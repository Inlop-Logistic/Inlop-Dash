# AUDITORÍA DE IMPACTO — MODELO DE DATOS DEL VIAJE

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Estado:** AUDITORÍA — sin modificaciones de código ni SQL  
**Propósito:** Evaluar el impacto real de dos alternativas arquitectónicas antes de tocar el modelo físico  

---

## 1. Tablas que Representan el Ciclo de Vida del Viaje Hoy

El ciclo de vida completo de un viaje en el ERP involucra tres tablas y un caché en memoria. Cada una viene de una fuente distinta y cubre una perspectiva distinta del mismo viaje físico.

### 1.1 `planeados` — Vista de Programación

| Campo clave | Tipo | Descripción |
|---|---|---|
| `trip_number` | TEXT PK | Identificador del viaje en ControlT |
| `license_plate` | TEXT | Placa del vehículo |
| `driver_name` | TEXT | Nombre del conductor |
| `company_customer_name` | TEXT | Nombre de cliente crudo (TMS) |
| `city_origin` / `city_destination` | TEXT | Ciudades |
| `schedulate_origin` | TEXT | Fecha programada (formato TMS crudo) |
| `fecha_programada_dia` | DATE | Fecha extraída a zona Colombia |
| `activo_en_resume` | BOOLEAN | Si el viaje está actualmente en Resume |
| `estado_programacion` | TEXT | programado / asignado / en_ruta / sin_asignar / completado / cancelado |
| `observaciones` | TEXT | Notas del operador |
| `empresa_cliente_id` | UUID FK | Propagada desde solicitudes vía `propagarEmpresaId()` |

**Fuente primaria:** ControlT `/Programmation` endpoint (syncPlaneados, cada 5 min)  
**Ciclo de vida:** 7 días de retención. Nace cuando ControlT programa un viaje futuro. Puede desaparecer sin que el viaje llegue a activarse.

### 1.2 `cumplidos` — Vista Operacional

| Campo clave | Tipo | Descripción |
|---|---|---|
| `id` | TEXT PK | = trip_number de ControlT |
| `manifiesto` | TEXT | Número de orden (number_order de ControlT) |
| `placa` | TEXT | Placa del vehículo |
| `conductor` | TEXT | Nombre del conductor |
| `conductor_tel` | TEXT | Teléfono extraído de driver_phone/full_driver |
| `cliente` | TEXT | Nombre de cliente crudo (primer segmento) |
| `empresa_cliente_id` | UUID FK | Resuelto por `resolveTrip()` en syncCumplidos |
| `estado_controlt` | TEXT | Estado literal de ControlT (state_travel) |
| `estado_cumplido` | TEXT | LIVE / SOLICITADO / CUMPLIDO RECIBIDO / FINALIZADO CONTROLT / PENDIENTE LIQUIDACION |
| `pct` | NUMERIC | Porcentaje de avance del viaje |
| `fecha_viaje` | TEXT | activated_on (cuando el viaje se activó) |
| `fecha_finalizacion` | TIMESTAMPTZ | Cuando desapareció del snapshot de Resume |
| `tipo_negocio` | TEXT | type_operation |
| `tiene_soporte` | BOOLEAN | Si hay documentos en Storage |
| `obs` | TEXT | Observaciones internas |
| `link_soporte` | TEXT | URL de soporte adicional |
| `origen` / `destino` | TEXT | Ciudades |

**Fuente primaria:** ControlT `/Resume` endpoint (syncCumplidos, cada 60 s)  
**Ciclo de vida:** Nace con `estado_cumplido = 'LIVE'` en el momento en que el viaje aparece en el snapshot de Resume. Persiste indefinidamente. Recibe `fecha_finalizacion` cuando el viaje desaparece del snapshot.

**Observación crítica:** A pesar de su nombre, `cumplidos` no es solo la vista de viajes terminados — es el registro operacional completo desde que el viaje aparece en ControlT hasta que se cierra documentalmente.

### 1.3 `solicitudes` — Vista de Demanda

| Campo clave | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador interno de la solicitud |
| `codigo_solicitud` | TEXT | SOL-XXXXX |
| `controlt_trip_number` | TEXT NULL | FK informal hacia trip_number de ControlT |
| `empresa_cliente_id` | UUID FK | Empresa del cliente que solicitó |
| `estado` | TEXT | pendiente / confirmado / en_ruta / completado / cancelado |
| `estado_controlt` | TEXT | Espejo del estado de ControlT |
| `placa_asignada` | TEXT | Copiada de ControlT al confirmar el viaje |
| `conductor_nombre` | TEXT | Copiado de ControlT al confirmar |
| `conductor_tel` | TEXT | Extraído de ControlT |
| `manifiesto` | TEXT | number_order de ControlT |
| `pct` | NUMERIC | Porcentaje de avance |
| `fecha_confirmacion` | TIMESTAMPTZ | Cuando INLOP confirmó la solicitud |
| `fecha_inicio_real` | TIMESTAMPTZ | Cuando el viaje pasó a en_ruta |
| `fecha_fin_real` | TIMESTAMPTZ | Cuando el viaje completó |
| `fecha_cancelacion` | TIMESTAMPTZ | Si fue cancelada |
| `external_ref` | TEXT | Referencia del cliente en su propio sistema |
| `origen` / `destino` | TEXT | Declarados por el cliente al solicitar |
| `observacion_coordinadora` | TEXT | Notas internas |
| `canal` | TEXT | APP / EMAIL / etc. |

**Fuente primaria:** Portal Cliente / ERP interno (creadas por el usuario)  
**Ciclo de vida:** Nace cuando el cliente registra una solicitud. Se vincula a ControlT a través de `controlt_trip_number` cuando syncSolicitudes encuentra un match. No se elimina — permanece como registro histórico.

### 1.4 `cache.viajes` — Caché en Memoria (no persiste en Supabase)

Snapshot del endpoint `/Resume` de ControlT, renovado cada 60 s. Contiene datos efímeros:

- `latitude` / `longitude` — posición GPS actual
- `latest_gps_report` — timestamp del último reporte GPS
- `current_address_location` — dirección textual actual
- `last_alarm_name` — última alarma registrada
- `state_travel` — estado literal de ControlT en este instante

**No se persiste** en Supabase. Sirve como fuente de verdad solo mientras el viaje está activo.

### 1.5 Por Qué `planeados` y `cumplidos` Son Fuentes Distintas (No Duplicadas)

Este punto es crítico para la evaluación de alternativas:

| | `planeados` | `cumplidos` |
|---|---|---|
| Fuente ControlT | `/Programmation` | `/Resume` |
| ¿Cuándo nace la fila? | Al programar el viaje (futuro) | Al activarse el viaje (presente) |
| ¿Puede existir sin el otro? | Sí — viajes programados que no se activan | Sí — viajes sin programación previa |
| Retención | 7 días | Indefinida |
| Propósito | Planificación operativa | Historial operacional |

Un viaje puede existir en `planeados` sin tener registro en `cumplidos` (programado pero no iniciado). También puede existir en `cumplidos` sin `planeados` si surgió directamente en el Resume sin pasar por la programación.

---

## 2. Qué Tablas Consume Cada Sistema

### 2.1 INLOP Dash (ERP Interno)

| Módulo / Endpoint | Tablas leídas | Tablas escritas |
|---|---|---|
| `GET /api/viajes` | `cache.viajes` (memoria) | — |
| `GET /api/cumplidos` | `cumplidos` | — |
| `PATCH /api/cumplidos/:trip/estado` | — | `cumplidos` |
| `GET/POST /api/cumplidos/:trip/documentos` | — | Storage + `cumplidos` (tiene_soporte) |
| `GET /api/planeados` | `planeados` | — |
| `GET /api/programacion` | `planeados`, `empresas_cliente`, `cache.viajes` | — |
| `GET /api/programacion/:id` | `planeados` | — |
| `PATCH /api/programacion/:id/estado` | — | `planeados` |
| `PATCH /api/programacion/:id/observaciones` | — | `planeados` |
| `POST /api/programacion/:id/sync` | `planeados`, `cache.viajes` | `planeados` |
| `GET /api/programacion/:id/solicitud` | `solicitudes`, `empresas_cliente`, `agencias_cliente`, `usuarios_cliente` | — |
| `GET /api/solicitudes` | `solicitudes`, `empresas_cliente`, `agencias_cliente`, `usuarios_cliente` | — |
| `GET /api/solicitudes/:id` | `solicitudes`, `cumplidos`, `planeados`, `empresas_cliente` | — |
| `PATCH /api/solicitudes/:id/estado` | — | `solicitudes` |
| `GET /api/gps` | `cache.viajes` (memoria) | — |
| `GET /api/clientes` | `empresas_cliente`, `clientes_info_general`, `clientes_relaciones_comerciales` | — |
| `GET /api/clientes/:id` | + `clientes_info_tributaria` | — |
| `POST/PATCH /api/clientes/:id` | — | todas las tablas maestro |
| `syncViajes` | — | `cache.viajes` (memoria) |
| `syncCumplidos` | `cache.viajes`, `empresas_cliente`, `cumplidos` | `cumplidos`, `planeados` |
| `syncPlaneados` | ControlT `/Programmation`, `planeados`, `cache.viajes` | `planeados` |
| `syncSolicitudes` | `solicitudes`, `cache.viajes`, `cumplidos` | `solicitudes`, `notificaciones_cliente` |
| `propagarEmpresaId()` | — | `planeados` + `cumplidos` (simultáneo) |

### 2.2 Portal Cliente

| Endpoint | Tablas leídas | Tablas escritas |
|---|---|---|
| `GET /servicios` | `solicitudes`, `cumplidos`, `cache.viajes` | — |
| `GET /servicios/:id` | `solicitudes`, `cumplidos`, `cache.viajes` | — |
| `GET /servicios/:id/paradas` | `solicitudes` | — |
| `GET /servicios/:id/vehiculo` | `solicitudes`, `cache.viajes` | — |
| `POST /servicios` | — | `solicitudes` |
| `PATCH /servicios/:id` | `solicitudes` | `solicitudes` |
| `POST /servicios/:id/cancelar` | `solicitudes` | `solicitudes` |
| `GET /notificaciones` | `notificaciones_cliente`, `solicitudes` | — |
| `PATCH /notificaciones/:id/leer` | — | `notificaciones_cliente` |
| `GET/POST /push/suscripcion` | — | `push_subscriptions` |
| `GET /preferencias/notificaciones` | `notification_preferences` | — |
| `PUT /preferencias/notificaciones` | — | `notification_preferences` |
| `GET /usuarios` | `usuarios_cliente`, `agencias_cliente`, `usuario_agencias` | — |
| `POST/PATCH/DELETE /usuarios/:id` | `usuarios_cliente` | `usuarios_cliente`, `usuario_agencias` |
| `GET/POST/PATCH/DELETE /agencias` | `agencias_cliente`, `usuario_agencias`, `usuarios_cliente` | `agencias_cliente` |

**El Portal Cliente consume `cumplidos` en dos lugares críticos:**
1. `GET /servicios` — fallback para trip_numbers que no están en `cache.viajes`
2. `GET /servicios/:id` — misma lógica de fallback
3. `syncSolicitudes → pendVerif` — determina si una solicitud puede cerrarse consultando `cumplidos.estado_cumplido = 'FINALIZADO CONTROLT'`

### 2.3 Torre de Control (TorreControl.html — Legado)

| Endpoint | Tablas leídas | Tablas escritas |
|---|---|---|
| `GET /api/data` | `cache.viajes` (memoria) | — |
| `GET /api/alarmas` | `cache.alarmas` (memoria) | — |
| `GET /api/pendientes` | `cache.viajes`, `cache.pendientes` (memoria) | — |
| `GET /api/solicitudes` | `solicitudes`, `empresas_cliente`, `agencias_cliente`, `usuarios_cliente` | — |
| `PATCH /api/solicitudes/:id/estado` | — | `solicitudes` |

**La Torre de Control legada NO lee ni escribe `cumplidos` ni `planeados` directamente.** Solo consume el caché en memoria y `solicitudes`.

### 2.4 APIs Internas (diagnóstico SOAP)

| Endpoint | Tablas leídas | Tablas escritas |
|---|---|---|
| `GET /api/controlt/*` (controltDiag.js) | `controlt_soap_audit` (si existe) | `controlt_soap_audit` |

---

## 3. Dependencias que Rompería Crear una Nueva Tabla `viajes`

Crear una nueva tabla `viajes` como entidad canónica y deprecar `cumplidos` + `planeados` implicaría modificar los siguientes puntos de código activos:

### 3.1 Funciones de Sync (escritura masiva)

| Función | Cambio requerido |
|---|---|
| `syncCumplidos()` (líneas ~1664–1826) | Redirigir upserts de `cumplidos` a `viajes`; adaptar lógica de estados |
| `syncPlaneados()` (líneas ~700–955) | Redirigir upserts de `planeados` a `viajes`; fusionar campos de programación |
| `syncSolicitudes()` (líneas ~1829–2079) | Cambiar consulta `pendVerif` de `cumplidos` a `viajes`; adaptar campos |
| `propagarEmpresaId()` (líneas ~2082–2092) | Una sola escritura en `viajes` en vez de dos paralelas |

### 3.2 Endpoints de Lectura ERP

| Endpoint | Cambio requerido |
|---|---|
| `GET /api/cumplidos` (línea 1227) | Cambiar fuente a `viajes` con filtro de estado |
| `PATCH /api/cumplidos/:trip/estado` (línea 1370) | Cambiar destino a `viajes` |
| `POST /api/cumplidos/:trip/documentos` (línea 1310) | Cambiar `cumplidos.tiene_soporte` a `viajes.tiene_soporte` |
| `GET /api/planeados` (línea 3357) | Cambiar fuente a `viajes` |
| `GET /api/programacion` (línea 3383) | Cambiar fuente de `planeados` a `viajes`; adaptar campos de programación |
| `GET /api/programacion/:id` (línea 3513) | Cambiar fuente a `viajes` |
| `PATCH /api/programacion/:id/estado` (línea 3527) | Cambiar destino a `viajes` |
| `PATCH /api/programacion/:id/observaciones` (línea 3551) | Cambiar destino a `viajes` |
| `POST /api/programacion/:id/sync` (línea 3571) | Cambiar destino a `viajes` |
| `GET /api/solicitudes/:id` (línea 1499) | Cambiar join con `cumplidos` a `viajes` |

### 3.3 Endpoints del Portal Cliente

| Endpoint | Cambio requerido |
|---|---|
| `GET /servicios` (línea 2902) | Cambiar consulta de `cumplidos` a `viajes` como fallback |
| `GET /servicios/:id` (línea 2954) | Mismo cambio |

### 3.4 Lógicas de Reconciliación

La reconciliación en `syncCumplidos` (revertir `fecha_finalizacion → null`) y la cross-write a `planeados` (`estado_programacion = 'completado'`) tendrían que fusionarse en una lógica unificada sobre `viajes`. Son ~60 líneas de lógica de negocio delicada (líneas 1749–1816).

### 3.5 Conteo Total de Puntos de Cambio

| Categoría | Cantidad estimada de touch points |
|---|---|
| Funciones de sync (escritura masiva) | 4 funciones |
| Endpoints ERP | 10 endpoints |
| Endpoints Portal Cliente | 2 endpoints |
| Funciones utilitarias (`mapSolicitud`, etc.) | 2–3 funciones |
| **Total** | **~19 puntos de cambio** en un único archivo de 4.315 líneas |

Todos estos cambios deben ser coordinados y desplegados juntos — ninguno puede hacerse de forma incremental sin mantener una capa de compatibilidad.

---

## 4. ¿Es Posible Enriquecer una Tabla Existente?

Sí. Hay dos candidatas:

### 4.1 Opción de enriquecer: `cumplidos`

`cumplidos` ya es, en la práctica, el registro operacional canónico del viaje:
- Nace cuando el viaje aparece en Resume (estado `LIVE`) — no cuando termina.
- Persiste indefinidamente, a diferencia de `planeados` (retención 7 días).
- Tiene `trip_number` como PK — la misma clave de reconciliación que todo el sistema usa.
- Ya acumula los datos más relevantes: placa, conductor, cliente, estado, pct, fechas.

Los campos que le faltan para ser el registro completo son exactamente los que el SOAP aporta:
- `paradas` JSONB (con productos anidados)
- `conductor_cedula`
- `tipo_operacion_codigo`, `tipo_viaje_codigo`, `tipo_carga_codigo`
- `valor_mercancia`, `valor_flete`, `peso_total_ton`, `volumen_total`
- `temperatura_min`, `temperatura_max`
- `instrucciones`
- `fecha_evento`
- `estado_viaje` (derivado de paradas, enum INLOP)
- `sincronizado_en` (timestamp de última sincronización SOAP)

Todos estos son columnas **nullable** y **aditivas** — no rompen ningún contrato existente.

### 4.2 Opción de enriquecer: `solicitudes`

**Descartada para este propósito.** `solicitudes` representa la demanda logística, no el viaje operacional:
- No toda solicitud tiene viaje asignado (`controlt_trip_number` es nullable).
- No todo viaje tiene solicitud asociada (viajes que ControlT crea directamente).
- Su PK es UUID, no el trip_number — complicaría la reconciliación con ControlT.
- Ya contiene campos como `placa_asignada`, `conductor_nombre` que son copias del estado del viaje, no la fuente original.

---

## 5. Comparación de Alternativas

### Alternativa A — Nueva Tabla `viajes`

**Descripción:** Crear una tabla `viajes` como entidad canónica. Deprecar `cumplidos` y `planeados` progresivamente. Formalizar la FK `solicitudes.controlt_trip_number → viajes.trip_number`.

#### Impacto técnico

- Requiere diseñar un esquema que fusione los campos de `planeados`, `cumplidos` y los campos SOAP nuevos.
- Los sync jobs deben reescribirse para apuntar a una sola tabla.
- La lógica de reconciliación (`sincCumplidos` ↔ `planeados`) debe refactorizarse.
- La lógica de programación (`estado_programacion`) convive en la misma tabla que el historial operacional — requiere un campo discriminador claro.
- Los ~19 puntos de cambio identificados en §3 deben implementarse coordinadamente.
- La migración de datos (de `cumplidos` + `planeados` actuales a `viajes`) debe ejecutarse con upsert por `trip_number` sin pérdida de datos en producción.

#### Compatibilidad hacia atrás

- **Ruptura total** de las interfaces internas en el momento de migración.
- Requiere feature flag o despliegue big-bang: no se puede hacer de forma incremental sin una capa de compatibilidad que temporalmente escriba en ambos lados.
- El nombre de tabla `viajes` en las URLs de Supabase REST (`/rest/v1/viajes`) cambia todos los paths de sbFetch.

#### Riesgo

| Riesgo | Severidad | Probabilidad |
|---|---|---|
| `syncCumplidos` y `syncPlaneados` escritos simultáneamente en tablas distintas durante transición | Alto | Alta |
| Pérdida de datos históricos en `cumplidos` si la migración no es atómica | Alto | Media |
| Regresiones en `GET /servicios` (Portal Cliente) si el fallback no funciona correctamente con `viajes` | Alto | Media |
| `estado_programacion` (de planeados) y `estado_cumplido` (de cumplidos) colisionan en un solo registro | Medio | Alta |
| La lógica de reconciliación (reversión de `fecha_finalizacion`) introduce bugs al fusionarse | Alto | Media |

**Riesgo global: ALTO**

#### Complejidad de migración

- Alta. Requiere un plan de migración en fases con período de escritura dual.
- Necesita tests de regresión exhaustivos para los sync jobs y los ~10 endpoints ERP que cambian.
- Estimación: 3–5 sprints de trabajo para ejecutarlo de forma segura.

#### Beneficio a largo plazo

- Alto. Un único lugar para buscar cualquier dato de viaje.
- FK formal entre `solicitudes` y `viajes` con integridad referencial real.
- Consultas más simples: sin joins multi-tabla para ensamblar la vista de un viaje.
- Habilitaría capacidades nuevas: consultas sobre paradas retrasadas, temperatura fuera de rango, historial completo en una sola query.
- Elimina la función `mapSolicitud()` con su cascada de resolución.

---

### Alternativa B — Enriquecer el Modelo Existente

**Descripción:** Agregar las columnas SOAP a la tabla `cumplidos` (ya existente, con toda la infraestructura de sync funcionando). `persistenceLayer.js` apunta a `cumplidos` en lugar de la propuesta `controlt_viajes`. No se crea ninguna tabla nueva.

#### Impacto técnico

- Mínimo. Se agregan columnas nullable a `cumplidos`: `paradas JSONB`, `conductor_cedula`, `tipo_operacion_codigo`, etc.
- `persistenceLayer.js` cambia solo el valor de la constante `TABLE` (de `controlt_viajes` a `cumplidos`) y el `PATH`.
- Los sync jobs `syncCumplidos` y `syncPlaneados` no cambian.
- Todos los endpoints existentes siguen funcionando sin modificación.
- La resolución en cascada (`viaje_cache || solicitud || cumplido`) en `mapSolicitud()` continúa funcionando — ahora `cumplido` también tiene los campos SOAP.

#### Compatibilidad hacia atrás

- **Totalmente compatible.** Agregar columnas nullable es una operación aditiva.
- Todos los endpoints existentes siguen respondiendo los mismos campos que hoy.
- Los nuevos campos SOAP aparecen disponibles opcionalmente cuando se sincronicen.
- Sin cambios en las URLs de Supabase REST usadas por los endpoints.

#### Riesgo

| Riesgo | Severidad | Probabilidad |
|---|---|---|
| Columna con nombre en conflicto (ej. `conductor` en cumplidos vs `conductor_cedula` nuevo) | Bajo | Baja — nombres distintos |
| El nombre `cumplidos` es semánticamente incorrecto para el nuevo rol de la tabla | Bajo | Alta (pero no es un bug) |
| Un futuro desarrollador confunde los campos de origen Resume con los de origen SOAP | Bajo | Media — comentarios en schema lo previenen |
| La tabla `planeados` sigue siendo una tabla separada, no unificada | Medio | Cierta — el modelo no queda completamente consolidado |

**Riesgo global: BAJO**

#### Complejidad de migración

- Muy baja. Un `ALTER TABLE cumplidos ADD COLUMN` por cada campo SOAP nuevo (operación online en PostgreSQL).
- La migración propuesta `20260801000000_controlt_viajes.sql` simplemente no se ejecuta.
- `persistenceLayer.js` cambia 2 líneas de código.
- No hay migración de datos.

#### Beneficio a largo plazo

- Medio. Los campos SOAP quedan en `cumplidos`, que es el registro más completo del viaje.
- Los consumers existentes pueden acceder a paradas, temperatura, etc. a través de la misma tabla que ya conocen.
- No resuelve completamente la fragmentación con `planeados` (que sigue siendo una tabla separada con distinto propósito y distinto origen de datos).
- La deuda semántica del nombre `cumplidos` permanece, pero es cosmética y no funcional.

---

## 6. Tabla Comparativa

| Dimensión | A — Nueva tabla `viajes` | B — Enriquecer `cumplidos` |
|---|---|---|
| Impacto técnico | Alto (~19 touch points) | Mínimo (2 líneas + ALTER TABLE) |
| Compatibilidad hacia atrás | Ruptura total | Compatible al 100% |
| Riesgo | Alto | Bajo |
| Complejidad de migración | Alta (3–5 sprints) | Muy baja (1 sprint) |
| Beneficio a largo plazo | Alto — modelo canónico limpio | Medio — unifica SOAP pero no elimina `planeados` |
| ¿Elimina `cumplidos`? | Sí (eventualmente) | No — la enriquece |
| ¿Elimina `planeados`? | Sí (eventualmente) | No — sigue siendo tabla separada |
| ¿Unifica la vista del viaje? | Sí — completamente | Parcialmente — SOAP va a `cumplidos`, programación sigue en `planeados` |
| ¿Formaliza FK con `solicitudes`? | Sí | No (continúa sin FK formal) |

---

## 7. Observaciones de la Auditoría

Estas son conclusiones factuales derivadas de la lectura del código, sin valor prescriptivo:

### 7.1 `cumplidos` y `planeados` vienen de endpoints distintos de ControlT

No son duplicados del mismo dato. `planeados` nace del endpoint `/Programmation` (programación futura) y `cumplidos` nace del endpoint `/Resume` (viajes en ejecución). Un viaje puede existir en uno sin existir en el otro.

### 7.2 `cumplidos` ya es el registro de vida completa del viaje

El estado `LIVE` en `cumplidos` existe desde que el viaje aparece en Resume. La tabla no es un registro de viajes finalizados — es un registro de viajes activos e históricos.

### 7.3 `propagarEmpresaId()` acopla `cumplidos` con `planeados`

Esta función escribe `empresa_cliente_id` en ambas tablas simultáneamente. Es el punto de mayor acoplamiento horizontal entre las dos tablas y el punto donde más claramente se ve que "son el mismo viaje visto desde dos ángulos".

### 7.4 La resolución en cascada de `mapSolicitud()` es el síntoma, no la causa

```
placa: viaje_cache?.license_plate || solicitud.placa_asignada || cumplido?.placa
```

Esta cascada existe porque los tres sistemas tienen los datos disponibles en momentos distintos del ciclo de vida. No es solo un problema de diseño de tabla — es un problema de cuándo el dato está disponible en cada fuente.

### 7.5 `solicitudes.controlt_trip_number` no es siempre sinónimo de viaje

La relación `solicitudes → viaje` es 1:1 opcional en ambas direcciones:
- Una solicitud puede no tener viaje asignado (`controlt_trip_number IS NULL`).
- Un viaje puede no tener solicitud asociada (viajes directos en ControlT).
- La cardinalidad real es N:M potencial — una solicitud podría reasignarse a un viaje distinto si el primer viaje se cancela.

### 7.6 El mayor costo de la Alternativa A no es el código

El mayor costo es la **lógica de reconciliación en `syncCumplidos`** (líneas 1749–1816). Esta lógica maneja casos como: "viaje que reapareció en Resume tras marcarse como finalizado". Esa lógica tendría que trasladarse a `viajes` de forma exactamente equivalente — cualquier omisión o desviación produce finalizaciones prematuras o no-finalizaciones reales en producción.

### 7.7 `planeados` tiene retención de 7 días; `cumplidos` no tiene retención

Si se fusionan en una sola tabla `viajes`, se necesita decidir una política de retención para los registros de programación que nunca se activaron.

---

## 8. Recomendación Fundamentada

### 8.1 Premisa

El objetivo declarado es que ControlT enriquezca el Viaje existente del ERP, sin crear una segunda entidad paralela. El documento anterior (`ARQUITECTURA_DATOS_VIAJE.md`) propuso una tabla `viajes` nueva. Esta auditoría muestra que el costo de esa propuesta es considerablemente mayor al estimado.

### 8.2 Recomendación para la integración SOAP (Fase 4)

**Implementar la Alternativa B: enriquecer `cumplidos` con los campos SOAP.**

`cumplidos` ya es la tabla más cercana a un registro canónico del viaje. Añadir columnas SOAP nullable es la única forma de cumplir el objetivo (un solo registro por viaje con todos los datos de ControlT) sin asumir el riesgo de Alternative A en esta fase.

El cambio concreto en el código existente es mínimo:
- `persistenceLayer.js` apunta a `cumplidos` (tabla existente) en lugar de `controlt_viajes` (tabla nueva que no existe).
- La migración `20260801000000_controlt_viajes.sql` no se ejecuta.
- Se ejecuta en su lugar un `ALTER TABLE cumplidos ADD COLUMN ...` para cada campo SOAP.

### 8.3 Sobre la tabla `planeados`

`planeados` no debe fusionarse con `cumplidos` ahora. Tiene una fuente distinta (`/Programmation`), un propósito distinto (planificación operativa), y una política de retención distinta (7 días). La separación es correcta desde el punto de vista del origen de datos.

La fragmentación que se percibe entre `planeados` y `cumplidos` no es un problema de diseño de tabla — es la consecuencia natural de que ControlT expone dos endpoints distintos que representan dos perspectivas distintas del mismo viaje (programado vs activo).

### 8.4 Sobre la tabla `viajes` como objetivo futuro

La Alternativa A (tabla `viajes`) sigue siendo el modelo correcto a largo plazo. El beneficio de tener un único registro por viaje con FK formal desde `solicitudes` es real. Pero debe ejecutarse cuando:

1. Los sync jobs estén estabilizados y con tests automatizados que detecten regresiones.
2. Exista una ventana de mantenimiento para ejecutar la migración de datos.
3. Se haya acumulado experiencia con la lógica SOAP en producción (validando que los campos que enriquecen `cumplidos` son correctos antes de construir la tabla definitiva).

### 8.5 Resumen ejecutivo

| Pregunta | Respuesta |
|---|---|
| ¿Se debe crear `viajes` ahora? | No — el costo y riesgo superan el beneficio inmediato |
| ¿Se debe ejecutar la migración `controlt_viajes`? | No — la tabla propuesta no debe crearse |
| ¿Dónde deben ir los campos SOAP? | En `cumplidos`, como columnas nullable adicionales |
| ¿Se modifica algún endpoint existente? | No — solo `persistenceLayer.js` (constante TABLE) |
| ¿Es `planeados` un candidato a fusionar? | No ahora — fuente y propósito distintos |
| ¿Es `viajes` el destino correcto a largo plazo? | Sí — pero como siguiente fase, no como Fase 4 |
