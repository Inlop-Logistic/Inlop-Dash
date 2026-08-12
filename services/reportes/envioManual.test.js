/**
 * Unit tests for envioManual.js
 * Run: node --test services/reportes/envioManual.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverDestinatarios, ejecutarReporteManual } from './envioManual.js';
import { crearAlmacen } from '../gps/testStore.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function reporteBase(overrides = {}) {
  return {
    id: 'R1',
    nombre: 'Centro GPS diario',
    tipo_reporte: 'centro_gps',
    asunto: 'Reporte GPS de hoy',
    cuerpo: 'Aquí tienes el reporte de hoy.',
    formato: 'excel',
    activo: true,
    borrador: false,
    filtros: [],
    columnas: [],
    destinatarios: { personal_ids: ['P1', 'P2'], correos_externos: ['ext@dominio.com'] },
    ...overrides,
  };
}

function crearSbFetch({ reporte, personal = [] } = {}) {
  const llamadas = [];
  const sbFetch = async (qs) => {
    llamadas.push(qs);
    if (qs.startsWith('/reportes_automaticos?id=eq.')) return reporte ? [reporte] : [];
    if (qs.startsWith('/personal?')) return personal;
    return [];
  };
  sbFetch.llamadas = llamadas;
  return sbFetch;
}

function depsBase({ reporte, personal, envioResultado } = {}) {
  const llamadasEnvio = [];
  const sendWithAttachment = async (params) => {
    llamadasEnvio.push(params);
    return envioResultado ?? { ok: true, id: 'msg_test_1' };
  };
  sendWithAttachment.llamadas = llamadasEnvio;

  return {
    sbFetch: crearSbFetch({ reporte, personal }),
    viajesCache: [
      { trip_number: 'T1', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    ],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
    sendWithAttachment,
  };
}

// ── resolverDestinatarios ────────────────────────────────────────────────────

test('resolverDestinatarios resuelve personal_ids vía tabla personal (correo_compartido)', async () => {
  const sbFetch = crearSbFetch({
    personal: [
      { id: 'P1', nombre: 'Ana',  correo_compartido: 'ana@inlop.com.co' },
      { id: 'P2', nombre: 'Luis', correo_compartido: 'luis@inlop.com.co' },
    ],
  });
  const out = await resolverDestinatarios({ personal_ids: ['P1', 'P2'], correos_externos: [] }, { sbFetch });
  assert.deepEqual(out.correosEnvio.sort(), ['ana@inlop.com.co', 'luis@inlop.com.co']);
  assert.equal(out.totalPersonal, 2);
  assert.equal(out.totalExternos, 0);
  assert.equal(out.personalSinCorreo, 0);
});

test('resolverDestinatarios incluye correos_externos junto con personal', async () => {
  const sbFetch = crearSbFetch({ personal: [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }] });
  const out = await resolverDestinatarios(
    { personal_ids: ['P1'], correos_externos: ['cliente@externo.com'] },
    { sbFetch }
  );
  assert.deepEqual(out.correosEnvio.sort(), ['ana@inlop.com.co', 'cliente@externo.com']);
});

test('resolverDestinatarios deduplica por correo (case-insensitive) solo en la lista de envío', async () => {
  const sbFetch = crearSbFetch({ personal: [{ id: 'P1', correo_compartido: 'Ana@Inlop.com.co' }] });
  const out = await resolverDestinatarios(
    { personal_ids: ['P1'], correos_externos: ['ana@inlop.com.co'] }, // mismo correo, distinta fuente
    { sbFetch }
  );
  assert.equal(out.correosEnvio.length, 1); // deduplicado para el envío
  // pero el conteo NO oculta a las personas — sigue reflejando la selección real
  assert.equal(out.totalPersonal, 1);
  assert.equal(out.totalExternos, 1);
});

test('resolverDestinatarios cuenta personal sin correo_compartido asignado', async () => {
  // 2 personal_ids configurados, pero la tabla personal solo devuelve 1 con correo
  // (el otro no existe, está inactivo, o no tiene correo_compartido).
  const sbFetch = crearSbFetch({ personal: [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }] });
  const out = await resolverDestinatarios({ personal_ids: ['P1', 'P2'], correos_externos: [] }, { sbFetch });
  assert.equal(out.totalPersonal, 2);
  assert.equal(out.correosEnvio.length, 1);
  assert.equal(out.personalSinCorreo, 1);
});

test('resolverDestinatarios sin destinatarios configurados devuelve lista vacía', async () => {
  const sbFetch = crearSbFetch({});
  const out = await resolverDestinatarios({ personal_ids: [], correos_externos: [] }, { sbFetch });
  assert.deepEqual(out.correosEnvio, []);
  assert.equal(out.totalPersonal, 0);
  assert.equal(out.totalExternos, 0);
});

// ── ejecutarReporteManual — validaciones ─────────────────────────────────────

test('ejecutarReporteManual exige reporteId', async () => {
  const out = await ejecutarReporteManual(undefined, depsBase({ reporte: reporteBase() }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'reporte_id_requerido');
});

test('ejecutarReporteManual exige sbFetch en deps', async () => {
  const out = await ejecutarReporteManual('R1', {});
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'deps_incompletas');
});

test('ejecutarReporteManual: reporte no encontrado', async () => {
  const out = await ejecutarReporteManual('inexistente', depsBase({ reporte: null }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrado');
});

test('ejecutarReporteManual: reporte borrador no se puede enviar', async () => {
  const reporte = reporteBase({ borrador: true });
  const out = await ejecutarReporteManual('R1', depsBase({ reporte }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'borrador');
});

test('ejecutarReporteManual: reporte inactivo no se puede enviar', async () => {
  const reporte = reporteBase({ activo: false });
  const out = await ejecutarReporteManual('R1', depsBase({ reporte }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'inactivo');
});

test('ejecutarReporteManual: sin destinatarios con correo válido', async () => {
  const reporte = reporteBase({ destinatarios: { personal_ids: [], correos_externos: [] } });
  const out = await ejecutarReporteManual('R1', depsBase({ reporte, personal: [] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'sin_destinatarios');
});

// ── ejecutarReporteManual — generación + envío exitosos ─────────────────────

test('ejecutarReporteManual genera Excel y envía cuando formato=excel', async () => {
  const reporte = reporteBase({ formato: 'excel' });
  const personal = [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }, { id: 'P2', correo_compartido: 'luis@inlop.com.co' }];
  const deps = depsBase({ reporte, personal });

  const out = await ejecutarReporteManual('R1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.reporteId, 'R1');
  assert.equal(out.formato, 'excel');
  assert.match(out.filename, /\.xlsx$/);
  assert.equal(out.destinatarios.totalPersonal, 2);
  assert.equal(out.destinatarios.totalExternos, 1);
  assert.equal(out.destinatarios.totalEnviados, 3); // 2 personal + 1 externo, sin solapamiento

  // El envío llamó a sendWithAttachment exactamente una vez, con adjunto real
  assert.equal(deps.sendWithAttachment.llamadas.length, 1);
  const llamada = deps.sendWithAttachment.llamadas[0];
  assert.equal(llamada.subject, 'Reporte GPS de hoy');
  assert.equal(llamada.attachments.length, 1);
  assert.match(llamada.attachments[0].filename, /\.xlsx$/);
  assert.ok(llamada.attachments[0].content.length > 0); // base64 no vacío
  assert.deepEqual(llamada.to.sort(), ['ana@inlop.com.co', 'ext@dominio.com', 'luis@inlop.com.co']);
});

test('ejecutarReporteManual genera HTML y envía cuando formato=html_columnas', async () => {
  const reporte = reporteBase({ formato: 'html_columnas' });
  const personal = [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }, { id: 'P2', correo_compartido: 'luis@inlop.com.co' }];
  const deps = depsBase({ reporte, personal });

  const out = await ejecutarReporteManual('R1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.formato, 'html_columnas');
  assert.match(out.filename, /\.html$/);
  const llamada = deps.sendWithAttachment.llamadas[0];
  assert.match(llamada.attachments[0].filename, /\.html$/);
});

test('ejecutarReporteManual usa reporte.nombre como asunto si no hay asunto configurado', async () => {
  const reporte = reporteBase({ asunto: null });
  const personal = [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }, { id: 'P2', correo_compartido: 'luis@inlop.com.co' }];
  const deps = depsBase({ reporte, personal });
  await ejecutarReporteManual('R1', deps);
  assert.equal(deps.sendWithAttachment.llamadas[0].subject, 'Centro GPS diario');
});

// ── ejecutarReporteManual — fallo de envío ──────────────────────────────────

test('ejecutarReporteManual: fallo de Resend se reporta como error_envio, no lanza', async () => {
  const reporte = reporteBase();
  const personal = [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }, { id: 'P2', correo_compartido: 'luis@inlop.com.co' }];
  const deps = depsBase({ reporte, personal, envioResultado: { ok: false, error: 'Resend rechazó el envío' } });

  const out = await ejecutarReporteManual('R1', deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'error_envio');
  assert.equal(out.error, 'Resend rechazó el envío');
});

// ── No modifica el reporte ───────────────────────────────────────────────────

test('ejecutarReporteManual nunca escribe (PATCH/POST) sobre reportes_automaticos — no toca proxima_ejecucion ni recurrencia', async () => {
  const reporte = reporteBase();
  const personal = [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }, { id: 'P2', correo_compartido: 'luis@inlop.com.co' }];
  const deps = depsBase({ reporte, personal });

  await ejecutarReporteManual('R1', deps);

  // El sbFetch de prueba solo soporta GET (retorna arrays); si el código
  // intentara un PATCH/POST sobre reportes_automaticos, esas llamadas
  // quedarían igual registradas en `llamadas` — confirmamos que ninguna
  // llamada tocó reportes_automaticos salvo el GET inicial de lectura.
  const llamadasAReportes = deps.sbFetch.llamadas.filter(qs => qs.startsWith('/reportes_automaticos'));
  assert.equal(llamadasAReportes.length, 1);
  assert.ok(llamadasAReportes[0].startsWith('/reportes_automaticos?id=eq.'));
});

// ── Seguimiento GPS (Fase 10D) ────────────────────────────────────────────────
//
// Usa el almacén multi-tabla de services/gps/testStore.js (en vez del mock
// simple de arriba) porque crearEnlace() (Fase 10B) hace un POST real a
// reportes_gps_enlaces — el mock simple de este archivo solo sabe responder
// GET. Esto también ejercita la integración real: services/reportes/
// enlaceGps.js → services/gps/enlaces.js#crearEnlace(), sin mocks de por
// medio salvo sbFetch/sendWithAttachment (mismo criterio de todo el
// proyecto: probar el código real contra un almacén falso, no funciones
// reimplementadas para el test).

function reporteGpsBase(overrides = {}) {
  return {
    id: 'RG1',
    nombre: 'Viajes con seguimiento GPS',
    tipo_reporte: 'centro_gps',
    modulo_id: 'gestion_logistica',
    asunto: 'Reporte con GPS',
    cuerpo: 'Cuerpo del reporte.',
    formato: 'excel',
    activo: true,
    borrador: false,
    filtros: [],
    columnas: [],
    seguimiento_gps: true,
    destinatarios: { personal_ids: [], correos_externos: ['cliente@externo.com'] },
    ...overrides,
  };
}

function depsGpsBase({
  reporte, viajesCache, personal = [], envioResultado,
  seguimientoGpsUrl = 'https://seguimiento.inlop.com.co',
} = {}) {
  const sbFetch = crearAlmacen({ reportes_automaticos: [reporte], personal });
  const llamadasEnvio = [];
  const sendWithAttachment = async (params) => {
    llamadasEnvio.push(params);
    return envioResultado ?? { ok: true, id: 'msg_gps_1' };
  };
  sendWithAttachment.llamadas = llamadasEnvio;

  return {
    sbFetch,
    viajesCache: viajesCache ?? [
      { trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
      { trip_number: 'T2', license_plate: 'XYZ789', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Medellín' },
    ],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
    sendWithAttachment,
    seguimientoGpsUrl,
  };
}

// 1/4 — Gestión Logística + GPS habilitado + placas presentes

test('GPS: Gestión Logística + seguimiento_gps=true → crea el enlace y el correo incluye el CTA', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, true);
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces?.[0];
  assert.ok(filaEnlace);
  assert.equal(filaEnlace.reporte_id, 'RG1');
  assert.match(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
});

// 2 — Gestión Logística + GPS deshabilitado

test('GPS: Gestión Logística + seguimiento_gps=false → sin CTA, sin enlace creado', async () => {
  const reporte = reporteGpsBase({ seguimiento_gps: false });
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces?.length ?? 0, 0);
  assert.doesNotMatch(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
});

// 3 — Otro módulo + intento de GPS

test('GPS: reporte de otro módulo con seguimiento_gps=true → se ignora, sin enlace ni CTA', async () => {
  const reporte = reporteGpsBase({ modulo_id: 'otro_modulo', seguimiento_gps: true });
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces?.length ?? 0, 0);
});

// 4/9 — Ejecución con placas: se congelan exactamente las presentes

test('GPS: el enlace se crea con las placas realmente presentes en esta ejecución', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);

  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.deepEqual(filaEnlace.placas.sort(), ['ABC123', 'XYZ789']);
});

test('GPS: las placas quedan congeladas — un viaje nuevo tras crear el enlace no lo modifica retroactivamente', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  const placasOriginales = [...filaEnlace.placas].sort();

  deps.viajesCache.push({
    trip_number: 'T3', license_plate: 'NUEVO01', state_travel: 'en transíto',
    origin_city_name: 'A', destiny_city_name: 'B',
  });

  assert.deepEqual([...filaEnlace.placas].sort(), placasOriginales);
});

// 5 — Ejecución sin placas

test('GPS: sin placas válidas en esta ejecución → no se crea enlace, el envío continúa normal', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte, viajesCache: [] }); // ningún viaje activo ahora mismo

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces?.length ?? 0, 0);
  assert.doesNotMatch(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
});

// 6 — Destinatarios externos autorizados

test('GPS: destinatarios_autorizados del enlace = correos_externos de esta ejecución', async () => {
  const reporte = reporteGpsBase({ destinatarios: { personal_ids: [], correos_externos: ['a@x.com', 'b@x.com'] } });
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);

  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.deepEqual(filaEnlace.destinatarios_autorizados.sort(), ['a@x.com', 'b@x.com']);
});

// 7 — No inclusión de destinatarios no autorizados (personal interno)

test('GPS: un destinatario interno (personal_ids) recibe el correo pero nunca queda autorizado para el enlace', async () => {
  const reporte = reporteGpsBase({ destinatarios: { personal_ids: ['P1'], correos_externos: ['ext@x.com'] } });
  const deps = depsGpsBase({
    reporte,
    personal: [{ id: 'P1', nombre: 'Ana', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.ok(deps.sendWithAttachment.llamadas[0].to.includes('interno@inlop.com.co'));
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.deepEqual(filaEnlace.destinatarios_autorizados, ['ext@x.com']);
});

// 8 — Enlace diferente por ejecución

test('GPS: cada ejecución genera un enlace y un CTA con URL distintos', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);
  await ejecutarReporteManual('RG1', deps);

  const filas = deps.sbFetch.tablas.reportes_gps_enlaces;
  assert.equal(filas.length, 2);
  assert.notEqual(filas[0].id, filas[1].id);
  assert.notEqual(filas[0].token_hash, filas[1].token_hash);

  const urls = deps.sendWithAttachment.llamadas.map(l => l.html.match(/href="([^"]+)"/)[1]);
  assert.notEqual(urls[0], urls[1]);
});

// 12 — Fallo de creación del enlace sin romper el reporte

test('GPS: si crearEnlace falla (error de persistencia), el envío del reporte continúa sin CTA', async () => {
  const reporte = reporteGpsBase();
  const base = depsGpsBase({ reporte });
  const sbFetchReal = base.sbFetch;
  const sbFetchConFallo = async (qs, method, body) => {
    if (qs === '/reportes_gps_enlaces' && method === 'POST') return null; // simula fallo de Supabase
    return sbFetchReal(qs, method, body);
  };
  const deps = { ...base, sbFetch: sbFetchConFallo };

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.doesNotMatch(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
});

test('GPS: si crearEnlace lanza una excepción inesperada, el envío del reporte continúa sin CTA', async () => {
  const reporte = reporteGpsBase();
  const base = depsGpsBase({ reporte });
  const sbFetchReal = base.sbFetch;
  const sbFetchQueLanza = async (qs, method, body) => {
    if (qs === '/reportes_gps_enlaces' && method === 'POST') throw new Error('fallo de red simulado');
    return sbFetchReal(qs, method, body);
  };
  const deps = { ...base, sbFetch: sbFetchQueLanza };

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
});

test('GPS: sin seguimientoGpsUrl configurada, el CTA se omite y no se crea ningún enlace', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte, seguimientoGpsUrl: '' }); // igual que process.env.SEGUIMIENTO_GPS_URL || ""

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces?.length ?? 0, 0);
});

// 13 — El correo contiene el CTA correcto, sin exponer el token como texto

test('GPS: el CTA apunta a {seguimientoGpsUrl}/t/{token} y el texto visible nunca es la URL/token', async () => {
  const reporte = reporteGpsBase();
  const deps = depsGpsBase({ reporte, seguimientoGpsUrl: 'https://gps.inlop.com.co/' }); // con barra final

  await ejecutarReporteManual('RG1', deps);

  const html = deps.sendWithAttachment.llamadas[0].html;
  assert.match(html, /href="https:\/\/gps\.inlop\.com\.co\/t\/[^"]+"/);
  assert.match(html, />\s*📍 Ver seguimiento GPS\s*<\/a>/);
  // Fuera del atributo href, el token/URL nunca aparece como texto visible.
  const sinHrefs = html.replace(/href="[^"]*"/g, '');
  assert.doesNotMatch(sinHrefs, /\/t\/[A-Za-z0-9_-]{20,}/);
});

// 14 — Excel/HTML siguen funcionando igual con GPS habilitado

test('GPS: Excel se genera igual (mismo filename/adjunto) con seguimiento_gps activo', async () => {
  const reporte = reporteGpsBase({ formato: 'excel' });
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.match(out.filename, /\.xlsx$/);
  const adjunto = deps.sendWithAttachment.llamadas[0].attachments[0];
  assert.match(adjunto.filename, /\.xlsx$/);
  assert.ok(adjunto.content.length > 0);
});

test('GPS: HTML se genera igual (mismo filename/adjunto) con seguimiento_gps activo', async () => {
  const reporte = reporteGpsBase({ formato: 'html_filas' });
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.match(out.filename, /\.html$/);
  const adjunto = deps.sendWithAttachment.llamadas[0].attachments[0];
  assert.match(adjunto.filename, /\.html$/);
});

// 15 — Reportes existentes (sin el campo, ni siquiera `false`) no cambian

test('GPS: reporte sin el campo seguimiento_gps (undefined) se comporta exactamente igual que antes de 10D', async () => {
  const reporte = reporteGpsBase();
  delete reporte.seguimiento_gps;
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, false);
  assert.doesNotMatch(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces?.length ?? 0, 0);
});

// ── Fase 11B — acceso GPS interno/externo ────────────────────────────────────
// Corrige el bug reportado: un reporte con SOLO destinatarios internos ya no
// se queda sin enlace por "sin_destinatarios_externos" — internos y
// externos comparten el mismo enlace/aplicación (seguimiento-gps/), solo
// cambia el método de autenticación dentro de esa app (ver
// services/gps/accesoInterno.js).

test('GPS (11B): solo destinatarios internos → SÍ crea el enlace y el correo incluye el CTA', async () => {
  const reporte = reporteGpsBase({ destinatarios: { personal_ids: ['P1'], correos_externos: [] } });
  const deps = depsGpsBase({
    reporte,
    personal: [{ id: 'P1', nombre: 'Ana', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, true);
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.ok(filaEnlace);
  assert.deepEqual(filaEnlace.destinatarios_autorizados, []); // sin externos
  assert.deepEqual(filaEnlace.destinatarios_internos_autorizados, ['interno@inlop.com.co']);
  assert.match(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
});

test('GPS (11B): solo destinatarios externos → sin cambios respecto al comportamiento previo (regresión)', async () => {
  const reporte = reporteGpsBase({ destinatarios: { personal_ids: [], correos_externos: ['ext@x.com'] } });
  const deps = depsGpsBase({ reporte });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  assert.equal(out.seguimientoGps, true);
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.deepEqual(filaEnlace.destinatarios_autorizados, ['ext@x.com']);
  assert.deepEqual(filaEnlace.destinatarios_internos_autorizados, []);
});

test('GPS (11B): internos + externos → un único enlace/CTA compartido para ambos grupos', async () => {
  const reporte = reporteGpsBase({ destinatarios: { personal_ids: ['P1'], correos_externos: ['ext@x.com'] } });
  const deps = depsGpsBase({
    reporte,
    personal: [{ id: 'P1', nombre: 'Ana', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const out = await ejecutarReporteManual('RG1', deps);

  assert.equal(out.ok, true);
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces[0];
  assert.deepEqual(filaEnlace.destinatarios_autorizados, ['ext@x.com']);
  assert.deepEqual(filaEnlace.destinatarios_internos_autorizados, ['interno@inlop.com.co']);
  // Mismo enlace para todos — un único correo compartido (mismo html/url para ambos)
  assert.equal(deps.sendWithAttachment.llamadas.length, 1);
  assert.deepEqual(deps.sendWithAttachment.llamadas[0].to.sort(), ['ext@x.com', 'interno@inlop.com.co']);
});

test('resolverDestinatarios (11B): expone correosInternos por separado, sin afectar correosEnvio', async () => {
  const sbFetch = crearSbFetch({
    personal: [{ id: 'P1', correo_compartido: 'ana@inlop.com.co' }],
  });
  const out = await resolverDestinatarios(
    { personal_ids: ['P1'], correos_externos: ['ext@x.com'] },
    { sbFetch }
  );
  assert.deepEqual(out.correosInternos, ['ana@inlop.com.co']);
  assert.deepEqual(out.correosEnvio.sort(), ['ana@inlop.com.co', 'ext@x.com']);
});

// ── Fase 11C — CTA presente en el cuerpo en los 3 formatos + Content-Type
// del adjunto (evita que el cliente de correo previsualice el HTML adjunto
// en vez de mostrar el cuerpo real con el CTA) ──────────────────────────────

for (const formato of ['excel', 'html_filas', 'html_columnas']) {
  test(`GPS (11C): formato=${formato} → el CTA SIEMPRE llega en el html del cuerpo`, async () => {
    const reporte = reporteGpsBase({ formato });
    const deps = depsGpsBase({ reporte });

    const out = await ejecutarReporteManual('RG1', deps);

    assert.equal(out.ok, true);
    assert.equal(out.seguimientoGps, true);
    assert.match(deps.sendWithAttachment.llamadas[0].html, /Ver seguimiento GPS/);
  });
}

test('11C: el adjunto Excel declara su mimeType real como contentType', async () => {
  const reporte = reporteGpsBase({ formato: 'excel' });
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);

  const adjunto = deps.sendWithAttachment.llamadas[0].attachments[0];
  assert.equal(adjunto.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

for (const formato of ['html_filas', 'html_columnas']) {
  test(`11C: el adjunto ${formato} declara contentType=application/octet-stream (nunca text/html) — evita la vista previa inline de Gmail`, async () => {
    const reporte = reporteGpsBase({ formato });
    const deps = depsGpsBase({ reporte });

    await ejecutarReporteManual('RG1', deps);

    const adjunto = deps.sendWithAttachment.llamadas[0].attachments[0];
    assert.equal(adjunto.contentType, 'application/octet-stream');
    assert.notEqual(adjunto.contentType, 'text/html');
    // El contenido y el nombre del archivo NO cambian — solo el Content-Type declarado.
    assert.match(adjunto.filename, /\.html$/);
    assert.ok(adjunto.content.length > 0);
  });
}

test('11C: ningún adjunto lleva contentId — evita que Resend lo marque como inline (ver JSDoc de contentTypeAdjunto)', async () => {
  const reporte = reporteGpsBase({ formato: 'html_columnas' });
  const deps = depsGpsBase({ reporte });

  await ejecutarReporteManual('RG1', deps);

  const adjunto = deps.sendWithAttachment.llamadas[0].attachments[0];
  assert.equal(adjunto.contentId, undefined);
});
