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
 * ControlT stop fields observed in wild:
 *   NumeroParada, NombreParada, Direccion, Latitud, Longitud,
 *   EstadoParada, FechaProgramada, FechaReal, FechaETA, TipoParada,
 *   Productos / Producto
 *
 * @param {object} raw
 * @param {number} index — 0-based fallback orden when NumeroParada absent
 * @returns {Parada}
 */
function mapParada(raw, index) {
  const productos = normalizeArray(raw.Productos?.Producto ?? raw.Producto)
    .map(mapProducto);

  return {
    orden:            toInt(raw.NumeroParada) ?? index + 1,
    nombre:           toStr(raw.NombreParada),
    direccion:        toStr(raw.Direccion),
    lat:              toFloat(raw.Latitud),
    lng:              toFloat(raw.Longitud),
    estado:           toStr(raw.EstadoParada),
    hora_programada:  toStr(raw.FechaProgramada),
    hora_real:        toStr(raw.FechaReal),
    eta:              toStr(raw.FechaETA),
    tipo:             toStr(raw.TipoParada),
    productos,
  };
}

/**
 * @param {object} raw
 * @returns {Producto}
 */
function mapProducto(raw) {
  return {
    descripcion: toStr(raw.Descripcion ?? raw.NombreProducto),
    cantidad:    toFloat(raw.Cantidad),
    unidad:      toStr(raw.UnidadMedida ?? raw.Unidad),
    peso_ton:    toFloat(raw.PesoToneladas ?? raw.Peso),
    volumen:     toFloat(raw.Volumen),
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

  // ── paradas ──────────────────────────────────────────────────────────────
  const rawParadas = normalizeArray(
    detail?.Paradas?.Parada ??
    detail?.paradas?.Parada ??
    detail?.Paradas ??
    detail?.paradas
  );
  const paradas = rawParadas.map(mapParada);

  // ── estado ───────────────────────────────────────────────────────────────
  const estado_viaje = deriveEstado(paradas);

  // ── conductor ─────────────────────────────────────────────────────────────
  const conductor = detail?.Conductor ?? detail?.conductor ?? detail?.DatosConductor ?? {};
  const conductor_cedula = toStr(conductor.Cedula ?? conductor.cedula ?? conductor.NumeroDocumento ?? detail?.CedulaConductor);
  const conductor_nombre = toStr(conductor.Nombre ?? conductor.nombre ?? conductor.NombreCompleto ?? detail?.NombreConductor);

  // ── tipo / clasificación ──────────────────────────────────────────────────
  const tipo_operacion_codigo = toInt(detail?.TipoOperacion ?? detail?.CodigoTipoOperacion);
  const tipo_viaje_codigo     = toInt(detail?.TipoViaje ?? detail?.CodigoTipoViaje);
  const tipo_carga_codigo     = toInt(detail?.TipoCarga ?? detail?.CodigoTipoCarga);

  // ── valores económicos ────────────────────────────────────────────────────
  const valor_mercancia = toFloat(detail?.ValorMercancia ?? detail?.valorMercancia);
  const moneda          = toStr(detail?.Moneda ?? detail?.moneda);
  const valor_flete     = toFloat(detail?.ValorFlete ?? detail?.valorFlete);

  // ── valores físicos ───────────────────────────────────────────────────────
  const peso_total_ton  = toFloat(detail?.PesoTotal ?? detail?.pesoTotal ?? detail?.PesoToneladas);
  const volumen_total   = toFloat(detail?.VolumenTotal ?? detail?.volumenTotal ?? detail?.Volumen);

  // ── temperatura ───────────────────────────────────────────────────────────
  const temperatura_min = toFloat(detail?.TemperaturaMinima ?? detail?.temperaturaMin ?? detail?.TempMinima);
  const temperatura_max = toFloat(detail?.TemperaturaMaxima ?? detail?.temperaturaMax ?? detail?.TempMaxima);

  // ── instrucciones ─────────────────────────────────────────────────────────
  const instrucciones = toStr(detail?.Instrucciones ?? detail?.instrucciones ?? detail?.InstruccionesEspeciales);

  // ── fecha del último evento ───────────────────────────────────────────────
  const fecha_evento = toStr(
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

  // Pattern 1: { GetDetailMonitoringOrderResult: { ... } }
  if (soapResult.GetDetailMonitoringOrderResult) return soapResult.GetDetailMonitoringOrderResult;

  // Pattern 2: { GetDetailMonitoringOrderResponse: { GetDetailMonitoringOrderResult: { ... } } }
  const inner = soapResult.GetDetailMonitoringOrderResponse;
  if (inner?.GetDetailMonitoringOrderResult) return inner.GetDetailMonitoringOrderResult;
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

/** Return the latest non-null hora_real string from paradas, or null. */
function latestHoraReal(paradas) {
  const reals = paradas.map(p => p.hora_real).filter(Boolean);
  if (reals.length === 0) return null;
  return reals.reduce((a, b) => (a > b ? a : b));
}
