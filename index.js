import express from "express";
import fetch from "node-fetch";
import cors from "cors";


// ─── SUPABASE ───────────────────────────────────────────
const SB_URL = "https://gtyydandwcgoaratmnqh.supabase.co/rest/v1";
const SB_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI";

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

// Parsear schedulate_origin DD/MM/YYYY HH:MM:SS
function parseSchedulate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss = '00'] = m;
  return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss.padStart(2,'0')}`);
}

const app = express();
app.use(cors());

const LOGIN_URL = "https://integrations.controlt.io/Auth/login";
const BASE_URL  = "https://app.controlt.com.co/apipublic/api";
const TOKEN_TTL = 60 * 60 * 1000; // 1 hora — renovación proactiva cada hora
const CACHE_TTL = 60 * 1000;

let currentToken = null;
let lastLogin    = null;

// ─── CACHÉ EN MEMORIA ───────────────────────────────────
const cache = {
  viajes:    { data: [], ts: 0 },
  alarmas:   { data: [], ts: 0 },
  pendientes:{ data: [], ts: 0 },
};

function cacheVigente(key) {
  return (Date.now() - cache[key].ts) < CACHE_TTL && cache[key].data.length > 0;
}

// ─── TOKEN ──────────────────────────────────────────────
async function refreshToken() {
  console.log("🔄 Renovando token ControlT...");
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.CONTROLT_USER,
      password: process.env.CONTROLT_PASS
    })
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

// Renovación proactiva cada hora
setInterval(async () => {
  try { await refreshToken(); }
  catch(e) { console.error("❌ Error renovando token:", e.message); }
}, TOKEN_TTL);

// ─── API PÚBLICA CONTROLT (Get_Details + Binnacle) ─────
const CT_PUBLIC_URL      = 'https://app.controlt.com.co/apipublic/api';
const CT_PUBLIC_USER     = process.env.CT_PUBLIC_USER || 'Inlop';
const CT_PUBLIC_PASS     = process.env.CT_PUBLIC_PASS || 'InLoPC4rg*24';
const CT_PUBLIC_TOKEN_TTL = 23 * 60 * 60 * 1000;

let ctPublicToken    = null;
let ctPublicTokenTs  = null;

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

// GET /api/ct/travel/:id
app.get('/api/ct/travel/:id', async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const r = await fetch(`${CT_PUBLIC_URL}/Travel/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error(`❌ CT Travel/${req.params.id} → ${r.status}: ${txt.slice(0,200)}`);
      return res.status(r.status).json({ error: 'ControlT error', status: r.status });
    }
    const data = await r.json();
    res.json(data);
  } catch(e) {
    console.error('❌ /api/ct/travel error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ct/binnacle
app.use(express.json());
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
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error(`❌ CT Binnacle → ${r.status}: ${txt.slice(0,200)}`);
      return res.status(r.status).json({ error: 'ControlT error', status: r.status });
    }
    const data = await r.json();
    res.json(data);
  } catch(e) {
    console.error('❌ /api/ct/binnacle error:', e.message);
    res.status(500).json({ error: e.message });
  }
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

  // Si el servidor devuelve 401, el token expiró — renovar y reintentar una vez
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
    console.error("ERROR PARSE:", e.message);
    return fallback;
  }
}

// ─── PRIORIDAD OPERACIONAL ───────────────────────────────
const ESTADO_PRIORIDAD = {
  'en transíto': 1, 'en tránsito': 1, 'en transito': 1,
  'cargando':    2, 'descargando': 3, 'iniciado':    4,
  'pernoctando': 5, 'sin activar': 6, 'sin asignar': 7,
  'completado':  8, 'finalizado':  9, 'cancelado':  10,
};

// ─── GRUPOS DE ESTADO — PORTAL CLIENTE ──────────────────
const GRUPO_CONFIRMADO  = new Set(['sin asignar', 'sin activar']);
const GRUPO_EN_RUTA     = new Set(['iniciado', 'cargando', 'en tránsito', 'en transito', 'pernoctando', 'descargando']);
const GRUPO_COMPLETADO  = new Set(['completado', 'finalizado']);
const GRUPO_CANCELADO   = new Set(['cancelado']);
const ORPHAN_HOURS      = parseInt(process.env.ORPHAN_HOURS || '4', 10);
let   _diagSolDone      = false;

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
    const dateA = new Date(a.latest_gps_report || 0);
    const dateB = new Date(b.latest_gps_report || 0);
    return dateB - dateA;
  });
}

function parseCreated(str) {
  if (!str) return new Date(0);
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return new Date(0);
  const [, mm, dd, yyyy, hh, min] = m;
  return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:00`);
}

async function syncPendientes() {
  try {
    const ahora   = new Date();
    const en7dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const desde = fmt(ahora);
    const hasta  = fmt(en7dias);

    const path = `/Travel/search?dateStart=${encodeURIComponent(desde)}&dateEnd=${encodeURIComponent(hasta)}&size=200&page=1`;
    console.log(`⏳ Consultando: ${path}`);

    const data = await safeFetch(path, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    cache.pendientes.data = arr;
    cache.pendientes.ts   = Date.now();
    console.log(`⏳ Travel/search devolvió: ${arr.length} viajes`);
    if(arr.length > 0){
      console.log(`⏳ CAMPOS: ${Object.keys(arr[0]).join(', ')}`);
      console.log(`⏳ Muestra: ${arr.slice(0,3).map(v=>`${v.trip_number}=${v.schedulate_origin||v.license_plate}`).join(' | ')}`);
    } else {
      console.log(`⏳ Sin resultados con fechas — intentando sin filtro de fecha...`);
      const data2 = await safeFetch(`/Travel/search?size=200&page=1`, []);
      const arr2 = Array.isArray(data2) ? data2 : data2.data || data2.result || [];
      cache.pendientes.data = arr2;
      cache.pendientes.ts   = Date.now();
      console.log(`⏳ Fallback: ${arr2.length} viajes`);
      if(arr2.length > 0) console.log(`⏳ CAMPOS fallback: ${Object.keys(arr2[0]).join(', ')}`);
    }
  } catch(e) {
    console.error("❌ Error sync pendientes:", e.message);
  }
}

// ─── SYNC PLANEADOS ─────────────────────────────────────
async function syncPlaneados() {
  try {
    const path = `/Travel/search?size=200&page=1`;
    const data = await safeFetch(path, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];

    if (!arr.length) {
      console.log('📅 Planeados: Travel/search devolvió 0 viajes');
      return;
    }

    const ahora = new Date();
    const hoyInicio = new Date(ahora);
    hoyInicio.setHours(0, 0, 0, 0);

    const viajesFuturos = arr.filter(v => {
      const f = parseSchedulate(v.schedulate_origin);
      if (!f || isNaN(f.getTime())) return false;
      return f >= hoyInicio;
    });

    console.log(`📅 Planeados: ${arr.length} en Travel/search → ${viajesFuturos.length} hoy o futuros`);
    if (!viajesFuturos.length) return;

    const existentes = await sbFetch('/planeados?select=trip_number,fecha_detectado,company_customer_name,activo_en_resume');
    const existMap = {};
    (existentes || []).forEach(e => { existMap[e.trip_number] = e; });

    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    const rows = viajesFuturos.map(v => {
      const f = parseSchedulate(v.schedulate_origin);
      const yaExiste = existMap[v.trip_number];
      const estaActivo = activeIds.has(v.trip_number);
      const viajeResume = cache.viajes.data.find(r => r.trip_number === v.trip_number);
      const cliente = viajeResume?.company_customer_name || v.company_customer_name || null;

      // activado_en siempre presente para que todos los objetos del batch tengan las mismas claves
      const row = {
        trip_number:           v.trip_number,
        license_plate:         v.license_plate || null,
        driver_name:           v.driver_name || null,
        company_customer_name: cliente,
        city_origin:           v.city_origin || null,
        city_destination:      v.city_destination || null,
        origin_address:        v.origin_address || null,
        schedulate_origin:     v.schedulate_origin || null,
        fecha_programada_dia:  f ? f.toISOString().slice(0, 10) : null,
        activo_en_resume:      estaActivo,
        fecha_detectado:       null,
        activado_en:           null,
      };

      if (yaExiste) {
        row.fecha_detectado = yaExiste.fecha_detectado;
        if (estaActivo && !yaExiste.activo_en_resume) row.activado_en = new Date().toISOString();
      } else {
        row.fecha_detectado = new Date().toISOString();
        if (estaActivo) row.activado_en = new Date().toISOString();
      }
      return row;
    });

    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch('/planeados', 'POST', rows.slice(i, i + 50));
    }

    const hoyStr = hoyInicio.toISOString().slice(0, 10);
    await sbFetch(`/planeados?fecha_programada_dia=lt.${hoyStr}`, 'DELETE');
    console.log(`📅 Planeados: ${rows.length} upsertados, limpieza de anteriores a ${hoyStr}`);

    const sinCliente = (existentes || []).filter(e => !e.company_customer_name);
    for (const e of sinCliente) {
      const viajeResume = cache.viajes.data.find(r => r.trip_number === e.trip_number);
      if (viajeResume?.company_customer_name) {
        await sbFetch(
          `/planeados?trip_number=eq.${encodeURIComponent(e.trip_number)}`,
          'PATCH',
          { company_customer_name: viajeResume.company_customer_name }
        );
      }
    }
  } catch(e) {
    console.error("❌ Error sync planeados:", e.message);
  }
}

async function syncViajes() {
  try {
    const data1 = await safeFetch("/Resume?size=100&page=1", null);
    if (!data1) return;
    const arr1 = Array.isArray(data1) ? data1 : data1.data || data1.result || [];
    if (arr1.length === 0) {
      console.warn("⚠️  Resume devolvió 0 viajes — manteniendo caché anterior");
      return;
    }

    let todos = [...arr1];

    if (arr1.length >= 100) {
      try {
        const data2 = await safeFetch("/Resume?size=100&page=2", null);
        const arr2 = Array.isArray(data2) ? data2 : (data2?.data || data2?.result || []);
        if (arr2.length > 0) {
          todos = [...todos, ...arr2];
          console.log(`📄 Página 2 cargada: ${arr2.length} viajes adicionales`);
          if (arr2.length >= 100) {
            try {
              const data3 = await safeFetch("/Resume?size=100&page=3", null);
              const arr3 = Array.isArray(data3) ? data3 : (data3?.data || data3?.result || []);
              if (arr3.length > 0) {
                todos = [...todos, ...arr3];
                console.log(`📄 Página 3 cargada: ${arr3.length} viajes adicionales`);
              }
            } catch(e) { console.warn("⚠️  Página 3 no disponible:", e.message); }
          }
        }
      } catch(e) { console.warn("⚠️  Página 2 no disponible:", e.message); }
    }

    const seen = new Set();
    const dedup = todos.filter(v => {
      const k = v.trip_number || v.id_monitoring_order;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    cache.viajes.data = sortViajes(dedup);
    cache.viajes.ts   = Date.now();
    console.log(`📦 Caché: ${dedup.length} viajes totales (p1:${arr1.length} + extras)`);
  } catch(e) {
    console.error("❌ Error sync viajes:", e.message);
  }
}

async function syncAlarmas() {
  try {
    const data = await safeFetch("/Alarm?size=500&page=1", null);
    if (!data) return;
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    if (arr.length === 0) {
      console.warn("⚠️  Alarm devolvió 0 — manteniendo caché anterior");
      return;
    }
    cache.alarmas.data = arr;
    cache.alarmas.ts   = Date.now();
    console.log(`🔔 Alarmas actualizadas: ${arr.length}`);
  } catch(e) {
    console.error("❌ Error sync alarmas:", e.message);
  }
}

// ─── ENDPOINTS — responden siempre del caché ────────────

app.get("/api/data", (req, res) => {
  res.json(cache.viajes.data);
});

app.get("/api/alarmas", (req, res) => {
  res.json(cache.alarmas.data);
});

app.get("/api/pendientes", async (req, res) => {
  try {
    if ((Date.now() - cache.pendientes.ts) > 5 * 60 * 1000 || cache.pendientes.data.length === 0) {
      await syncPendientes();
    }
    const arr = cache.pendientes.data;

    function parseSchedulate(str) {
      if (!str) return null;
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
      if (!m) return null;
      const [, dd, mm, yyyy, hh, min, ss = '00'] = m;
      return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss.padStart(2,'0')}`);
    }

    const ahora     = new Date();
    const hace1dia  = new Date(ahora.getTime() - 1 * 24 * 60 * 60 * 1000);
    const en7dias   = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    const filtrados = arr.filter(v => {
      if (activeIds.has(v.trip_number)) return false;
      const fecha = parseSchedulate(v.schedulate_origin);
      if (!fecha || isNaN(fecha.getTime())) return true;
      return fecha >= hace1dia && fecha <= en7dias;
    });

    filtrados.sort((a, b) => {
      const dA = parseSchedulate(a.schedulate_origin) || new Date(0);
      const dB = parseSchedulate(b.schedulate_origin) || new Date(0);
      return dA - dB;
    });

    console.log(`⏳ Cache pendientes: ${arr.length} total, activeIds: ${activeIds.size}`);
    if(arr.length > 0) console.log(`⏳ Muestra schedulate_origin:`, arr.slice(0,3).map(v=>`${v.trip_number}=${v.schedulate_origin}`).join(' | '));
    console.log(`⏳ Resultado filtrado: ${filtrados.length} futuros pendientes`);
    res.json(filtrados);
  } catch(err) {
    console.warn("⚠️  /api/pendientes error:", err.message);
    res.json([]);
  }
});



// ─── SYNC CUMPLIDOS — corre en Railway cada 60s ─────────
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
        const row = {
          id:              v.trip_number,
          manifiesto:      v.number_order || '',
          placa:           v.license_plate || '',
          conductor:       v.driver_name || '',
          conductor_tel:   extraerTelefono(v.driver_phone, v.full_driver),
          cliente:         cliente,
          estado_controlt: v.state_travel || '',
          estado_cumplido: 'LIVE',
          pct:             parseFloat(v.percentage_travel) || 0,
          fecha_viaje:     v.activated_on || v.created_on || '',
          origen:          v.origin_city_name || '',
          destino:         v.destiny_city_name || '',
          tiene_soporte:   false,
        };
        await sbFetch('/cumplidos', 'POST', row);
        insertados++;
      } else {
        const patch = {
          estado_controlt: v.state_travel || '',
          pct:             parseFloat(v.percentage_travel) || 0,
        };
        if (!existe.cliente && cliente) patch.cliente = cliente;
        await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(v.trip_number)}`, 'PATCH', patch);
        actualizados++;
      }
    }

    let finalizados = 0;
    for (const [id, c] of existentes) {
      const estadoActivo = ESTADOS_ACTIVOS.has((c.estado_cumplido || '').toUpperCase());
      if (estadoActivo && !apiSet.has(id)) {
        const nuevoEstado = c.tiene_soporte ? 'PENDIENTE LIQUIDACION' : 'FINALIZADO CONTROLT';
        await sbFetch(
          `/cumplidos?id=eq.${encodeURIComponent(id)}`,
          'PATCH',
          { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() }
        );
        finalizados++;
        console.log(`🏁 Cumplido ${id} → ${nuevoEstado}`);
      }
    }

    console.log(`✅ Cumplidos sync: +${insertados} nuevos, ~${actualizados} actualizados, 🏁${finalizados} finalizados`);
  } catch(e) {
    console.error('❌ Error syncCumplidos:', e.message);
  }
}

// ─── SYNC SOLICITUDES — portal cliente, corre cada 65s ──
async function syncSolicitudes() {
  try {
    if (!cache.viajes.data.length) {
      console.log('📋 syncSolicitudes: cache.viajes vacío, omitiendo ciclo.');
      return;
    }

    if (!_diagSolDone) {
      const kv = cache.viajes.data.length    ? Object.keys(cache.viajes.data[0])    : [];
      const kp = cache.pendientes.data.length ? Object.keys(cache.pendientes.data[0]) : [];
      console.log('🔍 [SOL-DIAG] Campos viajes:',       kv.join(', '));
      console.log('🔍 [SOL-DIAG] ¿remission viajes?:',   kv.includes('remission'));
      console.log('🔍 [SOL-DIAG] ¿number_order viajes?:', kv.includes('number_order'));
      console.log('🔍 [SOL-DIAG] Campos pendientes:',   kp.join(', '));
      console.log('🔍 [SOL-DIAG] ¿remission pendientes?:', kp.includes('remission'));
      const mv = cache.viajes.data.filter(v=>(v.remission||'').startsWith('SOL-')).slice(0,3).map(v=>`${v.trip_number}→${v.remission}`);
      const mp = cache.pendientes.data.filter(v=>(v.remission||'').startsWith('SOL-')).slice(0,3).map(v=>`${v.trip_number}→${v.remission}`);
      console.log('🔍 [SOL-DIAG] Muestra SOL viajes:',    mv.join(' | ') || 'ninguna');
      console.log('🔍 [SOL-DIAG] Muestra SOL pendientes:', mp.join(' | ') || 'ninguna');
      _diagSolDone = true;
    }

    const resumeByRemission     = new Map();
    const resumeByTripNumber    = new Map();
    const pendientesByRemission = new Map();
    for (const v of cache.viajes.data) {
      const rem = (v.remission || '').trim();
      if (rem.startsWith('SOL-')) resumeByRemission.set(rem, v);
      if (v.trip_number)          resumeByTripNumber.set(String(v.trip_number), v);
    }
    for (const v of cache.pendientes.data) {
      const rem = (v.remission || '').trim();
      if (rem.startsWith('SOL-')) pendientesByRemission.set(rem, v);
    }

    const solicitudes = await sbFetch(
      '/solicitudes?estado=in.(pendiente,confirmado,en_ruta)' +
      '&select=id,codigo_solicitud,estado,controlt_trip_number,' +
              'creado_por,empresa_cliente_id,fecha_requerida,' +
              'observacion_coordinadora,manifiesto'
    );
    if (!solicitudes?.length) {
      console.log('📋 syncSolicitudes: sin solicitudes activas.');
      return;
    }
    console.log(`📋 syncSolicitudes: evaluando ${solicitudes.length} solicitudes.`);

    const ahora        = new Date().toISOString();
    const orphanCutoff = new Date(Date.now() - ORPHAN_HOURS * 3600 * 1000).toISOString();
    const updates      = [];
    const insertsNotif = [];
    const pendVerif    = [];

    for (const sol of solicitudes) {
      const { id, codigo_solicitud, estado, controlt_trip_number,
              creado_por, fecha_requerida, observacion_coordinadora } = sol;

      if (estado === 'pendiente') {
        if (fecha_requerida < orphanCutoff &&
            !resumeByRemission.has(codigo_solicitud) &&
            !pendientesByRemission.has(codigo_solicitud)) {
          console.warn(`⚠️ [HUÉRFANA] ${codigo_solicitud} | requerida: ${fecha_requerida}`);
          continue;
        }
        const vR = resumeByRemission.get(codigo_solicitud);
        if (vR) {
          const g  = _grupo(vR.state_travel);
          const ne = g || 'confirmado';
          updates.push({ id, fields: _fields(vR, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vR, 'pendiente'));
          continue;
        }
        const vP = pendientesByRemission.get(codigo_solicitud);
        if (vP) {
          const g  = _grupo(vP.state_travel);
          const ne = (g === 'en_ruta' || g === 'completado' || g === 'cancelado') ? g : 'confirmado';
          updates.push({ id, fields: _fields(vP, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vP, 'pendiente'));
        }

      } else if (estado === 'confirmado') {
        const vR = controlt_trip_number
          ? resumeByTripNumber.get(controlt_trip_number)
          : resumeByRemission.get(codigo_solicitud);
        if (vR) {
          const g = _grupo(vR.state_travel);
          if (g === 'en_ruta' || g === 'completado' || g === 'cancelado') {
            updates.push({ id, fields: _fields(vR, g, ahora, false) });
            insertsNotif.push(..._notifs(sol, g, vR, 'confirmado'));
          } else {
            updates.push({ id, fields: { estado_controlt: (vR.state_travel||'').toLowerCase().trim(), ultima_actualizacion_controlt: ahora } });
          }
        } else if (controlt_trip_number) {
          pendVerif.push({ trip_number: controlt_trip_number, solicitud_id: id, estado_actual: estado, sol });
        } else {
          console.warn(`⚠️ [syncSolicitudes] ${codigo_solicitud}: confirmado sin controlt_trip_number`);
        }

      } else if (estado === 'en_ruta') {
        const vR = controlt_trip_number ? resumeByTripNumber.get(controlt_trip_number) : null;
        if (vR) {
          const g = _grupo(vR.state_travel);
          if (g === 'completado' || g === 'cancelado') {
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

    if (pendVerif.length > 0) {
      const tripIds = [...new Set(pendVerif.map(t => t.trip_number))];
      const idsStr  = tripIds.map(encodeURIComponent).join(',');
      const cumplidos = await sbFetch(`/cumplidos?id=in.(${idsStr})&select=id,estado_cumplido`) || [];
      const cumplMap  = new Map(cumplidos.map(c => [c.id, c]));
      for (const { trip_number, solicitud_id, estado_actual, sol } of pendVerif) {
        const cumpl = cumplMap.get(trip_number);
        if (cumpl) {
          updates.push({ id: solicitud_id, fields: { estado: 'completado', estado_controlt: cumpl.estado_cumplido, ultima_actualizacion_controlt: ahora } });
          insertsNotif.push(..._notifs(sol, 'completado', null, estado_actual));
        } else {
          console.warn(`⚠️ [syncSolicitudes] ANOMALÍA: trip ${trip_number} (${sol.codigo_solicitud}) desapareció de Resume sin registrarse en cumplidos. Estado mantenido: ${estado_actual}`);
          updates.push({ id: solicitud_id, fields: { ultima_actualizacion_controlt: ahora } });
        }
      }
    }

    let updOk = 0;
    for (const { id, fields } of updates) {
      const r = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(id)}`, 'PATCH', fields);
      if (r !== null) updOk++;
    }
    for (let i = 0; i < insertsNotif.length; i += 50) {
      await sbFetch('/notificaciones_cliente', 'POST', insertsNotif.slice(i, i + 50));
    }

    console.log(`📋 syncSolicitudes OK: ${updOk}/${updates.length} upd | ${insertsNotif.length} notifs | ${pendVerif.length} verif cumplidos`);
  } catch(e) {
    console.error('❌ Error syncSolicitudes:', e.message);
  }
}

function _grupo(stateTravel) {
  const s = (stateTravel || '').toLowerCase().trim();
  if (GRUPO_CONFIRMADO.has(s)) return 'confirmado';
  if (GRUPO_EN_RUTA.has(s))    return 'en_ruta';
  if (GRUPO_COMPLETADO.has(s)) return 'completado';
  if (GRUPO_CANCELADO.has(s))  return 'cancelado';
  return null;
}

function _fields(viaje, nuevoEstado, ahora, esPrimerEnlace) {
  const f = {
    estado:                        nuevoEstado,
    estado_controlt:               (viaje?.state_travel || '').toLowerCase().trim() || null,
    ultima_actualizacion_controlt: ahora,
  };
  if (viaje?.trip_number)  f.controlt_trip_number = String(viaje.trip_number);
  if (viaje?.number_order) f.manifiesto            = String(viaje.number_order);
  if (esPrimerEnlace)      f.fecha_confirmacion    = ahora;
  if (nuevoEstado === 'cancelado') f.fecha_cancelacion = ahora;
  return f;
}

function _notifs(sol, nuevoEstado, viaje, estadoAnterior) {
  const cod   = sol.codigo_solicitud;
  const placa = viaje?.license_plate || '';
  const cond  = viaje?.driver_name   || '';
  const obs   = sol.observacion_coordinadora ? `\n${sol.observacion_coordinadora}` : '';
  const uid   = sol.creado_por;
  const sid   = sol.id;
  const n = (tipo, titulo, mensaje) => ({ usuario_id: uid, solicitud_id: sid, tipo, titulo, mensaje });
  if (nuevoEstado === 'confirmado' && estadoAnterior === 'pendiente')
    return [n('confirmacion', 'Servicio confirmado', `Tu servicio ${cod} ha sido confirmado. Vehículo: ${placa}. Conductor: ${cond}.${obs}`)];
  if (nuevoEstado === 'en_ruta' && estadoAnterior === 'pendiente')
    return [n('confirmacion', 'Servicio en camino', `Tu servicio ${cod} fue confirmado y ya está en operación. Vehículo: ${placa}. Conductor: ${cond}.${obs}`)];
  if (nuevoEstado === 'en_ruta' && estadoAnterior === 'confirmado')
    return [n('info', 'Tu servicio está en camino', `El servicio ${cod} inició operación.`)];
  if (nuevoEstado === 'completado')
    return [n('info', 'Servicio completado', `El servicio ${cod} fue completado exitosamente.`)];
  if (nuevoEstado === 'cancelado')
    return [n('cancelacion', 'Servicio cancelado', `El servicio ${cod} fue cancelado. Si tienes dudas, comunícate con INLOP.`)];
  return [];
}

// Planeados — desde Supabase
app.get("/api/planeados", async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);
    const data = await sbFetch(
      `/planeados?fecha_programada_dia=gte.${hoyStr}&order=schedulate_origin.asc&limit=500`
    );
    res.json(data || []);
  } catch(e) {
    console.error("❌ /api/planeados:", e.message);
    res.json([]);
  }
});

// Health check
app.get("/health", (req, res) => {
  const estados = {};
  cache.viajes.data.forEach(v => {
    const e = v.state_travel || 'desconocido';
    estados[e] = (estados[e] || 0) + 1;
  });
  res.json({
    status: "ok",
    tokenActivo: !!currentToken,
    ultimoLogin: lastLogin ? new Date(lastLogin).toISOString() : null,
    cache: {
      viajes:  {
        cantidad: cache.viajes.data.length,
        edad_seg: Math.round((Date.now() - cache.viajes.ts) / 1000),
        por_estado: estados
      },
      alarmas: {
        cantidad: cache.alarmas.data.length,
        edad_seg: Math.round((Date.now() - cache.alarmas.ts) / 1000)
      }
    }
  });
});

// ─── INICIO ─────────────────────────────────────────────
app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 INLOP Torre de Control — Servidor iniciado");
  console.log("📊 Modo caché: ControlT se consulta 1 vez/minuto en background");

  try {
    await refreshToken();
    await syncViajes();
    await syncAlarmas();
    await syncPendientes();
    await syncPlaneados();
    await syncCumplidos();
    await syncSolicitudes();
  } catch(e) {
    console.error("❌ Error inicialización:", e.message);
  }

  setInterval(syncViajes,       60 * 1000);
  setInterval(syncAlarmas,      70 * 1000);
  setInterval(syncPendientes,    5 * 60 * 1000);
  setInterval(syncPlaneados,     5 * 60 * 1000);
  setInterval(syncCumplidos,    60 * 1000);
  setInterval(syncSolicitudes,  65 * 1000);
});
