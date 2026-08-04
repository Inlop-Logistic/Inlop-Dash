# ARQUITECTURA DE DATOS — ENTIDAD VIAJE

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Estado:** PROPUESTA — pendiente de certificación  
**Alcance:** Revisión de arquitectura del dominio antes de generar migraciones SQL  

---

## 1. Situación Actual

El ERP INLOP representa el concepto de negocio **Viaje** de forma fragmentada en tres tablas
operativas separadas, más una cuarta propuesta que agravaría el problema:

### 1.1 Tablas actuales que representan un Viaje

| Tabla | Propósito declarado | PK | Fuente primaria |
|---|---|---|---|
| `planeados` | Programación futura | `trip_number TEXT` | ControlT Resume API |
| `cumplidos` | Historial operacional | `id TEXT` (= trip_number) | ControlT Resume API |
| `solicitudes` | Demanda logística | `id UUID` | ERP / Portal Cliente |
| `controlt_viajes` *(propuesta, no ejecutada)* | Detalle SOAP | `codigo_controlt TEXT` | ControlT SOAP |

### 1.2 Ciclo de vida real de un Viaje en el ERP

Un mismo viaje físico pasa por estas etapas y activa múltiples tablas:

```
SOLICITUD creada (Portal Cliente / ERP)
    │
    ▼
ControlT asigna trip_number
    │
    ├─► solicitudes.controlt_trip_number = trip_number    (FK manual)
    ├─► planeados.trip_number = trip_number               (via syncPlaneados)
    └─► cumplidos.id = trip_number, estado='LIVE'         (via syncCumplidos)
          │
          ▼ viaje activo (visible en Resume API / cache.viajes)
          │
          ├─► cumplidos actualiza: estado_controlt, pct   (cada 65s)
          └─► planeados actualiza: estado_programacion    (cada 65s)
                │
                ▼ viaje desaparece del snapshot Resume
                │
                └─► cumplidos: estado='FINALIZADO CONTROLT' | 'PENDIENTE LIQUIDACION'
                    planeados: estado_programacion='completado'
```

### 1.3 Cómo se resuelve hoy la vista unificada

El endpoint `GET /api/solicitudes/:id` construye la vista de detalle con este patrón de
resolución por capas:

```
placa:      viaje_cache?.license_plate  || solicitud.placa_asignada  || cumplido.placa
conductor:  viaje_cache?.driver_name    || solicitud.conductor_nombre || cumplido.conductor
pct:        viaje_cache.percentage_travel (solo si viaje activo)
fechas:     cumplido.fecha_viaje / cumplido.fecha_finalizacion || solicitud.fecha_inicio/fin_real
```

Esta lógica ad-hoc es la señal más clara de que el dominio necesita consolidación.

### 1.4 Tres integraciones ControlT coexistentes

| Integración | Endpoint | Uso | Actualización |
|---|---|---|---|
| Resume REST | `https://integrations.controlt.io/Auth/login` + `/apipublic/api/Resume` | Snapshot de viajes activos | Cada 65 s (syncViajes / syncCumplidos / syncPlaneados) |
| Public API | `https://app.controlt.com.co/apipublic/api` | Detalle on-demand, bitácora | Por demanda (`/api/ct/travel/:id`, `/api/ct/binnacle`) |
| SOAP | `https://app.controlt.com.co/WS/service.asmx` | Detalle completo: paradas, productos, temperatura | Fase 4 (a definir) |

---

## 2. Problemas de Mantener una Entidad `controlt_viajes`

Crear `controlt_viajes` como tabla independiente generaría los siguientes problemas
estructurales:

### 2.1 Cuarta representación del mismo concepto

El mismo viaje físico quedaría repartido en cuatro lugares:

```
solicitudes.controlt_trip_number  ──────────────► planeados.trip_number
                                                      │
                                  ──────────────► cumplidos.id
                                                      │
                                  ──────────────► controlt_viajes.codigo_controlt
```

Cada tabla contiene un subconjunto diferente de los campos del viaje. Ninguna es la fuente
de verdad completa. El resto del sistema tiene que consultar todas para ensamblar una vista
coherente.

### 2.2 Inconsistencias estructurales garantizadas

| Escenario | Efecto sin modelo único |
|---|---|
| ControlT actualiza placa/conductor en Resume | `cumplidos` se actualiza; `controlt_viajes` tiene el valor anterior del SOAP |
| SOAP devuelve fecha_evento distinta de la de Resume | Dos timestamps diferentes para el mismo evento |
| Solicitud queda en estado `en_ruta` pero `controlt_viajes` marca `COMPLETADO` | Estado del viaje contradictorio según qué tabla consulte la UI |
| Se busca el conductor de un viaje completado | Hay que mirar `cumplidos`, `solicitudes` y `controlt_viajes` |

### 2.3 Reconciliación permanente

`syncCumplidos` ya contiene lógica de reconciliación para detectar cuando un viaje
reapareció en el snapshot tras haber sido marcado como finalizado (el campo
`fecha_finalizacion → null` y el estado revertido a `LIVE`). Con una cuarta tabla se
necesitaría una lógica de reconciliación equivalente entre `controlt_viajes` y `cumplidos`,
duplicando complejidad de sincronización.

### 2.4 El Trip Number pierde unicidad como identificador

`solicitudes.controlt_trip_number` (TEXT nullable), `cumplidos.id` (TEXT PK),
`planeados.trip_number` (TEXT PK) y `controlt_viajes.codigo_controlt` (TEXT PK) son cuatro
columnas diferentes que apuntan al mismo identificador de ControlT, sin ninguna FK formal
entre ellas. Es imposible garantizar integridad referencial.

### 2.5 Confusión de dominio para desarrolladores futuros

Un desarrollador nuevo que lea el esquema ve cuatro tablas y no puede determinar cuál es la
"tabla del viaje". El dominio oculta su propia semántica.

### 2.6 SOAP es infraestructura, no entidad

Las paradas, productos y temperaturas que devuelve el SOAP son **atributos del viaje**,
no una entidad separada. Guardarlos en una tabla propia les da un estatus de entidad
que no les corresponde semánticamente.

---

## 3. Ventajas del Modelo Único de Viaje

### 3.1 Un identificador, una fila

`trip_number` es el identificador natural del viaje en ControlT. Con un modelo único existe
exactamente una fila en la base de datos por cada viaje. Cualquier módulo que necesite datos
de un viaje consulta una sola tabla.

### 3.2 Estado siempre consistente

No hay múltiples campos de estado que puedan contradecirse. El estado del viaje se deriva de
una única fuente y se escribe en una única ubicación.

### 3.3 Consultas simples

```
-- Hoy, con modelo único:
SELECT * FROM viajes WHERE trip_number = 'IN018108';

-- Sin modelo único (resolución actual):
SELECT s.*, c.*, p.*
FROM solicitudes s
LEFT JOIN cumplidos c ON c.id = s.controlt_trip_number
LEFT JOIN planeados p ON p.trip_number = s.controlt_trip_number
WHERE s.controlt_trip_number = 'IN018108';
-- + separar viaje activo de caché en memoria
```

### 3.4 Eliminación del patrón de resolución en cascada

La función `mapSolicitud(sol, viaje, cumplido)` con resolución `viaje || solicitud || cumplido`
desaparece. La UI recibe el campo directamente de la entidad canónica.

### 3.5 Trazabilidad completa del ciclo de vida

Con todas las fechas y estados en una sola entidad, es trivial reconstruir la línea de tiempo
completa de cualquier viaje: desde la solicitud hasta el cierre documental.

### 3.6 Integración ControlT transparente para el resto del ERP

Los módulos de Portal Cliente, Torre de Control y ERP interno consumen campos de `viajes`.
La fuente de cada campo (Resume API, SOAP, entrada manual) es un detalle de implementación
invisible para los consumidores.

---

## 4. Modelo Entidad-Relación Propuesto

```
empresas_cliente (1)──────────────────────────────(N) solicitudes
       │                                                    │
       │                                       controlt_trip_number (FK)
       │                                                    │
       └────────────────────────────────────────────────── viajes ──────────────────────┐
                                                  ┌─────────────────────────────────┐   │
                                                  │ trip_number (PK)                │   │
                                                  │ empresa_cliente_id (FK)         │   │
                                                  │                                 │   │
                                                  │ — Datos de programación —       │   │
                                                  │ schedulate_origin               │   │
                                                  │ estado_programacion             │   │
                                                  │                                 │   │
                                                  │ — Datos operacionales —         │   │
                                                  │ license_plate                   │   │
                                                  │ driver_name / conductor_cedula  │   │
                                                  │ estado_controlt                 │   │
                                                  │ pct                             │   │
                                                  │                                 │   │
                                                  │ — Enriquecimiento SOAP —        │   │
                                                  │ estado_viaje                    │   │
                                                  │ paradas (JSONB)                 │   │
                                                  │ productos por parada (JSONB)    │   │
                                                  │ temperatura_min / max           │   │
                                                  │                                 │   │
                                                  │ — Cierre documental —           │   │
                                                  │ estado_cumplido                 │   │
                                                  │ tiene_soporte                   │   │
                                                  │ fecha_finalizacion              │   │
                                                  └─────────────────────────────────┘   │
                                                                                        │
                                          viajes_documentos (N) ────────────────────────┘
                                          (bucket Storage: trip_number/filename)
```

### 4.1 Relaciones clave

| Relación | Cardinalidad | FK |
|---|---|---|
| `empresas_cliente` → `viajes` | 1:N | `viajes.empresa_cliente_id` |
| `solicitudes` → `viajes` | 1:1 opcional | `solicitudes.controlt_trip_number` → `viajes.trip_number` |
| `viajes` → `paradas` | 1:N embebido | `viajes.paradas` (JSONB array) |
| `paradas` → `productos` | 1:N embebido | `paradas[].productos` (JSONB array) |
| `viajes` → documentos | 1:N en Storage | ruta `{trip_number}/{filename}` |

---

## 5. Ubicación Definitiva del Trip Number

### 5.1 Situación actual (fragmentada)

| Tabla | Columna | Tipo | Rol |
|---|---|---|---|
| `solicitudes` | `controlt_trip_number` | TEXT NULL | Referencia opcional a ControlT |
| `cumplidos` | `id` | TEXT PK | Identificador principal |
| `planeados` | `trip_number` | TEXT PK | Identificador principal |
| `controlt_viajes` *(propuesta)* | `codigo_controlt` | TEXT PK | Identificador SOAP |

### 5.2 Modelo propuesto

El Trip Number de ControlT se convierte en la **clave natural del Viaje** en la entidad
canónica:

```
viajes.trip_number  TEXT  PRIMARY KEY
```

- Es asignado por ControlT al crear el viaje en el TMS.
- Es único en todo el sistema.
- Es la misma clave que hoy usan `cumplidos.id` y `planeados.trip_number` — no hay
  discontinuidad para los datos existentes.

### 5.3 Relación con Solicitud

`solicitudes.controlt_trip_number` se convierte en FK formal hacia `viajes.trip_number`.
La relación es 1:1 opcional: una solicitud puede no tener viaje asignado aún
(`controlt_trip_number IS NULL`), y un viaje creado directamente en ControlT puede no
tener solicitud asociada.

---

## 6. Cómo se Relacionan: Solicitud, Viaje, Paradas, Productos, Cliente, Vehículo, Conductor

```
CLIENTE (empresas_cliente)
    │
    ├── tiene muchas SOLICITUDES (solicitudes)
    │       │
    │       └── puede originar un VIAJE (viajes) ◄──── o el viaje existe sin solicitud
    │
    └── tiene muchos VIAJES directos (viajes)
            │
            ├── tiene VEHÍCULO: license_plate (desnormalizado — sin tabla vehículos hoy)
            │
            ├── tiene CONDUCTOR: driver_name, conductor_cedula (desnormalizado — sin tabla conductores hoy)
            │
            ├── tiene PARADAS (viajes.paradas[] JSONB)
            │       │
            │       └── cada PARADA tiene PRODUCTOS (parada.productos[] JSONB)
            │
            └── tiene DOCUMENTOS (Storage bucket cumplidos/{trip_number}/)
```

### 6.1 Por qué Paradas y Productos son JSONB y no tablas separadas

- Las paradas son atributos de monitoreo del viaje, no entidades de negocio independientes.
- Su estructura puede variar entre viajes (número de paradas, campos opcionales).
- Nunca se consultan de forma independiente del viaje al que pertenecen.
- El SOAP ya los entrega como array anidado — desnormalizar sería incurrir en complejidad sin
  beneficio.
- Supabase permite índices GIN sobre JSONB y operadores `@>` para consultas eficientes si
  fuera necesario en el futuro.

---

## 7. Qué Información Pertenece al ERP

Son campos **propietarios del ERP**: creados, validados y mantenidos internamente, sin
dependencia de ControlT para su existencia.

| Campo | Tabla origen actual | Descripción |
|---|---|---|
| `empresa_cliente_id` | `solicitudes`, `cumplidos`, `planeados` | FK al maestro de clientes |
| `agencia_id` / `agencia_nombre` | `solicitudes` | Agencia que genera la solicitud |
| `codigo_solicitud` | `solicitudes` | Referencia interna de la solicitud |
| `external_ref` | `solicitudes` | Referencia del cliente en su propio sistema |
| `tipo_vehiculo` | `solicitudes` | Tipo de vehículo requerido |
| `tipo_operacion` | `solicitudes`, `cumplidos` | Modalidad de negocio |
| `origen` / `destino` | `solicitudes`, `cumplidos` | Ciudades de origen y destino |
| `fecha_requerida` | `solicitudes` | Fecha solicitada por el cliente |
| `fecha_confirmacion` | `solicitudes` | Cuando INLOP aprobó la solicitud |
| `estado` (negocio) | `solicitudes` | pendiente/confirmado/en_ruta/completado/cancelado |
| `estado_cumplido` | `cumplidos` | LIVE/FINALIZADO/PENDIENTE LIQUIDACION (cierre documental) |
| `tiene_soporte` | `cumplidos` | Si el viaje tiene documentos cargados en Storage |
| `manifiesto` | `solicitudes`, `cumplidos` | Número de manifiesto/remisión |
| `obs` | `cumplidos` | Observaciones internas del operador |
| `link_soporte` | `cumplidos` | URL de soporte adicional |
| `canal` | `solicitudes` | Canal de entrada de la solicitud (APP, EMAIL, etc.) |
| `observacion_coordinadora` | `solicitudes` | Notas del coordinador |

---

## 8. Qué Información Proviene de ControlT

Son campos **sincronizados desde ControlT**. El ERP los almacena para disponibilidad
offline y rendimiento, pero la fuente de verdad es ControlT.

### 8.1 Desde Resume API (syncViajes / syncCumplidos / syncPlaneados)

| Campo ControlT | Campo ERP destino | Frecuencia |
|---|---|---|
| `trip_number` | `viajes.trip_number` (PK) | Al crear el viaje |
| `number_order` | `viajes.manifiesto` | Cada 65 s |
| `license_plate` | `viajes.license_plate` | Cada 65 s |
| `driver_name` | `viajes.driver_name` | Cada 65 s |
| `driver_phone` / `full_driver` | `viajes.conductor_tel` (extraído) | Cada 65 s |
| `company_customer_name` | `viajes.company_customer_name` | Cada 65 s |
| `state_travel` | `viajes.estado_controlt` | Cada 65 s |
| `percentage_travel` | `viajes.pct` | Cada 65 s |
| `origin_city_name` | `viajes.origen` | Al crear |
| `destiny_city_name` | `viajes.destino` | Al crear |
| `type_operation` | `viajes.tipo_negocio` | Cada 65 s |
| `activated_on` / `created_on` | `viajes.fecha_viaje` | Al crear |
| `schedulate_origin` | `viajes.schedulate_origin` | syncPlaneados |
| `latitude` / `longitude` | *solo en caché en memoria* | Cada 65 s (no persistido) |
| `latest_gps_report` | *solo en caché en memoria* | Cada 65 s (no persistido) |
| `current_address_location` | *solo en caché en memoria* | Cada 65 s (no persistido) |

### 8.2 Desde SOAP GetDetailMonitoringOrder (Fases 3-4)

| Campo SOAP | Campo ERP destino | Notas |
|---|---|---|
| `Paradas[].Parada` | `viajes.paradas` (JSONB) | Incluye hora_real, hora_programada, ETA |
| `Paradas[].Productos` | dentro de `viajes.paradas[].productos` | Nested JSONB |
| `Conductor.Cedula` | `viajes.conductor_cedula` | Solo disponible en SOAP |
| `TipoOperacion` | `viajes.tipo_operacion_codigo` | Código numérico de ControlT |
| `TipoViaje` | `viajes.tipo_viaje_codigo` | Código numérico de ControlT |
| `TipoCarga` | `viajes.tipo_carga_codigo` | Código numérico de ControlT |
| `ValorMercancia` | `viajes.valor_mercancia` | Solo disponible en SOAP |
| `Moneda` | `viajes.moneda` | Solo disponible en SOAP |
| `ValorFlete` | `viajes.valor_flete` | Solo disponible en SOAP |
| `PesoTotal` | `viajes.peso_total_ton` | Solo disponible en SOAP |
| `VolumenTotal` | `viajes.volumen_total` | Solo disponible en SOAP |
| `TemperaturaMinima` | `viajes.temperatura_min` | Solo disponible en SOAP |
| `TemperaturaMaxima` | `viajes.temperatura_max` | Solo disponible en SOAP |
| `Instrucciones` | `viajes.instrucciones` | Solo disponible en SOAP |
| `FechaUltimoEvento` | `viajes.fecha_evento` | Solo disponible en SOAP |

---

## 9. Qué Información es Derivada

Son campos calculados a partir de otros campos del viaje o de sus relaciones. Pueden
almacenarse para rendimiento, pero nunca son la fuente de verdad.

| Campo derivado | Fórmula | Dónde se calcula |
|---|---|---|
| `estado_viaje` | `deriveEstado(paradas)` — reglas deterministas sobre hora_real | `tripMapper.deriveEstado()` |
| `fecha_programada_dia` | `extraerFechaColombia(parseSchedulate(schedulate_origin))` | `syncPlaneados` |
| `activo_en_resume` | `trip_number ∈ cache.viajes.data` | `syncPlaneados` / `syncCumplidos` |
| `estado_programacion` | función de `activo_en_resume` + `fecha_programada_dia` + estado sticky | `syncPlaneados` |
| `conductor_tel` | `extraerTelefono(driver_phone, full_driver)` — extracción regex | `syncCumplidos` |
| `fecha_evento` (fallback) | máximo `hora_real` entre todas las paradas | `tripMapper.latestHoraReal()` |
| `sincronizado_en` | `new Date().toISOString()` en cada escritura SOAP | `persistenceLayer.upsertViaje()` |
| `pct` API normalizado | `parseFloat(percentage_travel) || 0` | Endpoint `/api/viajes` |

### 9.1 Regla de derivación de estado_viaje

El estado operativo del viaje se deriva exclusivamente de las marcas de tiempo reales de
las paradas, no del campo `state_travel` de Resume. Esta distinción es importante:

- `state_travel` (Resume): string de texto de ControlT, puede contener variantes ortográficas
  (`'en transíto'`, `'en tránsito'`, `'en transito'`) — útil para mapas de prioridad y filtros
- `estado_viaje` (SOAP derivado): enum canónico del ERP (PENDIENTE / EN_CARGUE / EN_TRANSITO /
  EN_DESCARGUE / COMPLETADO) — fuente de verdad para lógica de negocio y reportes

---

## 10. Qué Información Puede Mantenerse como Caché sin Convertirse en Entidad del Dominio

Estas informaciones **no deben tener una tabla propia** ni ser tratadas como entidades del
dominio.

### 10.1 Caché en memoria de viajes activos (`cache.viajes`)

- **Qué es:** Snapshot de viajes activos del endpoint Resume, renovado cada 65 segundos.
- **Por qué no es una entidad:** Es una vista temporal de ControlT. Su ciclo de vida no
  corresponde al ciclo de negocio del viaje. Los campos GPS (lat, lon, latest_gps_report,
  current_address_location) son datos de posición en tiempo real que no necesitan persistencia
  en Supabase.
- **Regla:** Solo persisten en Supabase los campos del viaje que tienen relevancia de
  negocio más allá del instante actual.

### 10.2 Tokens de autenticación ControlT

- **Qué son:** Los tokens de autenticación del Resume API, Public API y SOAP son credenciales
  de sesión con TTL corto.
- **Por qué no deben persistirse:** Los tokens nunca deben aparecer en almacenamiento
  persistente. El módulo `authManager.js` los gestiona exclusivamente en memoria con
  invalidación reactiva.
- **Regla obligatoria de seguridad:** Si por cualquier razón un token necesitara almacenarse,
  debe cifrarse en reposo. Los logs de auditoría (`auditLogger.js`) los filtran activamente.

### 10.3 Logs de auditoría SOAP (`controlt_soap_audit`)

- **Qué es:** Registro estructurado de cada llamada SOAP: timestamp, código viaje, latencia,
  resultado (sin credenciales ni token activo).
- **Por qué no es una entidad del dominio:** Es infraestructura de observabilidad. No
  alimenta ninguna lógica de negocio.
- **Regla:** Los campos `CONTROLT_PASS` y token activo están activamente filtrados y nunca
  aparecen en los registros.

### 10.4 Caché de resolución de clientes (`customerLookupMap`)

- **Qué es:** Mapa en memoria `nombreCliente → empresa_cliente_id`, reconstruido cada 10
  minutos desde `empresas_cliente`.
- **Por qué no es una entidad:** Es un índice derivado para rendimiento. No tiene estado
  propio.

---

## 11. Recomendación Final de Arquitectura

### 11.1 Decisión

**Consolidar `planeados`, `cumplidos` y `controlt_viajes` (propuesta cancelada) en una
sola tabla `viajes` que es la entidad canónica del Viaje en el ERP.**

La tabla `solicitudes` se mantiene como entidad separada porque representa la demanda
logística del cliente — un concepto de negocio distinto del viaje operacional. La FK
`solicitudes.controlt_trip_number → viajes.trip_number` formaliza la relación.

### 11.2 Principios que sustentan la decisión

1. **Un concepto de negocio = una entidad del dominio.**  
   El Viaje es un concepto único. No debe tener representaciones distintas por fase de
   su ciclo de vida.

2. **Debe existir una única fuente de verdad para el Viaje.**  
   Hoy ninguna tabla contiene toda la información del viaje. La nueva tabla `viajes`
   contendrá todos los campos — desde la programación hasta el cierre documental.

3. **SOAP es infraestructura, no dominio.**  
   Las paradas, productos y temperaturas son atributos del viaje. `tripMapper.js` es
   un transformador de datos de infraestructura; su salida debe enriquecer la entidad
   `viajes`, no crear una tabla paralela.

4. **El ERP nunca debe tener dos modelos diferentes para un mismo viaje.**  
   La tabla `controlt_viajes` propuesta en Fase 1 fue diseñada antes de tener visibilidad
   completa del ERP. Esa decisión queda cancelada.

5. **La integración con ControlT debe ser transparente para el resto del ERP.**  
   Los módulos que consumen datos de viajes no deben saber si un campo vino de Resume,
   de la Public API o del SOAP.

### 11.3 Campos que se consolidan

La nueva tabla `viajes` absorbe:

- Todos los campos de `planeados` relevantes para persistencia
- Todos los campos de `cumplidos`
- Todos los campos de `controlt_viajes` (propuesta)
- Los campos de enriquecimiento SOAP que no estaban en ninguna tabla

Los campos GPS efímeros (lat, lon, latest_gps_report, current_address_location) **no
se persisten** — siguen viviendo solo en el caché en memoria (`cache.viajes`).

---

## 12. Impacto sobre Supabase

### 12.1 Migración `controlt_viajes` — cancelada

La migración `supabase/migrations/20260801000000_controlt_viajes.sql` **no debe
ejecutarse**. La tabla `controlt_viajes` no debe crearse. Esta migración queda
reemplazada por la nueva migración que crea `viajes`.

### 12.2 Nueva migración principal

Se creará una migración que define la tabla `viajes` con todos los campos unificados.
Los datos de `cumplidos` y `planeados` se migrarán a `viajes` mediante upsert con
`trip_number` como clave de resolución.

### 12.3 Estrategia de transición para `cumplidos` y `planeados`

Las tablas `cumplidos` y `planeados` **no se eliminan en esta fase**. La transición es
gradual:

1. Se crea `viajes` con todos los campos.
2. Los sync jobs escriben en `viajes` (nueva ruta) y opcionalmente siguen escribiendo en
   `cumplidos`/`planeados` durante el período de transición.
3. Los endpoints del ERP migran uno a uno a leer de `viajes`.
4. Cuando todos los endpoints leen de `viajes`, las tablas viejas se marcan como
   deprecadas.
5. Se eliminan `cumplidos` y `planeados` en una fase posterior.

### 12.4 Integridad referencial formalizable

Con `viajes` como tabla canónica, es posible agregar:

```
solicitudes.controlt_trip_number → viajes.trip_number  (FK formal, deferred)
```

Esto garantiza que ninguna solicitud pueda referenciar un trip_number inexistente.

### 12.5 Política de retención

- `viajes` sin fecha de cierre: retención indefinida (viajes activos y recientes).
- `viajes` con `fecha_finalizacion` antigua: política de archivado a definir en Fase 5+.
- La ventana de 8 días que hoy aplica `syncPlaneados` sobre `planeados` se reemplaza por
  la política de archivado de `viajes`.

### 12.6 RLS

`viajes` hereda la política RLS de `cumplidos` y `planeados`: acceso por
`empresa_cliente_id`. Los endpoints del ERP (backend) operan con `SUPABASE_SERVICE_KEY`
(bypasa RLS). El Portal Cliente accede a sus viajes a través del backend — nunca directamente.

---

## 13. Impacto sobre la API

### 13.1 Endpoints que cambian de fuente de datos

| Endpoint actual | Fuente hoy | Fuente propuesta |
|---|---|---|
| `GET /api/viajes` | `cache.viajes` (memoria) | `cache.viajes` (sin cambio — datos efímeros GPS) |
| `GET /api/cumplidos` | tabla `cumplidos` | tabla `viajes` (filtro estado_cumplido != LIVE) |
| `GET /api/cumplidos/:trip` | tabla `cumplidos` | tabla `viajes` |
| `GET /api/solicitudes/:id` (datos viaje) | `cumplidos` + `planeados` + caché | tabla `viajes` + caché GPS |
| `GET /servicios/:id` (portal) | misma lógica cascada | tabla `viajes` |
| `PATCH /api/cumplidos/:trip/estado` | tabla `cumplidos` | tabla `viajes` |

### 13.2 Endpoints sin cambio

- `GET /api/solicitudes` — sigue leyendo de `solicitudes`.
- `GET /api/gps` — sigue leyendo de `cache.viajes` (datos GPS solo en memoria).
- `POST/DELETE /api/cumplidos/:trip/documentos` — Storage bucket sin cambio; el campo
  `tiene_soporte` migra a `viajes`.
- Todos los endpoints de `auth/*` y `servicios/*` que no consumen datos de viajes.

### 13.3 Nueva ruta de enriquecimiento SOAP

```
GET /api/viajes/:trip/detalle-soap
POST /internal/controlt/sync-soap/:trip
```

Estos endpoints de Fase 4 escribirán directamente en `viajes`, no en una tabla separada.

### 13.4 `syncCumplidos` y `syncPlaneados`

Se unificarán gradualmente en un único `syncViajes` que escribe en la tabla `viajes`:

- `syncViajes` (actual) → sigue actualizando `cache.viajes` en memoria.
- `syncCumplidos` (actual) → migra a escribir en `viajes`.
- `syncPlaneados` (actual) → migra a escribir en `viajes`.
- `syncControltSoap` (nuevo en Fase 4) → escribe campos SOAP en `viajes`.

---

## 14. Impacto sobre el Portal Cliente

### 14.1 Vistas afectadas

| Vista del portal | Cambio |
|---|---|
| Lista de servicios (`GET /servicios`) | Lee de `solicitudes` + join a `viajes` — simplifica la resolución en cascada actual |
| Detalle de servicio (`GET /servicios/:id`) | Lee de `solicitudes` + `viajes` — elimina consulta separada a `cumplidos` y `planeados` |
| Estado del viaje en tiempo real | Sin cambio — sigue viniendo del caché en memoria vía `mapSolicitud` |
| Historial de servicios completados | Lee de `viajes` (estado_cumplido finalizado) |

### 14.2 Campos que mejoran

- `pct` del viaje: disponible en `viajes.pct` sin necesidad de validar si el viaje está
  activo en caché.
- `placa_asignada` / `conductor_nombre`: campo único en `viajes`, sin resolución en cascada.
- Fechas reales de inicio/fin: en `viajes.fecha_viaje` y `viajes.fecha_finalizacion`.

### 14.3 Sin cambios visibles para el usuario final

El Portal Cliente ve la misma interfaz. El cambio es interno a la capa de datos.
La lógica de negocio que determina cuándo mostrar el estado "en ruta", "completado" o
"cancelado" no cambia.

---

## 15. Impacto sobre la Torre de Control

### 15.1 TorreControl.html (legado)

TorreControl.html consume exclusivamente:

- `GET /api/data` → `cache.viajes` (sin cambio)
- `GET /api/alarmas` → `cache.alarmas` (sin cambio)
- `GET /api/pendientes` → `cache.viajes` + `cache.pendientes` (sin cambio)
- `GET /api/solicitudes` → tabla `solicitudes` (sin cambio)
- `PATCH /api/solicitudes/:id/estado` → tabla `solicitudes` (sin cambio)

La torre legada no requiere cambios durante la migración.

### 15.2 Torre de Control ERP (módulos internos)

Los módulos que consumen `GET /api/viajes`, `GET /api/cumplidos` y `GET /api/programacion`
continuarán funcionando durante la transición, ya que los endpoints mantienen sus contratos
de respuesta. Los cambios son internos a la capa de datos del servidor.

### 15.3 Nuevas capacidades habilitadas por el modelo único

Con la tabla `viajes` como entidad canónica, la Torre de Control puede consultar:

- Viajes con paradas retrasadas (consulta sobre JSONB de paradas con hora_real vs hora_programada)
- Viajes con temperatura fuera de rango
- Historial completo de un viaje desde solicitud hasta cierre documental, sin joins multi-tabla
- Indicadores de cumplimiento de ventanas horarias en paradas

Estas capacidades no son posibles con el modelo actual.

---

## 16. Roadmap Recomendado para las Siguientes Fases

### Fase 4 — Modelo físico y migración `viajes`

**Objetivo:** Definir el esquema completo de la tabla `viajes` y la migración de datos.

Pasos:
1. Certificar este documento de arquitectura.
2. Diseñar el esquema completo de `viajes` (columnas, tipos, constraints, índices).
3. Generar la migración SQL `viajes` (upsert desde `cumplidos` + `planeados`).
4. Ejecutar migración en Supabase (staging primero).
5. Cancelar formalmente la migración `20260801000000_controlt_viajes.sql`.

Restricción: No se modifica ningún código hasta que la arquitectura esté certificada
y la migración ejecutada en staging.

### Fase 5 — Adaptación de sync jobs

**Objetivo:** Redirigir `syncCumplidos` y `syncPlaneados` para que escriban en `viajes`.

Pasos:
1. Modificar `syncCumplidos` → escribe en `viajes` con upsert por `trip_number`.
2. Modificar `syncPlaneados` → escribe en `viajes` (campos de programación).
3. Período de escritura dual (viajes + tablas originales) para validación.
4. Verificar consistencia por 48h en producción.
5. Desactivar escritura dual; tablas originales quedan en read-only.

### Fase 6 — tripService y enriquecimiento SOAP

**Objetivo:** Implementar el servicio que orquesta la obtención de detalle SOAP y lo
escribe en `viajes`.

Pasos:
1. Crear `tripService.js` con lógica: intentar SOAP → enriquecer `viajes` → devolver fila
   completa.
2. El `persistenceLayer.js` existente se adapta para escribir en `viajes` (no en
   `controlt_viajes`).
3. Exponer `GET /internal/controlt/viaje/:trip` para consumo por el ERP.
4. Activar sincronización SOAP periódica para viajes activos.

### Fase 7 — Adaptación de API y Portal Cliente

**Objetivo:** Migrar los endpoints consumidores para leer de `viajes`.

Pasos:
1. `GET /api/cumplidos` → leer de `viajes`.
2. `GET /api/solicitudes/:id` → eliminar resolución en cascada; usar `viajes`.
3. `GET /servicios/:id` (portal) → usar `viajes`.
4. Validar todas las vistas del Portal Cliente en staging.

### Fase 8 — Deprecación de tablas legadas

**Objetivo:** Eliminar `cumplidos`, `planeados` y el código de sync duplicado.

Pasos:
1. Verificar que ningún endpoint lee de `cumplidos` o `planeados`.
2. Ejecutar migración de eliminación de tablas.
3. Limpiar código de sync legacy (`syncCumplidos`, `syncPlaneados` separados).
4. Documentar el modelo final.

---

## Apéndice A — Estado de Archivos Certificados (Fases 1-3)

Los siguientes archivos están certificados y **no deben modificarse** en Fase 4+
salvo revisión explícita:

| Archivo | Estado | Fase |
|---|---|---|
| `services/controlt-soap/soapGateway.js` | ✅ Certificado | Fase 2 |
| `services/controlt-soap/authManager.js` | ✅ Certificado | Fase 2 |
| `services/controlt-soap/config.js` | ✅ Certificado | Fase 2 |
| `services/controlt-soap/errors.js` | ✅ Certificado | Fase 2 |
| `services/controlt-soap/auditLogger.js` | ✅ Certificado | Fase 2 |
| `services/controlt-soap/tripMapper.js` | ✅ Certificado | Fase 3 |
| `services/controlt-soap/persistenceLayer.js` | ✅ Certificado | Fase 3 (destino tabla a cambiar en Fase 6) |

`persistenceLayer.js` está certificado como módulo; su destino de escritura cambiará
en Fase 6 de `controlt_viajes` a `viajes`, lo cual requiere revisión de ese módulo
específicamente (no de los demás).

## Apéndice C — Regla Permanente: Fuente Única de Verdad para Datos ControlT

> **Aprobada:** Sprint 4.7 — tras hallazgo de endpoint `GET /servicios/:id/paradas`
> con doble llamada directa a ControlT violando la arquitectura de fuente única.  
> **Estado:** Regla permanente — no derogar sin revisión de arquitectura formal.

### Principio

Todo dato proveniente de ControlT debe **obtenerse una sola vez, enriquecerse una
sola vez, persistirse una sola vez y reutilizarse** por todos los endpoints internos.

Ningún endpoint de consumo (ERP, Portal Cliente o APIs auxiliares) podrá volver a
consultar ControlT cuando la información ya pueda obtenerse a través de
`tripService.getTripDetail`.

### Flujo mandatorio

```
ControlT (SOAP GetDetailMonitoringOrder)
    │
    ▼
tripService.getTripDetail()   ← única puerta de entrada certificada
    │
    ├── caché fresco en cumplidos → devolver sin llamar al SOAP
    └── caché vencido / ausente  → SOAP → tripMapper → persistenceLayer → devolver
    │
    ▼
Endpoints consumidores:
  GET /api/viajes/:tripNumber   (uso actual)
  GET /servicios/:id            (vía construirControltEnriquecido)
  GET /servicios/:id/paradas    (corrección Sprint 4.7)
  cualquier endpoint futuro con datos ControlT
```

### Prohibido

- Crear nuevas llamadas HTTP a ControlT (`CT_PUBLIC_URL`, Resume API, etc.) desde
  endpoints consumidores.
- Usar `getCtPublicToken()` para obtener datos de paradas, productos o detalle de viaje
  desde un endpoint secundario — esa función es exclusiva del módulo de autenticación.
- Reimplementar Login, SOAP, caché o persistencia fuera del módulo `controlt-soap`.
- Consultar ControlT más de una vez por el mismo dato en el mismo request.

### Función autorizada

```javascript
// Único punto de acceso a datos de ControlT desde cualquier handler HTTP:
const detalle = await getTripDetail(codigoViaje, { sbFetch: controltSbFetch });
// detalle.paradas → Parada[] enriquecidas (coordenadas, productos, horarios)
```

`getTripDetail` (importada de `services/controlt-soap/tripService.js`) gestiona
internamente el caché, la autenticación, el reintento y la persistencia — el
endpoint consumidor no necesita conocer ni reimplementar ninguno de esos detalles.

### Referencia de implementación

- `services/controlt-soap/tripService.js` — implementación de `getTripDetail`
- `index.js` → `construirControltEnriquecido()` — patrón de uso con absorción de errores
- `index.js` → `GET /api/viajes/:tripNumber` — patrón de uso con propagación de errores
- `index.js` → `GET /servicios/:id/paradas` — corrección Sprint 4.7 aplicando esta regla

---

## Apéndice B — Restricciones de Seguridad Vigentes

Las siguientes restricciones permanecen en efecto en todas las fases futuras:

- `CONTROLT_PASS` nunca debe aparecer en logs, audit trails ni registros de llamadas.
- El token SOAP activo nunca debe aparecer en logs ni almacenamiento persistente.
- `SUPABASE_SERVICE_KEY` nunca debe exponerse al navegador ni commitearse en el repositorio.
- Los payloads SOAP completos solo se loguean en nivel DEBUG en entorno de desarrollo.
  En producción: solo el registro de auditoría estructurado.
