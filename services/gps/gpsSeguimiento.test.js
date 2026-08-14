/**
 * Unit tests for services/gps/gpsSeguimiento.js
 * Run: node --test services/gps/gpsSeguimiento.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { crearEnlace } from './enlaces.js';
import { crearSesion } from './sesiones.js';
import { obtenerVehiculosAutorizados } from './gpsSeguimiento.js';

function reporteBase(overrides = {}) {
  return {
    id: 'R1',
    nombre: 'Viajes activos — solo 2 placas',
    tipo_reporte: 'viajes_activos',
    modulo_id: 'gestion_logistica',
    formato: 'excel',
    activo: true,
    borrador: false,
    filtros: [],
    columnas: [],
    destinatarios: { personal_ids: [], correos_externos: ['cliente@externo.com'] },
    ...overrides,
  };
}

// La flota "en vivo" tiene 3 vehículos; el reporte (vía filtros, simulados
// aquí con un dataset que ya solo trae 2) solo incluye 2 de ellos — el
// tercero (DEF456) NUNCA debe aparecer en la respuesta pública.
function viajesCacheCompleta() {
  return [
    { trip_number: 'T1', license_plate: 'ABC123', driver_name: 'Juan', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali',
      company_customer_name: 'ACME S.A.S.', empresa_cliente_id: 'EMP1', latitude: '4.6', longitude: '-74.1', latest_gps_report: '08/12/2026 09:00:00' },
    { trip_number: 'T2', license_plate: 'XYZ789', driver_name: 'Ana',  state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Medellín',
      company_customer_name: 'ACME S.A.S.', empresa_cliente_id: 'EMP1', latitude: '5.0', longitude: '-75.5', latest_gps_report: '08/12/2026 09:00:00' },
    { trip_number: 'T3', license_plate: 'DEF456', driver_name: 'Pedro', state_travel: 'en transíto', origin_city_name: 'Cali', destiny_city_name: 'Bogotá',
      company_customer_name: 'OTRO CLIENTE', empresa_cliente_id: 'EMP2', latitude: '3.4', longitude: '-76.5', latest_gps_report: '08/12/2026 09:00:00' },
  ];
}

/**
 * Crea un enlace+sesión de prueba sobre una flota "en vivo" de 3 vehículos,
 * pero deja el enlace autorizado solo para 2 de esas 3 placas — el Filter
 * Engine (Fase 9B) ya está probado en services/reportes/*.test.js, así que
 * aquí no hace falta reconstruir un filtro real: lo que este módulo debe
 * garantizar es que la respuesta pública SOLO incluye lo que el enlace
 * tiene congelado en `placas`, sin importar qué más traiga el dataset — por
 * eso se fija `placas` directamente sobre la fila persistida.
 */
async function crearSesionParaReporte() {
  const sbFetch = crearAlmacen({ reportes_automaticos: [reporteBase()] });
  const deps = {
    sbFetch,
    cache: { viajes: { data: viajesCacheCompleta() } },
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };

  const creado = await crearEnlace(
    { reporteId: 'R1', destinatariosAutorizados: ['cliente@externo.com'] },
    deps,
  );
  // Forzamos manualmente el conjunto de placas autorizadas a solo 2 de las
  // 3 vivas, para poder afirmar con certeza que la tercera nunca se filtra.
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces.find(e => e.id === creado.enlaceId);
  filaEnlace.placas = ['ABC123', 'XYZ789'];

  const sesion = await crearSesion(filaEnlace, 'cliente@externo.com', deps);
  return { sesionToken: sesion.sesionToken, deps };
}

test('obtenerVehiculosAutorizados: sesión inválida', async () => {
  const out = await obtenerVehiculosAutorizados('token-inventado', {
    sbFetch: crearAlmacen({}),
    cache: { viajes: { data: [] } },
  });
  assert.equal(out.ok, false);
});

test('obtenerVehiculosAutorizados: solo devuelve las placas congeladas en el enlace — nunca la flota completa', async () => {
  const { sesionToken, deps } = await crearSesionParaReporte();
  const out = await obtenerVehiculosAutorizados(sesionToken, deps);

  assert.equal(out.ok, true);
  assert.equal(out.vehiculos.length, 2);
  const placas = out.vehiculos.map(v => v.placa).sort();
  assert.deepEqual(placas, ['ABC123', 'XYZ789']);
  assert.ok(!placas.includes('DEF456')); // fuera del reporte — nunca debe aparecer
});

test('obtenerVehiculosAutorizados: proyección pública no expone IDs internos ni datos de otros clientes', async () => {
  const { sesionToken, deps } = await crearSesionParaReporte();
  const out = await obtenerVehiculosAutorizados(sesionToken, deps);

  const CAMPOS_PERMITIDOS = new Set([
    'placa', 'conductor', 'estado', 'estadoViaje', 'lat', 'lon',
    'ultimaActualizacion', 'ubicacion', 'origen', 'destino', 'alarma', 'manifiesto',
  ]);
  for (const v of out.vehiculos) {
    for (const key of Object.keys(v)) {
      assert.ok(CAMPOS_PERMITIDOS.has(key), `campo no permitido en la respuesta pública: ${key}`);
    }
    // Explícitamente ausentes: IDs de Supabase y datos de otros clientes.
    assert.equal(v.empresa_cliente_id, undefined);
    assert.equal(v.company_customer_name, undefined);
    assert.equal(v.razon_social, undefined);
    assert.equal(v.id_monitoring_order, undefined);
  }
});

test('manipulación: aunque la flota "en vivo" cambie después de crear el enlace, la autorización sigue atada a las placas congeladas', async () => {
  const { sesionToken, deps } = await crearSesionParaReporte();
  // Un cuarto vehículo aparece en la flota en vivo DESPUÉS de emitido el enlace.
  deps.cache.viajes.data = [
    ...deps.cache.viajes.data,
    { trip_number: 'T4', license_plate: 'NUEVO01', driver_name: 'X', state_travel: 'en transíto', origin_city_name: 'A', destiny_city_name: 'B', latitude: '1', longitude: '1', latest_gps_report: '08/12/2026 09:00:00' },
  ];
  const out = await obtenerVehiculosAutorizados(sesionToken, deps);
  assert.equal(out.vehiculos.some(v => v.placa === 'NUEVO01'), false);
  assert.equal(out.vehiculos.length, 2); // sigue siendo exactamente el conjunto congelado
});

test('sin vehículos con GPS en vivo actualmente → lista vacía, no error', async () => {
  const { sesionToken, deps } = await crearSesionParaReporte();
  deps.cache.viajes.data = []; // ningún viaje activo ahora mismo
  const out = await obtenerVehiculosAutorizados(sesionToken, deps);
  assert.equal(out.ok, true);
  assert.deepEqual(out.vehiculos, []);
});
