/**
 * Unit tests for envioManual.js
 * Run: node --test services/reportes/envioManual.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverDestinatarios, ejecutarReporteManual } from './envioManual.js';

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
