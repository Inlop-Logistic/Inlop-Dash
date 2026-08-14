/**
 * services/reportes/datasetProvider.js — Dataset Provider del generador (Fase 9B)
 *
 * Obtiene el dataset COMPLETO (no la muestra de 10 filas de Preview — Fase
 * 8C) de cada tipo_reporte, reutilizando la MISMA lógica de datos que ya
 * usan los endpoints operativos de index.js — nunca reimplementada desde
 * cero, nunca invocada por HTTP (sin loopback a /api/*).
 *
 * Patrón de inyección de dependencias — idéntico al ya usado en
 * services/notificationOrchestrator.js / services/authScope.js: este módulo
 * NUNCA importa nada de index.js (importarlo ejecutaría app.listen() y todo
 * el arranque del servidor). index.js importa las funciones de aquí y les
 * pasa sus propios `sbFetch`, caché en memoria y helpers como `deps`.
 *
 *   - viajes_activos / centro_gps: las funciones de transformación
 *     (transformarViajesActivos, transformarCentroGps) y los tres helpers
 *     de GPS (derivarEstadoGps, parseLatLon, ESTADOS_MONITOREABLES) se
 *     MOVIERON aquí desde index.js — eran su único call site (GET /api/viajes
 *     y GET /api/gps). index.js ahora las importa de vuelta para sus rutas:
 *     una sola implementación, no dos.
 *   - solicitudes / programacion / viajes_finalizados: `extraerTelefono` y
 *     `primerNombreCliente` se usan en muchos otros puntos de index.js y NO
 *     se movieron — se inyectan vía `deps`, igual que `sbFetch`.
 *
 * Decisiones de Fase 9A aplicadas aquí (ver
 * docs/REPORTES_AUTOMATICOS_MOTOR_GENERACION.md):
 *   §5.2 — solicitudes/programación: fecha de ejecución (hoy Colombia) por
 *          defecto; si `filtros` trae una condición explícita sobre el
 *          campo que el endpoint ya usa para acotar la consulta, se
 *          empuja como rango (`desde`/`hasta`) en vez de traer todo y
 *          filtrar en memoria. El resto de filtros sigue resolviéndose en
 *          el Filter Engine, después de traer los datos.
 *   "sin límite de Preview" — viajes_finalizados hace el escaneo paginado
 *          completo (igual que GET /api/cumplidos sin `?limit`), sin el
 *          tope de 10 de la muestra del wizard.
 */
import { parseFechaTMS, fechaHoyColombia } from '../../utils/fechas.js';
import { isPlaceholderTmsCustomer } from '../customerResolver.js';
import { normalizarClienteFiltro } from './clienteFiltro.js';

// ─── Centro GPS — constantes y helper movidos desde index.js (único call site) ──

export const GPS_THRESHOLD_DETENIDO     = 2;   // horas — coincide con frontend
export const GPS_THRESHOLD_DESCONECTADO = 6;   // horas — coincide con frontend

export const ESTADOS_MONITOREABLES = new Set([
  'en transíto', 'iniciado', 'descargando', 'cargando', 'pernoctando',
]);

export function derivarEstadoGps(v) {
  const alarm = (v.last_alarm_name ?? '').toLowerCase();
  if (alarm.includes('pánico') || alarm.includes('panico')) return 'panico';
  if (v.last_alarm_name) return 'con_alarma';
  const ts = parseFechaTMS(v.latest_gps_report, 'MDY');
  if (!ts) return 'desconectado';
  const horas = (Date.now() - ts.getTime()) / 3_600_000;
  if (horas > GPS_THRESHOLD_DESCONECTADO) return 'desconectado';
  if (horas > GPS_THRESHOLD_DETENIDO)     return 'detenido';
  return 'activo';
}

export function parseLatLon(str) {
  if (!str) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// ─── Viajes Activos ───────────────────────────────────────────────────────────
// Misma transformación que GET /api/viajes (index.js). Recibe cache.viajes.data
// ya cargado — nunca hace I/O propio.

export function transformarViajesActivos(viajesCache, deps = {}) {
  const { tripCustomerCache, extraerTelefono, primerNombreCliente } = deps;
  return (viajesCache ?? []).map(v => {
    const cached = tripCustomerCache?.get(v.trip_number);
    return {
      trip_number:              v.trip_number,
      id_monitoring_order:      v.id_monitoring_order      || null,
      number_order:              v.number_order             || null,
      license_plate:             v.license_plate            || null,
      driver_name:               v.driver_name              || null,
      driver_phone:              v.driver_phone             || null,
      conductor_tel:             extraerTelefono(v.driver_phone, v.full_driver) || null,
      cliente:                   primerNombreCliente(v.company_customer_name),
      company_customer_name:     v.company_customer_name    || null,
      empresa_cliente_id:        cached?.empresa_cliente_id ?? null,
      razon_social:              cached?.razon_social        ?? null,
      origin_city_name:          v.origin_city_name         || null,
      destiny_city_name:         v.destiny_city_name        || null,
      type_operation:            v.type_operation           || null,
      stops:                     v.stops                    || null,
      state_travel:              v.state_travel,
      pct:                       v.percentage_travel != null ? (parseFloat(String(v.percentage_travel)) || 0) : null,
      percentage_travel:         v.percentage_travel,
      last_event:                v.last_event               || null,
      appointment_fulfillment:   v.appointment_fulfillment  || null,
      lat:                       parseLatLon(v.latitude),
      lon:                       parseLatLon(v.longitude),
      latest_gps_report:         v.latest_gps_report        || null,
      current_address_location:  v.current_address_location || null,
      last_alarm_name:           v.last_alarm_name          || null,
      created_on:                v.created_on               || null,
      activated_on:              v.activated_on             || null,
      schedulate_origin:         v.schedulate_origin        || null,
    };
  });
}

// ─── Centro GPS ───────────────────────────────────────────────────────────────
// Misma transformación que GET /api/gps (index.js).

export function transformarCentroGps(viajesCache, deps = {}) {
  const { tripCustomerCache } = deps;
  return (viajesCache ?? [])
    .filter(v => ESTADOS_MONITOREABLES.has((v.state_travel ?? '').toLowerCase()))
    .map(v => {
      const cached = tripCustomerCache?.get(v.trip_number);
      return {
        id:                        v.trip_number,
        trip_number:               v.trip_number,
        number_order:              v.number_order             || null,
        license_plate:             v.license_plate            || null,
        driver_name:               v.driver_name              || null,
        company_customer_name:     v.company_customer_name    || null,
        empresa_cliente_id:        cached?.empresa_cliente_id ?? null,
        razon_social:              cached?.razon_social        ?? null,
        origin_city_name:          v.origin_city_name         || null,
        destiny_city_name:         v.destiny_city_name        || null,
        state_travel:              v.state_travel,
        lat:                       parseLatLon(v.latitude),
        lon:                       parseLatLon(v.longitude),
        latest_gps_report:         v.latest_gps_report        || null,
        current_address_location:  v.current_address_location || null,
        last_alarm_name:           v.last_alarm_name          || null,
        estadoGps:                 derivarEstadoGps(v),
      };
    });
}

// ─── Solicitudes ──────────────────────────────────────────────────────────────
// Misma consulta y mapeo que GET /api/solicitudes. `desde`/`hasta` opcionales
// (omitidos = sin cota en ese extremo) para soportar push-down abierto
// (antes_de/despues_de) — el endpoint HTTP sigue resolviendo su propio
// default "hoy" antes de llegar aquí, así que su comportamiento no cambia.

const SOL_SELECT = [
  'id', 'codigo_solicitud', 'external_ref', 'estado', 'creado_en', 'creado_por',
  'empresa_cliente_id', 'agencia_id', 'agencia_nombre',
  'tipo_operacion', 'tipo_vehiculo', 'origen', 'destino',
  'fecha_requerida', 'observacion_coordinadora',
  'placa_asignada', 'conductor_nombre', 'conductor_tel',
  'controlt_trip_number', 'canal',
].join(',');

export async function obtenerSolicitudesCompletas({ desde, hasta } = {}, deps = {}) {
  const { sbFetch } = deps;

  let qs = `/solicitudes?order=creado_en.desc&limit=500&select=${SOL_SELECT}`;
  qs += `&estado=in.(pendiente,confirmado,en_ruta,completado,cancelado)`;
  if (desde) qs += `&creado_en=gte.${encodeURIComponent(desde + 'T00:00:00.000-05:00')}`;
  if (hasta) qs += `&creado_en=lte.${encodeURIComponent(hasta + 'T23:59:59.999-05:00')}`;

  const solicitudes = await sbFetch(qs) || [];

  const empresaIds = [...new Set(solicitudes.map(s => s.empresa_cliente_id).filter(Boolean))];
  const agenciaIds = [...new Set(solicitudes.map(s => s.agencia_id).filter(Boolean))];
  const usuarioIds = [...new Set(solicitudes.map(s => s.creado_por).filter(Boolean))];

  const [empresas, agencias, usuarios] = await Promise.all([
    empresaIds.length
      ? sbFetch(`/empresas_cliente?id=in.(${empresaIds.map(encodeURIComponent).join(',')})&select=id,razon_social`)
      : Promise.resolve([]),
    agenciaIds.length
      ? sbFetch(`/agencias_cliente?id=in.(${agenciaIds.map(encodeURIComponent).join(',')})&select=id,nombre`)
      : Promise.resolve([]),
    usuarioIds.length
      ? sbFetch(`/usuarios_cliente?id=in.(${usuarioIds.map(encodeURIComponent).join(',')})&select=id,nombre`)
      : Promise.resolve([]),
  ]);

  const empMap = {}; (empresas || []).forEach(e => { empMap[e.id] = e.razon_social; });
  const agMap  = {}; (agencias || []).forEach(a => { agMap[a.id]  = a.nombre; });
  const usrMap = {}; (usuarios || []).forEach(u => { usrMap[u.id] = u.nombre; });

  return solicitudes.map(s => ({
    id:                    s.id,
    codigo_solicitud:      s.codigo_solicitud,
    external_ref:          s.external_ref              || null,
    cliente:               empMap[s.empresa_cliente_id] || '—',
    agencia:               agMap[s.agencia_id]          || s.agencia_nombre || '—',
    solicitante:           usrMap[s.creado_por]         || '—',
    tipo_operacion:        s.tipo_operacion             || '',
    tipo_vehiculo:         s.tipo_vehiculo              || '',
    origen:                s.origen                    || '',
    destino:               s.destino                    || '',
    fecha_requerida:       s.fecha_requerida            || null,
    estado:                s.estado === 'confirmado' ? 'aprobado' : s.estado,
    creado_en:             s.creado_en,
    canal:                 s.canal                     || 'APP',
    placa_asignada:        s.placa_asignada            || null,
    conductor_nombre:      s.conductor_nombre          || null,
    conductor_tel:         s.conductor_tel             || null,
    controlt_trip_number:  s.controlt_trip_number      || null,
  }));
}

// ─── Programación ─────────────────────────────────────────────────────────────
// Misma consulta y enriquecimiento que GET /api/programacion. `desde`/`hasta`
// opcionales, mismo criterio que Solicitudes.

export async function obtenerProgramacionCompleta({ desde, hasta } = {}, deps = {}) {
  const { sbFetch, viajesCache, extraerTelefono } = deps;

  let qs = `/planeados?order=schedulate_origin.asc&limit=500`;
  if (desde) qs += `&fecha_programada_dia=gte.${desde}`;
  if (hasta) qs += `&fecha_programada_dia=lte.${hasta}`;

  const rows = await sbFetch(qs) || [];

  const empIds = [...new Set(rows.map(r => r.empresa_cliente_id).filter(Boolean))];
  let empMap = {};
  if (empIds.length) {
    const empresas = await sbFetch(
      `/empresas_cliente?id=in.(${empIds.map(encodeURIComponent).join(',')})&select=id,razon_social`
    ) || [];
    empresas.forEach(e => { empMap[e.id] = e.razon_social; });
  }

  const viajesIdx = new Map((viajesCache ?? []).map(v => [v.trip_number, v]));

  const tripNums = rows.map(r => r.trip_number).filter(Boolean);
  let solTelMap = {};
  if (tripNums.length) {
    const solRows = await sbFetch(
      `/solicitudes?controlt_trip_number=in.(${tripNums.map(encodeURIComponent).join(',')})&select=controlt_trip_number,conductor_tel`
    ) || [];
    solRows.forEach(s => {
      if (s.controlt_trip_number && s.conductor_tel) {
        solTelMap[s.controlt_trip_number] = s.conductor_tel;
      }
    });
  }

  return rows.map(r => {
    let nombre_cliente = null;
    if (r.empresa_cliente_id && empMap[r.empresa_cliente_id]) {
      nombre_cliente = empMap[r.empresa_cliente_id];
    } else if (r.company_customer_name && !isPlaceholderTmsCustomer(r.company_customer_name)) {
      nombre_cliente = r.company_customer_name;
    }
    const vivo = viajesIdx.get(r.trip_number) || null;
    const origen  = (r.city_origin  || '').trim().toLowerCase();
    const destino = (r.city_destination || '').trim().toLowerCase();
    const tipo_servicio = (origen && destino)
      ? (origen === destino ? 'Urbano' : 'Nacional')
      : null;
    return {
      ...r,
      nombre_cliente,
      match_tms_pendiente: !r.empresa_cliente_id && isPlaceholderTmsCustomer(r.company_customer_name),
      tipo_servicio,
      type_operation: vivo?.type_operation || null,
      conductor_tel: vivo
        ? (extraerTelefono(vivo.driver_phone, vivo.full_driver) || solTelMap[r.trip_number] || null)
        : (solTelMap[r.trip_number] || null),
    };
  });
}

// ─── Viajes Finalizados (cumplidos) ─────────────────────────────────────────
// Escaneo paginado completo, sin el tope de 10 de Preview (Fase 8C) — mismo
// bucle de paginación que GET /api/cumplidos sin `?limit`.

const CUMPLIDOS_SELECT = 'id,manifiesto,placa,conductor,conductor_tel,cliente,origen,destino,' +
  'estado_controlt,pct,fecha_viaje,fecha_finalizacion,tipo_negocio,estado_cumplido,' +
  'tiene_soporte,estado_documental,obs,link_soporte';

export async function obtenerCumplidosCompletos(_contexto, deps = {}) {
  const { sbFetch } = deps;
  const SB_PAGE = 500;
  let sbOffset = 0;
  const allRows = [];
  while (true) {
    const page = await sbFetch(
      `/cumplidos?select=${CUMPLIDOS_SELECT}&order=fecha_viaje.desc&limit=${SB_PAGE}&offset=${sbOffset}`
    );
    if (!page || page.length === 0) break;
    allRows.push(...page);
    if (page.length < SB_PAGE) break;
    sbOffset += SB_PAGE;
  }

  return allRows.map(r => ({
    id:                     r.id,
    trip_number:            r.id,
    number_order:           r.manifiesto      || null,
    company_customer_name:  r.cliente         || null,
    license_plate:          r.placa           || null,
    driver_name:            r.conductor       || null,
    conductor_tel:          r.conductor_tel   || null,
    origin_city_name:       r.origen          || null,
    destiny_city_name:      r.destino         || null,
    state_travel:           r.estado_controlt || '',
    activated_on:           r.fecha_viaje     || null,
    created_on:             null,
    fecha_cumplido:         r.fecha_finalizacion || null,
    estado_documental:      r.estado_documental   || 'pendiente',
    type_operation:         r.tipo_negocio    || null,
    estado_cumplido:        r.estado_cumplido || null,
    tiene_soporte:          r.tiene_soporte   ?? false,
    obs:                    r.obs             || null,
    link_soporte:           r.link_soporte    || null,
  }));
}

// ─── Enriquecimiento de campos derivados ─────────────────────────────────────
// Mismo criterio que la Preview del wizard (Fase 8D, corregido en 8E):
//  - `tipo_servicio` → origin_city_name === destiny_city_name → Urbano | Nacional
//  - `linea_negocio` → misma regla exacta que erp/src/utils/lineaNegocio.ts y
//    que index.js (tiposDocumentoParaViaje): match exacto "granel liquido",
//    no substring.
//  - `cliente_normalizado` (Fase 11A) → clave estable para el filtro
//    multi-selección "Cliente" (ver clienteFiltro.js). Requiere `tipoReporte`
//    porque el nombre crudo del cliente vive en un campo distinto según el
//    dataset (ver CAMPO_CLIENTE_POR_REPORTE) — sin tipoReporte no se agrega
//    (mantiene compatibilidad con los call sites/tests que aún no lo pasan).
// Solo completa campos que el dataset no trae ya resueltos (`!fila[campo]`).

function lineaNegocio(raw) {
  if (!raw) return 'Carga Seca';
  return String(raw).trim().toLowerCase() === 'granel liquido' ? 'Carga Líquida' : 'Carga Seca';
}

/**
 * Campo(s) crudo(s) que representan el nombre del cliente en cada dataset,
 * por orden de preferencia: primero la razón social ya resuelta contra el
 * maestro `empresas_cliente` (cuando el dataset la trae), luego el nombre
 * crudo del TMS/Supabase como respaldo. Mismos campos que ya usa cada
 * transformador de este archivo (`razon_social`, `cliente`, `nombre_cliente`,
 * `company_customer_name`) — no se agrega ninguna fuente de dato nueva.
 */
export const CAMPO_CLIENTE_POR_REPORTE = {
  viajes_activos:      fila => fila.razon_social || fila.company_customer_name,
  solicitudes:         fila => fila.cliente,
  programacion:        fila => fila.nombre_cliente,
  viajes_finalizados:  fila => fila.company_customer_name,
  centro_gps:          fila => fila.razon_social || fila.company_customer_name,
};

export function enriquecerFilas(filas, tipoReporte) {
  const obtenerCliente = CAMPO_CLIENTE_POR_REPORTE[tipoReporte];

  return filas.map(r => {
    const fila = { ...r };

    if (!fila.tipo_servicio) {
      const orig = String(fila.origin_city_name ?? fila.city_origin ?? '').trim().toLowerCase();
      const dest = String(fila.destiny_city_name ?? fila.city_destination ?? '').trim().toLowerCase();
      if (orig && dest) {
        fila.tipo_servicio = orig === dest ? 'Urbano' : 'Nacional';
      }
    }

    if (!fila.linea_negocio && fila.type_operation) {
      fila.linea_negocio = lineaNegocio(fila.type_operation);
    }

    if (obtenerCliente) {
      fila.cliente_normalizado = normalizarClienteFiltro(obtenerCliente(fila));
    }

    return fila;
  });
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/** Campo fecha, por reporte, sobre el que el endpoint ya acota su consulta —
 *  único caso en el que un filtro de fecha puede empujarse como desde/hasta
 *  (Fase 9A §5.2). Cualquier otro filtro de fecha se resuelve en el Filter
 *  Engine, en memoria, después de traer los datos. */
const CAMPO_PUSHDOWN_FECHA = {
  solicitudes:  'creado_en',
  programacion: 'schedulate_origin',
};

/**
 * Calcula un rango { desde, hasta } (YYYY-MM-DD o null) a partir de un
 * filtro de fecha explícito sobre el campo de push-down, o null si no hay
 * ninguno (→ el llamador debe usar la fecha de ejecución por defecto).
 * El rango solo necesita ser lo bastante amplio para no EXCLUIR ninguna
 * fila válida — el Filter Engine hace después la comparación exacta.
 */
export function calcularRangoPushdown(filtros, campoPushdown) {
  if (!campoPushdown) return null;
  const filtro = (filtros ?? []).find(f => f.campo === campoPushdown);
  if (!filtro) return null;
  switch (filtro.operador) {
    case 'es':
      return filtro.valor ? { desde: filtro.valor, hasta: filtro.valor } : null;
    case 'antes_de':
      return filtro.valor ? { desde: null, hasta: filtro.valor } : null;
    case 'despues_de':
      return filtro.valor ? { desde: filtro.valor, hasta: null } : null;
    case 'entre':
      return (filtro.valor_desde || filtro.valor_hasta)
        ? { desde: filtro.valor_desde || null, hasta: filtro.valor_hasta || null }
        : null;
    default:
      return null;
  }
}

/**
 * Obtiene el dataset COMPLETO del `tipoReporte` indicado — sin filtrar
 * todavía (eso lo hace el Filter Engine) y sin recortar a un límite de
 * Preview. Nunca llama endpoints HTTP propios: usa exclusivamente la lógica
 * interna de este módulo más lo inyectado en `deps`.
 *
 * @param {string} tipoReporte
 * @param {{filtros?: Array, fechaEjecucion?: string}} contexto
 * @param {{sbFetch?: Function, viajesCache?: Array, tripCustomerCache?: Map,
 *          extraerTelefono?: Function, primerNombreCliente?: Function}} deps
 */
export async function obtenerDatasetCompleto(tipoReporte, contexto = {}, deps = {}) {
  const fechaEjecucion = contexto.fechaEjecucion || fechaHoyColombia();
  const filtros = contexto.filtros ?? [];

  switch (tipoReporte) {
    case 'viajes_activos':
      return enriquecerFilas(transformarViajesActivos(deps.viajesCache, deps), tipoReporte);

    case 'centro_gps':
      return enriquecerFilas(transformarCentroGps(deps.viajesCache, deps), tipoReporte);

    case 'solicitudes': {
      const pushdown = calcularRangoPushdown(filtros, CAMPO_PUSHDOWN_FECHA.solicitudes);
      const desde = pushdown ? pushdown.desde : fechaEjecucion;
      const hasta = pushdown ? pushdown.hasta : fechaEjecucion;
      return enriquecerFilas(await obtenerSolicitudesCompletas({ desde, hasta }, deps), tipoReporte);
    }

    case 'programacion': {
      const pushdown = calcularRangoPushdown(filtros, CAMPO_PUSHDOWN_FECHA.programacion);
      const desde = pushdown ? pushdown.desde : fechaEjecucion;
      const hasta = pushdown ? pushdown.hasta : fechaEjecucion;
      return enriquecerFilas(await obtenerProgramacionCompleta({ desde, hasta }, deps), tipoReporte);
    }

    case 'viajes_finalizados':
      return enriquecerFilas(await obtenerCumplidosCompletos(contexto, deps), tipoReporte);

    default:
      throw new Error(`Sin fuente de datos configurada para: ${tipoReporte}`);
  }
}

// ─── Clientes disponibles (Fase 11A) ─────────────────────────────────────────
// Alimenta el selector "Cliente" del wizard con los clientes REALES del
// dataset — nunca un catálogo aparte que pueda desalinearse del filtro que
// de verdad se aplica en generación. Un cliente por clave normalizada
// (cliente_normalizado), con la variante cruda más corta como etiqueta —
// suele ser la razón social "limpia" en vez de un sufijo ruidoso del TMS.

export async function listarClientesDataset(tipoReporte, deps = {}) {
  if (!CAMPO_CLIENTE_POR_REPORTE[tipoReporte]) return [];

  const filas = await obtenerDatasetCompleto(tipoReporte, {}, deps);
  const obtenerCliente = CAMPO_CLIENTE_POR_REPORTE[tipoReporte];
  const porClave = new Map();

  for (const fila of filas) {
    const clave = fila.cliente_normalizado;
    if (!clave) continue;
    const etiqueta = obtenerCliente(fila);
    if (!etiqueta) continue;
    const actual = porClave.get(clave);
    if (!actual || etiqueta.length < actual.length) {
      porClave.set(clave, etiqueta);
    }
  }

  return [...porClave.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
