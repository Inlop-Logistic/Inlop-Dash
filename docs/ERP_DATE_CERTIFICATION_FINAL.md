# ERP_DATE_CERTIFICATION_FINAL.md
## Certificación Definitiva del Sistema de Fechas y Horas — ERP INLOP

**Versión:** 1.0 · **Fecha de certificación:** 2026-07-28 · **Zona:** America/Bogota (UTC−5 fijo)
**Auditor:** Claude Code · **Estado:** ✅ CERTIFICADO

---

## 1. Resumen Ejecutivo

El sistema de fechas y horas del ERP INLOP ha sido auditado, corregido y certificado en su
totalidad. Se identificaron y corrigieron **9 archivos** con lógica de fecha deficiente,
incluyendo el bug crítico de producción reportado (DatePicker mostrando 28/07 cuando Colombia
era 27/07 a las 21:20 h).

**Causa raíz del bug de producción:** `DateRangePicker.tsx` tenía funciones locales `toISO()`
y `today()` que usaban `.toISOString().slice(0,10)` — extracción de fecha UTC. A las 19:00 COL
(00:00 UTC del día siguiente), este cálculo adelantaba la fecha un día.

**Resultado:** 30 casos de prueba ejecutados. 30 pasaron. 0 fallaron.

---

## 2. Componentes Auditados

| # | Archivo | Patrón Encontrado | Evaluación |
|---|---------|------------------|------------|
| 1 | `utils/date.ts` | `new Date()` en `fechaHoyColombia()` | ✓ Correcto — función corporativa oficial |
| 2 | `utils/parseFecha.ts` | `Date.now()` en `gpsRelativo()` | ✓ Correcto — diferencia de ms, timezone-agnostic |
| 3 | `components/ui/DateRangePicker.tsx` | `toISOString().slice(0,10)`, `Date.now()`, `new Date()` | ✗ Corregido — bug de producción |
| 4 | `hooks/useFiltrosComunes.ts` | `defaultDesde`, `defaultHasta` | ✓ Correcto — acepta YYYY-MM-DD Colombia |
| 5 | `modules/solicitudes/hooks/useSolicitudes.ts` | `hoy()`, `hace7dias()`, `extraerFechaColombia()` | ✓ Correcto — usa helpers corporativos |
| 6 | `modules/viajes/hooks/useViajes.ts` | `parseFechaTMS()`, `extraerFechaColombia()` | ✓ Correcto — certificado en Sprint 2 |
| 7 | `modules/programacion/hooks/useProgramacion.ts` | `.getFullYear()/.getMonth()/.getDate()` (hora local) | ✗ Corregido — migrado a `extraerFechaColombia()` |
| 8 | `modules/programacion/constants.ts` | `new Date(schedulate_origin)` — string DMY inválido | ✗ Corregido — parseo correcto con `parseFechaDMY()` |
| 9 | `modules/programacion/components/ProgramacionTableColumns.tsx` | `.getDate()/.getMonth()/.getFullYear()/.getHours()` (hora local) | ✗ Corregido — migrado a Colombia timezone |
| 10 | `modules/cumplidos/hooks/useCumplidos.ts` | `.getFullYear()/.getMonth()/.getDate()` (hora local) | ✗ Corregido — migrado a `extraerFechaColombia()` |
| 11 | `modules/cumplidos/components/CumplidosTableColumns.tsx` | `.getDate()/.getHours()` (hora local) | ✗ Corregido — migrado a Colombia timezone |
| 12 | `modules/viajes/components/ViajesTableColumns.tsx` | `.getDate()/.getHours()` (hora local) | ✗ Corregido — migrado a Colombia timezone |
| 13 | `modules/gps/hooks/useGps.ts` | `new Date()` en `setLastRefresh` | ✓ Correcto — timestamp para cálculo de antigüedad (ms diff) |
| 14 | `modules/gps/GpsPage.tsx` | `new Date()` en ticker de reloj | ✓ Correcto — diferencia de ms para "hace Xs/Xm" |
| 15 | `modules/comercial/components/TabIdentidades.tsx` | `toLocaleDateString` sin `timeZone` | ✗ Corregido — agregado `timeZone: 'America/Bogota'` |

---

## 3. Componentes Corregidos

### 3.1 `utils/date.ts` — Nueva función `sumarDias()`

**Problema:** no existía un helper corporativo para aritmética de fechas sobre strings YYYY-MM-DD.
Los componentes resolvían esto con `new Date(ymd + "T00:00:00").getTime() + N*86400000` seguido de
`.toISOString()` — resultado incorrecto si el browser no estaba en UTC.

**Corrección:** `sumarDias(ymd: string, n: number): string` — construye UTC-midnight del día base,
suma N días en UTC puro, extrae la fecha UTC. El resultado es siempre el día calendario correcto.

```typescript
export function sumarDias(ymd: string, n: number): string {
  const [Y, M, D] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
```

---

### 3.2 `components/ui/DateRangePicker.tsx` — Bug de producción

**Problema:** funciones locales `toISO()` y `today()` usaban `.toISOString().slice(0,10)` (UTC).
A las 19:00 COL el UTC avanza al día siguiente, haciendo que "Hoy" mostrara mañana. Los shortcuts
"Últimos 7d" y "Últimos 30d" usaban `Date.now()` (UTC) y el mismo `toISO()` — también adelantados.
El constraint de 30 días también usaba `toISO()` — potencialmente incorrecto en browsers no UTC.

**Corrección:**
- Eliminadas `toISO()` y `today()` locales.
- `fechaHoyColombia()` importada desde `@/utils/date` para obtener la fecha actual Colombia.
- `sumarDias()` para arithmetic de rangos y MAX_DAYS constraint.
- `fmtLabel()` y `diffDays()` internos usan UTC noon (`T12:00:00Z`) para formateo y `Date.UTC` para diferencias — ambos seguros.
- Shortcuts calculados como `fechaHoyColombia()`, `sumarDias(hoy, -6)`, `sumarDias(hoy, -29)`.

---

### 3.3 `modules/programacion/hooks/useProgramacion.ts` — `schedulateToISO()`

**Problema:** usaba `.getFullYear()/.getMonth()/.getDate()` (hora local del browser) sobre un
`Date` con offset Colombia. En browsers fuera de UTC-5, la fecha extraída podía diferir.

**Corrección:** `return extraerFechaColombia(d)` — extrae YYYY-MM-DD siempre en Colombia.

---

### 3.4 `modules/programacion/constants.ts` — `estadoVisual()`

**Problema:** `new Date(v.schedulate_origin)` donde `schedulate_origin` es "DD/MM/YYYY HH:MM:SS".
V8/Node.js no reconoce este formato — devuelve `Invalid Date`. La comparación `Invalid Date < new Date()`
retorna `false`, por lo que el estado "vencido" **nunca se activaba** (bug silencioso).

**Corrección:** `const d = parseFechaDMY(v.schedulate_origin); if (d && d.getTime() < Date.now()) return "vencido";`
— ahora el estado "vencido" funciona correctamente.

---

### 3.5 `modules/programacion/components/ProgramacionTableColumns.tsx` — `splitSchedulate()`

**Problema:** `.getDate()/.getMonth()/.getFullYear()/.getHours()/.getMinutes()` — hora local.

**Corrección:** `extraerFechaColombia(d)` para la fecha; `d.toLocaleTimeString('en-US', { timeZone: 'America/Bogota', hour12: false })` para la hora.

---

### 3.6 `modules/cumplidos/hooks/useCumplidos.ts` — `activatedOnISO()`

**Problema:** `.getFullYear()/.getMonth()/.getDate()` — hora local.

**Corrección:** `return extraerFechaColombia(d)`.

---

### 3.7 `modules/cumplidos/components/CumplidosTableColumns.tsx` — `splitActivatedOn()`

**Problema:** `.getDate()/.getMonth()/.getFullYear()/.getHours()/.getMinutes()` — hora local.

**Corrección:** `extraerFechaColombia(d)` para fecha; `toLocaleTimeString` con `timeZone: 'America/Bogota'`.

---

### 3.8 `modules/viajes/components/ViajesTableColumns.tsx` — renderer `activated_on`

**Problema:** `.getDate()/.getMonth()/.getFullYear()/.getHours()/.getMinutes()` — hora local.

**Corrección:** `extraerFechaColombia(d)` para fecha; `toLocaleTimeString` con `timeZone: 'America/Bogota'`.

---

### 3.9 `modules/comercial/components/TabIdentidades.tsx` — `fmtFecha()`

**Problema:** `d.toLocaleDateString("es-CO", { ... })` sin `timeZone` — usa timezone del browser.

**Corrección:** `d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", ... })`.

---

## 4. Evidencias

### 4.1 Bug de producción reproducido

| Hora Colombia | UTC (Railway) | `today()` BUGGY | `fechaHoyColombia()` |
|---|---|---|---|
| 06:00 | 11:00 UTC | 2026-07-27 (ok por coincidencia) | 2026-07-27 ✅ |
| 18:59 | 23:59 UTC | 2026-07-27 (ok por coincidencia) | 2026-07-27 ✅ |
| **19:00** | **00:00 UTC +1d** | **2026-07-28 ❌** | **2026-07-27 ✅** |
| **21:20** | **02:20 UTC +1d** | **2026-07-28 ❌** | **2026-07-27 ✅** (bug reportado) |
| **23:59** | **04:59 UTC +1d** | **2026-07-28 ❌** | **2026-07-27 ✅** |
| 00:01 | 05:01 UTC | 2026-07-27 (ok) | 2026-07-27 ✅ |

### 4.2 Estado "vencido" en Programación — bug adicional descubierto

| Valor | `new Date()` directo | `parseFechaDMY()` |
|---|---|---|
| `"27/07/2026 08:00:00"` | `Invalid Date` → condición siempre falsa | `Date` válido → "vencido" ✅ |

---

## 5. Archivos Modificados

| Archivo | Tipo de cambio |
|---------|----------------|
| `erp/src/utils/date.ts` | Nueva función `sumarDias()` |
| `erp/src/components/ui/DateRangePicker.tsx` | Reescritura de `toISO()`, `today()`, shortcuts — bug de producción |
| `erp/src/modules/programacion/hooks/useProgramacion.ts` | `schedulateToISO()` → `extraerFechaColombia()` |
| `erp/src/modules/programacion/constants.ts` | `estadoVisual()` → `parseFechaDMY()` |
| `erp/src/modules/programacion/components/ProgramacionTableColumns.tsx` | `splitSchedulate()` → Colombia timezone |
| `erp/src/modules/cumplidos/hooks/useCumplidos.ts` | `activatedOnISO()` → `extraerFechaColombia()` |
| `erp/src/modules/cumplidos/components/CumplidosTableColumns.tsx` | `splitActivatedOn()` → Colombia timezone |
| `erp/src/modules/viajes/components/ViajesTableColumns.tsx` | renderer `activated_on` → Colombia timezone |
| `erp/src/modules/comercial/components/TabIdentidades.tsx` | `fmtFecha()` → `timeZone: 'America/Bogota'` |

---

## 6. Casos de Prueba Ejecutados

### Suite completa — 30 casos, 0 fallos

#### Bloque 1: `fechaHoyColombia()` vs UTC (7 casos)
Verifica que la fecha "Hoy" sea siempre la fecha Colombia real, independientemente de UTC.

| Hora Colombia | UTC | Resultado |
|---|---|---|
| 06:00 | 11:00 | 2026-07-27 ✅ |
| 12:00 | 17:00 | 2026-07-27 ✅ |
| 18:59 | 23:59 | 2026-07-27 ✅ |
| 19:00 | 00:00+1d | 2026-07-27 ✅ |
| 21:00 | 02:00+1d | 2026-07-27 ✅ |
| 23:59 | 04:59+1d | 2026-07-27 ✅ |
| 00:01 | 05:01 | 2026-07-27 ✅ |

#### Bloque 2: `sumarDias()` — aritmética de fechas (7 casos)
Suma/resta de días sobre strings YYYY-MM-DD, incluyendo cruces de mes y año.

| Caso | Resultado |
|---|---|
| `sumarDias("2026-07-27", 0)` | 2026-07-27 ✅ |
| `sumarDias("2026-07-27", 1)` | 2026-07-28 ✅ |
| `sumarDias("2026-07-27", -6)` | 2026-07-21 ✅ (Últimos 7d) |
| `sumarDias("2026-07-27", -29)` | 2026-06-28 ✅ (Últimos 30d) |
| `sumarDias("2026-07-27", 30)` | 2026-08-26 ✅ (MAX_DAYS) |
| `sumarDias("2026-12-31", 1)` | 2027-01-01 ✅ (cruce de año) |
| `sumarDias("2026-02-28", 1)` | 2026-03-01 ✅ (fin de febrero) |

#### Bloque 3: Shortcuts DateRangePicker a las 21:00 COL (3 casos)

| Shortcut | BUGGY (UTC) | Corregido (Colombia) |
|---|---|---|
| Hoy | 2026-07-28 ❌ | 2026-07-27 ✅ |
| Últimos 7d | 2026-07-22 | 2026-07-21 ✅ |
| Últimos 30d | 2026-06-29 | 2026-06-28 ✅ |

#### Bloque 4: `extraerFechaColombia()` en filtros client-side (6 casos)
Extracción de fecha Colombia desde timestamps ISO, incluyendo los puntos críticos de medianoche.

| Timestamp | Fecha Colombia |
|---|---|
| 2026-07-27T23:59:00-05:00 | 2026-07-27 ✅ |
| 2026-07-28T00:00:00-05:00 | 2026-07-28 ✅ |
| 2026-07-27T19:00:00-05:00 | 2026-07-27 ✅ |
| 2026-07-28T02:00:00Z (21h COL) | 2026-07-27 ✅ |
| 2026-07-28T04:59:00Z (23:59 COL) | 2026-07-27 ✅ |
| 2026-07-28T05:00:00Z (00:00 COL) | 2026-07-28 ✅ |

#### Bloque 5: `parseFechaTMS()` + `extraerFechaColombia()` en filtros (6 casos)
Parseo de strings TMS (MDY y DMY) con extracción Colombia correcta.

| Input TMS | Formato | Fecha Colombia |
|---|---|---|
| `27/07/2026 21:00:00` | DMY | 2026-07-27 ✅ |
| `07/27/2026 21:00:00` | MDY | 2026-07-27 ✅ |
| `28/07/2026 00:01:00` | DMY | 2026-07-28 ✅ |
| `07/28/2026 00:01:00` | MDY | 2026-07-28 ✅ |
| `27/07/2026 18:59:00` | DMY | 2026-07-27 ✅ |
| `27/07/2026 19:00:00` | DMY | 2026-07-27 ✅ |

#### Bloque 6: `estadoVisual()` con `parseFechaDMY()` (1 caso)
Verifica que el estado "vencido" ahora funcione correctamente.

| Input | Antes (Bug) | Después |
|---|---|---|
| `"27/07/2026 08:00:00"` | `Invalid Date` → nunca "vencido" | Fecha válida → "vencido" ✅ |

---

## 7. Resultados

```
═══════════════════════════════════════════════════════════
  RESULTADO FINAL: 30 pruebas pasaron · 0 fallaron
═══════════════════════════════════════════════════════════
```

TypeScript (`tsc --noEmit`): **0 errores**

---

## 8. Riesgos Restantes

No existen riesgos de fecha activos post-certificación. Los dos items siguientes son
históricos / de mejora de calidad, no bugs funcionales:

| ID | Descripción | Severidad | Fase sugerida |
|----|-------------|-----------|---------------|
| R-01 | `useSolicitudes.ts` llama `hoy()` y `hace7dias()` (wrappers `@deprecated`). Funcionan correctamente pero podrían migrarse a `fechaHoyColombia()`. | Baja / estética | Cuando se refactorice el módulo Solicitudes |
| R-02 | `useProgramacion.ts` llama `hoy()` (wrapper `@deprecated`). Ídem. | Baja / estética | Cuando se refactorice el módulo Programación |

---

## 9. Certificación Final

### ✅ Criterios de éxito — todos cumplidos

| Criterio | Estado |
|----------|--------|
| Todo el ERP usa el estándar corporativo de fechas | ✅ Cumplido |
| No existen cálculos paralelos de "Hoy" | ✅ Cumplido — eliminados `toISO()` y `today()` locales de DateRangePicker |
| No existen DatePicker mostrando fechas adelantadas | ✅ Cumplido — bug de producción corregido |
| No existen filtros afectados por UTC | ✅ Cumplido — todos los filtros usan `extraerFechaColombia()` |
| El proyecto queda certificado para America/Bogota | ✅ Cumplido — 30/30 pruebas pasando |

### Validación de la certificación

| Verificación | Resultado |
|---|---|
| `fechaHoyColombia()` a las 21:00 COL devuelve fecha Colombia correcta | ✅ |
| DatePicker shortcut "Hoy" a las 21:00 COL muestra 27/07, no 28/07 | ✅ |
| Filtros de fecha en Viajes, Solicitudes, Programación, Cumplidos usan zona Colombia | ✅ |
| Columnas de tabla en todos los módulos muestran fecha/hora Colombia | ✅ |
| `estadoVisual("vencido")` funciona correctamente en Programación | ✅ |
| TypeScript compila sin errores | ✅ |

---

## 10. Conclusión

El sistema de manejo de fechas y horas del ERP INLOP queda **definitivamente cerrado y
certificado** para la zona `America/Bogota (UTC−5)`.

Todos los cálculos de fecha "Hoy" dependen exclusivamente de `fechaHoyColombia()`.
Toda aritmética de rangos usa `sumarDias()`. Toda extracción de fecha Colombia desde
un `Date` usa `extraerFechaColombia()`. Ningún componente calcula fechas de forma
independiente al módulo corporativo `utils/date.ts`.

El bug de producción (DatePicker mostrando mañana después de las 19:00 hora Colombia)
queda corregido definitivamente.

---

_Certificado por auditoría técnica completa · ERP INLOP · 2026-07-28_
_Rama: `claude/clever-edison-y3au9r` · ERP_DATE_TIME_STANDARD.md V1.2_
