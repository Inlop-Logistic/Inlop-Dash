/**
 * TripMapper — transforms a raw GetDetailMonitoringOrder SOAP response into
 * the internal domain model for the ControlT "Viaje" domain.
 *
 * Design rules:
 *   - Pure function: no I/O, no side-effects, fully unit-testable.
 *   - Tolerant reader: missing / null SOAP fields map to null — never throw
 *     on missing optional data. Only throw MappingError when required fields
 *     are absent (codigo_controlt, estado_viaje derivable base).
 *   - Estado derivation is deterministic from paradas timestamps.
 *   - Does NOT call fixMojibake — soapGateway.deepFixMojibake has already
 *     been applied before this function receives the data.
 *   - Preserva TODA la información de negocio que ControlT entrega (Fase 6,
 *     certificación final, Objetivo 1) — ningún campo se descarta solo
 *     porque el frontend actual no lo use.
 *
 * Contrato REAL confirmado por auditoría Fase 6 (evidencia Railway —
 * IN018159 el 2026-08-02, volcado completo y rastreo campo a campo de
 * IN018153) — el envelope de GetDetailMonitoringOrder anida DOS niveles
 * simultáneos, no alternativos:
 *   GetDetailMonitoringOrderResult (wrapper legacy, real) → {
 *     success, errors, messages,
 *     data: {
 *       code_company, number_travel_main, number_travel_secondary,
 *       code_type_operation, code_type_trip, code_type_cargo,
 *       username, fullname, date_event, id_route,
 *       weight, volume, price_commodity, code_currency_commodity,
 *       prices_freight, temperature_min, temperature_max,
 *       observations, doc_ref1, doc_ref2, aux_fields, trackingFromNewUI,
 *       stops: { eMonitoringOrderPointStop: [ {
 *         number_order, shipment_number, remission, code_location_seller,
 *         id_company_client, description_company_client, type_company_client,
 *         code_location_destiny, description_location_destiny, type_location,
 *         datetime_in_place, datetime_out_place, latitude, longitude,
 *         address, code_city, code_deparment, mandate, aux,
 *         code_type_commodity, Permanence_destinity,
 *         products: "" | { eMonitoringOrderProductWS: {...} | [...] }
 *       } ] },
 *     },
 *   }
 * products.eMonitoringOrderProductWS puede ser un objeto único (no arreglo)
 * cuando la parada tiene un solo producto, o la cadena vacía "" cuando no
 * tiene ninguno — normalizeArray() soporta ambos casos. Cada producto real
 * trae: code_product, description_product, barcode, amount_order,
 * amount_deliver, unit, weight, volumen (sin "e" final — distinto de
 * "volume" a nivel de viaje), routing_variable, amount_settled, aux_fields.
 *
 * number_order a nivel de parada NO es un número de secuencia — es el
 * código de la orden (mismo valor repetido en todas las paradas del mismo
 * pedido); por eso el fallback a `index + 1` en "orden" es correcto, y el
 * valor real se preserva aparte en "codigo_orden".
 *
 * CORRECCIÓN DE MODELO DE DOMINIO (Fase 6, certificación final, Objetivo 2):
 * username/fullname NO son datos del conductor — son el usuario del
 * TMS/ControlT que planilló la orden de monitoreo. Se exponen en su propio
 * objeto `planificado_por`, nunca mezclados con `conductor_cedula`/
 * `conductor_nombre` (que solo se alimentan de los candidatos legacy nunca
 * confirmados contra una respuesta real — SOAP no expone identidad real
 * del conductor bajo ningún nombre confirmado; cuando existe, esa
 * información real proviene de Resume y se combina en el endpoint, no aquí).
 *
 * Los nombres antiguos (PascalCase en español) se conservan como fallback
 * — no hay evidencia de que ControlT los use, pero tampoco de que nunca los
 * use en otro endpoint/ambiente, y mantenerlos no tiene costo bajo el
 * patrón Tolerant Reader.
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
 * @typedef {object} Cliente
 * @property {string|null} id
 * @property {string|null} nombre
 * @property {string|null} tipo
 */

/**
 * @typedef {object} Parada
 * @property {number} orden
 * @property {string|null} codigo_orden        — number_order real (no es secuencial)
 * @property {string|null} numero_remesa        — shipment_number
 * @property {string|null} remision             — remission
 * @property {string|null} codigo_vendedor      — code_location_seller
 * @property {Cliente} cliente                  — id/nombre/tipo del cliente en esta parada
 * @property {string|null} codigo_ubicacion     — code_location_destiny
 * @property {string|null} nombre
 * @property {string|null} direccion
 * @property {number|null} ciudad_codigo        — code_city
 * @property {number|null} departamento_codigo  — code_deparment
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string|null} estado
 * @property {string|null} hora_programada      — ISO-8601 UTC
 * @property {string|null} hora_real            — ISO-8601 UTC
 * @property {string|null} eta                  — ISO-8601 UTC
 * @property {string|null} tipo
 * @property {number|null} mandato              — mandate
 * @property {string|null} aux
 * @property {number|null} tipo_mercancia_codigo — code_type_commodity
 * @property {number|null} permanencia_destino   — Permanence_destinity
 * @property {Producto[]} productos
 */

/**
 * @typedef {object} Producto
 * @property {string|null} codigo_producto        — code_product
 * @property {string|null} descripcion
 * @property {string|null} codigo_barras          — barcode
 * @property {number|null} cantidad
 * @property {number|null} cantidad_entregada     — amount_deliver
 * @property {string|null} unidad
 * @property {number|null} peso_ton
 * @property {number|null} volumen
 * @property {string|null} variable_enrutamiento  — routing_variable
 * @property {number|null} valor_liquidado        — amount_settled
 * @property {string|null} campos_auxiliares      — aux_fields
 */

/**
 * Normalise a raw SOAP stop node into a Parada domain object.
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
    orden:               toInt(raw.NumeroParada ?? raw.number_order) ?? index + 1,
    codigo_orden:        toStr(raw.number_order),
    numero_remesa:       toStr(raw.shipment_number),
    remision:            toStr(raw.remission),
    codigo_vendedor:     toStr(raw.code_location_seller),
    cliente: {
      id:     toStr(raw.id_company_client),
      nombre: toStr(raw.description_company_client),
      tipo:   toStr(raw.type_company_client),
    },
    codigo_ubicacion:    toStr(raw.code_location_destiny),
    nombre:              toStr(raw.NombreParada ?? raw.description_location_destiny),
    direccion:           toStr(raw.Direccion ?? raw.address),
    ciudad_codigo:       toInt(raw.code_city),
    departamento_codigo: toInt(raw.code_deparment),
    lat:                 toFloat(raw.Latitud ?? raw.latitude),
    lng:                 toFloat(raw.Longitud ?? raw.longitude),
    estado:              toStr(raw.EstadoParada),
    hora_programada:     normalizeControlTDate(raw.FechaProgramada ?? raw.datetime_in_place),
    hora_real:           normalizeControlTDate(raw.FechaReal ?? raw.datetime_out_place),
    eta:                 normalizeControlTDate(raw.FechaETA),
    tipo:                toStr(raw.TipoParada ?? raw.type_location),
    mandato:             toInt(raw.mandate),
    aux:                 toStr(raw.aux),
    tipo_mercancia_codigo: toInt(raw.code_type_commodity),
    permanencia_destino: toFloat(raw.Permanence_destinity),
    productos,
  };
}

/**
 * @param {object} raw
 * @returns {Producto}
 */
function mapProducto(raw) {
  return {
    codigo_producto:       toStr(raw.code_product),
    descripcion:           toStr(raw.description_product ?? raw.Descripcion ?? raw.NombreProducto),
    codigo_barras:         toStr(raw.barcode),
    cantidad:              toFloat(raw.amount_order ?? raw.Cantidad),
    cantidad_entregada:    toFloat(raw.amount_deliver),
    unidad:                toStr(raw.unit ?? raw.UnidadMedida ?? raw.Unidad),
    peso_ton:              toFloat(raw.weight ?? raw.PesoToneladas ?? raw.Peso),
    // "volumen" (con esa grafía exacta) es el nombre real confirmado —
    // distinto de "volume" (sin la n final) usado a nivel de viaje completo.
    volumen:               toFloat(raw.volumen ?? raw.Volumen),
    variable_enrutamiento: toStr(raw.routing_variable),
    valor_liquidado:       toFloat(raw.amount_settled),
    campos_auxiliares:     toStr(raw.aux_fields),
  };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

/**
 * @typedef {object} Planificador
 * @property {string|null} username
 * @property {string|null} fullname
 */

/**
 * @typedef {object} ViajeRow
 * @property {string}  codigo_controlt
 * @property {string|null} codigo_controlt_secundario — number_travel_secondary
 * @property {string|null} codigo_empresa             — code_company
 * @property {string}  estado_viaje
 * @property {Planificador|null} planificado_por       — usuario TMS que planilló la orden (NO el conductor)
 * @property {string|null} conductor_cedula
 * @property {string|null} conductor_nombre
 * @property {number|null} tipo_operacion_codigo
 * @property {number|null} tipo_viaje_codigo
 * @property {number|null} tipo_carga_codigo
 * @property {string|null} codigo_ruta               — id_route
 * @property {number|null} valor_mercancia
 * @property {string|null} moneda
 * @property {number|null} valor_flete
 * @property {number|null} peso_total_ton
 * @property {number|null} volumen_total
 * @property {number|null} temperatura_min
 * @property {number|null} temperatura_max
 * @property {string|null} instrucciones
 * @property {string|null} observaciones             — observations, crudo
 * @property {string|null} referencia_doc1           — doc_ref1, crudo
 * @property {string|null} referencia_doc2           — doc_ref2, crudo
 * @property {string|null} campos_auxiliares         — aux_fields, crudo
 * @property {boolean|null} rastreo_nueva_ui         — trackingFromNewUI
 * @property {Parada[]}    paradas
 * @property {string|null} fecha_evento              — ISO-8601 UTC
 */

/**
 * Map the result of GetDetailMonitoringOrder (after deepFixMojibake) into
 * a ViajeRow.
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
    detail?.stops?.eMonitoringOrderPointStop ??   // real (auditoría Fase 6)
    detail?.Paradas?.Parada ??
    detail?.paradas?.Parada ??
    detail?.Paradas ??
    detail?.paradas
  );
  const paradas = rawParadas.map(mapParada);

  // ── estado ───────────────────────────────────────────────────────────────
  const estado_viaje = deriveEstado(paradas);

  // ── planificado_por (usuario TMS, NO el conductor) ────────────────────────
  const planificado_por = (detail?.username != null || detail?.fullname != null) ? {
    username: toStr(detail?.username),
    fullname: toStr(detail?.fullname),
  } : null;

  // ── conductor ─────────────────────────────────────────────────────────────
  // SOAP GetDetailMonitoringOrder no expone identidad real del conductor
  // bajo ningún nombre confirmado — solo se mantienen los candidatos legacy
  // (nunca validados contra una respuesta real) por compatibilidad. El
  // nombre/teléfono reales del conductor, cuando existen, provienen de
  // Resume — se combinan en el endpoint (index.js), no aquí.
  const conductor = detail?.Conductor ?? detail?.conductor ?? detail?.DatosConductor ?? {};
  const conductor_cedula = toStr(
    conductor.Cedula ?? conductor.cedula ?? conductor.NumeroDocumento ?? detail?.CedulaConductor
  );
  const conductor_nombre = toStr(
    conductor.Nombre ?? conductor.nombre ?? conductor.NombreCompleto ?? detail?.NombreConductor
  );

  // ── tipo / clasificación ──────────────────────────────────────────────────
  const tipo_operacion_codigo = toInt(detail?.code_type_operation ?? detail?.TipoOperacion ?? detail?.CodigoTipoOperacion);
  const tipo_viaje_codigo     = toInt(detail?.code_type_trip      ?? detail?.TipoViaje     ?? detail?.CodigoTipoViaje);
  const tipo_carga_codigo     = toInt(detail?.code_type_cargo     ?? detail?.TipoCarga     ?? detail?.CodigoTipoCarga);

  // ── valores económicos ────────────────────────────────────────────────────
  const valor_mercancia = toFloatMaybeArray(detail?.price_commodity  ?? detail?.ValorMercancia ?? detail?.valorMercancia);
  const valor_flete     = toFloatMaybeArray(detail?.prices_freight   ?? detail?.ValorFlete      ?? detail?.valorFlete);
  const moneda          = toStr(detail?.code_currency_commodity ?? detail?.Moneda ?? detail?.moneda);

  // ── valores físicos ───────────────────────────────────────────────────────
  const peso_total_ton  = toFloat(detail?.weight ?? detail?.PesoTotal ?? detail?.pesoTotal ?? detail?.PesoToneladas);
  const volumen_total   = toFloat(detail?.volume ?? detail?.VolumenTotal ?? detail?.volumenTotal ?? detail?.Volumen);

  // ── temperatura ───────────────────────────────────────────────────────────
  const temperatura_min = toFloat(detail?.temperature_min ?? detail?.TemperaturaMinima ?? detail?.temperaturaMin ?? detail?.TempMinima);
  const temperatura_max = toFloat(detail?.temperature_max ?? detail?.TemperaturaMaxima ?? detail?.temperaturaMax ?? detail?.TempMaxima);

  // ── instrucciones (derivado) + campos crudos preservados ──────────────────
  const observaciones   = toStr(detail?.observations);
  const referencia_doc1 = toStr(detail?.doc_ref1);
  const referencia_doc2 = toStr(detail?.doc_ref2);
  const instrucciones = observaciones ?? referencia_doc1 ??
    toStr(detail?.Instrucciones ?? detail?.instrucciones ?? detail?.InstruccionesEspeciales);

  // ── fecha del último evento ───────────────────────────────────────────────
  const fecha_evento = normalizeControlTDate(
    detail?.date_event ??
    detail?.FechaUltimoEvento ??
    detail?.UltimaFechaEvento ??
    detail?.FechaEvento
  ) ?? latestHoraReal(paradas); // Fall back to the latest hora_real among all stops (ya normalizado a ISO)

  return {
    codigo_controlt: codigoViaje.trim(),
    codigo_controlt_secundario: toStr(detail?.number_travel_secondary),
    codigo_empresa:  toStr(detail?.code_company),
    estado_viaje,
    planificado_por,
    conductor_cedula,
    conductor_nombre,
    tipo_operacion_codigo,
    tipo_viaje_codigo,
    tipo_carga_codigo,
    codigo_ruta: toStr(detail?.id_route),
    valor_mercancia,
    moneda,
    valor_flete,
    peso_total_ton,
    volumen_total,
    temperatura_min,
    temperatura_max,
    instrucciones,
    observaciones,
    referencia_doc1,
    referencia_doc2,
    campos_auxiliares: toStr(detail?.aux_fields),
    rastreo_nueva_ui: toBool(detail?.trackingFromNewUI),
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

  // El wrapper legacy (GetDetailMonitoringOrderResult/Response) y el
  // envelope real ({ success, data }) NO son alternativas excluyentes —
  // ambos niveles están presentes a la vez en la respuesta real de
  // ControlT (auditoría Fase 6, 3ª ronda). Se pelan ambos en secuencia.
  let node = soapResult;

  if (node.GetDetailMonitoringOrderResult) {
    node = node.GetDetailMonitoringOrderResult;
  } else if (node.GetDetailMonitoringOrderResponse) {
    node = node.GetDetailMonitoringOrderResponse;
    if (node?.GetDetailMonitoringOrderResult) node = node.GetDetailMonitoringOrderResult;
  }

  // Envelope real (auditoría Fase 6): { success, errors, messages, data: {...} }
  if (node && typeof node === 'object' && node.data && typeof node.data === 'object') {
    node = node.data;
  }

  return node;
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

/** Convert a boolean-ish SOAP value to boolean; null if absent/unrecognised. */
function toBool(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return null;
}

/** Return the latest non-null hora_real string from paradas, or null. */
function latestHoraReal(paradas) {
  const reals = paradas.map(p => p.hora_real).filter(Boolean);
  if (reals.length === 0) return null;
  return reals.reduce((a, b) => (a > b ? a : b));
}

// ── Normalización de fechas (Fase 6, certificación final, Objetivo 3) ─────────

// ControlT entrega sus fechas como "DD/MM/YYYY HH:mm:ss", sin zona horaria
// explícita. El resto de la operación (INLOP, direcciones en Villavicencio/
// Meta, moneda COP) confirma que el origen es Colombia — America/Bogota,
// UTC-05:00 fijo, sin horario de verano. Esta es una asunción operativa
// explícita (no hay evidencia SOAP de zona horaria), documentada aquí.
const CONTROLT_UTC_OFFSET_MINUTES = 5 * 60;
const DDMMYYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/;

/**
 * Convierte "DD/MM/YYYY HH:mm:ss" (hora Bogotá, UTC-05:00) a ISO-8601 UTC
 * de forma determinista — sin `new Date()`, sin depender del locale o zona
 * horaria del proceso que ejecuta el código.
 *
 * Tolerant Reader: si el valor no matchea el patrón exacto (puede ya venir
 * en ISO, o ser un formato futuro no contemplado), se retorna sin modificar.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function normalizeControlTDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;

  const m = DDMMYYYY_RE.exec(s);
  if (!m) return s; // no matchea el patrón conocido — se conserva tal cual

  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const hour = Number(m[4]), minute = Number(m[5]), second = Number(m[6]);

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Sumar el offset a UTC en minutos y normalizar manualmente el desborde
  // de día/mes/año — sin pasar por Date() en ningún momento.
  let totalMinutes = hour * 60 + minute + CONTROLT_UTC_OFFSET_MINUTES;
  const extraDays = Math.floor(totalMinutes / (24 * 60));
  totalMinutes -= extraDays * 24 * 60;
  const utcHour = Math.floor(totalMinutes / 60);
  const utcMinute = totalMinutes % 60;

  let utcDay = day + extraDays;
  let utcMonth = month;
  let utcYear = year;
  while (utcDay > daysInMonth[utcMonth - 1]) {
    utcDay -= daysInMonth[utcMonth - 1];
    utcMonth += 1;
    if (utcMonth > 12) { utcMonth = 1; utcYear += 1; }
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${utcYear}-${pad(utcMonth)}-${pad(utcDay)}T${pad(utcHour)}:${pad(utcMinute)}:${pad(second)}.000Z`;
}
