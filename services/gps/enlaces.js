/**
 * services/gps/enlaces.js — Enlaces de Seguimiento GPS (Fase 10B; interno
 * sin OTP agregado en Fase 11B)
 *
 * Crea y valida el enlace temporal que un destinatario de un Reporte
 * Automático de Gestión Logística puede usar para ver, en modo solo
 * lectura, únicamente las placas incluidas en ESE reporte — misma
 * aplicación (seguimiento-gps/) y mismo token para destinatarios internos y
 * externos; solo cambia el método de autenticación (ver
 * services/gps/accesoInterno.js para internos, services/gps/otp.js para
 * externos, sin cambios).
 *
 * Patrón de inyección de dependencias — igual que services/reportes/*: este
 * módulo nunca importa el index.js raíz (evita ejecutar app.listen()).
 * `obtenerDatosReporte` sí se importa directamente de services/reportes/
 * index.js — es un módulo hermano, sin efectos secundarios de arranque
 * (mismo patrón que excelBuilder.js/htmlBuilder.js, que hacen exactamente
 * lo mismo).
 */
import { obtenerDatosReporte } from '../reportes/index.js';
import { extraerPlacas } from './vehiculos.js';
import { generarToken, hashSecreto } from './crypto.js';

/** Módulo al que Fase 10B restringe el Seguimiento GPS — decisión cerrada. */
export const MODULO_PERMITIDO = 'gestion_logistica';

/** TTL por defecto del enlace si el llamador no especifica uno — 7 días. */
export const TTL_HORAS_DEFECTO = 24 * 7;

function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

// ─── Crear enlace ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   reporteId: string,
 *   reporte?: object,                      // fila de reportes_automaticos YA resuelta
 *                                           // (evita un segundo sbFetch — Fase 10D,
 *                                           // ejecutarReporteManual ya la tiene). Se
 *                                           // valida que reporte.id === reporteId.
 *   datos?: {columnas, registros, metadata}, // salida YA resuelta de obtenerDatosReporte()
 *                                           // (evita recalcular el dataset — Fase 10D,
 *                                           // el motor de envío ya lo hizo para el
 *                                           // Excel/HTML de esa misma ejecución).
 *   destinatariosAutorizados?: string[],   // omitido = reporte.destinatarios.correos_externos
 *   destinatariosInternosAutorizados?: string[], // Fase 11B — correos internos ya
 *     resueltos (personal.correo_compartido, vía resolverDestinatarios() en
 *     envioManual.js). Sin default derivado de reporte.destinatarios.personal_ids
 *     aquí a propósito: personal_ids son IDs, no correos — resolverlos requeriría
 *     una segunda consulta a `personal` que el llamador (envioManual.js) YA hizo
 *     para el envío del correo; se reutiliza ese resultado en vez de duplicarla.
 *   origen?: string,                        // 'manual' | 'scheduler' — informativo
 *   creadoPor?: string,
 *   ttlHoras?: number,
 * }} input
 * @param {object} deps — sbFetch + las deps de obtenerDatosReporte (viajesCache,
 *   tripCustomerCache, extraerTelefono, primerNombreCliente) — solo se usan si
 *   `input.reporte`/`input.datos` no vienen ya resueltos.
 * @returns {Promise<
 *   {ok: true, enlaceId: string, token: string, placas: string[],
 *    destinatariosAutorizados: string[], destinatariosInternosAutorizados: string[],
 *    expiraEn: string}
 *   | {ok: false, codigo: string, error: string}
 * >}
 */
export async function crearEnlace(input = {}, deps = {}) {
  const { sbFetch } = deps;
  const { reporteId, origen = null, creadoPor = null } = input;

  if (!reporteId) return { ok: false, codigo: 'reporte_id_requerido', error: 'reporteId es obligatorio' };
  if (!sbFetch)    return { ok: false, codigo: 'deps_incompletas',   error: 'crearEnlace requiere sbFetch en deps' };

  if (input.reporte && input.reporte.id !== reporteId) {
    return { ok: false, codigo: 'reporte_no_coincide', error: 'input.reporte no corresponde a reporteId' };
  }
  const reporte = input.reporte
    ?? (await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(reporteId)}&limit=1`))?.[0];
  if (!reporte) return { ok: false, codigo: 'no_encontrado', error: 'Reporte no encontrado' };
  if (reporte.borrador) return { ok: false, codigo: 'borrador', error: 'El reporte es un borrador' };
  if (!reporte.activo)  return { ok: false, codigo: 'inactivo', error: 'El reporte está inactivo' };
  if (reporte.modulo_id !== MODULO_PERMITIDO) {
    return {
      ok: false,
      codigo: 'modulo_no_soportado',
      error: `El Seguimiento GPS solo aplica a reportes de ${MODULO_PERMITIDO}`,
    };
  }

  const autorizados = [
    ...new Set(
      (input.destinatariosAutorizados ?? reporte.destinatarios?.correos_externos ?? [])
        .map(normalizarCorreo)
        .filter(Boolean)
    ),
  ];
  // Fase 11B: un enlace ya no requiere destinatarios EXTERNOS específicamente
  // — internos y externos comparten el mismo enlace/aplicación, así que
  // basta con que exista AL MENOS UNO de los dos grupos. (Antes de 11B esta
  // condición solo miraba `autorizados` — el bug reportado: un reporte con
  // solo destinatarios internos terminaba en 'sin_destinatarios_externos'.)
  const autorizadosInternos = [
    ...new Set((input.destinatariosInternosAutorizados ?? []).map(normalizarCorreo).filter(Boolean)),
  ];
  if (autorizados.length === 0 && autorizadosInternos.length === 0) {
    return {
      ok: false,
      codigo: 'sin_destinatarios',
      error: 'El reporte no tiene destinatarios (internos ni externos) autorizados para el enlace',
    };
  }

  let datos;
  try {
    datos = input.datos ?? await obtenerDatosReporte(reporte, deps);
  } catch (err) {
    return { ok: false, codigo: 'error_dataset', error: `No se pudo resolver el dataset del reporte: ${err.message}` };
  }
  const placas = extraerPlacas(datos.registros, reporte.tipo_reporte);

  const token     = generarToken();
  const tokenHash = hashSecreto(token);
  const ttlHoras  = input.ttlHoras ?? TTL_HORAS_DEFECTO;
  const expiraEn  = new Date(Date.now() + ttlHoras * 3_600_000).toISOString();

  const filasEnlace = await sbFetch('/reportes_gps_enlaces', 'POST', {
    reporte_id:                          reporteId,
    token_hash:                          tokenHash,
    placas,
    destinatarios_autorizados:           autorizados,
    destinatarios_internos_autorizados:  autorizadosInternos,
    expira_en:                           expiraEn,
    revocado:                            false,
    origen,
    creado_por:                          creadoPor,
  });
  const enlace = filasEnlace?.[0];
  if (!enlace) return { ok: false, codigo: 'error_persistencia', error: 'No se pudo crear el enlace' };

  return {
    ok: true,
    enlaceId: enlace.id,
    token,                 // en claro — única vez que se devuelve, nunca se persiste así
    placas,
    destinatariosAutorizados: autorizados,
    destinatariosInternosAutorizados: autorizadosInternos,
    expiraEn,
  };
}

// ─── Validar enlace ───────────────────────────────────────────────────────────

/**
 * @param {string} token
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<{ok:true, enlace:object} | {ok:false, codigo:string}>}
 *   `enlace` es la fila completa de reportes_gps_enlaces — uso interno del
 *   servicio. La capa de ruta pública NUNCA debe reenviar este objeto tal
 *   cual (contiene reporte_id, destinatarios_autorizados) — debe proyectar
 *   solo lo estrictamente necesario.
 */
export async function validarEnlace(token, deps = {}) {
  const { sbFetch } = deps;
  if (!token) return { ok: false, codigo: 'token_requerido' };
  if (!sbFetch) return { ok: false, codigo: 'deps_incompletas' };

  const hash = hashSecreto(token);
  const filas = await sbFetch(`/reportes_gps_enlaces?token_hash=eq.${encodeURIComponent(hash)}&limit=1`);
  const enlace = filas?.[0];
  if (!enlace) return { ok: false, codigo: 'no_encontrado' };
  if (enlace.revocado) return { ok: false, codigo: 'revocado' };
  if (new Date(enlace.expira_en).getTime() <= Date.now()) return { ok: false, codigo: 'expirado' };

  return { ok: true, enlace };
}

// ─── Revocar enlace ───────────────────────────────────────────────────────────

/**
 * Acción interna (no expuesta por una ruta pública en esta fase — la UI que
 * la dispare es Fase 10D+). Revocación "soft": conserva el registro para
 * auditoría, pero lo invalida de inmediato — validarEnlace() y, en cascada,
 * validarSesion() (services/gps/sesiones.js) dejan de aceptar el enlace y
 * cualquier sesión ya emitida desde él.
 */
export async function revocarEnlace(enlaceId, deps = {}) {
  const { sbFetch } = deps;
  if (!enlaceId) return { ok: false, codigo: 'enlace_id_requerido' };
  if (!sbFetch)  return { ok: false, codigo: 'deps_incompletas' };

  const filas = await sbFetch(
    `/reportes_gps_enlaces?id=eq.${encodeURIComponent(enlaceId)}`,
    'PATCH',
    { revocado: true, revocado_en: new Date().toISOString() },
  );
  if (!filas?.[0]) return { ok: false, codigo: 'no_encontrado' };
  return { ok: true };
}
