# Seguimiento GPS desde Reportes Automáticos — Descubrimiento y Arquitectura (Fase 10A)

> **Estado: SOLO DISEÑO.** Ningún código, tabla, ruta ni configuración de Railway
> fue creado o modificado en esta fase. Este documento es el insumo para las
> fases de implementación 10B–10E.
>
> Convención de este documento: cada afirmación técnica está marcada como
> **[CONFIRMADO]** (verificado leyendo código real), **[INFERENCIA]**
> (deducido con alta confianza pero no verificado end-to-end, p. ej. porque
> requiere acceso a Supabase/Railway no disponible en este entorno), o
> **[FALTANTE]** (dato o capacidad que hoy no existe en el sistema).

---

## 1. Cómo funciona actualmente el GPS (Centro GPS / Centro de Monitoreo)

### 1.1 Fuente real de los datos GPS

**[CONFIRMADO]** No existe una tabla ni un proveedor GPS dedicado. Los datos
de posición vienen de **ControlT** (el TMS), específicamente del endpoint
`GET /Resume` (`https://app.controlt.com.co/apipublic/api/Resume`,
`index.js:364,1072` — función `syncViajes()`). Cada 60&nbsp;segundos
(`setInterval(syncViajes, 60_000)`, `index.js:5134`) el backend descarga
hasta 300 viajes activos (paginado, 3 páginas de 100), deduplica por
`trip_number`/`id_monitoring_order` y los guarda en memoria en
`cache.viajes.data` (`index.js:1210`). **No hay tabla Supabase de GPS ni
histórico de posiciones** — el estado GPS es siempre el último snapshot de
ControlT, nunca una traza.

Cada fila de `cache.viajes.data` ya trae los campos de posición
directamente del TMS: `latitude`, `longitude`, `latest_gps_report` (fecha
del último reporte GPS, formato MDY), `last_alarm_name`, `state_travel`.

### 1.2 Endpoint / API que expone estos datos al frontend

**[CONFIRMADO]** `GET /api/gps` (`index.js:1743`), protegido únicamente por
`requireInternalApiKey` (el mismo secreto compartido estático que protegen
las rutas de Reportes Automáticos — ver §7.4 sobre el modelo de seguridad
real de este middleware). El handler es una línea:

```js
app.get('/api/gps', requireInternalApiKey, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(transformarCentroGps(cache.viajes.data, { tripCustomerCache }));
});
```

`transformarCentroGps()` vive en `services/reportes/datasetProvider.js`
(Fase 9B) — **es la MISMA función que usa el generador de reportes
automáticos** para el dataset `centro_gps`. No hay dos implementaciones.

Filtra a `ESTADOS_MONITOREABLES = {'en transíto', 'iniciado', 'descargando',
'cargando', 'pernoctando'}` — es decir, **Centro GPS solo muestra vehículos
con un viaje ACTIVO en uno de esos estados**. Un viaje finalizado, cancelado
o que nunca llegó a ControlT no aparece, sin importar si tuvo GPS en algún
momento. Esta es la restricción más importante para el diseño de Fase 10:
**no hay traza histórica de GPS, solo snapshot de flota activa.**

El frontend (`erp/src/modules/gps/hooks/useGps.ts`) hace polling de este
endpoint cada 15&nbsp;segundos (`REFRESH_INTERVAL_MS = 15_000`). Como el
backend solo refresca su cache cada 60s, la cadencia real de datos nuevos es
de ~60s — el polling de 15s solo evita esperar hasta el próximo ciclo del
navegador, no trae datos más frescos que el backend.

### 1.3 Identificador real del vehículo

**[CONFIRMADO]** **No existe un identificador de vehículo independiente.**
No hay tabla `vehiculos` (existe `GET /catalogos/vehiculos` en
`index.js:3823`, pero es una lista estática de *tipos* de carrocería —
`['NHR','NKR','TURBO',...]` — no un maestro de vehículos con ID). El único
identificador estable y universal de un vehículo en todo el sistema es la
**placa (`license_plate`, string)**.

El campo `id` que usa el frontend de Centro GPS (`GpsRecord.id`,
`erp/src/modules/gps/types.ts:22`) **es igual a `trip_number`**, no a la
placa:

```ts
export interface GpsRecord {
  id: string;   // = trip_number
  ...
  license_plate: string | null;
  ...
}
```

Esto significa que la "identidad" que usa Centro GPS hoy es *viaje activo*,
no *vehículo*. Si dos viajes activos comparten placa (infrecuente pero
posible en un cambio de vehículo), aparecerían como dos filas distintas.

### 1.4 Cómo relaciona placa ↔ vehículo GPS

**[CONFIRMADO]** No hay relación — son el mismo campo. `license_plate` viene
tal cual del TMS en cada registro de `cache.viajes.data` y se propaga sin
transformación a `GpsRecord.license_plate`. No hay joins, no hay tabla
intermedia, no hay normalización de formato de placa.

### 1.5 Información disponible por vehículo

**[CONFIRMADO]** (`erp/src/modules/gps/types.ts`, `GpsInfoPanel.tsx`):

| Campo | Disponible | Fuente |
|---|---|---|
| Posición (lat/lon) | Sí | `latitude`/`longitude` (ControlT), parseadas a number |
| Estado GPS derivado | Sí | `estadoGps`: `activo\|detenido\|con_alarma\|panico\|desconectado` — calculado en `derivarEstadoGps()` a partir de antigüedad de `latest_gps_report` (umbrales: >2h detenido, >6h desconectado) y de `last_alarm_name` |
| Última actualización | Sí | `latest_gps_report` (fecha/hora del último reporte GPS del TMS) |
| Estado del viaje (TMS) | Sí | `state_travel` |
| Dirección textual | Sí | `current_address_location` |
| Alarma activa | Sí | `last_alarm_name` (incluye pánico) |
| Conductor | Sí | `driver_name` |
| Cliente | Sí | `razon_social` / `company_customer_name` |
| Origen/destino | Sí | `origin_city_name`/`destiny_city_name` |
| Manifiesto/remisión | Sí | `trip_number`/`number_order` |
| **Velocidad** | **[FALTANTE]** | No existe en `GpsRecord`, ni en `cache.viajes.data`, ni en ningún componente del módulo — verificado por búsqueda exhaustiva (`velocidad`/`speed`) en `erp/src/modules/gps`, `services/reportes` e `index.js`: cero resultados. ControlT `/Resume` no la expone (o no se está pidiendo). |
| Traza histórica de posiciones | **[FALTANTE]** | No se persiste ningún punto GPS — solo el último snapshot |

### 1.6 Selección de un vehículo — funcionamiento actual

**[CONFIRMADO]** `GpsPage.tsx` mantiene un `selectedId` (= `trip_number`) en
`useGps()`. Selección posible por:
- click en el mapa o en la lista (`onSelect`/`setSelectedId`);
- **una sola placa** vía navegación contextual: `selectByPlate(plate)`
  (usada cuando se navega desde otro módulo con
  `navPayload.licensePlate`);
- **un solo `trip_number`** vía `navPayload.tripNumber`.

`navActions.verGps(licensePlate, tripNumber, from)`
(`erp/src/core/navigation/navigationActions.ts:13`) es el único punto de
entrada de navegación contextual hacia Centro GPS (módulo `"mapa"`), y
**solo acepta una placa/viaje**, no una lista.

### 1.7 ¿Puede mostrar varios vehículos simultáneamente?

**[CONFIRMADO] Sí, es su modo normal.** `MapaPrincipal.tsx` (Leaflet +
`leaflet.markercluster`) renderiza **todos** los vehículos de
`filtrados` (el resultado de aplicar tab/cliente/búsqueda de texto sobre
`data`) como marcadores agrupados en cluster; el panel derecho
(`GpsInfoPanel`) muestra la ficha del vehículo seleccionado o, si no hay
selección, una lista de todos los `vehiculos` visibles. La tabla alterna
(`VehiculosTable.tsx`) es la misma vista en formato tabla.

**No existe hoy**, sin embargo, un filtro por **lista arbitraria de
placas** — solo tabs de estado (`activos/detenidos/alarmas/sin_señal`),
un combobox de cliente, y una búsqueda de texto libre de un solo término
(`useGps.ts:42-68`). Este es un vacío real que Fase 10B necesita cerrar
para el flujo interno (ver §3 y §6).

---

## 2. Cómo conectar reporte → vehículo GPS (por dataset)

**[CONFIRMADO]** Los 5 `tipo_reporte` de Reportes Automáticos
(`services/reportes/catalogoDatasets.js`) obtienen sus filas mediante
`obtenerDatasetCompleto()` (`services/reportes/datasetProvider.js`). El
campo placa **no depende de si está expuesto como columna seleccionable del
catálogo** — está presente en el objeto de fila (`registros`) que produce
`obtenerDatosReporte()` independientemente de qué columnas eligió el
usuario para el Excel/HTML, porque la selección de columnas solo afecta a
los *builders* (Excel/HTML), no a `registros` en sí (verificado leyendo
`excelBuilder.js`/`htmlBuilder.js`: ambos reciben `datos.registros`
completos y `datos.columnas` por separado, y solo proyectan columnas al
momento de escribir la celda).

| `tipo_reporte` | Campo placa en `registros` | ¿Es columna seleccionable hoy? | Identificador de viaje disponible |
|---|---|---|---|
| `viajes_activos` | `license_plate` | Sí (catálogo) | `trip_number` — **mismo esquema que ControlT/GPS**, viene del mismo `cache.viajes.data` |
| `centro_gps` | `license_plate` | Sí (catálogo) | `trip_number` — es literalmente el mismo dataset que `/api/gps` |
| `programacion` | `license_plate` | Sí (catálogo) | `trip_number` (de `planeados.trip_number`, usado internamente para cruzar con `viajesCache`) |
| `solicitudes` | `placa_asignada` | **No** — existe en el objeto de fila (`datasetProvider.js:199`) pero no está en `CATALOGO_DATASETS.solicitudes.campos` | `controlt_trip_number` (puede ser `null` si la solicitud aún no se despachó) |
| `viajes_finalizados` (cumplidos) | `license_plate` (mapeado de `cumplidos.placa`) | Sí (catálogo) | `trip_number` (mapeado de `cumplidos.id` — **[INFERENCIA]**: no se verificó si `cumplidos.id` coincide con el `trip_number` real de ControlT; el código existente ya lo trata así desde antes de esta fase, sin que ninguna auditoría previa (9B/9G) lo señalara como defecto, así que se asume intencional, pero no es un dato confirmado por fuera del código) |

**Conclusión — clave de correlación recomendada: `license_plate` / placa.**
Es el único campo presente, bajo un nombre u otro, en los 5 datasets. El
`trip_number`/`controlt_trip_number` es una correlación *más fuerte* cuando
existe (relaciona con el viaje ControlT exacto, no solo con la placa física
en general), pero:
- en `solicitudes`, puede ser `null` (solicitud sin despachar);
- en `viajes_finalizados`, su procedencia (`cumplidos.id`) no es
  100% verificable como el mismo `trip_number` de ControlT sin auditar el
  proceso de `syncCumplidos` (fuera del alcance de esta fase — **NO
  auditado aquí**, marcado como **[FALTANTE]** de verificación).

**Limitación estructural a comunicar en el producto**: dado que Centro GPS
(§1.2) solo muestra vehículos con viaje **activo** en un estado
monitoreable, un reporte de tipo `viajes_finalizados` o de `solicitudes`
con viajes ya completados **casi siempre resolverá 0 vehículos con GPS en
vivo** en el momento en que se abra el enlace. Esto no es un defecto de
Fase 10 — es una propiedad del sistema GPS actual (snapshot, no histórico)
y debe reflejarse como estado vacío explícito en ambas experiencias
(interna y externa), nunca como error.

---

## 3. Flujo técnico real: Reporte → registros → placas → vehículos GPS

```
reportes_automaticos (fila: tipo_reporte, filtros, columnas)
        │
        ▼
obtenerDatosReporte(reporte, deps)          [EXISTENTE — services/reportes/index.js, Fase 9B]
    ├─ obtenerDatasetCompleto()             [EXISTENTE — datasetProvider.js]
    ├─ aplicarFiltros()                     [EXISTENTE — filterEngine.js]
    ├─ resolverColumnas()                   [EXISTENTE — columnResolver.js]
    └─ ordenarPorFechaSeleccionada()        [EXISTENTE — ordenReporte.js, Fase 9H]
        │
        ▼
{ columnas, registros, metadata }            (registros = TODAS las filas que pasaron el filtro,
        │                                     con TODOS los campos del dataset, no solo columnas elegidas)
        ▼
extraerPlacas(registros, tipoReporte)        [NUEVO, Fase 10B — no existe hoy]
    · usa la tabla de la §2 (campo placa por tipoReporte)
    · dedup + descarta null/vacío
        │
        ▼
placas[]  (array de strings, ej. ["ABC123", "XYZ789"])
        │
        ├──────────────── INTERNO ─────────────────┐        ┌─────────── EXTERNO ────────────┐
        ▼                                           │        ▼                                │
navigateTo({modulo:"mapa",                          │  crear token (Fase 10C)                 │
  payload:{licensePlates: placas}})                 │    · random no predecible               │
  [NUEVO campo en NavPayload]                        │    · guarda placas[] congeladas         │
        │                                           │    · expira_en, revocado                │
        ▼                                           │        │                                │
GpsPage aplica filtro por lista de placas            │        ▼                                │
  [NUEVO en useGps.ts]                               │  enlace en el correo del reporte         │
        │                                           │  (construirCuerpoCorreo, envioManual.js)│
        ▼                                           │        │                                │
transformarCentroGps(cache.viajes.data, ...)        │        ▼                                │
  [EXISTENTE, SIN CAMBIOS — mismo /api/gps]          │  GET /api/gps-publico/:token [NUEVO]     │
        │                                           │    · valida token/expiración/revocado    │
        ▼                                           │    · llama transformarCentroGps()        │
Centro GPS (ERP), ya filtrado a esas placas         │      [EXISTENTE, REUSADO]                │
                                                     │    · filtra SERVER-SIDE a placas[] del   │
                                                     │      token antes de responder            │
                                                     │        │                                │
                                                     │        ▼                                │
                                                     │  Vista web pública Mobile First [NUEVO]  │
                                                     └──────────────────────────────────────────┘
```

**Punto de diseño crítico**: el filtrado a "vehículos de este reporte" pasa
por `transformarCentroGps()` en **ambos** flujos — nunca se reimplementa la
lógica de estado/posición GPS. Lo único nuevo es *a qué subconjunto de
placas* se le aplica.

---

## 4. Arquitectura recomendada

### 4.1 Decisión de diseño: ¿placas "congeladas" al envío, o recalculadas al click?

Se recomienda **congelar la lista de placas en el momento en que se genera
el enlace** (al enviar el reporte — manual o por scheduler), no
recalcularla cada vez que alguien abre el enlace. Motivos:

1. **Coincide con la semántica pedida**: "los vehículos incluidos en **ese**
   reporte" se refiere al envío concreto que recibió el destinatario, no a
   "lo que el filtro devolvería si se ejecutara hoy" (los datos operativos
   cambian constantemente — viajes se activan/finalizan).
2. **Seguridad más simple y verificable**: la autorización del token se
   reduce a "¿esta placa está en esta lista guardada?" — no depende de
   volver a ejecutar filtros de negocio en cada request público, lo que
   además evitaría exponer indirectamente el motor de filtros a tráfico no
   autenticado.
3. **No reintroduce "historial de ejecuciones"**: guardar únicamente
   `placas[]` (un array corto de strings) junto al token es una lista de
   control de acceso, no un histórico de resultados de reporte (que sigue
   explícitamente fuera de alcance, como en fases 9E–9G).

### 4.2 Componentes nuevos (a diseñar en detalle en 10B–10D, no implementados aquí)

- **`services/reportes/vehiculos.js`** (nuevo, mismo patrón que
  `ordenReporte.js`/`nombreArchivo.js`): mapa `tipoReporte → campo placa`
  (tabla de la §2) + `extraerPlacas(registros, tipoReporte)`. Puro, sin I/O
  — testeable igual que el resto del motor.
- **Tabla nueva en Supabase** (nombre propuesto, a confirmar en 10B):
  `reportes_gps_enlaces` — ver diseño completo en §5.
- **`services/gps/enlacesPublicos.js`** (nuevo): crear/validar/revocar
  token — capa de servicio equivalente a `services/reportes/envioManual.js`
  pero para el enlace, no para el envío.
- **`POST` interno de creación de enlace**: se dispara desde el mismo punto
  donde hoy se arma el correo (`envioManual.js#ejecutarReporteManual`, y el
  scheduler que lo reutiliza) — **no se modifica su lógica de generación
  Excel/HTML/envío**, solo se le agrega, como paso adicional opcional, la
  llamada a `extraerPlacas()` + creación de token + inserción del enlace en
  `construirCuerpoCorreo()`.
- **`GET /api/gps-publico/:token`** (nuevo, público, SIN
  `requireInternalApiKey`): valida el token y devuelve el snapshot GPS
  filtrado. Es la ÚNICA ruta nueva de backend que un usuario externo toca.
- **Vista web externa** (nueva, Mobile First) — ver §6.2. Decisión abierta
  (marcada como pendiente en §8): ¿vive dentro del mismo build de `erp/`
  como una ruta pública sin guard de auth, o es un mini-frontend
  independiente? Ver análisis de trade-offs en §7.3.
- **`GET /api/reportes-automaticos/:id/vehiculos`** (nuevo, interno,
  protegido con `requireInternalApiKey` — mismo mecanismo que las demás
  rutas del módulo): ejecuta `obtenerDatosReporte()` +
  `extraerPlacas()` y devuelve solo el array de placas. Es el endpoint que
  usa el botón "Seguimiento GPS" del ERP para saber a qué placas navegar
  internamente, sin tener que duplicar el pipeline en el frontend.

### 4.3 Nada de esto reemplaza `/api/gps`

`/api/gps` sigue siendo la única fuente de verdad para el estado GPS. El
enlace público y el filtro interno son, ambos, **capas delgadas de
autorización/filtrado alrededor de `transformarCentroGps()`**, no una
reimplementación paralela.

---

## 5. Diseño de seguridad del enlace externo

### 5.1 Forma del token

- **Aleatorio no predecible**: `crypto.randomBytes(32)` (256 bits),
  codificado `base64url` o `hex` — usa el módulo `crypto` de Node, ya
  importado en `index.js` (hoy solo para `randomUUID()`, usado en IDs de
  documentos — no para tokens de acceso). Un UUID v4 (122 bits de entropía)
  sería aceptable, pero un token dedicado de 256 bits es el estándar para
  enlaces tipo "capability" y evita cualquier ambigüedad de formato.
- El token **es el único secreto** — no debe derivarse de, ni incluir,
  `reporte_id` ni ningún ID de Supabase.

### 5.2 Relación token → reporte → vehículos permitidos

Tabla nueva (propuesta, **no creada**):

```
reportes_gps_enlaces
  id            uuid pk
  token         text unique not null      -- el secreto; index único
  reporte_id    uuid not null             -- referencia informativa/auditoría,
                                           -- NUNCA se usa para recalcular
                                           -- autorización en caliente
  placas        jsonb not null            -- array de strings, congelado al crear
  creado_en     timestamptz not null default now()
  expira_en     timestamptz not null      -- TTL obligatorio
  revocado      boolean not null default false
  origen        text                      -- 'manual' | 'scheduler', para auditoría
```

`reporte_id` se guarda por trazabilidad (saber de qué reporte salió el
enlace, para poder revocar todos los enlaces de un reporte si hace falta),
pero la autorización de cada request pública se resuelve **solo** contra
`placas` — nunca volviendo a ejecutar `obtenerDatosReporte()` con el
`reporte_id` en caliente. Esto es intencional: impide que un cambio
posterior en la configuración del reporte (filtros editados, Fase 9I) altere
retroactivamente qué placas puede ver un enlace ya emitido.

### 5.3 Expiración

- Campo `expira_en` obligatorio, validado server-side en cada request
  (`expira_en < now()` → 404/410, nunca un mensaje que confirme "el token
  existió pero venció" de forma distinguible de "no existe" — mismo
  criterio de no-filtración que ya usan las rutas protegidas existentes,
  que devuelven 404 genérico).
- TTL por defecto sugerido: 24–72h (a definir en 10B según el caso de uso
  real — un reporte diario probablemente necesita una ventana corta; uno
  para un cliente que hace seguimiento de una carga puntual, más larga).

### 5.4 Revocación

Dos mecánicas posibles, a decidir en 10B:
- **Soft** (`revocado = true`): conserva el registro para auditoría
  ("¿quién tuvo acceso, cuándo se cortó?"). Recomendado.
- **Hard delete**: más simple, consistente con el patrón ya usado para
  eliminar reportes (Fase 9I) — pierde el rastro de auditoría.

En ambos casos, revocar es una operación interna protegida por
`requireInternalApiKey` (mismo mecanismo que el resto del CRUD de
Reportes Automáticos) — nunca alcanzable desde la vista pública.

### 5.5 Impedir manipulación para acceder a vehículos fuera del reporte

- El filtrado a `placas[]` ocurre **en el backend**, dentro de
  `GET /api/gps-publico/:token`, nunca en el cliente. La respuesta JSON de
  ese endpoint jamás incluye vehículos fuera de la lista — no hay
  parámetro de query, body ni header que el cliente pueda usar para ampliar
  el conjunto.
- El token no es adivinable ni enumerable (256 bits aleatorios, columna
  `unique`, sin secuencia).
- No hay endpoint público que acepte una placa arbitraria o un
  `reporte_id` arbitrario — el único input público es el token de la URL.
- El endpoint público debe responder con **la misma forma/latencia** tanto
  para "token inválido" como para "token expirado" como para "token
  revocado", para no filtrar por qué falló (evita timing/enumeration
  attacks triviales). **[Riesgo a mitigar en 10B]**: sin rate limiting,
  nada impide fuerza bruta contra `/api/gps-publico/:token` — no existe hoy
  infraestructura de rate limiting en el backend (**[FALTANTE]**,
  verificado: no hay `express-rate-limit` ni equivalente en
  `package.json`/`index.js`). Con 256 bits de espacio de token esto es
  computacionalmente inviable igual, pero es una capa de defensa ausente
  que vale la pena señalar como riesgo, no como bloqueante.

### 5.6 Minimizar exposición de IDs sensibles

- La URL pública solo contiene el token — nunca `reporte_id`,
  `empresa_cliente_id`, `personal.id` ni ningún UUID interno.
- La respuesta de `GET /api/gps-publico/:token` debe proyectar **solo** los
  campos operativos necesarios (placa, conductor, posición, estado,
  última actualización, ciudad origen/destino) — nunca IDs internos
  (`trip_number` interno de ControlT es defendible mostrarlo como
  "manifiesto", ya que es un dato operativo visible también en el Excel del
  reporte, pero `empresa_cliente_id`/`id_monitoring_order`/etc. no deben
  viajar al cliente público). Esta proyección es una responsabilidad nueva
  del endpoint público, **no** de `transformarCentroGps()` (que sigue
  devolviendo el objeto completo para uso interno).

---

## 6. Diseño de experiencia

### 6.1 Interno → ERP / Centro GPS existente

No es una vista nueva. Es:
1. Un botón **"Seguimiento GPS"** en Reportes Automáticos (lista y/o panel
   lateral — mismo lugar que "Enviar ahora"/"Editar", Fase 9E/9I).
2. Al click, resuelve placas vía el nuevo
   `GET /api/reportes-automaticos/:id/vehiculos` (§4.2).
3. Navega a Centro GPS (`navActions`, módulo `"mapa"`) con un `NavPayload`
   extendido (`licensePlates: string[]`, campo nuevo — aditivo, no rompe los
   usos existentes de `licensePlate` singular).
4. `useGps.ts` necesita un filtro nuevo (`placasFiltro: Set<string> | null`)
   que, si está presente, restringe `filtrados` a esas placas — igual
   patrón que el filtro de cliente que ya existe (`clienteFiltro`).
5. Si el reporte no tiene ninguna placa resuelta (p. ej. reporte de
   `solicitudes` con puras solicitudes pendientes sin vehículo asignado), o
   ninguna de sus placas está actualmente en un viaje monitoreable, Centro
   GPS debe mostrar su estado vacío normal ("Sin vehículos para los filtros
   activos" — ya existe en `GpsInfoPanel.tsx:103-106`), no un error.

**Nada de Centro GPS se reimplementa.** El mapa, el cluster, la ficha de
vehículo, el estado GPS derivado: todo se reutiliza sin cambios.

### 6.2 Externo → vista independiente, Mobile First

Nueva superficie, **no** el mismo bundle del ERP (ver trade-off en §7.3).
Debe cubrir exactamente lo pedido:

| Requisito | Cómo se resuelve |
|---|---|
| Buscar por placa | Campo de búsqueda simple sobre el array ya acotado (pocas placas por reporte — no necesita ser tan sofisticado como el buscador de Centro GPS) |
| Seleccionar vehículo | Lista/tarjetas (Mobile First → lista vertical, no tabla) + mapa |
| Mapa GPS | Leaflet (ya es dependencia del proyecto, sin costo por request, sin API key — reutilizable tal cual la config de `MapaPrincipal.tsx`, sin el clustering si el volumen es bajo) |
| Estado | Mismo `estadoGps`/`ESTADO_GPS_CFG` (activo/detenido/con alarma/pánico/desconectado) — reutilizar las mismas etiquetas y colores para consistencia de marca, sin duplicar la lógica de cómputo (`derivarEstadoGps()` ya se ejecuta server-side en `transformarCentroGps()`) |
| Última actualización | `latest_gps_report`, mismo formato ya usado en `GpsInfoPanel` |
| Información operativa "estrictamente necesaria" | Placa, conductor, ciudad origen/destino, manifiesto — **sin** cliente/empresa (el destinatario externo probablemente ES el cliente, mostrar su propio nombre no aporta, y mostrar el de otro sería una fuga), sin IDs internos (§5.6) |
| Velocidad | **[FALTANTE]** — no disponible en ningún punto de la cadena (§1.5). Si el negocio lo requiere, es un requerimiento nuevo sobre ControlT, fuera del alcance de Fase 10 |

Al ser Mobile First y de un solo propósito (ver el estado de N vehículos de
un reporte), es un candidato natural para una página **pequeña,
autocontenida, sin el peso del ERP completo** (~979KB/254KB gzip hoy,
§7.3).

---

## 7. Componentes a reutilizar vs. nuevos

### 7.1 Se reutiliza tal cual (cero cambios)

- `transformarCentroGps()` / `derivarEstadoGps()` / `parseLatLon()`
  (`datasetProvider.js`) — el corazón del cómputo de estado GPS.
- `cache.viajes.data` y el ciclo `syncViajes()` (fuente de datos).
- `obtenerDatosReporte()` completo (Fase 9B–9H) — pipeline de
  dataset/filtros/columnas/orden de Reportes Automáticos.
- `ejecutarReporteManual()` / scheduler (Fase 9E/9F) — el envío en sí no
  cambia; solo se le agrega, como paso adicional, la creación opcional del
  enlace.
- `ESTADO_GPS_CFG`, `EstadoGpsBadge` (labels/colores) — para que la vista
  externa se vea consistente con el ERP.
- Leaflet como librería de mapa (ya es dependencia).
- El patrón de "signed/temporary link" ya usado para documentos de
  cumplidos (`sbStorageFetch(...,'POST',{expiresIn})`,
  `index.js:1702`) — mismo espíritu (enlace temporal, no adivinable), aunque
  técnicamente es la firma nativa de Supabase Storage y no aplica
  directamente a este caso (el recurso protegido aquí no es un archivo en
  Storage, sino un subconjunto de `/api/gps`).
- El patrón `requireInternalApiKey` para las rutas internas nuevas
  (`GET /api/reportes-automaticos/:id/vehiculos`).

### 7.2 Se extiende (cambio pequeño y aditivo sobre algo existente)

- `NavPayload` (`erp/src/core/navigation/types.ts`): agregar
  `licensePlates?: string[]`.
- `useGps.ts`: agregar filtro por lista de placas.
- `construirCuerpoCorreo()` (`envioManual.js`): agregar, condicionalmente,
  un botón/enlace "Ver seguimiento GPS" cuando el envío generó un token.

### 7.3 Es nuevo (no existe nada parecido hoy)

- Tabla `reportes_gps_enlaces` (o el nombre que se defina en 10B).
- Módulo de creación/validación/revocación de tokens.
- Ruta pública `GET /api/gps-publico/:token`.
- Ruta interna `GET /api/reportes-automaticos/:id/vehiculos`.
- La vista web externa en sí (Mobile First). **Decisión pendiente para
  10B**: ¿ruta pública dentro del mismo `erp/` (Vite) sin guard de auth, o
  un segundo mini-frontend separado?
  - *Dentro de `erp/`*: despliegue más simple (un solo build, un solo
    Railway service), pero el usuario externo descarga el bundle completo
    del ERP (~254KB gzip hoy y creciendo) para ver una página con 3 datos —
    mal para Mobile First / redes móviles, y aumenta la superficie de lo
    que un visitante no autenticado puede llegar a tocar (rutas del router
    del ERP, aunque no tenga sesión).
  - *Mini-frontend separado*: mejor rendimiento móvil, aislamiento real
    (el visitante externo nunca carga una sola línea del código del ERP
    autenticado), pero es un segundo deployable — nuevo build, nueva
    configuración de Railway (dominio o servicio adicional), más superficie
    operativa.
  - No se toma la decisión en esta fase (violaría "NO implementar" y
    excede el alcance de auditoría); se dimensiona el trade-off para que
    10B la resuelva con el usuario.

---

## 8. Riesgos

1. **Snapshot, no histórico**: la mayoría de los reportes de tipo
   `viajes_finalizados` (y buena parte de `solicitudes`/`programacion` con
   viajes ya cerrados) resolverán 0 vehículos con GPS en vivo. Riesgo de
   percepción ("el enlace no funciona") si no se comunica bien en la UI
   — mitigación: mensaje explícito, no solo un mapa vacío.
2. **`solicitudes` sin placa**: registros con `placa_asignada = null`
   (solicitud sin despachar) no producen ninguna placa — un reporte de
   puras solicitudes pendientes puede no tener NADA que enlazar. Mitigar
   con mensaje claro, no ocultando el botón silenciosamente sin explicar
   por qué.
3. **`cumplidos.id` como `trip_number`**: no se verificó en esta fase si
   coincide siempre con el `trip_number` real de ControlT — si no coincide,
   la correlación por `trip_number` en `viajes_finalizados` sería
   inválida (la correlación por `license_plate`, que sí está verificada,
   no se ve afectada). Se recomienda auditar `syncCumplidos` en 10B antes
   de depender de ese campo para algo más que trazabilidad.
4. **Enlace público = credencial portátil**: cualquiera con el token
   (reenviado, filtrado por correo comprometido, etc.) tiene acceso hasta
   que expire o se revoque. Mitigado por expiración + revocación (§5), pero
   sigue siendo, por diseño, un "quien tiene el link, entra" — igual que
   cualquier enlace firmado de Storage ya usado en el sistema.
5. **Sin rate limiting** en el backend hoy (§5.5) — no es explotable de
   forma realista contra 256 bits de entropía, pero es una capa de defensa
   ausente en general, no solo para este endpoint.
6. **Bundle del ERP no pensado para tráfico público** si se opta por
   alojar la vista externa dentro de `erp/` (§7.3) — impacto en
   performance móvil y en superficie de exposición.
7. **`requireInternalApiKey` es un secreto compartido estático**, no
   autenticación por usuario (confirmado leyendo
   `erp/src/services/http.ts`: se manda como header fijo en cada request
   del frontend, embebido en el bundle vía `VITE_INTERNAL_API_KEY`). Esto
   ya es así hoy para *todas* las rutas internas (`/api/gps` incluido) —
   Fase 10 no lo empeora, pero tampoco puede heredarlo para la ruta
   pública: el enlace externo necesita su propio mecanismo de autorización
   (el token), nunca la clave interna.
8. **`personal_ids` como destinatarios internos también reciben el
   correo con el enlace** si el reporte los incluye — si el diseño final
   decide generar el enlace para *todo* destinatario (interno y externo)
   en lugar de distinguir por tipo de destinatario, un miembro de INLOP con
   acceso al ERP recibiría igualmente un enlace "externo" — no es un
   problema de seguridad (el enlace solo expone lo que ya vería en el
   Excel adjunto), pero es una decisión de producto a definir en 10B: ¿el
   botón/enlace de seguimiento se genera siempre, o solo si el reporte
   tiene destinatarios externos?

---

## 9. Propuesta concreta de fases 10B–10E

- **Fase 10B — Diseño detallado y decisiones de cierre.** Mismo patrón que
  9A: cerrar las decisiones abiertas de este documento (TTL por defecto,
  soft vs. hard revoke, ubicación del mini-frontend externo, si el enlace
  se genera siempre o solo con destinatarios externos, nombre final de la
  tabla) antes de tocar código. Sin implementación.
- **Fase 10C — Backend: extracción de placas + tabla + tokens.**
  `services/reportes/vehiculos.js`, migración de la tabla nueva,
  `services/gps/enlacesPublicos.js`, `GET /api/gps-publico/:token`,
  `GET /api/reportes-automaticos/:id/vehiculos`. Sin tocar
  `ejecutarReporteManual()` más que para invocar la creación de enlace
  como paso adicional opcional.
- **Fase 10D — Frontend interno + vista externa.** Botón "Seguimiento GPS"
  en Reportes Automáticos, extensión de `NavPayload`/`useGps.ts`, y
  construcción de la vista pública Mobile First (según la decisión de 10B
  sobre dónde vive).
- **Fase 10E — Integración de correo + Railway + auditoría
  pre-producción.** Insertar el enlace en `construirCuerpoCorreo()`,
  configurar lo que Railway requiera (nuevo servicio o variable de entorno
  para el dominio público / TTL por defecto), y una auditoría final
  end-to-end al estilo Fase 9G antes de producción.
