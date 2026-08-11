/**
 * Unit tests for scheduler.js
 * Run: node --test services/reportes/scheduler.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarTickScheduler, _resetMutexParaTests } from './scheduler.js';

// ── Mock sbFetch — interpreta los filtros reales de PostgREST usados por el
// scheduler (eq., is.null, lte., in.(...)) sobre un almacén en memoria, para
// que los tests validen la consulta real, no solo la orquestación. ─────────

function aplicaFiltro(valor, condicion) {
  if (condicion === 'is.null') return valor === null || valor === undefined;
  if (condicion.startsWith('eq.')) {
    const esperado = condicion.slice(3);
    if (esperado === 'true')  return valor === true;
    if (esperado === 'false') return valor === false;
    return String(valor) === esperado;
  }
  if (condicion.startsWith('lte.')) {
    if (valor === null || valor === undefined) return false; // NULL <= x nunca es verdadero
    return new Date(valor).getTime() <= new Date(decodeURIComponent(condicion.slice(4))).getTime();
  }
  if (condicion.startsWith('in.(')) {
    const lista = condicion.slice(4, -1).split(',');
    return lista.includes(String(valor));
  }
  return true; // select=, order=, limit= — se ignoran para el filtrado
}

function crearAlmacen(reportesIniciales = [], personalFixture = []) {
  const reportes = reportesIniciales.map(r => ({ ...r }));
  const llamadas = [];

  async function sbFetch(qs, method = 'GET', body) {
    llamadas.push({ qs, method, body });
    const [ruta, query] = qs.split('?');
    const params = new URLSearchParams(query ?? '');

    if (ruta === '/reportes_automaticos') {
      if (method === 'PATCH') {
        const id = params.get('id')?.replace(/^eq\./, '');
        const idx = reportes.findIndex(r => r.id === id);
        if (idx === -1) return null;
        reportes[idx] = { ...reportes[idx], ...body };
        return [reportes[idx]];
      }
      return reportes.filter(r =>
        [...params.entries()].every(([campo, condicion]) =>
          ['select', 'order', 'limit'].includes(campo) || aplicaFiltro(r[campo], condicion)
        )
      );
    }

    if (ruta === '/personal') {
      const idsFiltro = params.get('id');
      if (!idsFiltro) return personalFixture;
      return personalFixture.filter(p => aplicaFiltro(p.id, idsFiltro) && p.activo !== false);
    }

    return [];
  }

  sbFetch.llamadas = llamadas;
  sbFetch.reportes = reportes;
  return sbFetch;
}

function reporteBase(overrides = {}) {
  return {
    id: 'R1',
    nombre: 'Centro GPS diario',
    tipo_reporte: 'centro_gps',
    asunto: 'Reporte GPS',
    cuerpo: '',
    formato: 'excel',
    activo: true,
    borrador: false,
    filtros: [],
    columnas: [],
    destinatarios: { personal_ids: [], correos_externos: ['ops@externo.com'] },
    recurrencia: { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-01', fin: { modo: 'nunca' } },
    proxima_ejecucion: null,
    ...overrides,
  };
}

function depsBase(sbFetch, envioOk = true) {
  const llamadasEnvio = [];
  const sendWithAttachment = async (params) => {
    llamadasEnvio.push(params);
    return envioOk ? { ok: true, id: 'msg_1' } : { ok: false, error: 'Resend rechazó el envío' };
  };
  sendWithAttachment.llamadas = llamadasEnvio;
  return {
    sbFetch,
    viajesCache: [
      { trip_number: 'T1', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    ],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
    sendWithAttachment,
  };
}

test.beforeEach(() => {
  _resetMutexParaTests();
});

// ── Validaciones básicas ─────────────────────────────────────────────────────

test('sin sbFetch en deps no ejecuta nada', async () => {
  const out = await ejecutarTickScheduler({});
  assert.equal(out.ok, false);
  assert.equal(out.motivo, 'deps_incompletas');
});

// ── Reporte inactivo / borrador ──────────────────────────────────────────────

test('reporte inactivo no se ejecuta aunque esté vencido', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({ activo: false, proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([reporte]);
  const out = await ejecutarTickScheduler(depsBase(sbFetch));
  assert.equal(out.ejecutados.length, 0);
});

test('reporte borrador no se ejecuta aunque esté activo y vencido', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({ borrador: true, proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([reporte]);
  const out = await ejecutarTickScheduler(depsBase(sbFetch));
  assert.equal(out.ejecutados.length, 0);
});

// ── Ejecución vencida ─────────────────────────────────────────────────────────

test('reporte activo con proxima_ejecucion vencida se ejecuta', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({ proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([reporte]);
  const deps = depsBase(sbFetch);

  const out = await ejecutarTickScheduler(deps);

  assert.equal(out.ejecutados.length, 1);
  assert.equal(out.ejecutados[0].reporteId, 'R1');
  assert.equal(out.ejecutados[0].ok, true);
  assert.equal(deps.sendWithAttachment.llamadas.length, 1); // el motor de 9E fue el único que envió
});

test('reporte activo con proxima_ejecucion futura NO se ejecuta todavía', async () => {
  const futuro = new Date(Date.now() + 3600_000).toISOString();
  const reporte = reporteBase({ proxima_ejecucion: futuro });
  const sbFetch = crearAlmacen([reporte]);
  const out = await ejecutarTickScheduler(depsBase(sbFetch));
  assert.equal(out.ejecutados.length, 0);
});

// ── Cálculo de próxima ejecución tras ejecutar ──────────────────────────────

test('tras ejecutar, proxima_ejecucion se recalcula y persiste hacia el futuro', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({
    proxima_ejecucion: vencido,
    recurrencia: { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2020-01-01', fin: { modo: 'nunca' } },
  });
  const sbFetch = crearAlmacen([reporte]);
  await ejecutarTickScheduler(depsBase(sbFetch));

  const actualizado = sbFetch.reportes.find(r => r.id === 'R1');
  assert.ok(actualizado.proxima_ejecucion);
  assert.ok(new Date(actualizado.proxima_ejecucion).getTime() > Date.now());
});

test('proxima_ejecucion queda en null cuando la recurrencia ya no tiene slots futuros (fin alcanzado)', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({
    proxima_ejecucion: vencido,
    recurrencia: {
      tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2020-01-01',
      fin: { modo: 'fecha', fecha: '2020-01-02' }, // muy en el pasado — ya no quedan slots futuros
    },
  });
  const sbFetch = crearAlmacen([reporte]);
  await ejecutarTickScheduler(depsBase(sbFetch));

  const actualizado = sbFetch.reportes.find(r => r.id === 'R1');
  assert.equal(actualizado.proxima_ejecucion, null);
});

test('inicializa proxima_ejecucion para un reporte activo recién configurado (sin proxima_ejecucion)', async () => {
  const reporte = reporteBase({
    proxima_ejecucion: null,
    recurrencia: { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2020-01-01', fin: { modo: 'nunca' } },
  });
  const sbFetch = crearAlmacen([reporte]);
  const out = await ejecutarTickScheduler(depsBase(sbFetch));

  assert.equal(out.inicializados.length, 1);
  assert.equal(out.inicializados[0].reporteId, 'R1');
  // fecha_inicio queda muy en el pasado → la primera ejecución también
  // queda vencida y se ejecuta en el MISMO tick (inicializar corre antes
  // de consultar los vencidos).
  assert.equal(out.ejecutados.length, 1);
  assert.equal(out.ejecutados[0].reporteId, 'R1');
});

// ── Evitar doble ejecución ───────────────────────────────────────────────────

test('un tick en curso rechaza un segundo tick concurrente (mutex de proceso)', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({ proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([reporte]);
  const deps = depsBase(sbFetch);

  const [primero, segundo] = await Promise.all([
    ejecutarTickScheduler(deps),
    ejecutarTickScheduler(deps),
  ]);

  const motivos = [primero, segundo].map(r => r.ok ? 'ok' : r.motivo);
  assert.ok(motivos.includes('ok'));
  assert.ok(motivos.includes('tick_en_curso'));
  // Solo UN envío real — el segundo tick nunca llegó a procesar nada.
  assert.equal(deps.sendWithAttachment.llamadas.length, 1);
});

test('un reporte ya vencido no se re-ejecuta en el tick inmediatamente siguiente', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({
    proxima_ejecucion: vencido,
    recurrencia: { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2020-01-01', fin: { modo: 'nunca' } },
  });
  const sbFetch = crearAlmacen([reporte]);
  const deps = depsBase(sbFetch);

  const primerTick = await ejecutarTickScheduler(deps);
  assert.equal(primerTick.ejecutados.length, 1);

  const segundoTick = await ejecutarTickScheduler(deps);
  assert.equal(segundoTick.ejecutados.length, 0); // proxima_ejecucion ya quedó en el futuro
  assert.equal(deps.sendWithAttachment.llamadas.length, 1); // no hubo un segundo envío
});

test('un id duplicado en la respuesta de la consulta se procesa una sola vez (barrera defensiva)', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reporte = reporteBase({ proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([reporte]);
  // Envuelve sbFetch para que la consulta de vencidos devuelva el mismo id dos veces.
  const original = sbFetch;
  const conDuplicado = async (qs, method, body) => {
    const res = await original(qs, method, body);
    if (qs.startsWith('/reportes_automaticos') && method === 'GET' && qs.includes('lte.')) {
      return [...res, ...res];
    }
    return res;
  };
  conDuplicado.llamadas = original.llamadas;
  conDuplicado.reportes = original.reportes;

  const deps = depsBase(conDuplicado);
  const out = await ejecutarTickScheduler(deps);

  assert.equal(out.ejecutados.length, 1); // deduplicado — no 2
  assert.equal(deps.sendWithAttachment.llamadas.length, 1);
});

// ── Un error no detiene los demás reportes ──────────────────────────────────

test('un fallo de envío en un reporte no impide procesar los demás', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const r1 = reporteBase({ id: 'R1', proxima_ejecucion: vencido });
  const r2 = reporteBase({ id: 'R2', proxima_ejecucion: vencido });
  const sbFetch = crearAlmacen([r1, r2]);
  const deps = depsBase(sbFetch, /* envioOk */ false); // ambos fallan el envío

  const out = await ejecutarTickScheduler(deps);

  assert.equal(out.ejecutados.length, 2); // ambos se intentaron, ninguno bloqueó al otro
  assert.ok(out.ejecutados.every(r => r.ok === false));
  assert.ok(out.ejecutados.every(r => r.codigo === 'error_envio'));
  // Ambos igual recalculan proxima_ejecucion — un reporte roto no queda
  // reintentándose en bucle infinito en cada tick.
  const actualizados = sbFetch.reportes;
  assert.ok(actualizados.every(r => r.proxima_ejecucion && new Date(r.proxima_ejecucion).getTime() > Date.now()));
});

test('múltiples reportes vencidos se procesan todos en el mismo tick', async () => {
  const vencido = new Date(Date.now() - 3600_000).toISOString();
  const reportes = [
    reporteBase({ id: 'R1', proxima_ejecucion: vencido }),
    reporteBase({ id: 'R2', proxima_ejecucion: vencido }),
    reporteBase({ id: 'R3', proxima_ejecucion: vencido }),
  ];
  const sbFetch = crearAlmacen(reportes);
  const deps = depsBase(sbFetch);

  const out = await ejecutarTickScheduler(deps);
  assert.equal(out.ejecutados.length, 3);
  assert.deepEqual(out.ejecutados.map(r => r.reporteId).sort(), ['R1', 'R2', 'R3']);
  assert.equal(deps.sendWithAttachment.llamadas.length, 3);
});
