# ERP_DATE_TIME_STANDARD.md
## Estándar Corporativo de Fechas, Horas y Zonas Horarias — ERP INLOP
**Versión:** 1.1 · **Estado:** Oficial · **Vigente desde:** Julio 2026 · **Última actualización:** Julio 2026

> Documento canónico de arquitectura. Toda implementación relacionada con fechas,
> horas o zonas horarias en el ERP INLOP **debe** respetar este estándar.
> Si una instrucción puntual contradice este documento, se detiene el trabajo
> y se eleva la contradicción antes de continuar.

---

## 1. Propósito

### 1.1 Objetivo

Definir una única forma oficial de manejar fechas, horas y zonas horarias en todo
el ecosistema ERP INLOP: almacenamiento, conversión, transmisión por API, comparaciones,
visualización e integraciones con sistemas externos.

Este documento nace de la Auditoría Integral de Fechas y Horas realizada en julio de 2026,
que identificó 9 hallazgos activos —3 críticos— causados por la ausencia de un estándar
unificado. El más grave (H-02) provocaba que la programación operativa completa del día
desapareciera de las pantallas de los operadores cada tarde a las 19:00 hora Colombia.

### 1.2 Alcance

Este estándar aplica a **todos** los módulos presentes y futuros del ERP INLOP:

- Solicitudes
- Programación
- Viajes
- Viajes Finalizados (Cumplidos)
- Centro GPS
- Cualquier módulo nuevo que se incorpore al ecosistema

Aplica a las siguientes capas técnicas:

- Backend Node.js (Railway)
- Frontend React (navegador)
- Integraciones externas (ControlT / TMS, Supabase)
- Infraestructura de despliegue (Railway, variables de entorno)

### 1.3 Precedencia

Este documento tiene la misma jerarquía que el `CLAUDE.md` del repositorio. Toda
decisión de implementación relacionada con fechas deberá referenciarse aquí primero.
En caso de conflicto entre este documento y una instrucción puntual de tarea,
prevalece este estándar.

---

## 2. Principios Arquitectónicos

Estas son las reglas que **ningún módulo puede romper**. Son no negociables.

### P-01 — Una sola zona horaria de negocio

El ERP opera exclusivamente en hora Colombia (`America/Bogota`, UTC−5). No existe
ningún otro contexto de negocio. Toda lógica de "hoy", "ahora", "ayer" o cualquier
cálculo relativo al tiempo presente debe producir resultados en hora Colombia.

### P-02 — El backend nunca asume su propia zona horaria

El servidor de Railway corre en UTC. Cualquier uso de `new Date()`, `Date.now()`,
`setHours()` o `.toISOString()` sin declaración explícita de zona horaria produce
resultados en UTC, no en Colombia. **El código nunca debe depender de la zona horaria
del servidor.** Toda función que calcule "hoy" o "ahora" en el backend debe declarar
explícitamente `America/Bogota`.

### P-03 — La conversión de zona horaria ocurre en un solo punto

La conversión entre UTC y hora Colombia ocurre **únicamente en la capa de API del
backend**, al construir filtros para consultas a Supabase o al calcular rangos de
"hoy". Ninguna otra capa convierte zonas horarias.

### P-04 — Los timestamps viajan con offset explícito

Todo timestamp que cruce la frontera entre capas (backend → API → frontend) debe
incluir el offset de zona horaria como parte del string ISO-8601. Ningún timestamp
viaja sin sufijo de zona.

### P-05 — El frontend solo muestra, nunca calcula fechas de negocio

El frontend recibe fechas ya correctas desde la API y las formatea para mostrar al
usuario. El frontend nunca calcula rangos de "hoy" para enviar al backend. Los
valores de rango por defecto los calcula el backend o se derivan en el frontend con
la función utilitaria corporativa `fechaHoyColombia()`.

### P-06 — Los strings de TMS son texto opaco hasta que se parsean con zona explícita

Los strings que llegan de ControlT (`"MM/DD/YYYY HH:MM:SS"`, `"DD/MM/YYYY HH:MM:SS"`)
representan hora Colombia local sin declaración de zona. **Nunca** se deben pasar a
`new Date(isoString)` sin agregar explícitamente el offset `−05:00`. El parseo que
no declara zona produce un Date incorrecto en el servidor (UTC) o ambiguo en el cliente.

### P-07 — Sin configuración implícita de timezone en infraestructura

No se configura `TZ=America/Bogota` en Railway ni en ninguna variable de entorno como
mecanismo de corrección. Las funciones de fecha deben ser correctas por su propio código,
no por depender de una variable de entorno que puede no existir en un ambiente nuevo,
en pruebas locales o en futuros despliegues.

### P-08 — Un solo patrón por operación

Para cada operación de fecha (calcular hoy, formatear para pantalla, parsear TMS,
construir filtro Supabase) existe exactamente una función oficial. No se reimplementa
la misma lógica en módulos distintos.

### P-09 — Single Source of Truth para fechas

Toda operación relacionada con fechas, horas o zonas horarias en el ERP INLOP
**debe** utilizar exclusivamente las funciones corporativas oficiales definidas en §10.

**Queda prohibido:**
- Implementar una versión alternativa de cualquier función corporativa en un módulo,
  hook, endpoint o script, aunque parezca equivalente.
- Copiar y pegar la lógica de una función corporativa en lugar de importarla.
- Tener más de una implementación activa de `fechaHoyColombia()`, `parseFechaTMS()`,
  `formatearFecha()` o cualquier otra función de §10 en el mismo repositorio.
- Introducir dependencias de fecha directas (llamadas a `new Date()`, `toISOString()`,
  `setHours()`, etc.) en capas que no sean las explícitamente autorizadas en §4.

Cuando un módulo nuevo necesite una operación de fecha que no está cubierta por las
funciones de §10, la solución es **extender las funciones corporativas**, no crear una
implementación paralela. La extensión se propone, se documenta aquí y se aprueba antes
de implementarse.

---

## 3. Zona Horaria Oficial del ERP

**Zona horaria oficial: `America/Bogota` · Offset fijo: `UTC−5` (`−05:00`)**

### 3.1 Justificación

- Colombia opera exclusivamente en `UTC−5`. No aplica horario de verano (DST).
  El offset `−05:00` es permanente durante todo el año.
- Todos los clientes del ERP operan desde Colombia.
- Todos los conductores y operaciones de campo ocurren en Colombia.
- ControlT (TMS) genera sus timestamps en hora Colombia local.
- Los operadores interpretan todas las fechas como hora Colombia.

### 3.2 Consecuencia directa

El offset `−05:00` puede usarse como constante en el código. No es necesario
resolver dinámicamente el offset de `America/Bogota` porque este nunca cambia.
Esto simplifica la implementación y la hace predecible.

### 3.3 Excepción documentada

Los campos de auditoría interna de Supabase (`created_at`, `updated_at` generados
por la base de datos) se almacenan en UTC. Estos campos **no se muestran al usuario**
y no requieren conversión. Son para trazabilidad técnica interna.

---

## 4. Arquitectura General del Flujo de Fechas

```
ControlT (TMS)
│  Formato: string local Colombia sin zona ("MM/DD/YYYY HH:MM:SS")
│  No tocar. No interpretar. Tratar como texto opaco.
▼
Backend — Capa de Parseo (ÚNICA capa autorizada para convertir TMS → Date)
│  Responsabilidad: parsear el string TMS agregando offset −05:00 explícito.
│  Resultado: objeto Date en memoria con zona correcta.
│  Nunca usar: new Date("YYYY-MM-DDTHH:MM:SS") sin sufijo de zona.
▼
Backend — Capa de Negocio (sync, filtros, derivaciones)
│  Responsabilidad: calcular "hoy Colombia", construir rangos, comparar fechas.
│  Siempre usar: fechaHoyColombia() para la fecha actual.
│  Siempre usar: Date.getTime() para comparaciones de instantes.
│  Prohibido: toISOString().slice(0,10) para obtener "hoy" o "ayer".
▼
Supabase — Almacenamiento
│  Formato entrada: ISO-8601 con offset explícito ("2026-07-28T14:00:00-05:00")
│  Formato salida: ISO-8601 con offset (timestamptz)
│  Filtros PostgREST: siempre con sufijo −05:00 en los extremos del rango.
│  Nunca filtrar con fechas UTC cuando el dato es de negocio Colombia.
▼
API — Respuesta JSON
│  Formato: ISO-8601 con offset para campos Supabase nativos.
│  Formato: string TMS original para campos copiados de ControlT (activated_on, etc.)
│  El string TMS se entrega tal cual — el frontend sabe cómo parsearlo.
│  Nunca reconvertir el string TMS a otro formato en el backend.
▼
Frontend — Capa de Parseo (SEGUNDA y última capa autorizada para parsear)
│  Para campos Supabase (ISO con offset): new Date(iso) → correcto en cualquier browser.
│  Para campos TMS (string MDY/DMY): parseFechaTMS(str, 'MDY'|'DMY') → Date local.
│  Prohibido: new Date(tmsString) directamente.
▼
Frontend — Componentes de Visualización (ÚNICA capa que formatea para pantalla)
│  Siempre usar las funciones corporativas: formatearFecha(), formatearHora(), etc.
│  Prohibido: toISOString() para mostrar al usuario.
│  Prohibido: new Date().toLocaleDateString() directamente en componentes.
▼
Usuario
   Ve siempre hora Colombia, formato DD/MM/YYYY HH:mm.
```

### 4.1 Puntos donde está permitido convertir fechas

| Punto | Operación permitida |
|---|---|
| Backend — parseo TMS | String TMS Colombia → `Date` con offset `−05:00` explícito |
| Backend — cálculo "hoy" | `fechaHoyColombia()` → string `YYYY-MM-DD` en hora Colombia |
| Backend — filtro Supabase | Construcción de rango con `T00:00:00.000-05:00` / `T23:59:59.999-05:00` |
| Frontend — parseo ISO | `new Date(isoConOffset)` para campos Supabase |
| Frontend — parseo TMS | `parseFechaTMS(str, formato)` para campos ControlT |
| Frontend — display | Funciones corporativas de formateo |

### 4.2 Puntos donde está prohibido convertir fechas

| Punto | Operación prohibida | Motivo |
|---|---|---|
| Backend — cualquier lugar | `new Date().toISOString().slice(0,10)` como "hoy" | Devuelve fecha UTC |
| Backend — parseSchedulate | `new Date("YYYY-MM-DDTHH:MM:SS")` sin sufijo | UTC en servidor |
| Frontend — hooks de módulo | Calcular rangos de "hoy" con `toISOString()` | UTC bias |
| Frontend — filtros client-side | `campo.slice(0,10)` sobre timestamps UTC | Fecha incorrecta |
| Componentes UI | Formatear fechas directamente sin función corporativa | Inconsistencia |
| Cualquier capa | Asumir que el string TMS ya incluye zona horaria | No la incluye |

---

## 5. Reglas de Almacenamiento

### 5.1 Supabase

| Tipo de campo | Formato en reposo | Ejemplo |
|---|---|---|
| Timestamps de negocio con hora | `timestamptz` — ISO-8601 UTC | `2026-07-28T19:00:00+00:00` |
| Fechas de programación (solo día) | `date` — YYYY-MM-DD en Colombia | `2026-07-28` |
| Strings TMS copiados de ControlT | `text` — se almacena el string original sin conversión | `"07/28/2026 14:00:00"` |
| Campos de auditoría internos | `timestamptz` generado por DB | No se muestran al usuario |

**Regla:** Cuando se escribe un timestamp de negocio en Supabase desde el backend,
siempre incluir el offset Colombia: `new Date().toISOString()` produce UTC (aceptable
para campos de auditoría técnica), pero para campos que el usuario ve, el offset
debe ser `−05:00` explícito.

**Regla:** Los campos `fecha_programada_dia` y equivalentes que almacenan solo la fecha
(sin hora) deben calcularse en hora Colombia, no en UTC. Una fecha calculada en UTC
puede ser el día siguiente al día real Colombia.

### 5.2 ControlT (TMS)

ControlT entrega strings de texto en dos formatos, sin declaración de zona:

| Campo | Formato TMS | Ejemplo | Zona implícita |
|---|---|---|---|
| `activated_on` | `MM/DD/YYYY HH:MM:SS` (MDY) | `"07/28/2026 14:30:00"` | Colombia |
| `created_on` | `MM/DD/YYYY HH:MM:SS` (MDY) | `"07/28/2026 08:00:00"` | Colombia |
| `latest_gps_report` | `MM/DD/YYYY HH:MM:SS` (MDY) | `"07/28/2026 13:45:22"` | Colombia |
| `schedulate_origin` | `DD/MM/YYYY HH:MM:SS` (DMY) | `"28/07/2026 07:00:00"` | Colombia |

Estos strings se almacenan en Supabase **tal cual**, en columnas `text`.
No se convierten en el backend. La conversión a `Date` ocurre solo cuando
se necesita para un cálculo (backend) o para mostrar (frontend).

### 5.3 Formato interno del ERP (en memoria)

Dentro de una ejecución (función de backend, hook de frontend), las fechas se
manipulan como objetos `Date` de JavaScript. Un `Date` es siempre UTC internamente;
su valor local depende del entorno. Por esto, **nunca se extrae la parte de fecha
de un `Date` con `.toISOString()`** a menos que la intención sea explícitamente UTC.
Se extraen siempre con los métodos de `Intl` o con `toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })`.

### 5.4 Formato que viaja por la API

| Tipo de dato | Formato en respuesta JSON | Ejemplo |
|---|---|---|
| Timestamp Supabase (timestamptz) | ISO-8601 con offset (tal como lo entrega Supabase) | `"2026-07-28T19:00:00+00:00"` |
| String TMS de ControlT | String original sin modificar | `"07/28/2026 14:30:00"` |
| Fecha solo-día de programación | `YYYY-MM-DD` en Colombia | `"2026-07-28"` |
| Parámetros de filtro recibidos por API | `YYYY-MM-DD` en Colombia (desde el frontend) | `"2026-07-28"` |

---

## 6. Reglas de Conversión

### 6.1 Dónde convertir

| Conversión | Capa responsable | Función a usar |
|---|---|---|
| String TMS → Date (para comparar) | Backend (sync) | `parseFechaTMS(str, 'MDY'\|'DMY')` — con sufijo `-05:00` |
| String TMS → string visual | Frontend (componente) | `parseFechaTMS()` → `formatearFecha()` |
| "Hoy" como string YYYY-MM-DD | Backend o frontend | `fechaHoyColombia()` |
| Timestamp ISO → fecha visual | Frontend (componente) | `formatearFecha(iso)` |
| Timestamp ISO → hora visual | Frontend (componente) | `formatearHora(iso)` |
| Rango Colombia → filtro Supabase | Backend (endpoint) | Agregar `T00:00:00.000-05:00` y `T23:59:59.999-05:00` |

### 6.2 Dónde NO convertir

- **Supabase** no convierte. Almacena y devuelve. No tiene lógica de negocio de fechas.
- **ControlT** no convierte. Genera los strings en su formato nativo. No se puede alterar.
- **Los componentes UI** no convierten. Reciben datos ya parseados y solo formatean para pantalla.
- **La capa de API en el backend** no convierte strings TMS — los pasa tal cual al frontend.
  Solo convierte cuando necesita comparar o filtrar (en ese caso usa `parseFechaTMS`).

### 6.3 Quién es responsable de cada conversión

| Responsable | Conversión que realiza |
|---|---|
| **Backend — capa de sync** | TMS string → Date (con offset −05:00) para comparaciones internas |
| **Backend — capa de endpoint** | Calcula "hoy Colombia" para filtros Supabase |
| **Backend — capa de endpoint** | Construye filtros PostgREST con sufijo −05:00 |
| **Frontend — función parseFechaTMS** | TMS string → Date (con offset −05:00) para display |
| **Frontend — funciones de formateo** | Date → string visual en formato corporativo |
| **Nadie más** | Ninguna otra capa tiene responsabilidad de conversión |

### 6.4 Capa que nunca modifica una fecha

**Los componentes UI son capa de solo lectura para fechas.** Reciben un `Date` o un
string ya parseado y llaman a la función de formateo. No aplican ninguna transformación
adicional, no comparan con "hoy", no calculan diferencias de tiempo.

---

## 7. Reglas de Visualización

### 7.1 Formatos oficiales

| Contexto | Formato | Ejemplo | Función a usar |
|---|---|---|---|
| Fecha sola | `DD/MM/YYYY` | `28/07/2026` | `formatearFecha(iso, 'fecha')` |
| Hora sola | `HH:mm` (24h) | `14:30` | `formatearFecha(iso, 'hora')` |
| Fecha y hora | `DD/MM/YYYY HH:mm` | `28/07/2026 14:30` | `formatearFecha(iso, 'completo')` |
| Fecha larga | `28 jul. 2026` | `28 jul. 2026` | `formatearFecha(iso, 'largo')` |
| Fecha y hora larga | `28 jul. 2026, 14:30` | — | `formatearFecha(iso, 'largo-hora')` |
| Valor ausente | `—` (guión largo) | `—` | Cualquier función devuelve `"—"` si recibe `null` |

### 7.2 Reglas por superficie

**Tabla de datos:**
- Fecha en línea 1: `DD/MM/YYYY` · color `var(--gray-500)` · 11px
- Hora en línea 2: `HH:mm` · color `var(--navy)` · 14px bold
- Componente estándar: `DateTimeCell` de `@/components/ui`
- Si la hora es `00:00`, no se muestra la segunda línea

**Drawer (panel lateral):**
- Fecha y hora completa: `28/07/2026 · 14:30`
- Función: `formatearFecha(iso, 'completo')`
- Color: `var(--gray-700)` para fecha, `var(--navy)` para hora

**Timeline:**
- Formato: `28 jul. 2026, 14:30`
- Si el timestamp es de ControlT (string MDY/DMY): parsear primero con `parseFechaTMS()`, luego formatear
- Si el timestamp es de Supabase (ISO): formatear directamente

**Filtros de rango de fechas:**
- El campo de entrada acepta: `YYYY-MM-DD` (formato estándar de `<input type="date">`)
- El label muestra: `DD/MM/YYYY`
- El valor enviado al backend: `YYYY-MM-DD` en hora Colombia

**KPIs:**
- Solo se muestran conteos (números). Nunca se muestran fechas directamente en un KPI.
- Si un KPI necesita contexto temporal ("Hoy", "Esta semana"), se muestra como subtítulo textual fijo.

### 7.3 Locale oficial

**Locale:** `es-CO` para todos los formatos con texto natural (nombres de meses, días).
**Formato de fecha numérico:** `DD/MM/YYYY` (no `MM/DD/YYYY`, no `YYYY-MM-DD`).
**Separador de hora:** `:` (dos puntos). No `h`, no punto.
**Formato 24 horas:** Siempre. No AM/PM en la UI.

---

## 8. Reglas para Comparaciones

### 8.1 Principio general

Toda comparación temporal que dependa de "cuándo es hoy en Colombia" debe usar
`fechaHoyColombia()`. Esta función es la única fuente de verdad para la fecha
actual del negocio.

**Prohibido:** calcular "hoy" de cualquier otra forma.
**Prohibido:** tener más de una implementación de "hoy" en el mismo repositorio.

### 8.2 Definiciones oficiales

| Período | Definición | Cómo calcular |
|---|---|---|
| **Hoy** | El día calendario actual en hora Colombia | `fechaHoyColombia()` → `YYYY-MM-DD` |
| **Ayer** | El día anterior en hora Colombia | `fechaHoyColombia(-1)` |
| **Últimos 7 días** | Desde hace 6 días hasta hoy inclusive | `fechaHoyColombia(-6)` → `fechaHoyColombia()` |
| **Últimos 30 días** | Desde hace 29 días hasta hoy inclusive | `fechaHoyColombia(-29)` → `fechaHoyColombia()` |
| **Programación del día** | Registros cuya `fecha_programada_dia` == `fechaHoyColombia()` | Filtro Supabase por igualdad de campo `date` |
| **Viajes activos** | Viajes con `activated_on` (Colombia) en el rango de fecha Colombia seleccionado | `parseFechaTMS()` → comparar con `fechaHoyColombia()` |
| **Filtro de tabla** | Rango seleccionado por el usuario en picker de fechas (Colombia) | Rango construido en backend con sufijo `−05:00` |

### 8.3 Cómo comparar dos instantes en el tiempo

Para comparar si un evento ocurrió antes o después de otro: usar
`Date.getTime()` (valor numérico en milisegundos desde epoch UTC). Dos objetos
`Date` correctamente construidos (con zona explícita) se comparan con `<`, `>` o
`===` sobre sus valores `.getTime()`. No comparar strings ISO directamente a menos
que ambos tengan exactamente el mismo formato y offset.

### 8.4 Cómo comparar fechas solo-día (sin hora)

Para saber si un registro pertenece a "hoy", "ayer" o un rango de días:
comparar el string `YYYY-MM-DD` (Colombia) del registro contra el string `YYYY-MM-DD`
devuelto por `fechaHoyColombia()`. Los strings `YYYY-MM-DD` se comparan lexicográficamente
de forma correcta (`<`, `>`, `===`).

**Nunca** comparar un string `YYYY-MM-DD` Colombia contra uno derivado de `.toISOString()`,
ya que el segundo puede ser un día UTC diferente.

### 8.5 Reglas específicas por módulo

**Solicitudes:** El filtro de rango se aplica sobre `creado_en`. La extracción de
la fecha de `creado_en` (timestamptz Supabase) para comparación client-side debe
hacerse con `toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })`, no con
`.slice(0, 10)`.

**Programación:** El campo `fecha_programada_dia` almacena la fecha Colombia del
viaje. El filtro de "hoy" es `fecha_programada_dia = fechaHoyColombia()`. La eliminación
de registros pasados usa `fecha_programada_dia < fechaHoyColombia()`.

**Viajes:** La fecha de un viaje se extrae de `activated_on` (string TMS MDY)
usando `parseFechaTMS(str, 'MDY')`, luego extrayendo año/mes/día con métodos locales
(`.getFullYear()`, `.getMonth()`, `.getDate()`). **Nunca** usar `.toISOString()` sobre
el Date resultante para obtener la fecha del viaje.

**Cumplidos:** Mismo patrón que Viajes para `activated_on`. Para `fecha_validacion`
(timestamptz Supabase), usar `new Date(iso)` directamente.

**GPS:** La frescura de `latest_gps_report` se calcula como
`Date.now() - parseFechaTMS(str, 'MDY').getTime()`. Ambos valores son milisegundos
desde epoch UTC; la diferencia es correcta independientemente de la zona horaria,
siempre que el parseo sea correcto (con offset `−05:00`).

---

## 9. Integraciones

### 9.1 ControlT (TMS)

| Aspecto | Regla |
|---|---|
| **Formato de entrada** | String texto sin zona horaria. Dos formatos posibles: MDY (`MM/DD/YYYY HH:MM:SS`) o DMY (`DD/MM/YYYY HH:MM:SS`). Cada campo tiene un formato fijo documentado. |
| **Zona implícita** | Siempre hora Colombia (UTC−5). |
| **Almacenamiento** | El string se copia tal cual a la columna `text` de Supabase. No se convierte en el backend. |
| **Parseo** | Solo cuando se necesita comparar (backend) o mostrar (frontend), usando `parseFechaTMS(str, formato)` que agrega `−05:00` explícito. |
| **Qué NO hacer** | Pasar el string directamente a `new Date()`. Interpretar los dígitos de mes/día sin saber el formato del campo específico. |
| **Documentación de formatos por campo** | `activated_on` → MDY · `created_on` → MDY · `latest_gps_report` → MDY · `schedulate_origin` → DMY |

### 9.2 Supabase

| Aspecto | Regla |
|---|---|
| **Escritura de timestamps** | Siempre con sufijo `−05:00` para datos de negocio Colombia. `new Date().toISOString()` produce UTC (`Z`) — no usar para campos visibles al usuario. |
| **Escritura de fechas solo-día** | Usar string `YYYY-MM-DD` Colombia (resultado de `fechaHoyColombia()` o equivalente). |
| **Filtros de rango en PostgREST** | Construir con `T00:00:00.000-05:00` (inicio del día Colombia) y `T23:59:59.999-05:00` (fin del día Colombia). |
| **Lectura** | Supabase devuelve `timestamptz` como ISO-8601 con offset. El frontend puede usarlo directamente con `new Date(iso)`. |
| **Campos `date` (sin hora)** | Se almacenan y comparan como strings `YYYY-MM-DD`. No se les agrega hora ni offset. |

### 9.3 Railway (servidor backend)

| Aspecto | Regla |
|---|---|
| **Zona del servidor** | UTC. Permanente. No configurable por este equipo. No se debe depender de ella. |
| **`new Date()` en el servidor** | Produce un instante UTC. Válido para campos de auditoría interna. Inválido para calcular "hoy Colombia". |
| **`setHours(0,0,0,0)` en el servidor** | Produce medianoche UTC, equivalente a las 19:00 Colombia. **Prohibido** usar para calcular inicio del día Colombia. |
| **`.toISOString().slice(0,10)` en el servidor** | Produce la fecha UTC, que puede ser un día adelante de la fecha Colombia. **Prohibido** usar como "hoy Colombia". |
| **Función oficial** | `fechaHoyColombia()` usando `toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })`. Válida en Node.js desde v12+. |

### 9.4 Frontend (navegador)

| Aspecto | Regla |
|---|---|
| **Zona del navegador** | Asumida como Colombia (América/Bogotá) para los operadores del ERP. |
| **`new Date(isoConOffset)`** | Correcto. El navegador aplica el offset declarado. |
| **`.get*()` sobre Date** | Devuelve valores en la zona del navegador. Correcto si el navegador está en Colombia. |
| **`.toISOString()`** | Siempre UTC. Solo para campos de auditoría o para comparar instantes como número. Nunca para extraer "la fecha local" de un evento. |
| **Riesgo de usuario fuera de Colombia** | Fuera del alcance actual. Si en el futuro hay usuarios en otras zonas, los métodos `.get*()` se reemplazarán por `Intl` con zona explícita. |

---

## 10. Funciones Corporativas

Las siguientes funciones deben existir como utilidades oficiales del ERP. Se definen
aquí su firma, propósito y contrato. **No se implementan en este documento.**

### 10.1 Frontend — `erp/src/utils/date.ts`

```
fechaHoyColombia(offsetDias?: number): string
```
- **Propósito:** Devuelve la fecha actual en hora Colombia como string `YYYY-MM-DD`.
- **Parámetro:** `offsetDias` (opcional, default 0). Negativo para días pasados, positivo para futuros.
- **Contrato:** Siempre devuelve un string `YYYY-MM-DD` en hora Colombia, sin importar
  la hora del servidor o del navegador.
- **Ejemplos de uso:** `fechaHoyColombia()` → `"2026-07-28"` · `fechaHoyColombia(-6)` → hace 6 días Colombia
- **Implementación guía:** `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })` para el día base; ajustar el offset sumando/restando milisegundos.
- **Reemplaza:** `hoy()`, `hace7dias()` actuales.

---

```
formatearFecha(
  iso: string | null | undefined,
  modo: 'fecha' | 'hora' | 'completo' | 'largo' | 'largo-hora'
): string
```
- **Propósito:** Formatea un timestamp ISO-8601 (con offset) para mostrar al usuario en hora Colombia.
- **Contrato:** Devuelve `"—"` si el argumento es `null`, `undefined` o string vacío.
- **Locale:** `es-CO`. **Zona de salida:** `America/Bogota`.
- **Reemplaza:** `fmtFecha()`, `fmtFechaCort()`, `fmtHora()`, `fmtDDMMYYYY()`, `fmtDDMMYYYYHm()`, `splitISO()` actuales.

---

```
parseFechaTMS(
  str: string | null | undefined,
  formato: 'MDY' | 'DMY'
): Date | null
```
- **Propósito:** Parsea un string de fecha de ControlT al objeto `Date` de JavaScript,
  declarando explícitamente el offset Colombia (`−05:00`).
- **Contrato:** Construye el Date como `new Date("YYYY-MM-DDTHH:MM:SS-05:00")`,
  garantizando la zona correcta en cualquier entorno (servidor UTC o navegador Colombia).
  Devuelve `null` si el string es inválido o vacío.
- **Formato MDY:** `MM/DD/YYYY HH:MM:SS` → campos: `activated_on`, `created_on`, `latest_gps_report`.
- **Formato DMY:** `DD/MM/YYYY HH:MM:SS` → campo: `schedulate_origin`.
- **Reemplaza:** `parseFechaMDY()`, `parseFechaDMY()` actuales (frontend y backend).

---

```
extraerFechaColombia(date: Date): string
```
- **Propósito:** Extrae la parte de fecha (`YYYY-MM-DD`) de un objeto `Date` en hora Colombia.
- **Contrato:** Usa `toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })`.
  Nunca usa `.toISOString().slice(0,10)`.
- **Uso:** En filtros client-side donde se necesita comparar la fecha-Colombia de un
  registro contra un rango YYYY-MM-DD.
- **Reemplaza:** El uso directo de `.toISOString().slice(0,10)` en filtros.

---

```
fresquraGPS(tmsStr: string | null | undefined): { horas: number; etiqueta: string; nivel: 'activo' | 'detenido' | 'desconectado' }
```
- **Propósito:** Calcula cuántas horas han pasado desde el último reporte GPS y devuelve
  la etiqueta y nivel de frescura.
- **Contrato:** Usa `parseFechaTMS(tmsStr, 'MDY')` para construir el Date con zona
  correcta. Calcula `(Date.now() - date.getTime()) / 3_600_000`. Umbrales: < 2h → activo,
  2–6h → detenido, > 6h → desconectado.
- **Reemplaza:** `gpsRelativo()` actual (frontend) y `derivarEstadoGps()` (backend).
  La lógica de nivel debe existir en un solo lugar.

### 10.2 Backend — `utils/fechas.js` (Node.js)

```
fechaHoyColombia(offsetDias = 0): string
```
- **Propósito y contrato:** Idéntico a la versión frontend.
- **Implementación guía:** `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })` funciona en Node.js v12+ con ICU completo. Ajustar offset con `Date` aritmético si se requiere.
- **Reemplaza:** Los tres lugares del backend que calculan `hoyStr` con `setHours(0,0,0,0)` + `toISOString().slice(0,10)`.

---

```
parseFechaTMS(str, formato = 'MDY'): Date | null
```
- **Propósito y contrato:** Idéntico a la versión frontend. Misma firma, mismo comportamiento.
- **Reemplaza:** `parseSchedulate()` y `parseFechaMDY()` del backend.

---

```
filtroRangoColombia(fechaDesde: string, fechaHasta: string): string
```
- **Propósito:** Construye el fragmento de query PostgREST para filtrar por rango de fechas Colombia.
- **Contrato:** Dado `fechaDesde = "2026-07-28"` y `fechaHasta = "2026-07-28"`, devuelve
  el par de parámetros `gte=2026-07-28T00:00:00.000-05:00&lte=2026-07-28T23:59:59.999-05:00`.
- **Reemplaza:** La construcción manual del filtro dispersa en cada endpoint.

---

## 11. Buenas Prácticas

### 11.1 Está permitido

```js
// ✅ Calcular "hoy" en Colombia (backend o frontend)
const hoy = fechaHoyColombia();

// ✅ Construir Date desde ISO con offset (frontend)
const d = new Date("2026-07-28T14:00:00-05:00"); // correcto en cualquier entorno

// ✅ Parsear string TMS con zona explícita
const d = parseFechaTMS("07/28/2026 14:30:00", "MDY"); // construye con -05:00

// ✅ Comparar instantes en el tiempo
if (d.getTime() >= hoyInicio.getTime()) { ... }

// ✅ Comparar fechas solo-día (strings YYYY-MM-DD)
if (fechaRegistro >= fechaDesde && fechaRegistro <= fechaHasta) { ... }

// ✅ Extraer fecha Colombia de un Date
const fechaStr = extraerFechaColombia(d); // usa Intl con America/Bogota

// ✅ Construir filtro Supabase con offset Colombia
const desde = `${fechaDesde}T00:00:00.000-05:00`;
const hasta  = `${fechaHasta}T23:59:59.999-05:00`;

// ✅ Formatear para pantalla con función corporativa
<DateTimeCell iso={solicitud.creado_en} />
formatearFecha(iso, 'completo')

// ✅ toISOString() para campos de auditoría técnica interna (no visibles al usuario)
actualizado_en: new Date().toISOString() // campos de trazabilidad, no de negocio
```

### 11.2 Está prohibido

```js
// ❌ Calcular "hoy" con toISOString() en cualquier entorno
const hoy = new Date().toISOString().slice(0, 10); // fecha UTC, no Colombia

// ❌ Calcular "medianoche" con setHours en servidor UTC
const inicio = new Date();
inicio.setHours(0, 0, 0, 0); // medianoche UTC = 19:00 Colombia

// ❌ Parsear string TMS sin offset
new Date("2026-07-28T14:30:00"); // ambiguo — UTC en servidor, local en browser

// ❌ Parsear string TMS con constructor de partes (sin offset)
new Date(y, m, d, h, min, s); // correcto en browser Colombia, incorrecto en servidor UTC

// ❌ Extraer fecha de un timestamp UTC haciendo slice
const fecha = "2026-07-28T23:30:00Z".slice(0, 10); // "2026-07-28" UTC, puede ser "2026-07-29" Colombia

// ❌ Usar formato de parser incorrecto para un campo
fmtTms(activated_on, "DMY"); // activated_on es MDY — produce fecha inválida o invertida

// ❌ Usar toISOString() después de un parseo local para obtener la fecha
const d = parseFechaMDY(str);     // correcto
const fecha = d.toISOString().slice(0, 10); // ❌ vuelve a UTC — incorrecto en browser Colombia tarde

// ❌ Calcular frescura GPS sin offset
const ts = new Date("07/28/2026 15:00:00"); // inválido — el navegador puede rechazarlo
const ts = parseFechaMDY("07/28/2026 15:00:00"); // sin offset — incorrecto en servidor

// ❌ Comparar strings ISO con zonas diferentes entre sí
if ("2026-07-28T14:00:00-05:00" < "2026-07-28T17:00:00Z") // apariencia correcta, trampa

// ❌ Filtrar Supabase con fechas sin offset
sbFetch(`/tabla?creado_en=gte.2026-07-28`); // Supabase interpreta como UTC, no Colombia

// ❌ Reimplementar la lógica de "hoy" en un nuevo módulo
const ahora = new Date();
const fechaHoy = `${ahora.getFullYear()}-${ahora.getMonth()+1}-${ahora.getDate()}`;
// Incorrecto en servidor + duplicación — usar fechaHoyColombia()
```

---

## 12. Matriz de Responsabilidades

| Responsabilidad | Frontend | Backend | API (endpoints) | Supabase | ControlT |
|---|:---:|:---:|:---:|:---:|:---:|
| Calcular "hoy Colombia" | ✅ | ✅ | — | ❌ | ❌ |
| Parsear string TMS → Date | ✅ | ✅ | — | ❌ | ❌ |
| Almacenar timestamps | ❌ | — | — | ✅ | — |
| Convertir zona horaria (UTC → Colombia) | ❌ | ✅ | ✅ | ❌ | ❌ |
| Construir filtros PostgREST con offset Colombia | — | — | ✅ | ❌ | ❌ |
| Formatear fechas para pantalla | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generar timestamps de auditoría interna | ❌ | ✅ | — | ✅ | — |
| Almacenar strings TMS sin conversión | ❌ | ✅ | — | ✅ | — |
| Declarar zona horaria en cada dato que genera | — | ✅ | ✅ | ✅ | ❌ |
| Calcular frescura GPS | ✅ | ✅ | — | ❌ | ❌ |
| Definir qué día pertenece a un trip (fecha Colombia) | — | ✅ | — | ❌ | — |

**Leyenda:** ✅ Responsable · ❌ Nunca · — No aplica directamente

---

## 13. Plan de Normalización

Los siguientes hallazgos de la Auditoría Integral (julio 2026) deben corregirse en
el orden indicado. Las fases con el mismo número se pueden ejecutar en paralelo si
los recursos lo permiten.

### Fase 1 — Emergencia (corregir antes de cualquier otra cosa)

Estos tres hallazgos se combinan en la misma causa raíz y pueden corregirse en
la misma sesión de trabajo.

| Hallazgo | Descripción | Archivo | Líneas | Impacto si no se corrige |
|---|---|---|---|---|
| **H-02** | `syncPlaneados` elimina la programación del día Colombia a las 19:00 | `index.js` | 659–750 | Toda la programación diaria desaparece cada tarde |
| **H-03** | `/api/programacion` calcula "hoy" en UTC | `index.js` | 2856–2918 | La API devuelve mañana desde las 19:00 Colombia |
| H-03b | `/api/planeados` calcula "hoy" en UTC | `index.js` | 2828–2840 | Mismo efecto en endpoint legacy |

**Acción:** Reemplazar los tres cálculos de "hoy" en el backend por `fechaHoyColombia()`
(función a crear como parte de esta fase o importar desde `utils/fechas.js`).

### Fase 2 — Urgente (corrección frontend de "hoy")

| Hallazgo | Descripción | Archivo | Líneas |
|---|---|---|---|
| **H-01** | `hoy()` y `hace7dias()` devuelven fechas UTC | `erp/src/utils/date.ts` | 5–14 |

**Acción:** Reemplazar la implementación de `hoy()` por `fechaHoyColombia()`.
Dado que `hace7dias()` usa el mismo patrón, corregir ambas en la misma intervención.

### Fase 3 — Alta prioridad (integridad de datos y GPS)

| Hallazgo | Descripción | Archivo | Líneas |
|---|---|---|---|
| **H-04** | `parseSchedulate` interpreta hora Colombia como UTC en servidor | `index.js` | 240–246 |
| **H-05** | `derivarEstadoGps` muestra unidades activas como desconectadas | `index.js` | 549–578 |

**Acción:** Crear `parseFechaTMS` en el backend con sufijo `−05:00` explícito.
Reemplazar `parseSchedulate` y la versión backend de `parseFechaMDY`. Refactorizar
`derivarEstadoGps` para usar la nueva función.

### Fase 4 — Media prioridad (correcciones frontend de módulos)

| Hallazgo | Descripción | Archivo | Líneas |
|---|---|---|---|
| **H-06** | `toDateISO` reconvierte a UTC después de parseo local | `useViajes.ts` | 10–14 |
| **H-07** | `TimelineCumplido` usa parser DMY sobre campo MDY | `TimelineCumplido.tsx` | 87, 100 |
| **H-08** | Filtro client-side de Solicitudes usa `.slice(0,10)` sobre UTC | `useSolicitudes.ts` | 71–75 |

**Acción:** Tres correcciones puntuales en tres archivos distintos. Pueden ser parte
de un mismo commit de "normalización de fechas frontend".

### Fase 5 — Estándar (prevención de regresiones futuras)

| Hallazgo | Descripción |
|---|---|
| **H-09** | Ausencia de documentación y utilidades centralizadas |

**Acción:** Crear el archivo `erp/src/utils/date.ts` refactorizado con todas las
funciones corporativas definidas en §10. Crear `utils/fechas.js` en el backend.
Agregar este documento al repositorio. Actualizar `CLAUDE.md` con referencia a este estándar.

### Resumen del plan

| Fase | Hallazgos | Urgencia | Esfuerzo estimado |
|---|---|---|---|
| 1 | H-02, H-03, H-03b | Emergencia — bloquea operación | 2–3 horas |
| 2 | H-01 | Urgente — afecta filtros diarios | 30 minutos |
| 3 | H-04, H-05 | Alta — afecta integridad y GPS | 2–3 horas |
| 4 | H-06, H-07, H-08 | Media — afecta módulos específicos | 2–3 horas |
| 5 | H-09 (arquitectural) | Estándar — prevención | 4–6 horas |

---

## 14. Política de Validación

Toda función corporativa de fechas debe validarse contra los siguientes casos antes
de considerarse correcta. Ninguna corrección se certifica sin evidencia de que al
menos los casos críticos (marcados con ⚠) pasan.

### 14.1 Casos obligatorios

| # | Escenario | Hora Colombia | Hora UTC | Comportamiento esperado | Criticidad |
|---|---|---|---|---|---|
| V-01 | Inicio de día Colombia | `00:00 COL` | `05:00 UTC` | `fechaHoyColombia()` devuelve el día Colombia iniciado, no el día UTC anterior | ⚠ Crítico |
| V-02 | Madrugada Colombia | `04:59 COL` | `09:59 UTC` | `fechaHoyColombia()` devuelve el día Colombia corriente | ⚠ Crítico |
| V-03 | Hora UTC 00:00 (19:00 COL) | `19:00 COL` | `00:00 UTC` | `fechaHoyColombia()` devuelve el día Colombia corriente (no el siguiente) | ⚠ Crítico |
| V-04 | Tarde Colombia pre-cambio | `18:59 COL` | `23:59 UTC` | `fechaHoyColombia()` devuelve el día Colombia corriente | ⚠ Crítico |
| V-05 | Tarde Colombia post-cambio | `19:00 COL` | `00:00 UTC (d+1)` | `fechaHoyColombia()` sigue devolviendo el día Colombia corriente | ⚠ Crítico |
| V-06 | Fin de día Colombia | `23:59 COL` | `04:59 UTC (d+1)` | `fechaHoyColombia()` devuelve el día Colombia corriente | ⚠ Crítico |
| V-07 | Cambio de mes | `23:59 COL del último día del mes` | `04:59 UTC del día 1 del mes siguiente` | `fechaHoyColombia()` devuelve el último día del mes Colombia | Alto |
| V-08 | Cambio de año | `23:59 COL del 31 de diciembre` | `04:59 UTC del 1 de enero` | `fechaHoyColombia()` devuelve `"YYYY-12-31"` Colombia | Alto |
| V-09 | Año bisiesto | `29 de febrero a cualquier hora` | Cualquier UTC del mismo día Colombia | `fechaHoyColombia()` devuelve `"YYYY-02-29"` correctamente | Medio |
| V-10 | Valor nulo | `null` o `undefined` en campo de fecha | — | Las funciones de formateo devuelven `"—"`. Las de parseo devuelven `null`. | Alto |
| V-11 | Valor inválido | String que no coincide con el formato esperado | — | `parseFechaTMS()` devuelve `null`. `formatearFecha()` devuelve `"—"`. No lanza excepción. | Alto |
| V-12 | Offset con días | `fechaHoyColombia(-6)` a las `19:30 COL` | `00:30 UTC (d+1)` | Devuelve la fecha Colombia de hace 6 días, no hace 6 días desde mañana UTC | Medio |

### 14.2 Estrategia de validación

Dado que el ERP no tiene cobertura de tests automatizados actualmente (deuda técnica H-09),
la validación de las funciones corporativas se realiza mediante:

1. **Script de validación manual** ejecutado en Node.js antes de cada release de fecha:
   simula las horas críticas usando `Date` con offsets manuales o mediante variables
   de entorno `TZ` en el script de prueba (no en producción).
2. **Validación en Railway** tras el deploy: observación directa del comportamiento
   de Programación a las 19:00–19:10 Colombia en el ambiente de desarrollo.
3. **Log de evidencia** en el commit que corrige cada hallazgo: captura o salida de
   consola que demuestre los casos V-01 a V-06 pasando.

Cuando se implementen tests automatizados (Fase 5 del plan de normalización), los
casos V-01 a V-11 deben convertirse en tests unitarios de las funciones corporativas.

---

## 15. Matriz de Cobertura del Estándar

Registra el estado de normalización de cada módulo respecto a este estándar.
Un módulo se considera **Normalizado** únicamente cuando todos sus hallazgos activos
están corregidos y sus implementaciones de fecha cumplen los principios P-01 a P-09.

### 15.1 Estado por módulo (frontend)

| Módulo | Archivo principal | Estado | Hallazgos activos | Fase de corrección |
|---|---|---|---|---|
| Utilidades de fecha | `erp/src/utils/date.ts` | ⏳ Pendiente de Normalización | H-01 | Fase 2 |
| Utilidades de parseo | `erp/src/utils/parseFecha.ts` | ⏳ Pendiente de Normalización | H-06, H-07 (indirectos) | Fase 4 |
| Solicitudes | `erp/src/modules/solicitudes/` | ⏳ Pendiente de Normalización | H-01 (indirecto), H-08 | Fases 2, 4 |
| Programación | `erp/src/modules/programacion/` | ⏳ Pendiente de Normalización | H-01 (indirecto) | Fase 2 |
| Viajes | `erp/src/modules/viajes/` | ⏳ Pendiente de Normalización | H-06 | Fase 4 |
| Cumplidos | `erp/src/modules/cumplidos/` | ⏳ Pendiente de Normalización | H-07 | Fase 4 |
| Centro GPS | `erp/src/modules/gps/` | ⏳ Pendiente de Normalización | H-05 (parcial, frontend correcto) | Fase 3 |
| Componentes UI compartidos | `erp/src/components/ui/TableCells.tsx` | ✅ Conforme | Ninguno activo | — |

### 15.2 Estado por módulo (backend)

| Módulo | Función / Endpoint | Estado | Hallazgos activos | Fase de corrección |
|---|---|---|---|---|
| `utils/fechas.js` | `fechaHoyColombia()` | ⏳ Pendiente de creación | — | **Fase 1 (en curso)** |
| Sync Programación | `syncPlaneados()` | ⏳ Pendiente de Normalización | H-02, H-04 | **Fase 1** (H-02), Fase 3 (H-04) |
| API Programación | `GET /api/programacion` | ⏳ Pendiente de Normalización | H-03 | **Fase 1 (en curso)** |
| API Planeados | `GET /api/planeados` | ⏳ Pendiente de Normalización | H-03b | **Fase 1 (en curso)** |
| API Solicitudes | `GET /api/solicitudes` | ✅ Conforme | Ninguno activo | — |
| Parse TMS backend | `parseSchedulate()` | ⏳ Pendiente de Normalización | H-04 | Fase 3 |
| Estado GPS backend | `derivarEstadoGps()` | ⏳ Pendiente de Normalización | H-05 | Fase 3 |

### 15.3 Leyenda de estados

| Estado | Significado |
|---|---|
| ✅ Conforme | El módulo cumple el estándar V1.1. Sin hallazgos activos. |
| ⏳ Pendiente de Normalización | Tiene hallazgos activos. Corrección programada en el plan de normalización (§13). |
| 🔄 En corrección | Corrección actualmente en progreso (rama de trabajo activa). |
| ❌ Bloqueado | Corrección bloqueada por dependencia de otro hallazgo o decisión pendiente. |

---

## Apéndice A — Referencia Rápida

### ¿Cómo obtengo la fecha de hoy en Colombia?

```js
// Frontend y Backend — función corporativa
const hoy = fechaHoyColombia(); // "2026-07-28"
```

### ¿Cómo parseo un string de ControlT?

```js
// Para activated_on, created_on, latest_gps_report (formato MDY)
const d = parseFechaTMS("07/28/2026 14:30:00", "MDY");

// Para schedulate_origin (formato DMY)
const d = parseFechaTMS("28/07/2026 14:30:00", "DMY");
```

### ¿Cómo construyo un filtro Supabase por rango de fechas Colombia?

```js
// Backend
const desde = `${fechaDesde}T00:00:00.000-05:00`;
const hasta  = `${fechaHasta}T23:59:59.999-05:00`;
// → sbFetch(`/tabla?campo=gte.${encodeURIComponent(desde)}&campo=lte.${encodeURIComponent(hasta)}`)
```

### ¿Cómo muestro una fecha en pantalla?

```jsx
// Componente tabla (fecha + hora en dos líneas)
<DateTimeCell iso={row.creado_en} />

// Texto libre
formatearFecha(iso, 'completo') // "28/07/2026 14:30"
formatearFecha(iso, 'largo-hora') // "28 jul. 2026, 14:30"
```

### ¿Cómo comparo si un registro es de "hoy"?

```js
const fechaRegistro = extraerFechaColombia(parseFechaTMS(row.activated_on, "MDY"));
const hoy = fechaHoyColombia();
const esDeHoy = fechaRegistro === hoy;
```

---

---

## Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| **V1.1** | Julio 2026 | Agregado P-09 (Single Source of Truth). Agregada §14 Política de Validación (12 casos). Agregada §15 Matriz de Cobertura del Estándar. Actualización de estados: `syncPlaneados`, `/api/programacion`, `/api/planeados` marcados como "En corrección" (Fase 1 en curso). |
| **V1.0** | Julio 2026 | Versión inicial. 13 secciones, 8 principios, 9 integraciones, 5 funciones corporativas, plan de normalización de 5 fases. Basado en Auditoría Integral de Fechas (9 hallazgos). |

---

*ERP INLOP · Estándar Corporativo de Fechas, Horas y Zonas Horarias · V1.1 · Julio 2026*
*Basado en: Auditoría Integral de Fechas — 9 hallazgos (3 Críticos, 2 Altos, 4 Medios/Bajos)*
*Rama de trabajo: `claude/clever-edison-y3au9r`*
