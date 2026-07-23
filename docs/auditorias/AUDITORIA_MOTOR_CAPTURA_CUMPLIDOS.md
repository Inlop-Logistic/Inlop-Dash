# Auditoría Complementaria — Motor de Captura de Cumplidos

**Fecha:** 2026-07-23
**Repositorio:** inlop-logistic/inlop-dash
**Rama auditada:** `claude/clever-edison-y3au9r`
**Alcance:** Solo lectura. Sin modificaciones. Solo `index.js` y funciones directamente relacionadas.

---

## 1. ¿Cómo detecta exactamente `syncCumplidos()` que un viaje ya no existe en ControlT?

**Evidencia — `index.js:1182–1186`:**

```javascript
const existentesRaw = await sbFetch(
  '/cumplidos?select=id,estado_cumplido,tiene_soporte,cliente,empresa_cliente_id&limit=1000'
);
const existentes = new Map((existentesRaw || []).map(c => [c.id, c]));

const ESTADOS_ACTIVOS = new Set(['LIVE', 'SOLICITADO', 'CUMPLIDO RECIBIDO']);
const apiSet = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));
```

**Algoritmo paso a paso:**

1. **Consulta Supabase** — obtiene hasta 1.000 filas de la tabla `cumplidos` (campos: `id`, `estado_cumplido`, `tiene_soporte`, `cliente`, `empresa_cliente_id`). Construye `existentes`: un `Map<trip_number, fila>`.

2. **Construye `apiSet`** — toma `cache.viajes.data` (snapshot en memoria de ControlT en ese instante) y construye un `Set<trip_number>` con todos los viajes actualmente visibles en el TMS.

3. **Primer bucle (líneas 1189–1242)** — recorre `cache.viajes.data`. Para cada viaje: si no existe en `existentes` → INSERT; si existe → PATCH de `estado_controlt` y `pct`.

4. **Segundo bucle (líneas 1245–1257)** — recorre `existentes` (los de Supabase). Para cada fila de BD:
   - Evalúa si `estado_cumplido` pertenece a `ESTADOS_ACTIVOS` (`'LIVE'`, `'SOLICITADO'`, `'CUMPLIDO RECIBIDO'`).
   - Evalúa si el `id` **NO** está en `apiSet`.
   - Si ambas condiciones son `true` → el viaje **desapareció del TMS** → transición a estado final.

```javascript
// index.js:1245–1256
for (const [id, c] of existentes) {
  const estadoActivo = ESTADOS_ACTIVOS.has((c.estado_cumplido || '').toUpperCase());
  if (estadoActivo && !apiSet.has(id)) {
    const nuevoEstado = c.tiene_soporte ? 'PENDIENTE LIQUIDACION' : 'FINALIZADO CONTROLT';
    await sbFetch(
      `/cumplidos?id=eq.${encodeURIComponent(id)}`,
      'PATCH',
      { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() }
    );
  }
}
```

---

## 2. ¿Qué estructuras compara?

No compara un "cache anterior" con un "cache actual". Las dos estructuras que compara son:

| Estructura | Origen | Tipo | Qué contiene |
|---|---|---|---|
| `existentes` | Supabase tabla `cumplidos` | `Map<string, object>` | Todos los viajes que alguna vez fueron capturados (máx. 1.000) |
| `apiSet` | `cache.viajes.data` (memoria) | `Set<string>` | Solo los `trip_number` visibles en ControlT en **este momento** |

**No existe comparación de cache anterior vs cache actual.** El mecanismo es siempre: "¿está este viaje de BD en el TMS ahora mismo?". Si no está → se considera finalizado.

**`cache.viajes.data` se puebla por `syncViajes()`** — `index.js:740–787` — que consulta el endpoint `/Resume` de ControlT (páginas 1, 2 y 3 cuando hay ≥100 resultados por página).

---

## 3. ¿Qué ocurre exactamente cuando detecta que un viaje desapareció?

**Funciones ejecutadas:** `sbFetch()` con método `PATCH`.

**Cambios realizados en BD — `index.js:1249–1253`:**

```javascript
await sbFetch(
  `/cumplidos?id=eq.${encodeURIComponent(id)}`,
  'PATCH',
  { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() }
);
```

**Dos campos actualizados:**

| Campo | Valor asignado |
|---|---|
| `estado_cumplido` | `'FINALIZADO CONTROLT'` (si `tiene_soporte = false`) o `'PENDIENTE LIQUIDACION'` (si `tiene_soporte = true`) |
| `fecha_finalizacion` | `new Date().toISOString()` — timestamp UTC del momento en que `syncCumplidos()` detectó la ausencia |

**Nota crítica:** `tiene_soporte` es siempre `false` (insertado así y nunca actualizado — `index.js:1221`). Por tanto, `'PENDIENTE LIQUIDACION'` es inalcanzable. Todos los viajes finalizados reciben `'FINALIZADO CONTROLT'`.

---

## 4. ¿Qué sucede si ControlT deja de responder temporalmente?

La cadena de llamadas relevante es:

**`syncViajes()` — `index.js:740–787`:**

```javascript
async function syncViajes() {
  try {
    const data1 = await safeFetch("/Resume?size=100&page=1", null);
    if (!data1) return;                   // ← Si safeFetch retorna null → RETURN sin tocar caché
    const arr1 = Array.isArray(data1) ? data1 : data1.data || data1.result || [];
    if (arr1.length === 0) {
      console.warn("⚠️  Resume devolvió 0 viajes — manteniendo caché anterior");
      return;                             // ← Si devuelve 0 → RETURN sin tocar caché
    }
    // ...
    cache.viajes.data = sortViajes(dedup); // Solo se actualiza si hay datos válidos
  } catch(e) {
    console.error("❌ Error sync viajes:", e.message);
    // No toca cache.viajes.data en el catch
  }
}
```

**`safeFetch()` — `index.js:451–492`:**

- Aplica `fetchConTimeout` con timeout de 10 segundos (`DEFAULT_FETCH_TIMEOUT_MS = 10_000`).
- Si el servidor devuelve 401 → renueva token y reintenta una vez.
- Si la respuesta no es OK → retorna `fallback` (en `syncViajes` el fallback es `null`).
- Si ControlT no responde y el `AbortController` dispara → lanza `AbortError` → capturado por el `try/catch` de `syncViajes` → log de error → `cache.viajes.data` **no se modifica**.

**Conclusión con evidencia:**

Si ControlT no responde, `cache.viajes.data` conserva su último valor válido. `syncCumplidos()` se ejecutará sobre ese cache anterior. **Los viajes que estaban presentes en el último cache válido no serán marcados como finalizados.**

Sin embargo, existe una ventana de riesgo: si ControlT responde pero devuelve una lista parcial (por ejemplo, un error en páginas 2 o 3 cuando hay más de 100 viajes), el código de páginas adicionales está en bloques `try/catch` propios que solo emiten un `warn` y continúan:

```javascript
// index.js:769–771
} catch(e) { console.warn("⚠️  Página 2 no disponible:", e.message); }
```

En ese caso `cache.viajes.data` **sí se actualiza** con solo los viajes de la página 1, y los viajes de páginas 2 y 3 estarían ausentes de `apiSet`. Si esos viajes tienen `estado_cumplido` activo en BD, serían **falsamente marcados como finalizados**.

---

## 5. ¿Qué sucede si el cache queda vacío?

**`syncCumplidos()` — `index.js:1180`:**

```javascript
if (!cache.viajes.data.length) return;
```

**Existe protección explícita.** Si `cache.viajes.data` es un array vacío, `syncCumplidos()` retorna inmediatamente sin ejecutar ninguna lógica, sin tocar Supabase.

**¿Cuándo puede quedar vacío el cache?**

- Solo al inicio del servidor, antes de que `syncViajes()` complete su primera ejecución.
- `syncViajes()` NO actualiza el cache si el resultado es vacío o nulo (ver respuesta 4).
- Por tanto, pasada la inicialización, el cache nunca queda en `[]` voluntariamente.

**`syncSolicitudes()` tiene la misma protección explícita — `index.js:1268–1270`:**

```javascript
if (!cache.viajes.data.length) {
  console.log('📋 syncSolicitudes: cache.viajes vacío, omitiendo ciclo.');
```

**`syncViajes()` NO tiene el mismo escudo** — si `syncViajes()` lanzara una excepción antes de asignar `cache.viajes.data`, el array quedaría en su estado previo (no en `[]`), ya que JavaScript no limpia variables por excepción.

---

## 6. ¿Qué ocurre si un viaje vuelve a aparecer después de haber sido marcado como FINALIZADO?

El código no contempla este escenario explícitamente. Analizando el flujo:

**Primer bucle — recorre `cache.viajes.data`:**

```javascript
// index.js:1189–1241
for (const v of cache.viajes.data) {
  const existe = existentes.get(v.trip_number);
  // ...
  if (!existe) {
    // INSERT con estado_cumplido: 'LIVE'
  } else {
    // PATCH: solo estado_controlt y pct
    // NO toca estado_cumplido
  }
}
```

El viaje que reapareció está en `cache.viajes.data` → también está en `existentes` (tiene fila en BD con `estado_cumplido = 'FINALIZADO CONTROLT'`) → entra al `else` → solo se actualizan `estado_controlt` y `pct`. **`estado_cumplido` no se resetea a `'LIVE'`.**

**Segundo bucle — detección de finalizados:**

```javascript
// index.js:1246
const estadoActivo = ESTADOS_ACTIVOS.has((c.estado_cumplido || '').toUpperCase());
```

`'FINALIZADO CONTROLT'` no pertenece a `ESTADOS_ACTIVOS = {'LIVE', 'SOLICITADO', 'CUMPLIDO RECIBIDO'}` → `estadoActivo = false` → no se vuelve a finalizar.

**Resultado del viaje que reaparece:**

- `estado_cumplido` permanece en `'FINALIZADO CONTROLT'` — no se actualiza.
- `estado_controlt` refleja el estado actual del TMS.
- `pct` se actualiza con el porcentaje del TMS.
- El viaje **no reaparece en el módulo Cumplidos del frontend** (porque `GET /api/cumplidos` solo lee `cache.viajes.data`, no la tabla Supabase).
- No se genera un nuevo registro ni una alerta.

---

## 7. ¿Existe riesgo de perder viajes?

**Sí.**

**Riesgo 1 — Límite de 1.000 filas en `existentes` (alta probabilidad a largo plazo):**

```javascript
// index.js:1182
'/cumplidos?select=...&limit=1000'
```

Si la tabla `cumplidos` acumula más de 1.000 filas, las filas más allá del límite no aparecen en `existentes`. Para esos viajes:

- Si aún están en `cache.viajes.data` → `existe` es `undefined` → se intenta **INSERT** → Supabase retorna conflicto de PK → `sbFetch` retorna `null` y loguea el error → el viaje no se actualiza.
- Sus datos (`estado_controlt`, `pct`, `empresa_cliente_id`) nunca se sincronizan.
- Si posteriormente desaparecen del TMS → no están en `existentes` → **nunca se detecta su finalización** → `fecha_finalizacion` nunca se escribe.

**Riesgo 2 — Carga parcial del TMS (baja probabilidad, alta consecuencia):**

Si la página 2 o 3 de `/Resume` falla silenciosamente (timeout o error de red capturado en `catch` local), los viajes de esas páginas no estarán en `apiSet`. Si tienen `estado_cumplido` activo en BD → serán **falsamente finalizados** con `fecha_finalizacion` incorrecta.

**Riesgo 3 — Viajes sin `trip_number`:**

```javascript
// index.js:1186
const apiSet = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));
```

El `.filter(Boolean)` excluye `trip_number` nulos o vacíos de `apiSet`. Si un viaje tiene `trip_number` en BD pero llegó con valor nulo desde el TMS, nunca entrará en `apiSet` → puede ser **falsamente finalizado** en cada ciclo (aunque en la práctica Supabase rechazaría la PK nula y no estaría en BD).

---

## 8. ¿El proceso es idempotente?

**Parcialmente — con garantía de base de datos pero sin garantía de aplicación.**

**Identificador utilizado:** `id = trip_number` (PK de la tabla `cumplidos`).

**Protección contra duplicados:**

El campo `id` es PK en Supabase. Una segunda inserción del mismo `trip_number` genera conflicto de clave primaria. Supabase retorna un error HTTP 4xx. `sbFetch` lo captura:

```javascript
// index.js:95–98
if (!r.ok) {
  const txt = await r.text();
  console.error(`Supabase ${method} ${path} → ${r.status}: ${txt}`);
  return null;
}
```

El error se loguea y se retorna `null`. **No se lanza excepción, no se interrumpe el bucle.** El contador `insertados++` se incrementa igualmente aunque el INSERT haya fallado (línea 1224 está fuera del bloque de manejo del error de `sbFetch` — se ejecuta siempre que `!existe` sea verdadero).

**¿Puede insertar dos veces el mismo viaje?**

En condiciones normales: no — la PK de Supabase rechaza el duplicado.

En condición de Riesgo 1 (>1.000 filas): sí intenta insertarlo dos veces — falla silenciosamente en la segunda. El log registrará el error pero el flujo continúa.

**¿El proceso puede ejecutar dos PATCH simultáneos sobre el mismo id?**

`syncCumplidos()` se ejecuta cada 60 s con `setInterval`. JavaScript en Node.js es single-threaded, pero si una ejecución tarda más de 60 s (por latencia acumulada de `sbFetch` × N viajes), una segunda ejecución puede comenzar antes de que la primera termine. En ese caso, dos PATCHs concurrentes sobre el mismo viaje son posibles. No hay mutex ni semáforo. El resultado final depende del orden de las respuestas de Supabase. No se han encontrado mecanismos de coordinación.

---

## Resumen de Riesgos

| # | Riesgo | Probabilidad | Consecuencia | Evidencia |
|---|---|---|---|---|
| R1 | Tabla >1.000 filas → viajes no detectados ni finalizados | Alta (tiempo) | Alta | `index.js:1182` `&limit=1000` |
| R2 | Fallo silencioso de página 2/3 → falsa finalización | Baja | Alta | `index.js:769–771` |
| R3 | `tiene_soporte` nunca actualizado → `'PENDIENTE LIQUIDACION'` inalcanzable | Certeza | Media | `index.js:1221` |
| R4 | Viaje reaparece en TMS → queda en `FINALIZADO CONTROLT` sin corrección | Baja | Media | `index.js:1225–1241` |
| R5 | Ejecuciones concurrentes de `syncCumplidos` si tarda >60 s | Baja | Baja | `index.js:3488` `setInterval` sin mutex |
| R6 | `insertados++` se incrementa aunque el INSERT falle | Certeza | Baja (solo log) | `index.js:1223–1224` |

---

## Nivel de Confianza del Mecanismo

**55 / 100**

**Justificación:**

- La lógica central (comparar Supabase vs cache, escribir `fecha_finalizacion`) es conceptualmente correcta.
- La guarda de cache vacío (`if (!cache.viajes.data.length) return`) es apropiada.
- `syncViajes()` conserva el cache en caso de fallo total de ControlT.
- El límite de `&limit=1000` es el riesgo más grave: a medida que la operación crece, el mecanismo se degrada silenciosamente sin alarma.
- La falla silenciosa de páginas parciales puede causar finalizaciones falsas sin trazabilidad.
- `tiene_soporte` siempre en `false` hace que parte del flujo de negocio sea inoperativo desde el primer día.
- No hay logs que adviertan sobre el límite de 1.000, ni sobre viajes que reaparecen con estado incorrecto.

---

*Fin de la auditoría. Ningún archivo fue modificado durante este proceso.*
