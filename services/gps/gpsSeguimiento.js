/**
 * services/gps/gpsSeguimiento.js — Vehículos autorizados de una sesión (Fase 10B)
 *
 * Única función que, dada una sesión ya validada, devuelve datos GPS reales
 * — y lo hace reutilizando exactamente transformarCentroGps()
 * (services/reportes/datasetProvider.js, Fase 9B), la MISMA función que ya
 * alimenta GET /api/gps del Centro GPS interno. No hay un segundo proveedor
 * GPS ni una reimplementación del cómputo de estado/posición: el único
 * trabajo propio de este módulo es (a) resolver la sesión→enlace→placas y
 * (b) filtrar y proyectar la respuesta a solo esas placas, con solo los
 * campos operativos necesarios — nunca IDs internos.
 */
import { transformarCentroGps } from '../reportes/datasetProvider.js';
import { validarSesion } from './sesiones.js';
import { registrarAcceso } from './accesos.js';

/**
 * Allowlist explícita — nunca se reenvía el objeto GpsRecord completo.
 * Deliberadamente fuera: empresa_cliente_id, razon_social,
 * company_customer_name, id_monitoring_order, number_order (remisión
 * interna) — no son necesarios para que un destinatario externo siga su
 * propio envío y algunos identifican a otras partes (§5.6/§6.2 de
 * docs/REPORTES_SEGUIMIENTO_GPS_ARQUITECTURA.md).
 */
function proyectarVehiculoPublico(v) {
  return {
    placa:            v.license_plate,
    conductor:        v.driver_name,
    estado:           v.estadoGps,
    estadoViaje:      v.state_travel,
    lat:              v.lat,
    lon:              v.lon,
    ultimaActualizacion: v.latest_gps_report,
    ubicacion:        v.current_address_location,
    origen:           v.origin_city_name,
    destino:          v.destiny_city_name,
    alarma:           v.last_alarm_name,
    manifiesto:        v.trip_number, // código operativo, ya visible en el Excel del reporte — no es un UUID interno
  };
}

/**
 * @param {string} sesionToken
 * @param {object} deps — sbFetch + cache (objeto ESTABLE de index.js — se
 *   lee `cache.viajes.data` en el momento de la llamada, nunca se
 *   desestructura antes, para no congelar un snapshot viejo — ver
 *   routes/gpsSeguimiento.js) + tripCustomerCache.
 * @param {{ip?: string, userAgent?: string}} contexto — solo para auditoría.
 */
export async function obtenerVehiculosAutorizados(sesionToken, deps = {}, contexto = {}) {
  const validacion = await validarSesion(sesionToken, deps);
  if (!validacion.ok) return { ok: false, codigo: validacion.codigo };
  const { sesion, enlace } = validacion;

  const placasAutorizadas = new Set(
    (enlace.placas ?? []).map(p => String(p).trim().toUpperCase()).filter(Boolean)
  );

  const viajesCache = deps.cache?.viajes?.data ?? deps.viajesCache ?? [];
  const snapshot = transformarCentroGps(viajesCache, deps);

  const vehiculos = snapshot
    .filter(v => v.license_plate && placasAutorizadas.has(String(v.license_plate).trim().toUpperCase()))
    .map(proyectarVehiculoPublico);

  await registrarAcceso({
    enlaceId: enlace.id, correo: sesion.correo, evento: 'vehiculos_consultados', exitoso: true,
    detalle: { cantidad: vehiculos.length, ip: contexto.ip ?? null },
    ip: contexto.ip ?? null, userAgent: contexto.userAgent ?? null,
  }, deps);

  return { ok: true, vehiculos };
}
