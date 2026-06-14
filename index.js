import express from "express";
import fetch from "node-fetch";
import cors from "cors";


// ─── SUPABASE ───────────────────────────────────────────
const SB_URL = "https://gtyydandwcgoaratmnqh.supabase.co/rest/v1";
const SB_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI";
const SB_AUTH_URL = 'https://gtyydandwcgoaratmnqh.supabase.co/auth/v1';

const SB_HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=merge-duplicates,return=representation"
};

async function sbFetch(path, method="GET", body=null) {
  const opts = { method, headers: SB_HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SB_URL}${path}`, opts);
  if (!r.ok) {
    const txt = await r.text();
    console.error(`Supabase ${method} ${path} → ${r.status}: ${txt}`);
    return null;
  }
  if (method === "DELETE") return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function parseSchedulate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss = '00'] = m;
  return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss.padStart(2,'0')}`);
}

const app = express();
app.use(cors());
app.use(express.json());

const LOGIN_URL = "https://integrations.controlt.io/Auth/login";
const BASE_URL  = "https://app.controlt.com.co/apipublic/api";
const TOKEN_TTL = 60 * 60 * 1000; // 1 hora
const CACHE_TTL = 60 * 1000;

let currentToken = null;
let lastLogin    = null;

const cache = {
  viajes:    { data: [], ts: 0 },
  alarmas:   { data: [], ts: 0 },
  pendientes:{ data: [], ts: 0 },
};

function cacheVigente(key) {
  return (Date.now() - cache[key].ts) < CACHE_TTL && cache[key].data.length > 0;
}

async function refreshToken() {
  console.log("🔄 Renovando token ControlT...");
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.CONTROLT_USER, password: process.env.CONTROLT_PASS })
  });
  const data = await res.json();
  if (!data.token) throw new Error("Login fallido: " + JSON.stringify(data));
  currentToken = data.token;
  lastLogin    = Date.now();
  console.log("✅ Token renovado OK");
}

async function getToken() {
  const expired = !lastLogin || (Date.now() - lastLogin) > TOKEN_TTL;
  if (expired) await refreshToken();
  return currentToken;
}

setInterval(async () => {
  try { await refreshToken(); }
  catch(e) { console.error("❌ Error renovando token:", e.message); }
}, TOKEN_TTL);

// ─── API PÚBLICA CONTROLT ───────────────────────────────
const CT_PUBLIC_URL       = 'https://app.controlt.com.co/apipublic/api';
const CT_PUBLIC_USER      = process.env.CT_PUBLIC_USER || 'Inlop';
const CT_PUBLIC_PASS      = process.env.CT_PUBLIC_PASS || 'InLoPC4rg*24';
const CT_PUBLIC_TOKEN_TTL = 23 * 60 * 60 * 1000;

let ctPublicToken   = null;
let ctPublicTokenTs = null;

async function getCtPublicToken() {
  const expired = !ctPublicTokenTs || (Date.now() - ctPublicTokenTs) > CT_PUBLIC_TOKEN_TTL;
  if (!expired && ctPublicToken) return ctPublicToken;
  console.log('🔑 Renovando token ControlT API Pública...');
  const res = await fetch(`${CT_PUBLIC_URL}/login/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(CT_PUBLIC_USER)}&password=${encodeURIComponent(CT_PUBLIC_PASS)}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('CT Public login fallido: ' + JSON.stringify(data));
  ctPublicToken   = data.access_token;
  ctPublicTokenTs = Date.now();
  console.log('✅ Token API Pública OK — vigencia:', data.expires_in, 'min');
  return ctPublicToken;
}

app.get('/api/ct/travel/:id', async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const r = await fetch(`${CT_PUBLIC_URL}/Travel/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: 'ControlT error', status: r.status });
    }
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ct/binnacle', async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const { trip_number, id_monitoring_order, date_start, date_end, take = 100, page = 1 } = req.body;
    const body = { take, page };
    if (trip_number)         body.trip_number         = trip_number;
    if (id_monitoring_order) body.id_monitoring_order = id_monitoring_order;
    if (date_start)          body.date_start          = date_start;
    if (date_end)            body.date_end            = date_end;
    const r = await fetch(`${CT_PUBLIC_URL}/ControlTower/binnacle`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return res.status(r.status).json({ error: 'ControlT error', status: r.status });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── FETCH SEGURO ───────────────────────────────────────
async function safeFetch(path, fallback = []) {
  const doRequest = async () => {
    const token = currentToken;
    return fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
  };

  let response = await doRequest();

  if (response.status === 401) {
    console.warn(`⚠️ safeFetch 401 en ${path} — token expirado, renovando...`);
    try {
      await refreshToken();
      response = await doRequest();
    } catch(e) {
      console.error(`❌ safeFetch: refreshToken falló tras 401 en ${path}:`, e.message);
      return fallback;
    }
  }

  if (!response.ok) {
    const txt = await response.text();
    console.error(`❌ safeFetch ${path} → ${response.status}: ${txt.slice(0, 200)}`);
    return fallback;
  }

  const text = await response.text();
  console.log("================================");
  console.log("URL:", `${BASE_URL}${path}`);
  console.log("STATUS:", response.status);
  console.log("CONTENT-TYPE:", response.headers.get("content-type"));
  console.log("BODY:", text.substring(0, 2000));
  console.log("================================");

  try {
    const data = JSON.parse(text);
    if (data && data.Message && data.Message.toLowerCase().includes("denied")) {
      console.warn(`⚠️ ${path} bloqueado por permisos`);
      return fallback;
    }
    return data;
  } catch (e) {
    console.warn(`⚠️ ${path} respuesta no-JSON`);
    return fallback;
  }
}

// ─── PRIORIDAD / GRUPOS ─────────────────────────────────
const ESTADO_PRIORIDAD = {
  'en transíto': 1, 'en tránsito': 1, 'en transito': 1,
  'cargando': 2, 'descargando': 3, 'iniciado': 4,
  'pernoctando': 5, 'sin activar': 6, 'sin asignar': 7,
  'completado': 8, 'finalizado': 9, 'cancelado': 10,
};

const GRUPO_CONFIRMADO = new Set(['sin asignar', 'sin activar']);
const GRUPO_EN_RUTA    = new Set(['iniciado', 'cargando', 'en tránsito', 'en transito', 'pernoctando', 'descargando']);
const GRUPO_COMPLETADO = new Set(['completado', 'finalizado']);
const GRUPO_CANCELADO  = new Set(['cancelado']);
const ORPHAN_HOURS     = parseInt(process.env.ORPHAN_HOURS || '4', 10);
let   _diagSolDone     = false;

function getPrioridad(state_travel) {
  const s = (state_travel || '').toLowerCase().trim();
  for (const [key, prio] of Object.entries(ESTADO_PRIORIDAD)) {
    if (s.includes(key)) return prio;
  }
  return 5;
}

function sortViajes(data) {
  return [...data].sort((a, b) => {
    const pA = getPrioridad(a.state_travel);
    const pB = getPrioridad(b.state_travel);
    if (pA !== pB) return pA - pB;
    return new Date(b.latest_gps_report || 0) - new Date(a.latest_gps_report || 0);
  });
}

// ─── SYNC FUNCIONES ─────────────────────────────────────
async function syncViajes() {
  try {
    const data1 = await safeFetch("/Resume?size=100&page=1", null);
    if (!data1) return;
    const arr1 = Array.isArray(data1) ? data1 : data1.data || data1.result || [];
    if (!arr1.length) { console.warn("⚠️  Resume devolvió 0 viajes — manteniendo caché anterior"); return; }

    let todos = [...arr1];
    if (arr1.length >= 100) {
      try {
        const data2 = await safeFetch("/Resume?size=100&page=2", null);
        const arr2 = Array.isArray(data2) ? data2 : (data2?.data || data2?.result || []);
        if (arr2.length > 0) {
          todos = [...todos, ...arr2];
          console.log(`📄 Página 2: ${arr2.length} viajes`);
          if (arr2.length >= 100) {
            try {
              const data3 = await safeFetch("/Resume?size=100&page=3", null);
              const arr3 = Array.isArray(data3) ? data3 : (data3?.data || data3?.result || []);
              if (arr3.length > 0) { todos = [...todos, ...arr3]; console.log(`📄 Página 3: ${arr3.length} viajes`); }
            } catch(e) { console.warn("⚠️  Página 3 no disponible"); }
          }
        }
      } catch(e) { console.warn("⚠️  Página 2 no disponible"); }
    }

    const seen = new Set();
    const dedup = todos.filter(v => {
      const k = v.trip_number || v.id_monitoring_order;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    cache.viajes.data = sortViajes(dedup);
    cache.viajes.ts   = Date.now();
    console.log(`📦 Caché: ${dedup.length} viajes totales`);
  } catch(e) { console.error("❌ Error sync viajes:", e.message); }
}

async function syncAlarmas() {
  try {
    const data = await safeFetch("/Alarm?size=500&page=1", null);
    if (!data) return;
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    if (!arr.length) { console.warn("⚠️  Alarm devolvió 0"); return; }
    cache.alarmas.data = arr;
    cache.alarmas.ts   = Date.now();
    console.log(`🔔 Alarmas actualizadas: ${arr.length}`);
  } catch(e) { console.error("❌ Error sync alarmas:", e.message); }
}

async function syncPendientes() {
  try {
    const ahora = new Date(), en7dias = new Date(ahora.getTime() + 7*24*60*60*1000);
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const path = `/Travel/search?dateStart=${encodeURIComponent(fmt(ahora))}&dateEnd=${encodeURIComponent(fmt(en7dias))}&size=200&page=1`;
    const data = await safeFetch(path, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    cache.pendientes.data = arr;
    cache.pendientes.ts   = Date.now();
    console.log(`⏳ Travel/search: ${arr.length} viajes`);
    if (!arr.length) {
      const data2 = await safeFetch(`/Travel/search?size=200&page=1`, []);
      const arr2 = Array.isArray(data2) ? data2 : data2.data || data2.result || [];
      cache.pendientes.data = arr2;
      cache.pendientes.ts   = Date.now();
      console.log(`⏳ Fallback: ${arr2.length} viajes`);
    }
  } catch(e) { console.error("❌ Error sync pendientes:", e.message); }
}

async function syncPlaneados() {
  try {
    const data = await safeFetch(`/Travel/search?size=200&page=1`, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    if (!arr.length) { console.log('📅 Planeados: 0 viajes'); return; }

    const ahora = new Date(), hoyInicio = new Date(ahora);
    hoyInicio.setHours(0,0,0,0);

    const viajesFuturos = arr.filter(v => {
      const f = parseSchedulate(v.schedulate_origin);
      return f && !isNaN(f.getTime()) && f >= hoyInicio;
    });
    console.log(`📅 Planeados: ${arr.length} → ${viajesFuturos.length} hoy o futuros`);
    if (!viajesFuturos.length) return;

    const existentes = await sbFetch('/planeados?select=trip_number,fecha_detectado,activo_en_resume');
    const existMap = {};
    (existentes || []).forEach(e => { existMap[e.trip_number] = e; });
    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    let upsertados = 0;
    for (const v of viajesFuturos) {
      const f = parseSchedulate(v.schedulate_origin);
      const yaExiste   = existMap[v.trip_number];
      const estaActivo = activeIds.has(v.trip_number);
      const viajeResume = cache.viajes.data.find(r => r.trip_number === v.trip_number);
      const cliente = viajeResume?.company_customer_name || v.company_customer_name || null;
      const row = {
        trip_number:           v.trip_number,
        license_plate:         v.license_plate         || null,
        driver_name:           v.driver_name           || null,
        company_customer_name: cliente,
        city_origin:           v.city_origin           || null,
        city_destination:      v.city_destination      || null,
        origin_address:        v.origin_address        || null,
        schedulate_origin:     v.schedulate_origin     || null,
        fecha_programada_dia:  f ? f.toISOString().slice(0,10) : null,
        activo_en_resume:      estaActivo,
        fecha_detectado:       yaExiste ? yaExiste.fecha_detectado : new Date().toISOString(),
        activado_en:           (estaActivo && yaExiste && !yaExiste.activo_en_resume) || (estaActivo && !yaExiste)
                                 ? new Date().toISOString() : null,
      };
      await sbFetch('/planeados', 'POST', row);
      upsertados++;
    }
    const hoyStr = hoyInicio.toISOString().slice(0,10);
    await sbFetch(`/planeados?fecha_programada_dia=lt.${hoyStr}`, 'DELETE');
    console.log(`📅 Planeados: ${upsertados} upsertados, limpieza < ${hoyStr}`);
  } catch(e) { console.error("❌ Error sync planeados:", e.message); }
}

function extraerTelefono(driver_phone, full_driver) {
  const p1 = (driver_phone || '').replace(/\D/g, '');
  if (p1.length === 10 && p1.startsWith('3')) return p1;
  const p2 = (full_driver || '').split(',')[1]?.trim().replace(/\D/g, '') || '';
  if (p2.length === 10 && p2.startsWith('3')) return p2;
  return '';
}

async function syncCumplidos() {
  try {
    if (!cache.viajes.data.length) return;
    const existentesRaw = await sbFetch('/cumplidos?select=id,estado_cumplido,tiene_soporte,cliente&limit=1000');
    const existentes = new Map((existentesRaw || []).map(c => [c.id, c]));
    const ESTADOS_ACTIVOS = new Set(['LIVE', 'SOLICITADO', 'CUMPLIDO RECIBIDO']);
    const apiSet = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));
    let insertados = 0, actualizados = 0;
    for (const v of cache.viajes.data) {
      if (!v.trip_number) continue;
      const existe = existentes.get(v.trip_number);
      const cliente = (v.company_customer_name || '').split(',')[0].trim();
      if (!existe) {
        await sbFetch('/cumplidos', 'POST', {
          id: v.trip_number, manifiesto: v.number_order || '',
          placa: v.license_plate || '', conductor: v.driver_name || '',
          conductor_tel: extraerTelefono(v.driver_phone, v.full_driver),
          cliente, estado_controlt: v.state_travel || '', estado_cumplido: 'LIVE',
          pct: parseFloat(v.percentage_travel) || 0,
          fecha_viaje: v.activated_on || v.created_on || '',
          origen: v.origin_city_name || '', destino: v.destiny_city_name || '',
          tiene_soporte: false,
        });
        insertados++;
      } else {
        const patch = { estado_controlt: v.state_travel || '', pct: parseFloat(v.percentage_travel) || 0 };
        if (!existe.cliente && cliente) patch.cliente = cliente;
        await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(v.trip_number)}`, 'PATCH', patch);
        actualizados++;
      }
    }
    let finalizados = 0;
    for (const [id, c] of existentes) {
      if (ESTADOS_ACTIVOS.has((c.estado_cumplido||'').toUpperCase()) && !apiSet.has(id)) {
        const nuevoEstado = c.tiene_soporte ? 'PENDIENTE LIQUIDACION' : 'FINALIZADO CONTROLT';
        await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(id)}`, 'PATCH',
          { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() });
        finalizados++;
        console.log(`🏁 Cumplido ${id} → ${nuevoEstado}`);
      }
    }
    console.log(`✅ Cumplidos: +${insertados} nuevos, ~${actualizados} act, 🏁${finalizados} fin`);
  } catch(e) { console.error('❌ Error syncCumplidos:', e.message); }
}

async function syncSolicitudes() {
  try {
    if (!cache.viajes.data.length) { console.log('📋 syncSolicitudes: cache vacío'); return; }

    if (!_diagSolDone) {
      const kv = cache.viajes.data.length    ? Object.keys(cache.viajes.data[0])    : [];
      const kp = cache.pendientes.data.length ? Object.keys(cache.pendientes.data[0]) : [];
      console.log('🔍 [SOL-DIAG] Campos viajes:', kv.join(', '));
      console.log('🔍 [SOL-DIAG] ¿remission?:', kv.includes('remission'));
      const mv = cache.viajes.data.filter(v=>(v.remission||'').startsWith('SOL-')).slice(0,3).map(v=>`${v.trip_number}→${v.remission}`);
      console.log('🔍 [SOL-DIAG] Muestra SOL:', mv.join(' | ') || 'ninguna');
      _diagSolDone = true;
    }

    const resumeByRemission  = new Map();
    const resumeByTripNumber = new Map();
    const pendByRemission    = new Map();
    for (const v of cache.viajes.data) {
      const rem = (v.remission||'').trim();
      if (rem.startsWith('SOL-')) resumeByRemission.set(rem, v);
      if (v.trip_number) resumeByTripNumber.set(String(v.trip_number), v);
    }
    for (const v of cache.pendientes.data) {
      const rem = (v.remission||'').trim();
      if (rem.startsWith('SOL-')) pendByRemission.set(rem, v);
    }

    const solicitudes = await sbFetch(
      '/solicitudes?estado=in.(pendiente,confirmado,en_ruta)' +
      '&select=id,codigo_solicitud,estado,controlt_trip_number,' +
              'creado_por,empresa_cliente_id,fecha_requerida,observacion_coordinadora,manifiesto'
    );
    if (!solicitudes?.length) { console.log('📋 syncSolicitudes: sin activas'); return; }
    console.log(`📋 syncSolicitudes: ${solicitudes.length} solicitudes`);

    const ahora = new Date().toISOString();
    const orphanCutoff = new Date(Date.now() - ORPHAN_HOURS*3600*1000).toISOString();
    const updates = [], insertsNotif = [], pendVerif = [];

    for (const sol of solicitudes) {
      const { id, codigo_solicitud, estado, controlt_trip_number, creado_por, fecha_requerida } = sol;

      if (estado === 'pendiente') {
        if (fecha_requerida < orphanCutoff && !resumeByRemission.has(codigo_solicitud) && !pendByRemission.has(codigo_solicitud)) {
          console.warn(`⚠️ [HUÉRFANA] ${codigo_solicitud}`);
          continue;
        }
        const vR = resumeByRemission.get(codigo_solicitud);
        if (vR) {
          const g = _grupo(vR.state_travel), ne = g || 'confirmado';
          updates.push({ id, fields: _fields(vR, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vR, 'pendiente'));
          continue;
        }
        const vP = pendByRemission.get(codigo_solicitud);
        if (vP) {
          const g = _grupo(vP.state_travel);
          const ne = (g==='en_ruta'||g==='completado'||g==='cancelado') ? g : 'confirmado';
          updates.push({ id, fields: _fields(vP, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vP, 'pendiente'));
        }
      } else if (estado === 'confirmado') {
        const vR = controlt_trip_number ? resumeByTripNumber.get(controlt_trip_number) : resumeByRemission.get(codigo_solicitud);
        if (vR) {
          const g = _grupo(vR.state_travel);
          if (g==='en_ruta'||g==='completado'||g==='cancelado') {
            updates.push({ id, fields: _fields(vR, g, ahora, false) });
            insertsNotif.push(..._notifs(sol, g, vR, 'confirmado'));
          } else {
            updates.push({ id, fields: { estado_controlt: (vR.state_travel||'').toLowerCase().trim(), ultima_actualizacion_controlt: ahora } });
          }
        } else if (controlt_trip_number) {
          pendVerif.push({ trip_number: controlt_trip_number, solicitud_id: id, estado_actual: estado, sol });
        }
      } else if (estado === 'en_ruta') {
        const vR = controlt_trip_number ? resumeByTripNumber.get(controlt_trip_number) : null;
        if (vR) {
          const g = _grupo(vR.state_travel);
          if (g==='completado'||g==='cancelado') {
            updates.push({ id, fields: _fields(vR, g, ahora, false) });
            insertsNotif.push(..._notifs(sol, g, vR, 'en_ruta'));
          } else {
            updates.push({ id, fields: { estado_controlt: (vR.state_travel||'').toLowerCase().trim(), ultima_actualizacion_controlt: ahora } });
          }
        } else if (controlt_trip_number) {
          pendVerif.push({ trip_number: controlt_trip_number, solicitud_id: id, estado_actual: estado, sol });
        }
      }
    }

    if (pendVerif.length) {
      const tripIds = [...new Set(pendVerif.map(t => t.trip_number))];
      const cs = await sbFetch(`/cumplidos?id=in.(${tripIds.map(encodeURIComponent).join(',')})&select=id,estado_cumplido`) || [];
      const cumplMap = new Map(cs.map(c => [c.id, c]));
      for (const { trip_number, solicitud_id, estado_actual, sol } of pendVerif) {
        const cumpl = cumplMap.get(trip_number);
        if (cumpl) {
          updates.push({ id: solicitud_id, fields: { estado: 'completado', estado_controlt: cumpl.estado_cumplido, ultima_actualizacion_controlt: ahora } });
          insertsNotif.push(..._notifs(sol, 'completado', null, estado_actual));
        } else {
          updates.push({ id: solicitud_id, fields: { ultima_actualizacion_controlt: ahora } });
        }
      }
    }

    let updOk = 0;
    for (const { id, fields } of updates) {
      const r = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(id)}`, 'PATCH', fields);
      if (r !== null) updOk++;
    }
    for (let i = 0; i < insertsNotif.length; i += 50)
      await sbFetch('/notificaciones_cliente', 'POST', insertsNotif.slice(i, i+50));

    console.log(`📋 syncSolicitudes OK: ${updOk}/${updates.length} upd | ${insertsNotif.length} notifs`);
  } catch(e) { console.error('❌ Error syncSolicitudes:', e.message); }
}

function _grupo(stateTravel) {
  const s = (stateTravel||'').toLowerCase().trim();
  if (GRUPO_CONFIRMADO.has(s)) return 'confirmado';
  if (GRUPO_EN_RUTA.has(s))    return 'en_ruta';
  if (GRUPO_COMPLETADO.has(s)) return 'completado';
  if (GRUPO_CANCELADO.has(s))  return 'cancelado';
  return null;
}

function _fields(viaje, nuevoEstado, ahora, esPrimerEnlace) {
  const f = { estado: nuevoEstado, estado_controlt: (viaje?.state_travel||'').toLowerCase().trim()||null, ultima_actualizacion_controlt: ahora };
  if (viaje?.trip_number)  f.controlt_trip_number = String(viaje.trip_number);
  if (viaje?.number_order) f.manifiesto            = String(viaje.number_order);
  if (esPrimerEnlace)      f.fecha_confirmacion    = ahora;
  if (nuevoEstado === 'cancelado') f.fecha_cancelacion = ahora;
  return f;
}

function _notifs(sol, nuevoEstado, viaje, estadoAnterior) {
  const cod = sol.codigo_solicitud, placa = viaje?.license_plate||'', cond = viaje?.driver_name||'';
  const obs = sol.observacion_coordinadora ? `\n${sol.observacion_coordinadora}` : '';
  const n = (tipo, titulo, mensaje) => ({ usuario_id: sol.creado_por, solicitud_id: sol.id, tipo, titulo, mensaje });
  if (nuevoEstado==='confirmado' && estadoAnterior==='pendiente')
    return [n('confirmacion','Servicio confirmado',`Tu servicio ${cod} ha sido confirmado. Vehículo: ${placa}. Conductor: ${cond}.${obs}`)];
  if (nuevoEstado==='en_ruta' && estadoAnterior==='pendiente')
    return [n('confirmacion','Servicio en camino',`Tu servicio ${cod} fue confirmado y ya está en operación. Vehículo: ${placa}. Conductor: ${cond}.${obs}`)];
  if (nuevoEstado==='en_ruta' && estadoAnterior==='confirmado')
    return [n('info','Tu servicio está en camino',`El servicio ${cod} inició operación.`)];
  if (nuevoEstado==='completado')
    return [n('info','Servicio completado',`El servicio ${cod} fue completado exitosamente.`)];
  if (nuevoEstado==='cancelado')
    return [n('cancelacion','Servicio cancelado',`El servicio ${cod} fue cancelado. Si tienes dudas, comunícate con INLOP.`)];
  return [];
}

// ─── PORTAL CLIENTE — AUTH + SERVICIOS + NOTIFICACIONES ─

async function requireClienteAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  if (!hdr.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  const token = hdr.slice(7);
  try {
    const r = await fetch(`${SB_AUTH_URL}/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_KEY }
    });
    if (!r.ok) return res.status(401).json({ error: 'Token inválido o expirado' });
    const sbUser = await r.json();
    const perfiles = await sbFetch(`/usuarios_cliente?id=eq.${sbUser.id}&limit=1`) || [];
    if (!perfiles.length) return res.status(403).json({ error: 'Perfil no configurado' });
    req.userId     = sbUser.id;
    req.userEmail  = sbUser.email;
    req.empresaId  = perfiles[0].empresa_cliente_id;
    req.userPerfil = perfiles[0];
    next();
  } catch(e) {
    console.error('❌ requireClienteAuth:', e.message);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

function mapSolicitud(sol, cumplido = null) {
  return {
    id:                sol.id,
    codigo_solicitud:  sol.codigo_solicitud,
    inlop_key:         sol.manifiesto      || '',
    external_ref:      sol.external_ref    || null,
    empresa_id:        sol.empresa_cliente_id,
    agencia_id:        sol.agencia_id      || '',
    agencia_nombre:    sol.agencia_nombre  || '',
    tipo_vehiculo:     sol.tipo_vehiculo   || '',
    tipo_operacion:    sol.tipo_operacion  || '',
    origen:            sol.origen          || '',
    destino:           sol.destino         || '',
    fecha_solicitud:   sol.creado_en       || sol.fecha_requerida,
    fecha_requerida:   sol.fecha_requerida,
    fecha_aprobacion:  sol.fecha_confirmacion || null,
    fecha_inicio_real: cumplido?.fecha_viaje        || null,
    fecha_fin_real:    cumplido?.fecha_finalizacion || null,
    fecha_cancelacion: sol.fecha_cancelacion || null,
    estado:            sol.estado === 'confirmado' ? 'aprobado' : sol.estado,
    controlt_trip_number: sol.controlt_trip_number || null,
    placa_asignada:    cumplido?.placa     || sol.placa_asignada   || null,
    conductor_nombre:  cumplido?.conductor || sol.conductor_nombre || null,
    observaciones:     sol.observacion_coordinadora || null,
  };
}

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });
  try {
    const r = await fetch(`${SB_AUTH_URL}/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok || !data.access_token)
      return res.status(401).json({ error: data.error_description || 'Credenciales inválidas' });
    const perfiles = await sbFetch(`/usuarios_cliente?id=eq.${data.user.id}&limit=1`) || [];
    if (!perfiles.length) return res.status(403).json({ error: 'Usuario no configurado en el portal' });
    const p = perfiles[0];
    res.json({
      token: data.access_token,
      usuario: { id: data.user.id, empresa_id: p.empresa_cliente_id, agencia_id: p.agencia_id||null, nombre: p.nombre, email: data.user.email, cargo: p.cargo||'', rol: p.rol||'encargado' }
    });
  } catch(e) { console.error('❌ /auth/login:', e.message); res.status(500).json({ error: e.message }); }
});

app.get('/auth/me', requireClienteAuth, (req, res) => {
  const p = req.userPerfil;
  res.json({ id: req.userId, empresa_id: p.empresa_cliente_id, agencia_id: p.agencia_id||null, nombre: p.nombre, email: req.userEmail, cargo: p.cargo||'', rol: p.rol||'encargado' });
});

app.post('/auth/logout', (req, res) => res.json({ ok: true }));

app.post('/auth/cambiar-password', requireClienteAuth, async (req, res) => {
  const { passwordNueva } = req.body || {};
  if (!passwordNueva) return res.status(400).json({ error: 'passwordNueva requerido' });
  try {
    const token = (req.headers.authorization||'').slice(7);
    const r = await fetch(`${SB_AUTH_URL}/user`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordNueva })
    });
    if (!r.ok) { const e = await r.json(); return res.status(400).json({ error: e.message||'Error' }); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/recuperar', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email requerido' });
  try {
    await fetch(`${SB_AUTH_URL}/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ email })
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/servicios', requireClienteAuth, async (req, res) => {
  try {
    const { estado, tipoOperacion, tipoVehiculo, agenciaIds, busqueda, desde, hasta } = req.query;
    let qs = `/solicitudes?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=creado_en.desc&limit=200`;
    if (estado)        qs += `&estado=eq.${encodeURIComponent(estado==='aprobado'?'confirmado':estado)}`;
    if (tipoOperacion) qs += `&tipo_operacion=eq.${encodeURIComponent(tipoOperacion)}`;
    if (tipoVehiculo)  qs += `&tipo_vehiculo=in.(${String(tipoVehiculo).split(',').map(encodeURIComponent).join(',')})`;
    if (agenciaIds)    qs += `&agencia_id=in.(${String(agenciaIds).split(',').map(encodeURIComponent).join(',')})`;
    if (desde)         qs += `&fecha_requerida=gte.${encodeURIComponent(desde)}`;
    if (hasta)         qs += `&fecha_requerida=lte.${encodeURIComponent(hasta+'T23:59:59Z')}`;
    let solicitudes = await sbFetch(qs) || [];
    if (busqueda) {
      const q = busqueda.toLowerCase();
      solicitudes = solicitudes.filter(s => [s.codigo_solicitud,s.origen,s.destino,s.manifiesto,s.external_ref].some(v=>v&&String(v).toLowerCase().includes(q)));
    }
    const tripIds = [...new Set(solicitudes.filter(s=>s.controlt_trip_number).map(s=>s.controlt_trip_number))];
    const cumplMap = {};
    if (tripIds.length) {
      const cs = await sbFetch(`/cumplidos?id=in.(${tripIds.map(encodeURIComponent).join(',')})&select=id,placa,conductor,fecha_viaje,fecha_finalizacion`) || [];
      cs.forEach(c => { cumplMap[c.id] = c; });
    }
    res.json(solicitudes.map(s => mapSolicitud(s, cumplMap[s.controlt_trip_number])));
  } catch(e) { console.error('❌ GET /servicios:', e.message); res.status(500).json({ error: e.message }); }
});

app.get('/servicios/:id', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    let cumplido = null;
    if (sol.controlt_trip_number) {
      const cs = await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(sol.controlt_trip_number)}&select=id,placa,conductor,fecha_viaje,fecha_finalizacion&limit=1`) || [];
      cumplido = cs[0] || null;
    }
    res.json(mapSolicitud(sol, cumplido));
  } catch(e) { console.error('❌ GET /servicios/:id:', e.message); res.status(500).json({ error: e.message }); }
});

app.get('/servicios/:id/paradas', requireClienteAuth, (req, res) => res.json([]));

app.get('/servicios/:id/vehiculo', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&select=controlt_trip_number&limit=1`) || [];
    const tripNum = sols[0]?.controlt_trip_number;
    if (!tripNum) return res.status(404).json({ error: 'Sin vehículo asignado' });
    const viaje = cache.viajes.data.find(v => String(v.trip_number) === String(tripNum));
    if (!viaje?.lat || !viaje?.lng) return res.status(404).json({ error: 'Sin posición GPS' });
    res.json({ lat: parseFloat(viaje.lat), lng: parseFloat(viaje.lng), placa: viaje.license_plate||'', ultima_actualizacion: viaje.latest_gps_report||new Date().toISOString() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/servicios', requireClienteAuth, async (req, res) => {
  try {
    const { tipo_vehiculo, tipo_operacion, origen, destino, fecha_requerida, observaciones, agencia_id, agencia_nombre, external_ref } = req.body || {};
    if (!fecha_requerida) return res.status(400).json({ error: 'fecha_requerida requerido' });
    const last = await sbFetch('/solicitudes?select=codigo_solicitud&order=creado_en.desc&limit=1') || [];
    const lastCode = last[0]?.codigo_solicitud;
    const n = lastCode?.startsWith('SOL-') ? parseInt(lastCode.slice(4), 10) : 0;
    const codigo_solicitud = 'SOL-' + String((isNaN(n)?0:n)+1).padStart(5,'0');
    const row = {
      codigo_solicitud, empresa_cliente_id: req.empresaId, creado_por: req.userId,
      tipo_vehiculo: tipo_vehiculo||null, tipo_operacion: tipo_operacion||null,
      origen: origen||null, destino: destino||null,
      agencia_id: agencia_id||null, agencia_nombre: agencia_nombre||null,
      external_ref: external_ref||null, fecha_requerida,
      observacion_coordinadora: observaciones||null,
      estado: 'pendiente', creado_en: new Date().toISOString(),
    };
    const created = await sbFetch('/solicitudes', 'POST', row);
    if (!created) return res.status(500).json({ error: 'Error creando solicitud' });
    res.status(201).json(mapSolicitud(Array.isArray(created)?created[0]:created||row));
  } catch(e) { console.error('❌ POST /servicios:', e.message); res.status(500).json({ error: e.message }); }
});

app.patch('/servicios/:id', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    if (sol.estado !== 'pendiente') return res.status(400).json({ error: `No editable en estado: ${sol.estado}` });
    const { fecha_requerida, observaciones, origen, destino, tipo_vehiculo, tipo_operacion } = req.body || {};
    const patch = {};
    if (fecha_requerida) patch.fecha_requerida          = fecha_requerida;
    if (observaciones)   patch.observacion_coordinadora = observaciones;
    if (origen)          patch.origen = origen;
    if (destino)         patch.destino = destino;
    if (tipo_vehiculo)   patch.tipo_vehiculo = tipo_vehiculo;
    if (tipo_operacion)  patch.tipo_operacion = tipo_operacion;
    await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', patch);
    res.json(mapSolicitud({ ...sol, ...patch }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/servicios/:id/cancelar', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    if (!['pendiente','confirmado'].includes(sol.estado)) return res.status(400).json({ error: `No cancelable en estado: ${sol.estado}` });
    const fecha_cancelacion = new Date().toISOString();
    await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', { estado: 'cancelado', fecha_cancelacion });
    res.json(mapSolicitud({ ...sol, estado: 'cancelado', fecha_cancelacion }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    const notifs = await sbFetch(`/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}&order=creado_en.desc&limit=100`) || [];
    const solIds = [...new Set(notifs.filter(n=>n.solicitud_id).map(n=>n.solicitud_id))];
    const solMap = {};
    if (solIds.length) {
      const sols = await sbFetch(`/solicitudes?id=in.(${solIds.map(encodeURIComponent).join(',')})&select=id,codigo_solicitud`) || [];
      sols.forEach(s => { solMap[s.id] = s.codigo_solicitud; });
    }
    res.json(notifs.map(n => ({ id: n.id, servicio_id: n.solicitud_id||null, codigo_solicitud: solMap[n.solicitud_id]||null, tipo: n.tipo==='confirmacion'?'estado':(n.tipo||'info'), titulo: n.titulo, mensaje: n.mensaje, fecha: n.creado_en, leida: n.leida||false })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/notificaciones/:id/leer', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(`/notificaciones_cliente?id=eq.${encodeURIComponent(req.params.id)}&usuario_id=eq.${encodeURIComponent(req.userId)}`, 'PATCH', { leida: true, leida_en: new Date().toISOString() });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/notificaciones/marcar-todas-leidas', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(`/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}&leida=eq.false`, 'PATCH', { leida: true, leida_en: new Date().toISOString() });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(`/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}`, 'DELETE');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/catalogos/agencias', requireClienteAuth, async (req, res) => {
  try {
    const rows = await sbFetch(`/agencias_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=nombre.asc`) || [];
    res.json(rows.map(a => ({ id: a.id, empresa_id: a.empresa_cliente_id, nombre: a.nombre, ciudad: a.ciudad||'' })));
  } catch(e) { res.json([]); }
});

app.get('/catalogos/vehiculos', (req, res) => {
  res.json(['NHR','TURBO','NPR','NQR','MINIMULA','TURBO PLATÓN']);
});

// ─── ENDPOINTS INTERNOS ─────────────────────────────────
app.get("/api/data", (req, res) => res.json(cache.viajes.data));
app.get("/api/alarmas", (req, res) => res.json(cache.alarmas.data));

app.get("/api/pendientes", async (req, res) => {
  try {
    if ((Date.now() - cache.pendientes.ts) > 5*60*1000 || !cache.pendientes.data.length) await syncPendientes();
    const arr = cache.pendientes.data;
    const ahora = new Date();
    const hace1dia = new Date(ahora.getTime() - 24*60*60*1000);
    const en7dias  = new Date(ahora.getTime() + 7*24*60*60*1000);
    const activeIds = new Set(cache.viajes.data.map(v=>v.trip_number).filter(Boolean));
    const filtrados = arr.filter(v => {
      if (activeIds.has(v.trip_number)) return false;
      const f = parseSchedulate(v.schedulate_origin);
      if (!f || isNaN(f.getTime())) return true;
      return f >= hace1dia && f <= en7dias;
    }).sort((a,b) => (parseSchedulate(a.schedulate_origin)||new Date(0)) - (parseSchedulate(b.schedulate_origin)||new Date(0)));
    res.json(filtrados);
  } catch(e) { res.json([]); }
});

app.get("/api/planeados", async (req, res) => {
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const data = await sbFetch(`/planeados?fecha_programada_dia=gte.${hoy.toISOString().slice(0,10)}&order=schedulate_origin.asc&limit=500`);
    res.json(data || []);
  } catch(e) { res.json([]); }
});

app.get("/health", (req, res) => {
  const estados = {};
  cache.viajes.data.forEach(v => { const e = v.state_travel||'desconocido'; estados[e]=(estados[e]||0)+1; });
  res.json({ status:"ok", tokenActivo:!!currentToken, ultimoLogin: lastLogin?new Date(lastLogin).toISOString():null,
    cache: { viajes: { cantidad: cache.viajes.data.length, edad_seg: Math.round((Date.now()-cache.viajes.ts)/1000), por_estado: estados },
             alarmas: { cantidad: cache.alarmas.data.length, edad_seg: Math.round((Date.now()-cache.alarmas.ts)/1000) } } });
});

// ─── INICIO ─────────────────────────────────────────────
app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 INLOP Torre de Control — Servidor iniciado");
  try {
    await refreshToken();
    await syncViajes();
    await syncAlarmas();
    await syncPendientes();
    await syncPlaneados();
    await syncCumplidos();
    await syncSolicitudes();
  } catch(e) { console.error("❌ Error inicialización:", e.message); }

  setInterval(syncViajes,        60 * 1000);
  setInterval(syncAlarmas,       70 * 1000);
  setInterval(syncPendientes,  5*60 * 1000);
  setInterval(syncPlaneados,   5*60 * 1000);
  setInterval(syncCumplidos,     60 * 1000);
  setInterval(syncSolicitudes,   65 * 1000);
});
