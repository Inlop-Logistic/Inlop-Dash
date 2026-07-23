# Auditoría Técnica y Funcional — Módulo Cumplidos

**Fecha:** 2026-07-23
**Repositorio:** inlop-logistic/inlop-dash
**Rama auditada:** `claude/clever-edison-y3au9r`
**Alcance:** Solo lectura. Sin modificaciones de código.

---

## 1. Resumen Ejecutivo

El módulo Cumplidos tiene su **ruta de escritura correctamente implementada** (`syncCumplidos` persiste en Supabase cada 60 s), pero su **ruta de lectura está completamente desconectada de la base de datos**: el endpoint `GET /api/cumplidos` lee exclusivamente de `cache.viajes.data` (caché en memoria del TMS ControlT) y nunca consulta la tabla `cumplidos` de Supabase.

Como consecuencia directa:

- `estado_documental` es siempre `"pendiente"` para todos los registros — hardcodeado en el endpoint.
- El checklist de documentos se regenera en memoria en cada solicitud desde `DOCUMENTOS_BASE` — nunca refleja actualizaciones persistidas.
- Los 6 KPIs del frontend (pendientes, en revisión, con observaciones, validados, listos para facturar, rechazados) mostrarán **siempre los mismos valores**: todos en `"pendiente"`, el resto en cero.
- El módulo no puede avanzar en su flujo documental: no existen endpoints PATCH para cambiar `estado_documental`, agregar `observaciones`, registrar `responsable`, ni aprobar/rechazar expedientes.
- Los viajes finalizados (que ya salieron del TMS) no aparecen en el módulo porque el endpoint no lee la tabla `cumplidos` donde sí están registrados.

---

## 2. Arquitectura del Módulo

### 2.1 Stack de archivos

```
Backend
  index.js                             Servidor Express Node.js (único archivo)
    ├── GET /api/cumplidos  (línea 901) Endpoint de lectura — NO usa Supabase
    └── syncCumplidos()    (línea 1178) Job de escritura — usa Supabase cada 60 s

Frontend (erp/src/modules/cumplidos/)
  CumplidosPage.tsx                    Página principal: KPIs, filtros, tabs, tabla, panel
  hooks/useCumplidos.ts                State management, filtrado, KPIs, auto-refresh 120 s
  services/api.ts                      listarCumplidos() → GET /api/cumplidos
  types.ts                             CumplidoRecord, DocumentoCheck, EstadoDocumental, KpisCumplidos
  constants.ts                         ESTADO_DOC_CFG, TABS, tabCount, REFRESH_INTERVAL_MS
  cumplidos.definition.ts              Definición ARC (columnas, filtros, acciones, KPIs, permisos)
  components/
    CumplidosTableColumns.tsx          Columnas de la tabla, generadas desde cumplidos.definition.ts
    DetalleCumplido.tsx                Panel lateral de detalle
    DocumentChecklist.tsx              Checklist de documentos con indicadores de estado
    TimelineCumplido.tsx               Timeline de 5 pasos del flujo documental
    AccionesCumplido.tsx               Botones de acción del panel
    EstadoDocumental.tsx               Badge de estado documental
```

### 2.2 Flujo de datos (estado actual)

```
ControlT TMS (externo)
    ↓ polling cada 60 s
cache.viajes.data (memoria)
    ├─→ GET /api/cumplidos  ← SOLO fuente de lectura del endpoint
    └─→ syncCumplidos()     → Supabase tabla "cumplidos" (escritura)

Supabase tabla "cumplidos"
    → NUNCA leída por GET /api/cumplidos
    → Solo leída como fallback en /api/solicitudes y /api/programacion (campos limitados)
```

---

## 3. Endpoint de Lectura — `GET /api/cumplidos` (index.js:901)

```javascript
// index.js líneas 901–928
app.get('/api/cumplidos', requireInternalApiKey, (req, res) => {
  const cumplidos = cache.viajes.data
    .filter(v => ESTADOS_CUMPLIBLES.has((v.state_travel ?? '').toLowerCase()))
    .map(v => ({
      id:                    v.trip_number,
      trip_number:           v.trip_number,
      number_order:          v.number_order          || null,
      company_customer_name: v.company_customer_name || null,
      license_plate:         v.license_plate         || null,
      driver_name:           v.driver_name           || null,
      origin_city_name:      v.origin_city_name      || null,
      destiny_city_name:     v.destiny_city_name     || null,
      state_travel:          v.state_travel,
      activated_on:          v.activated_on          || null,
      created_on:            v.created_on            || null,
      fecha_cumplido:        v.activated_on          || null,   // ← BUG: debería ser fecha de finalización
      estado_documental:     'pendiente',                        // ← HARDCODEADO siempre
      documentos:            DOCUMENTOS_BASE.map(d => ({
        ...d,
        presente: d.id === 'remision' ? !!v.number_order : false, // ← Siempre false excepto remisión
      })),
      observaciones:    null,   // ← Siempre null
      responsable:      null,   // ← Siempre null
      fecha_validacion: null,   // ← Siempre null
      aprobado_por:     null,   // ← Siempre null
    }));
  res.json(cumplidos);
});
```

**`ESTADOS_CUMPLIBLES`** (index.js:554):
```javascript
const ESTADOS_CUMPLIBLES = new Set(['completado', 'finalizado']);
```

**`DOCUMENTOS_BASE`** (index.js:578):
```javascript
const DOCUMENTOS_BASE = [
  { id: 'remision',        label: 'Remisión',              requerido: true  },
  { id: 'manifiesto',      label: 'Manifiesto de carga',   requerido: true  },
  { id: 'soporte_entrega', label: 'Soporte de entrega',    requerido: true  },
  { id: 'fotos',           label: 'Registro fotográfico',  requerido: false },
  { id: 'firma',           label: 'Firma del receptor',    requerido: true  },
];
```

---

## 4. Job de Escritura — `syncCumplidos()` (index.js:1178)

El job funciona correctamente como escritor. Se ejecuta cada 60 s (index.js:3488). Su lógica:

### 4.1 Para cada viaje en `cache.viajes.data`

- Si **no existe** en `cumplidos`: inserta una fila con `estado_cumplido: 'LIVE'`.
- Si **ya existe**: actualiza `estado_controlt` y `pct`. Nunca regresa a `'LIVE'`.

**Campos insertados en la tabla `cumplidos`:**

| Campo DB          | Fuente TMS           | Notas                              |
|-------------------|----------------------|------------------------------------|
| `id`              | `trip_number`        | PK                                 |
| `manifiesto`      | `number_order`       |                                    |
| `placa`           | `license_plate`      |                                    |
| `conductor`       | `driver_name`        |                                    |
| `conductor_tel`   | `extraerTelefono()`  | Normalizado                        |
| `cliente`         | `company_customer_name` (primer nombre) |                   |
| `empresa_cliente_id` | Resuelto por `resolveTrip()` |                            |
| `estado_controlt` | `state_travel`       | Actualizado en cada sync           |
| `estado_cumplido` | `'LIVE'`             | Hardcodeado en inserción           |
| `pct`             | `percentage_travel`  | Actualizado en cada sync           |
| `fecha_viaje`     | `activated_on` o `created_on` |                            |
| `origen`          | `origin_city_name`   |                                    |
| `destino`         | `destiny_city_name`  |                                    |
| `tiene_soporte`   | `false`              | **Siempre false, nunca actualizado** |

### 4.2 Detección de finalización

Cuando un viaje existente en la tabla ya **no aparece** en `cache.viajes.data` (salió del TMS):

```javascript
const nuevoEstado = c.tiene_soporte ? 'PENDIENTE LIQUIDACION' : 'FINALIZADO CONTROLT';
// PATCH → { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() }
```

**Problema crítico:** `tiene_soporte` siempre es `false` (nunca se actualiza). Por lo tanto, el estado `'PENDIENTE LIQUIDACION'` es **inalcanzable**: todos los viajes finalizados pasan a `'FINALIZADO CONTROLT'`.

### 4.3 Valores posibles de `estado_cumplido` en BD

| Valor                  | Cuándo se asigna                              |
|------------------------|-----------------------------------------------|
| `LIVE`                 | Inserción inicial (viaje activo en TMS)       |
| `FINALIZADO CONTROLT`  | Viaje salió del TMS y `tiene_soporte = false` |
| `PENDIENTE LIQUIDACION`| Inalcanzable (`tiene_soporte` nunca es true)  |

---

## 5. Esquema de la Tabla `cumplidos` en Supabase (DB)

Inferido desde el código de `syncCumplidos()` y los queries presentes en `index.js`:

| Columna             | Tipo inferido  | Descripción                                   |
|---------------------|----------------|-----------------------------------------------|
| `id`                | text (PK)      | `trip_number` del TMS                         |
| `manifiesto`        | text           | Número de orden / remisión                    |
| `placa`             | text           | Matrícula del vehículo                        |
| `conductor`         | text           | Nombre del conductor                          |
| `conductor_tel`     | text           | Teléfono normalizado                          |
| `cliente`           | text           | Primer nombre del cliente TMS                 |
| `empresa_cliente_id`| uuid           | FK → `empresas_cliente(id)`                   |
| `estado_controlt`   | text           | Estado del viaje en TMS (`state_travel`)      |
| `estado_cumplido`   | text           | Estado del flujo de cumplidos (ver §4.3)      |
| `pct`               | numeric        | Porcentaje de avance del viaje                |
| `fecha_viaje`       | text/timestamp | Fecha de inicio del viaje                     |
| `fecha_finalizacion`| timestamptz    | Fecha en que el viaje salió del TMS           |
| `origen`            | text           | Ciudad de origen                              |
| `destino`           | text           | Ciudad de destino                             |
| `tiene_soporte`     | boolean        | Siempre `false` — nunca actualizado           |

**Columnas que NO existen en la BD pero el frontend sí espera:**

| Campo frontend        | Estado en BD         |
|-----------------------|----------------------|
| `estado_documental`   | No existe            |
| `documentos` (JSONB)  | No existe            |
| `observaciones`       | No existe            |
| `responsable`         | No existe            |
| `fecha_validacion`    | No existe            |
| `aprobado_por`        | No existe            |
| `number_order`        | BD usa `manifiesto`  |
| `license_plate`       | BD usa `placa`       |
| `driver_name`         | BD usa `conductor`   |
| `origin_city_name`    | BD usa `origen`      |
| `destiny_city_name`   | BD usa `destino`     |

---

## 6. Tipos del Frontend — `types.ts`

```typescript
export type EstadoDocumental =
  | "pendiente"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"
  | "rechazado"
  | "listo_facturacion";

export interface CumplidoRecord {
  id:                    string;
  trip_number:           string;
  number_order:          string | null;
  company_customer_name: string | null;
  license_plate:         string | null;
  driver_name:           string | null;
  origin_city_name:      string | null;
  destiny_city_name:     string | null;
  state_travel:          string;
  activated_on:          string | null;   // Comentario dice "DD/MM/YYYY" — incorrecto (es MDY)
  created_on:            string | null;
  fecha_cumplido:        string | null;
  estado_documental:     EstadoDocumental;
  documentos:            DocumentoCheck[];
  observaciones:         string | null;
  responsable:           string | null;
  fecha_validacion:      string | null;
  aprobado_por:          string | null;
}
```

---

## 7. Estado Funcional del Frontend

### 7.1 `CumplidosPage.tsx`

- Renderiza 6 KPIs, barra de filtros (texto libre, estado documental, cliente), tabs y DataTable.
- **Todos los KPIs distintos de "Total" y "Pendientes" mostrarán cero** porque `estado_documental` siempre es `"pendiente"`.
- La selección de clientes en el filtro desplegable funciona correctamente (basada en `company_customer_name`).
- La búsqueda de texto libre funciona correctamente sobre los campos retornados.
- La navegación contextual desde otros módulos (via `navPayload.tripNumber`) funciona.

### 7.2 `useCumplidos.ts`

- Auto-refresh cada 120 s.
- Filtrado y KPIs calculados en cliente — correctos en implementación pero sin datos reales de estado documental.

### 7.3 `DetalleCumplido.tsx` — Bug de parseo de fechas

En línea 32:
```typescript
<InfoRow label="Fecha viaje" value={fmtTms(cumplido.activated_on, "DMY", ...)} />
<InfoRow label="Fecha cumplido" value={fmtTms(cumplido.fecha_cumplido, "DMY")} />
```

El campo `activated_on` del TMS ControlT tiene formato **MM/DD/YYYY HH:MM:SS** (MDY), no DD/MM/YYYY.
`fmtTms(..., "DMY")` lo parsea como DMY → **la fecha se muestra invertida** (día y mes intercambiados).

El mismo bug existe en `TimelineCumplido.tsx` línea 87:
```typescript
timestamp={fmtTms(cumplido.activated_on, "DMY")}
```

Este bug es idéntico al que fue corregido en `TimelineViaje.tsx` del módulo Viajes en sesiones anteriores.

### 7.4 `DocumentChecklist.tsx`

- La lógica de renderizado (íconos, colores, contador) es correcta.
- Los datos que recibe del backend son siempre los mismos: 4 documentos faltantes, solo "Remisión" presente cuando `number_order` existe.
- Incluye nota "Carga y validación de documentos disponibles próximamente" (hardcoded).

### 7.5 `TimelineCumplido.tsx`

- Timeline de 5 pasos: Viaje finalizado → Documentación recibida → Revisada → Aprobado → Listo p/facturar.
- La posición en el timeline depende de `estado_documental`, que siempre es `"pendiente"`.
- El paso 1 ("Viaje finalizado") siempre se marca como `"completed"` independientemente del estado real.
- Los pasos 2–5 siempre se muestran como `"pending"` (opacidad reducida).

### 7.6 `AccionesCumplido.tsx`

| Acción           | Estado      | Destino                          |
|------------------|-------------|----------------------------------|
| Abrir Viaje      | Funcional   | navActions.verViaje()            |
| Abrir Programación | Funcional | navActions.verProgramacion()     |
| Abrir Solicitud  | Funcional   | navActions.verSolicitud()        |
| Abrir GPS        | Funcional   | navActions.verGps()              |
| Abrir Cliente    | Deshabilitado | "Próximamente"                 |
| Abrir Vehículo   | Deshabilitado | "Próximamente"                 |
| Abrir Conductor  | Deshabilitado | "Próximamente"                 |
| Abrir Facturación | Deshabilitado | "Próximamente"                |

### 7.7 `cumplidos.definition.ts`

Archivo de definición ARC con columnas, filtros, acciones, KPIs y permisos. Referencia un "View Engine" que no existe aún. Las columnas definidas aquí son consumidas por `CumplidosTableColumns.tsx` para generar el array `COLUMNS`.

---

## 8. Inventario de Problemas

### P1 — CRÍTICO: Desconexión ruta lectura/escritura

**Archivo:** `index.js:901`
**Descripción:** `GET /api/cumplidos` lee `cache.viajes.data` en lugar de la tabla Supabase `cumplidos`. Todo el trabajo de `syncCumplidos()` (escritura correcta, detección de finalización, resolución de clientes) es invisible para el frontend.
**Impacto:** El módulo no puede mostrar viajes finalizados ni ningún dato documental persistido.

### P2 — CRÍTICO: `estado_documental` hardcodeado

**Archivo:** `index.js:917`
**Descripción:** `estado_documental: 'pendiente'` en cada registro del endpoint, sin importar estado real.
**Impacto:** KPIs inútiles, tabs "En revisión", "Validados", "Listos p/facturar", "Rechazados" siempre en cero. Flujo documental imposible.

### P3 — CRÍTICO: Sin endpoints de escritura documental

**Descripción:** No existe ningún endpoint `PATCH /api/cumplidos/:id` para actualizar `estado_documental`, `observaciones`, `responsable`, `fecha_validacion` o `aprobado_por`.
**Impacto:** El flujo documental completo (revisión → aprobación → facturación) es técnicamente imposible de implementar desde el frontend.

### P4 — ALTO: Mismatch de nombres de columnas DB ↔ Frontend

**Descripción:** La tabla Supabase usa nombres de columna distintos a los que espera el tipo `CumplidoRecord`:

| Frontend espera   | BD tiene          |
|-------------------|-------------------|
| `number_order`    | `manifiesto`      |
| `license_plate`   | `placa`           |
| `driver_name`     | `conductor`       |
| `origin_city_name`| `origen`          |
| `destiny_city_name`| `destino`        |

**Impacto:** Al reconectar el endpoint a la BD, se necesita un mapper explícito o una migración de nombres.

### P5 — ALTO: Columnas documentales inexistentes en BD

**Descripción:** Los campos `estado_documental`, `documentos` (JSONB), `observaciones`, `responsable`, `fecha_validacion` y `aprobado_por` no existen en la tabla `cumplidos`.
**Impacto:** Requieren migración antes de poder persistir el flujo documental.

### P6 — ALTO: Bug de parseo de fechas en panel de detalle

**Archivos:** `DetalleCumplido.tsx:32`, `DetalleCumplido.tsx:35`, `TimelineCumplido.tsx:87`
**Descripción:** `activated_on` del TMS llega en formato MDY (`MM/DD/YYYY HH:MM:SS`). Se parsea con `fmtTms(..., "DMY")` → día y mes quedan intercambiados.
**Ejemplo:** Un viaje activado el `01/15/2026` (15 de enero) se mostraría como `01/15/2026` → parseado como 1 del mes 15 (inválido → "—") o fecha errónea.

### P7 — MEDIO: `fecha_cumplido` mapea a `activated_on` (incorrecto)

**Archivo:** `index.js:916`
**Descripción:** `fecha_cumplido: v.activated_on` — `activated_on` es la fecha de **inicio** del viaje, no la de finalización.
**Corrección esperada:** Debería ser `fecha_finalizacion` de la tabla Supabase.

### P8 — MEDIO: `tiene_soporte` siempre `false`

**Archivo:** `index.js:1221`
**Descripción:** Se inserta como `false` y nunca se actualiza. El estado `'PENDIENTE LIQUIDACION'` (línea 1248) es inalcanzable. Todo viaje finalizado pasa directamente a `'FINALIZADO CONTROLT'`.

### P9 — BAJO: Viajes finalizados ausentes del módulo

**Descripción:** Al leer solo `cache.viajes.data`, los viajes en estado `'completado'/'finalizado'` que ya salieron del TMS no aparecen en el módulo. La tabla Supabase los conserva con `estado_cumplido = 'FINALIZADO CONTROLT'`, pero el endpoint no los retorna.

### P10 — BAJO: `checklist` regenerado en memoria, no persistido

**Archivo:** `index.js:918`
**Descripción:** `DOCUMENTOS_BASE.map(...)` regenera el checklist desde cero en cada petición. Solo "Remisión" refleja un dato real (`number_order`). El resto siempre `presente: false`.
**Impacto:** No hay posibilidad de marcar documentos recibidos, aunque se quisiera hacerlo.

---

## 9. Análisis de Transición

### Qué funciona correctamente

- **`syncCumplidos()`**: escritura a Supabase, detección de finalización, resolución de clientes por `resolveTrip()`.
- **Frontend**: compilación, renderizado, navegación, filtros de texto y cliente, búsqueda libre, auto-refresh.
- **Acciones de navegación contextual**: Viaje, Programación, Solicitud, GPS.
- **Definición ARC** (`cumplidos.definition.ts`): estructuralmente correcta y lista para un View Engine.

### Qué requiere trabajo antes de ser funcional

1. Reconectar `GET /api/cumplidos` a Supabase con mapper de nombres de columna.
2. Migración SQL para agregar columnas documentales a la tabla `cumplidos`.
3. Agregar endpoints PATCH para el flujo documental.
4. Corregir parseo de `activated_on` (`"MDY"` en lugar de `"DMY"`).
5. Cambiar `fecha_cumplido` para que use `fecha_finalizacion` de la BD.
6. Implementar actualización de `tiene_soporte` para desbloquear `'PENDIENTE LIQUIDACION'`.

---

## 10. Plan de Recuperación Propuesto

> **Nota:** Este plan es solo una recomendación. No implica compromiso de implementación.

### Fase 1 — Reconectar lectura (P1, P4, P7, P9)

Modificar `GET /api/cumplidos` para consultar la tabla Supabase con un mapper de columnas:

```sql
-- Query propuesto
SELECT
  id AS trip_number,
  id,
  manifiesto        AS number_order,
  placa             AS license_plate,
  conductor         AS driver_name,
  cliente           AS company_customer_name,
  origen            AS origin_city_name,
  destino           AS destiny_city_name,
  estado_controlt   AS state_travel,
  fecha_viaje       AS activated_on,
  fecha_finalizacion AS fecha_cumplido,
  -- columnas documentales (post-migración)
  COALESCE(estado_documental, 'pendiente') AS estado_documental,
  observaciones,
  responsable,
  fecha_validacion,
  aprobado_por
FROM cumplidos
ORDER BY fecha_viaje DESC
LIMIT 500;
```

### Fase 2 — Migración de esquema (P5, P8)

```sql
ALTER TABLE cumplidos
  ADD COLUMN IF NOT EXISTS estado_documental  text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS documentos         jsonb,
  ADD COLUMN IF NOT EXISTS observaciones      text,
  ADD COLUMN IF NOT EXISTS responsable        text,
  ADD COLUMN IF NOT EXISTS fecha_validacion   timestamptz,
  ADD COLUMN IF NOT EXISTS aprobado_por       text;

-- Desbloquear tiene_soporte (preparar para flujo)
-- (requiere lógica de negocio para actualizarlo)
```

### Fase 3 — Endpoints de escritura documental (P2, P3)

```
PATCH /api/cumplidos/:id/estado
PATCH /api/cumplidos/:id/documentos
PATCH /api/cumplidos/:id/observaciones
```

### Fase 4 — Corrección de bugs frontend (P6)

```typescript
// DetalleCumplido.tsx:32 — cambiar "DMY" → "MDY"
fmtTms(cumplido.activated_on, "MDY", ...)

// TimelineCumplido.tsx:87 — cambiar "DMY" → "MDY"
fmtTms(cumplido.activated_on, "MDY")
```

---

*Fin de la auditoría. Ningún archivo fue modificado durante este proceso.*
