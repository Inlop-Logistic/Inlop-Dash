/**
 * TripMapper — transforms a raw GetDetailMonitoringOrder SOAP response into
 * the internal domain model that matches the controlt_viajes table schema.
 *
 * Design rules:
 *   - Pure function: no I/O, no side-effects, fully unit-testable.
 *   - Tolerant reader: missing / null SOAP fields map to null — never throw
 *     on missing optional data. Only throw MappingError when required fields
 *     are absent (codigo_controlt, estado_viaje derivable base).
 *   - Estado derivation is deterministic from paradas timestamps.
 *   - Does NOT call fixMojibake — soapGateway.deepFixMojibake has already
 *     been applied before this function receives the data.
 *
 * Contrato REAL confirmado por auditoría Fase 6 (evidencia Railway —
 * IN018159 el 2026-08-02, y volcado completo de IN018153 en la segunda
 * ronda) — el envelope de GetDetailMonitoringOrder no usa
 * GetDetailMonitoringOrderResult/Response como se asumía originalmente. Usa:
 *   { success, errors, messages, data: {
 *       code_type_operation, code_type_trip, code_type_cargo,
 *       username, fullname, date_event,
 *       price_commodity, code_currency_commodity, prices_freight,
 *       weight, volume, temperature_min, temperature_max,
 *       observations, doc_ref1, doc_ref2,
 *       stops: { eMonitoringOrderPointStop: [ {
 *         number_order, shipment_number, description_company_client,
 *         description_location_destiny, type_location,
 *         datetime_in_place, datetime_out_place, latitude, longitude,
 *         address,
 *         products: "" | { eMonitoringOrderProductWS: {...} | [...] }
 *       } ] },
 *   } }
 * products.eMonitoringOrderProductWS puede ser un objeto único (no arreglo)
 * cuando la parada tiene un solo producto, o la cadena vacía "" cuando no
 * tiene ninguno — normalizeArray() ya soporta ambos casos.
 * Cada producto real trae: description_product, amount_order, amount_deliver,
 * unit, weight, volumen (sin "e" final, distinto de "volume" a nivel de viaje).
 * number_order a nivel de parada NO es un número de secuencia — es el código
 * de la orden (mismo valor repetido en todas las paradas de un mismo pedido);
 * por eso el fallback a `index + 1` es el comportamiento correcto y esperado.
 * Los nombres antiguos (PascalCase en español) se conservan como fallback
 * — no hay evidencia de que ControlT los use, pero tampoco de que nunca los
 * use en otro endpoint/ambiente, y mantenerlos no tiene costo bajo el patrón
 * Tolerant Reader. Sin evidencia real confirmada todavía: estado por parada,
 * eta.
 */

import { MappingError } from './errors.js';

// ── Estado derivation ─────────────────────────────────────────────────────────

/**
 * Derive EstadoViaje from the paradas array.
 *
 * Rules (evaluated in order — first match wins):
 *   COMPLETADO   — all stops have hora_real set
 *   EN_DESCARGUE — last stop has hora_real; at least one earlier stop has hora_real
 *   EN_TRANSITO  — at least one non-first stop has hora_real; last stop does not
 *   EN_CARGUE    — first stop has hora_real; no subsequent stop has hora_real
 *   PENDIENTE    — no stop has hora_real
 *
 * @param {Parada[]} paradas
 * @returns {'PENDIENTE'|'EN_CARGUE'|'EN_TRANSITO'|'EN_DESCARGUE'|'COMPLETADO'}
 */
export function deriveEstado(paradas) {
  if (!Array.isArray(paradas) || paradas.length === 0) return 'PENDIENTE';

  const withReal = paradas.filter(p => p.hora_real != null && p.hora_real !== '');
  if (withReal.length === 0) return 'PENDIENTE';

  const last = paradas[paradas.length - 1];
  const lastHasReal = last.hora_real != null && last.hora_real !== '';

  if (withReal.length === paradas.length) return 'COMPLETADO';
  if (lastHasReal && withReal.length > 1) return 'EN_DESCARGUE';

  const first = paradas[0];
  const firstHasReal = first.hora_real != null && first.hora_real !== '';

  // At least one non-first stop has hora_real
  if (withReal.some(p => p !== first)) return 'EN_TRANSITO';
  if (firstHasReal) return 'EN_CARGUE';
  return 'PENDIENTE';
}

// ── Parada mapper ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} Parada
 * @property {number} orden
 * @property {string|null} nombre
 * @property {string|null} direccion
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string|null} estado
 * @property {string|null} hora_programada
 * @property {string|null} hora_real
 * @property {string|null} eta
 * @property {string|null} tipo
 * @property {Producto[]} productos
 */

/**
 * @typedef {object} Producto
 * @property {string|null} descripcion
 * @property {number|null} cantidad
 * @property {string|null} unidad
 * @property {number|null} peso_ton
 * @property {number|null} volumen
 */

/**
 * Normalise a raw SOAP stop node into a Parada domain object.
 *
 * Nombres reales confirmados (auditoría Fase 6, evidencia Railway IN018159):
 *   number_order, description_location_destiny, type_location,
 *   datetime_in_place, datetime_out_place, latitude, longitude, address,
 *   products.eMonitoringOrderProductWS
 * Nombres antiguos (nunca confirmados contra una respuesta real, se
 * conservan como fallback sin costo bajo Tolerant Reader):
 *   NumeroParada, NombreParada, Direccion, Latitud, Longitud,
 *   EstadoParada, FechaProgramada, FechaReal, FechaETA, TipoParada,
 *   Productos / Producto
 * Sin evidencia real todavía (quedan null bajo el contrato real):
 *   estado de la parada, eta.
 *
 * @param {object} raw
 * @param {number} index — 0-based fallback orden when NumeroParada absent
 * @returns {Parada}
 */
function mapParada(raw, index) {
  const productos = normalizeArray(
    raw.products?.eMonitoringOrderProductWS ??
    raw.Productos?.Producto ??
    raw.Producto
  ).map(mapProducto);

  return {
    orden:            toInt(raw.NumeroParada ?? raw.number_order) ?? index + 1,
    nombre:           toStr(raw.NombreParada ?? raw.description_location_destiny),
    direccion:        toStr(raw.Direccion ?? raw.address),
    lat:              toFloat(raw.Latitud ?? raw.latitude),
    lng:              toFloat(raw.Longitud ?? raw.longitude),
    estado:           toStr(raw.EstadoParada),
    hora_programada:  toStr(raw.FechaProgramada ?? raw.datetime_in_place),
    hora_real:        toStr(raw.FechaReal ?? raw.datetime_out_place),
    eta:              toStr(raw.FechaETA),
    tipo:             toStr(raw.TipoParada ?? raw.type_location),
    productos,
  };
}

/**
 * @param {object} raw
 * @returns {Producto}
 *
 * Nombres reales confirmados (auditoría Fase 6, segunda ronda — volcado
 * completo IN018153): description_product, amount_order, unit, weight,
 * volumen. Los candidatos antiguos (Descripcion, Cantidad, UnidadMedida,
 * PesoToneladas, Volumen) se conservan como fallback sin costo.
 */
function mapProducto(raw) {
  return {
    descripcion: toStr(raw.description_product ?? raw.Descripcion ?? raw.NombreProducto),
    cantidad:    toFloat(raw.amount_order ?? raw.Cantidad),
    unidad:      toStr(raw.unit ?? raw.UnidadMedida ?? raw.Unidad),
    peso_ton:    toFloat(raw.weight ?? raw.PesoToneladas ?? raw.Peso),
    // "volumen" (con esa grafía exacta) es el nombre real confirmado —
    // distinto de "volume" (sin la n final) usado a nivel de viaje completo.
    volumen:     toFloat(raw.volumen ?? raw.Volumen),
  };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

/**
 * @typedef {object} ViajeRow
 * @property {string}  codigo_controlt
 * @property {string}  estado_viaje
 * @property {string|null} conductor_cedula
 * @property {string|null} conductor_nombre
 * @property {number|null} tipo_operacion_codigo
 * @property {number|null} tipo_viaje_codigo
 * @property {number|null} tipo_carga_codigo
 * @property {number|null} valor_mercancia
 * @property {string|null} moneda
 * @property {number|null} valor_flete
 * @property {number|null} peso_total_ton
 * @property {number|null} volumen_total
 * @property {number|null} temperatura_min
 * @property {number|null} temperatura_max
 * @property {string|null} instrucciones
 * @property {Parada[]}    paradas
 * @property {string|null} fecha_evento
 */

/**
 * Map the result of GetDetailMonitoringOrder (after deepFixMojibake) into
 * a ViajeRow ready to upsert into controlt_viajes.
 *
 * @param {object} soapResult — the object returned by soapGateway.getDetailMonitoringOrder()
 * @param {string} codigoViaje — the trip code used in the SOAP call
 * @returns {ViajeRow}
 * @throws {MappingError} if required fields cannot be derived
 */
export function mapToViajeRow(soapResult, codigoViaje) {
  if (!codigoViaje || typeof codigoViaje !== 'string' || codigoViaje.trim() === '') {
    throw new MappingError('codigoViaje is required and must be a non-empty string');
  }

  // Unwrap the response envelope — ControlT nests the payload differently
  // depending on the SOAP runtime version.
  const detail = unwrapDetail(soapResult);

  // [TRACE-TEMP code_type_operation] Etapa 1 — remover tras localizar la
  // causa raíz (rastreo de un único campo, auditoría Fase 6 — 3ª ronda).
  console.log(
    `[TRACE code_type_operation] Etapa 1 | Objeto: detail | Valor: ${detail?.code_type_operation}` +
    ` | typeof: ${typeof detail?.code_type_operation} | codigoViaje: ${codigoViaje}`
  );

  // ── paradas ──────────────────────────────────────────────────────────────
  const rawParadas = normalizeArray(
    detail?.stops?.eMonitoringOrderPointStop ??   // real (auditoría Fase 6)
    detail?.Paradas?.Parada ??
    detail?.paradas?.Parada ??
    detail?.Paradas ??
    detail?.paradas
  );
  const paradas = rawParadas.map(mapParada);

  // ── estado ───────────────────────────────────────────────────────────────
  const estado_viaje = deriveEstado(paradas);

  // ── conductor ─────────────────────────────────────────────────────────────
  // username/fullname: nombres reales confirmados (auditoría Fase 6) — el
  // servicio de conductor usa las mismas convenciones que la app de login.
  const conductor = detail?.Conductor ?? detail?.conductor ?? detail?.DatosConductor ?? {};
  const conductor_cedula = toStr(
    detail?.username ??
    conductor.Cedula ?? conductor.cedula ?? conductor.NumeroDocumento ?? detail?.CedulaConductor
  );
  const conductor_nombre = toStr(
    detail?.fullname ??
    conductor.Nombre ?? conductor.nombre ?? conductor.NombreCompleto ?? detail?.NombreConductor
  );

  // ── tipo / clasificación ──────────────────────────────────────────────────
  const tipo_operacion_codigo = toInt(detail?.code_type_operation ?? detail?.TipoOperacion ?? detail?.CodigoTipoOperacion);
  const tipo_viaje_codigo     = toInt(detail?.code_type_trip      ?? detail?.TipoViaje     ?? detail?.CodigoTipoViaje);
  const tipo_carga_codigo     = toInt(detail?.code_type_cargo     ?? detail?.TipoCarga     ?? detail?.CodigoTipoCarga);

  // [TRACE-TEMP code_type_operation] Etapa 2 — salida de mapToViajeRow (el
  // objeto viajeRow aún no existe como tal hasta el return final, pero
  // tipo_operacion_codigo ya es su valor definitivo desde aquí). Remover
  // tras localizar la causa raíz.
  console.log(`[TRACE code_type_operation] Etapa 2 | Objeto: viajeRow (salida mapToViajeRow) | Valor: ${tipo_operacion_codigo}`);

  // ── valores económicos ────────────────────────────────────────────────────
  // price_commodity/prices_freight/code_currency_commodity: nombres reales
  // confirmados (auditoría Fase 6, segunda ronda — volcado completo IN018153).
  const valor_mercancia = toFloatMaybeArray(detail?.price_commodity  ?? detail?.ValorMercancia ?? detail?.valorMercancia);
  const valor_flete     = toFloatMaybeArray(detail?.prices_freight   ?? detail?.ValorFlete      ?? detail?.valorFlete);
  const moneda          = toStr(detail?.code_currency_commodity ?? detail?.Moneda ?? detail?.moneda);

  // ── valores físicos ───────────────────────────────────────────────────────
  // weight/volume: nombres reales confirmados a nivel de viaje completo
  // (distintos de "weight"/"volumen" dentro de cada producto — ver mapProducto).
  const peso_total_ton  = toFloat(detail?.weight ?? detail?.PesoTotal ?? detail?.pesoTotal ?? detail?.PesoToneladas);
  const volumen_total   = toFloat(detail?.volume ?? detail?.VolumenTotal ?? detail?.volumenTotal ?? detail?.Volumen);

  // ── temperatura ───────────────────────────────────────────────────────────
  // temperature_min/temperature_max: nombres reales confirmados (auditoría Fase 6).
  const temperatura_min = toFloat(detail?.temperature_min ?? detail?.TemperaturaMinima ?? detail?.temperaturaMin ?? detail?.TempMinima);
  const temperatura_max = toFloat(detail?.temperature_max ?? detail?.TemperaturaMaxima ?? detail?.temperaturaMax ?? detail?.TempMaxima);

  // ── instrucciones ─────────────────────────────────────────────────────────
  // observations/doc_ref1: nombres reales confirmados. En la evidencia,
  // "observations" suele venir vacío y "doc_ref1" trae el texto operativo
  // real (instrucciones de tránsito/contacto) — se prefiere observations
  // cuando trae contenido, y se cae a doc_ref1 como el candidato con
  // contenido real más frecuente.
  const instrucciones = toStr(detail?.observations) ??
    toStr(detail?.doc_ref1) ??
    toStr(detail?.Instrucciones ?? detail?.instrucciones ?? detail?.InstruccionesEspeciales);

  // ── fecha del último evento ───────────────────────────────────────────────
  // date_event: nombre real confirmado (formato "DD/MM/YYYY HH:mm:ss", se
  // conserva tal cual sin normalizar — ver nota de riesgos).
  const fecha_evento = toStr(
    detail?.date_event ??
    detail?.FechaUltimoEvento ??
    detail?.UltimaFechaEvento ??
    detail?.FechaEvento ??
    // Fall back to the latest hora_real among all stops
    latestHoraReal(paradas)
  );

  return {
    codigo_controlt: codigoViaje.trim(),
    estado_viaje,
    conductor_cedula,
    conductor_nombre,
    tipo_operacion_codigo,
    tipo_viaje_codigo,
    tipo_carga_codigo,
    valor_mercancia,
    moneda,
    valor_flete,
    peso_total_ton,
    volumen_total,
    temperatura_min,
    temperatura_max,
    instrucciones,
    paradas,
    fecha_evento,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Unwrap the detail object from the various nesting patterns ControlT uses.
 * Returns the innermost relevant node or the input itself as a fallback.
 */
function unwrapDetail(soapResult) {
  if (!soapResult || typeof soapResult !== 'object') return {};

  // Pattern 1 (legacy — nunca confirmado contra una respuesta real):
  // { GetDetailMonitoringOrderResult: { ... } }
  if (soapResult.GetDetailMonitoringOrderResult) return soapResult.GetDetailMonitoringOrderResult;

  // Pattern 2 (legacy — nunca confirmado contra una respuesta real):
  // { GetDetailMonitoringOrderResponse: { GetDetailMonitoringOrderResult: { ... } } }
  const inner = soapResult.GetDetailMonitoringOrderResponse;
  if (inner?.GetDetailMonitoringOrderResult) return inner.GetDetailMonitoringOrderResult;

  // Pattern 3 (REAL — confirmado por auditoría Fase 6, evidencia Railway
  // IN018159, 2026-08-02): { success, errors, messages, data: { ... } }
  if (soapResult.data && typeof soapResult.data === 'object') return soapResult.data;

  if (inner) return inner;

  return soapResult;
}

/** Ensure value is always an array. */
function normalizeArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/** Convert to string; return null for null/undefined/empty. */
function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Convert to integer; return null if unparseable. */
function toInt(v) {
  if (v == null) return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** Convert to float; return null if unparseable. */
function toFloat(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert to float, unwrapping a single-level array first if present.
 * Usado para campos cuyo nombre real es plural (price_commodity /
 * prices_freight) sin evidencia documentada de si ControlT los envía como
 * arreglo o como escalar — tolerante a ambas formas.
 */
function toFloatMaybeArray(v) {
  return toFloat(Array.isArray(v) ? v[0] : v);
}

/** Return the latest non-null hora_real string from paradas, or null. */
function latestHoraReal(paradas) {
  const reals = paradas.map(p => p.hora_real).filter(Boolean);
  if (reals.length === 0) return null;
  return reals.reduce((a, b) => (a > b ? a : b));
}
