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
app.use(express.json());

// Servir TorreControl.html directamente desde la raíz
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));
app.get("/TorreControl.html", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));

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

    let upsertados = 0;
    for (const v of viajesFuturos) {
      const f = parseSchedulate(v.schedulate_origin);
      const yaExiste = existMap[v.trip_number];
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
        fecha_programada_dia:  f ? f.toISOString().slice(0, 10) : null,
        activo_en_resume:      estaActivo,
        fecha_detectado:       yaExiste ? yaExiste.fecha_detectado : new Date().toISOString(),
        activado_en:           (estaActivo && yaExiste && !yaExiste.activo_en_resume) || (estaActivo && !yaExiste)
                                 ? new Date().toISOString()
                                 : null,
      };

      await sbFetch('/planeados', 'POST', row);
      upsertados++;
    }

    const hoyStr = hoyInicio.toISOString().slice(0, 10);
    await sbFetch(`/planeados?fecha_programada_dia=lt.${hoyStr}`, 'DELETE');
    console.log(`📅 Planeados: ${upsertados} upsertados, limpieza de anteriores a ${hoyStr}`);

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


// ─── SOLICITUDES (Módulo de Demanda) ─────────────────────────────────────────
app.get('/api/solicitudes', async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;
    // Usar fecha local Colombia para el default de "hoy"
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const fechaDesde = desde || hoy;
    const fechaHasta = hasta || hoy;

    let qs = `/solicitudes?order=creado_en.desc&limit=500`;

    if (estado && estado !== 'todos' && estado !== '') {
      const dbEstado = estado === 'aprobado' ? 'confirmado' : estado;
      qs += `&estado=eq.${encodeURIComponent(dbEstado)}`;
    } else {
      qs += `&estado=in.(pendiente,confirmado,en_ruta,cancelado)`;
    }

    // Anclar al huso de Colombia (UTC-5) para que "hoy" coincida con el día local del operador
    qs += `&creado_en=gte.${encodeURIComponent(fechaDesde + 'T00:00:00.000-05:00')}`;
    qs += `&creado_en=lte.${encodeURIComponent(fechaHasta + 'T23:59:59.999-05:00')}`;

    const solicitudes = await sbFetch(qs) || [];

    // Colectar IDs únicos para los joins
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

    const result = solicitudes.map(s => ({
      id:               s.id,
      codigo_solicitud: s.codigo_solicitud,
      cliente:          empMap[s.empresa_cliente_id] || '—',
      agencia:          agMap[s.agencia_id]          || s.agencia_nombre || '—',
      solicitante:      usrMap[s.creado_por]         || '—',
      tipo_operacion:   s.tipo_operacion             || '',
      tipo_vehiculo:    s.tipo_vehiculo              || '',
      fecha_requerida:  s.fecha_requerida            || null,
      estado:           s.estado === 'confirmado' ? 'aprobado' : s.estado,
      creado_en:        s.creado_en,
      canal:            s.canal                     || 'APP',
    }));

    res.json(result);
  } catch(e) {
    console.error('❌ GET /api/solicitudes:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/solicitudes/:id/estado — cambia estado manualmente (interno, sin auth)
app.patch('/api/solicitudes/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, conductor_nombre, placa_asignada, conductor_tel } = req.body;
    const permitidos = ['pendiente', 'confirmado', 'en_ruta', 'completado', 'cancelado'];
    if (!estado || !permitidos.includes(estado)) {
      return res.status(400).json({ error: `estado inválido: ${estado}` });
    }
    const ahora = new Date().toISOString();
    const patch = { estado };
    if (estado === 'confirmado') patch.fecha_confirmacion = ahora;
    if (estado === 'en_ruta')    patch.fecha_inicio_real  = ahora;
    if (estado === 'cancelado')  patch.fecha_cancelacion  = ahora;
    if (conductor_nombre) patch.conductor_nombre = conductor_nombre;
    if (placa_asignada)   patch.placa_asignada   = placa_asignada;
    if (conductor_tel)    patch.conductor_tel     = conductor_tel;

    const result = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch);
    if (result === null) {
      return res.status(500).json({ error: 'Supabase rechazó la actualización — revisar logs del servidor' });
    }
    res.json({ ok: true, id, estado });
  } catch(e) {
    console.error('❌ PATCH /api/solicitudes/:id/estado:', e.message);
    res.status(500).json({ error: e.message });
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
      const mv = cache.viajes.data.slice(0,5).map(v=>`${v.trip_number}→"${v.remission||''}"`);
      const mp = cache.pendientes.data.slice(0,5).map(v=>`${v.trip_number}→"${v.remission||''}"`);
      console.log('🔍 [SOL-DIAG] Muestra remisiones viajes:',    mv.join(' | ') || 'ninguna');
      console.log('🔍 [SOL-DIAG] Muestra remisiones pendientes:', mp.join(' | ') || 'ninguna');
      _diagSolDone = true;
    }

    const resumeByRemission     = new Map();
    const resumeByTripNumber    = new Map();
    const pendientesByRemission = new Map();
    for (const v of cache.viajes.data) {
      // remission llega como ",val1,val2" — indexar cada parte no vacía
      for (const p of _splitRem(v.remission)) resumeByRemission.set(p, v);
      if (v.trip_number) resumeByTripNumber.set(String(v.trip_number), v);
    }
    for (const v of cache.pendientes.data) {
      for (const p of _splitRem(v.remission)) pendientesByRemission.set(p, v);
    }

    const solicitudes = await sbFetch(
      '/solicitudes?estado=in.(pendiente,confirmado,en_ruta)' +
      '&select=id,codigo_solicitud,external_ref,estado,controlt_trip_number,' +
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
      const { id, codigo_solicitud, external_ref, estado, controlt_trip_number,
              creado_por, fecha_requerida, observacion_coordinadora } = sol;

      // Clave de match: external_ref si está puesto (pruebas con remisión real), sino codigo_solicitud
      // Normalizar espacios dobles igual que _splitRem para que "NHR-IB-2185" == "NHR-  IB-2185"
      const matchKey = ((external_ref || '').trim().replace(/\s+/g, ' ')) || codigo_solicitud;

      if (estado === 'pendiente') {
        // Solo descartar como huérfana si la fecha ya venció Y no tiene external_ref (match explícito)
        if (!external_ref && fecha_requerida < orphanCutoff &&
            !resumeByRemission.has(matchKey) &&
            !pendientesByRemission.has(matchKey)) {
          console.warn(`⚠️ [HUÉRFANA] ${codigo_solicitud} | matchKey: ${matchKey} | requerida: ${fecha_requerida}`);
          continue;
        }
        // Log de diagnóstico cuando hay external_ref para facilitar depuración
        if (external_ref && !resumeByRemission.has(matchKey)) {
          const todasRem = [...resumeByRemission.keys()].join(' | ');
          console.warn(`🔍 [MATCH-MISS] ${codigo_solicitud} buscando "${matchKey}" — todas las remisiones: ${todasRem || 'ninguna'}`);
          // Buscar el valor en cualquier campo del viaje para saber dónde está
          const encontrado = cache.viajes.data.find(v =>
            Object.values(v).some(val => val && String(val).includes(matchKey))
          );
          if (encontrado) {
            console.warn(`🔍 [MATCH-HINT] "${matchKey}" encontrado en trip ${encontrado.trip_number} — remission="${encontrado.remission}" number_order="${encontrado.number_order}" placa="${encontrado.license_plate}"`);
          } else {
            console.warn(`🔍 [MATCH-HINT] "${matchKey}" NO encontrado en ningún campo de los ${cache.viajes.data.length} viajes activos`);
          }
        }
        const vR = resumeByRemission.get(matchKey);
        if (vR) {
          const g  = _grupo(vR.state_travel);
          const ne = g || 'confirmado';
          updates.push({ id, fields: _fields(vR, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vR, 'pendiente'));
          continue;
        }
        const vP = pendientesByRemission.get(matchKey);
        if (vP) {
          const g  = _grupo(vP.state_travel);
          const ne = (g === 'en_ruta' || g === 'completado' || g === 'cancelado') ? g : 'confirmado';
          updates.push({ id, fields: _fields(vP, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vP, 'pendiente'));
        }

      } else if (estado === 'confirmado') {
        const vR = controlt_trip_number
          ? resumeByTripNumber.get(controlt_trip_number)
          : resumeByRemission.get(matchKey);
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

function _splitRem(remission) {
  // ControlT devuelve remission como ",val1,val2" y puede tener espacios dobles internos
  return (remission || '').split(',')
    .map(p => p.trim().replace(/\s+/g, ' '))  // colapsar espacios dobles
    .filter(Boolean);
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
  // Primer enlace: la solicitud se creó tarde, el viaje ya estaba activo
  if (esPrimerEnlace)      f.fecha_confirmacion    = ahora;
  // Si llega en_ruta (o salta de pendiente directo a en_ruta) registrar fecha_inicio_real
  if (nuevoEstado === 'en_ruta' || (esPrimerEnlace && nuevoEstado !== 'pendiente' && nuevoEstado !== 'confirmado')) {
    f.fecha_inicio_real = ahora;
  }
  if (nuevoEstado === 'completado') f.fecha_fin_real    = ahora;
  if (nuevoEstado === 'cancelado')  f.fecha_cancelacion = ahora;
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

// ─── PORTAL CLIENTE — AUTH + SERVICIOS + NOTIFICACIONES ─

// Construye el payload completo de sesión reutilizado por /auth/login y GET /auth/me.
async function buildSessionData(userId, email, perfil) {
  const empresaId = perfil.empresa_cliente_id;
  const rol       = perfil.rol || 'encargado';

  const [empresas, agencias] = await Promise.all([
    sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(empresaId)}&limit=1`).catch(() => []),
    (async () => {
      if (rol === 'admin_cliente') {
        // Admin ve todas las agencias activas de la empresa
        const rows = await sbFetch(`/agencias_cliente?empresa_cliente_id=eq.${encodeURIComponent(empresaId)}&activa=eq.true&order=nombre.asc`).catch(() => []);
        return (rows || []).map(a => ({ id: a.id, nombre: a.nombre, ciudad: a.ciudad || '' }));
      }
      // Usuario regular: solo sus agencias asignadas (activas)
      const asignadas = await sbFetch(`/usuario_agencias?usuario_id=eq.${encodeURIComponent(userId)}&select=agencia_id`).catch(() => []);
      if (asignadas && asignadas.length > 0) {
        const ids = asignadas.map(a => encodeURIComponent(a.agencia_id)).join(',');
        const rows = await sbFetch(`/agencias_cliente?id=in.(${ids})&activa=eq.true&order=nombre.asc`).catch(() => []);
        return (rows || []).map(a => ({ id: a.id, nombre: a.nombre, ciudad: a.ciudad || '' }));
      }
      // Sin asignaciones → array vacío (el frontend muestra estado vacío)
      return [];
    })(),
  ]);

  const emp = (empresas || [])[0] || {};

  return {
    usuario: {
      id:           userId,
      nombre:       perfil.nombre       || '',
      email,
      cargo:        perfil.cargo        || '',
      rol,
      tipo_usuario: perfil.tipo_usuario || 'cliente',
      agencia_id:   perfil.agencia_id   || null,
      activo:       perfil.activo       !== false,
    },
    empresa: {
      id:             emp.id             || empresaId,
      nombre:         emp.razon_social   || '',
      nit:            emp.nit            || '',
      nombre_controlt: emp.nombre_controlt || '',
      activa:         emp.activa         !== false,
    },
    agencias,
    permisos: {
      rol,
      puede_gestionar_usuarios: rol === 'admin_cliente',
      puede_ver_todas_agencias: rol === 'admin_cliente',
      agencia_ids: agencias.map(a => a.id),
    },
  };
}

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
    const perfiles = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(sbUser.id)}&limit=1`) || [];
    if (!perfiles.length) return res.status(403).json({ error: 'Perfil no configurado' });
    const perfil = perfiles[0];
    if (!perfil.activo)                                           return res.status(403).json({ error: 'Usuario inactivo' });
    if (perfil.tipo_usuario && perfil.tipo_usuario !== 'cliente') return res.status(403).json({ error: 'Acceso no permitido' });
    req.userId     = sbUser.id;
    req.userEmail  = sbUser.email;
    req.empresaId  = perfil.empresa_cliente_id;
    req.userPerfil = perfil;
    next();
  } catch(e) {
    console.error('❌ requireClienteAuth:', e.message);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

function requireAdminCliente(req, res, next) {
  if (!req.userPerfil)                        return res.status(401).json({ error: 'No autenticado' });
  if (req.userPerfil.rol !== 'admin_cliente') return res.status(403).json({ error: 'Se requiere rol admin_cliente' });
  next();
}

// viaje: objeto de cache.viajes (activo en ControlT) — fuente de verdad para datos en tiempo real
// cumplido: fila de tabla cumplidos — solo disponible cuando el viaje ya finalizó
function mapSolicitud(sol, viaje = null, cumplido = null) {
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
    fecha_solicitud:   sol.creado_en || sol.created_at || null,
    fecha_requerida:   sol.fecha_requerida,
    fecha_aprobacion:  sol.fecha_confirmacion || null,
    fecha_inicio_real: cumplido?.fecha_viaje        || sol.fecha_inicio_real || null,
    fecha_fin_real:    cumplido?.fecha_finalizacion || null,
    fecha_cancelacion: sol.fecha_cancelacion || null,
    estado:            sol.estado === 'confirmado' ? 'aprobado' : sol.estado,
    controlt_trip_number: sol.controlt_trip_number || null,
    // Datos del vehículo: viaje activo (cache) > manual en solicitud > cumplido histórico
    placa_asignada:   viaje?.license_plate  || sol.placa_asignada   || cumplido?.placa      || null,
    conductor_nombre: viaje?.driver_name    || sol.conductor_nombre || cumplido?.conductor  || null,
    conductor_tel:    viaje
      ? extraerTelefono(viaje.driver_phone, viaje.full_driver)
      : (sol.conductor_tel || cumplido?.conductor_tel || null),
    pct:              viaje ? (parseFloat(viaje.percentage_travel) || 0) : null,
    observaciones:    sol.observacion_coordinadora || null,
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
    if (!r.ok || !data.access_token) {
      return res.status(401).json({ error: data.error_description || 'Credenciales inválidas' });
    }
    const perfiles = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(data.user.id)}&limit=1`) || [];
    if (!perfiles.length) return res.status(403).json({ error: 'Usuario no configurado en el portal' });
    const perfil = perfiles[0];
    if (!perfil.activo) return res.status(403).json({ error: 'Usuario inactivo' });
    const session = await buildSessionData(data.user.id, data.user.email, perfil);
    res.json({ token: data.access_token, refresh_token: data.refresh_token || null, ...session });
  } catch(e) {
    console.error('❌ /auth/login:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/me — sesión completa: usuario + empresa + agencias + permisos
app.get('/auth/me', requireClienteAuth, async (req, res) => {
  try {
    const session = await buildSessionData(req.userId, req.userEmail, req.userPerfil);
    res.json({
      ...session.usuario,
      empresa_id: req.empresaId,
      empresa:    session.empresa,
      agencias:   session.agencias,
      permisos:   session.permisos,
    });
  } catch(e) { console.error('❌ GET /auth/me:', e.message); res.status(500).json({ error: e.message }); }
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => res.json({ ok: true }));

// POST /auth/cambiar-password
app.post('/auth/cambiar-password', requireClienteAuth, async (req, res) => {
  const { passwordNueva } = req.body || {};
  if (!passwordNueva) return res.status(400).json({ error: 'passwordNueva requerido' });
  try {
    const token = (req.headers.authorization || '').slice(7);
    const r = await fetch(`${SB_AUTH_URL}/user`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordNueva })
    });
    if (!r.ok) { const e = await r.json(); return res.status(400).json({ error: e.message || 'Error al cambiar contraseña' }); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /auth/recuperar
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

// ─── GESTIÓN DE USUARIOS (admin_cliente only) ────────────
// Requiere SUPABASE_SERVICE_KEY en Railway (service_role key de Supabase).

const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SB_KEY;

async function sbAuthAdmin(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'apikey': SB_SERVICE_KEY, 'Authorization': `Bearer ${SB_SERVICE_KEY}`, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SB_AUTH_URL}${path}`, opts);
  if (!r.ok) {
    const txt = await r.text();
    console.error(`SbAuthAdmin ${method} ${path} → ${r.status}: ${txt}`);
    return null;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// Verifica que el usuario pertenece a la empresa del admin autenticado
async function verificarMismaEmpresa(usuarioId, empresaId) {
  const rows = await sbFetch(
    `/usuarios_cliente?id=eq.${encodeURIComponent(usuarioId)}&empresa_cliente_id=eq.${encodeURIComponent(empresaId)}&limit=1`
  ) || [];
  return rows[0] || null;
}

// GET /usuarios — lista usuarios de la empresa con agencias asignadas
app.get('/usuarios', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const perfiles = await sbFetch(
      `/usuarios_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=nombre.asc`
    ) || [];
    if (!perfiles.length) return res.json([]);

    const userIds = perfiles.map(p => encodeURIComponent(p.id)).join(',');
    const [asignaciones, agencias, authData] = await Promise.all([
      sbFetch(`/usuario_agencias?usuario_id=in.(${userIds})&select=usuario_id,agencia_id`).catch(() => []),
      sbFetch(`/agencias_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&select=id,nombre,ciudad`).catch(() => []),
      sbAuthAdmin(`/admin/users?per_page=1000`).catch(() => null),
    ]);

    const agenciasMap = {};
    (agencias || []).forEach(a => { agenciasMap[a.id] = a; });
    const emailMap = {};
    ((authData || {}).users || []).forEach(u => { emailMap[u.id] = u.email || ''; });

    res.json(perfiles.map(p => {
      const userAgencias = (asignaciones || [])
        .filter(a => a.usuario_id === p.id)
        .map(a => agenciasMap[a.agencia_id] ? { id: a.agencia_id, nombre: agenciasMap[a.agencia_id].nombre, ciudad: agenciasMap[a.agencia_id].ciudad || '' } : null)
        .filter(Boolean);
      return {
        id:           p.id,
        nombre:       p.nombre       || '',
        email:        emailMap[p.id] || '',
        cargo:        p.cargo        || '',
        rol:          p.rol          || 'encargado',
        tipo_usuario: p.tipo_usuario || 'cliente',
        agencia_id:   p.agencia_id   || null,
        activo:       p.activo       !== false,
        created_at:   p.created_at,
        agencias:     userAgencias,
      };
    }));
  } catch(e) { console.error('❌ GET /usuarios:', e.message); res.status(500).json({ error: e.message }); }
});

// POST /usuarios — crea usuario en Auth (trigger crea perfil automáticamente)
app.post('/usuarios', requireClienteAuth, requireAdminCliente, async (req, res) => {
  const { nombre, email, password, cargo, rol, agencia_id } = req.body || {};
  if (!nombre || !email || !password) return res.status(400).json({ error: 'nombre, email y password son requeridos' });

  const ROLES_VALIDOS = ['admin_cliente', 'encargado', 'coordinador'];
  if (rol && !ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: `Rol inválido. Permitidos: ${ROLES_VALIDOS.join(', ')}` });

  try {
    const authRes = await sbAuthAdmin('/admin/users', 'POST', {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        cargo:              cargo              || '',
        rol:                rol                || 'encargado',
        tipo_usuario:       'cliente',
        empresa_cliente_id: req.empresaId,
        agencia_id:         agencia_id         || '',
      }
    });
    if (!authRes || !authRes.id) return res.status(500).json({ error: 'Error creando usuario en Auth' });

    // Esperar al trigger (async en Supabase)
    await new Promise(r => setTimeout(r, 300));

    let perfiles = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(authRes.id)}&limit=1`) || [];

    // Fallback: trigger no ejecutó — insertar perfil manualmente
    if (!perfiles.length) {
      await sbFetch('/usuarios_cliente', 'POST', {
        id: authRes.id, empresa_cliente_id: req.empresaId,
        agencia_id: agencia_id || null, nombre, cargo: cargo || null,
        rol: rol || 'encargado', tipo_usuario: 'cliente', activo: true,
      });
      perfiles = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(authRes.id)}&limit=1`) || [];
    }

    if (!perfiles.length) return res.status(500).json({ error: 'Perfil no creado correctamente' });
    const p = perfiles[0];
    res.status(201).json({
      id: p.id, nombre: p.nombre, email: authRes.email,
      cargo: p.cargo || '', rol: p.rol, tipo_usuario: p.tipo_usuario,
      agencia_id: p.agencia_id || null, activo: p.activo !== false, agencias: [],
    });
  } catch(e) { console.error('❌ POST /usuarios:', e.message); res.status(500).json({ error: e.message }); }
});

// PATCH /usuarios/:id — editar perfil (nombre, cargo, rol, agencia_id, activo)
app.patch('/usuarios/:id', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const objetivo = await verificarMismaEmpresa(req.params.id, req.empresaId);
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado en esta empresa' });

    const { nombre, cargo, rol, agencia_id, activo } = req.body || {};

    const ROLES_VALIDOS = ['admin_cliente', 'encargado', 'coordinador'];
    if (rol !== undefined && !ROLES_VALIDOS.includes(rol))
      return res.status(400).json({ error: `Rol inválido. Permitidos: ${ROLES_VALIDOS.join(', ')}` });

    // Bloquear cambio de rol propio
    if (rol !== undefined && req.params.id === req.userId)
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });

    // Guardia último administrador: bloquear desactivación o degradación de rol si es el único admin activo
    const esAdminObjetivo = objetivo.rol === 'admin_cliente';
    const seDesactiva = activo !== undefined && !activo && objetivo.activo !== false;
    const seDegrada   = rol !== undefined && rol !== 'admin_cliente' && esAdminObjetivo;
    if (esAdminObjetivo && (seDesactiva || seDegrada)) {
      const admins = await sbFetch(
        `/usuarios_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&rol=eq.admin_cliente&activo=eq.true&select=id`
      ) || [];
      if (admins.length <= 1)
        return res.status(400).json({ error: 'No puedes dejar la empresa sin un administrador activo' });
    }

    const patch = {};
    if (nombre     !== undefined) patch.nombre    = nombre;
    if (cargo      !== undefined) patch.cargo     = cargo;
    if (rol        !== undefined) patch.rol       = rol;
    if (agencia_id !== undefined) patch.agencia_id = agencia_id || null;
    if (activo     !== undefined) patch.activo    = activo;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    const result = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', patch);
    if (result === null) return res.status(500).json({ error: 'Error actualizando usuario' });

    const rows = await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    const p = rows[0] || { ...objetivo, ...patch };
    res.json({ id: p.id, nombre: p.nombre, cargo: p.cargo || '', rol: p.rol, agencia_id: p.agencia_id || null, activo: p.activo !== false });
  } catch(e) { console.error('❌ PATCH /usuarios/:id:', e.message); res.status(500).json({ error: e.message }); }
});

// PUT /usuarios/:id/agencias — reemplazar lista completa de agencias asignadas
app.put('/usuarios/:id/agencias', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const objetivo = await verificarMismaEmpresa(req.params.id, req.empresaId);
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado en esta empresa' });

    const { agencia_ids } = req.body || {};
    if (!Array.isArray(agencia_ids)) return res.status(400).json({ error: 'agencia_ids debe ser un array' });

    // Verificar que todas las agencias pertenecen a esta empresa
    if (agencia_ids.length > 0) {
      const ids = agencia_ids.map(encodeURIComponent).join(',');
      const validas = await sbFetch(`/agencias_cliente?id=in.(${ids})&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&select=id`) || [];
      if (validas.length !== agencia_ids.length) return res.status(400).json({ error: 'Una o más agencias no pertenecen a esta empresa' });
    }

    await sbFetch(`/usuario_agencias?usuario_id=eq.${encodeURIComponent(req.params.id)}`, 'DELETE');

    if (agencia_ids.length > 0) {
      const rows = agencia_ids.map(agencia_id => ({ usuario_id: req.params.id, agencia_id }));
      await sbFetch('/usuario_agencias', 'POST', rows);
    }

    res.json({ ok: true, usuario_id: req.params.id, agencia_ids });
  } catch(e) { console.error('❌ PUT /usuarios/:id/agencias:', e.message); res.status(500).json({ error: e.message }); }
});

// DELETE /usuarios/:id — soft delete (activo = false)
app.delete('/usuarios/:id', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const objetivo = await verificarMismaEmpresa(req.params.id, req.empresaId);
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado en esta empresa' });
    if (req.params.id === req.userId) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });

    // Guardia último administrador
    if (objetivo.rol === 'admin_cliente' && objetivo.activo !== false) {
      const admins = await sbFetch(
        `/usuarios_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&rol=eq.admin_cliente&activo=eq.true&select=id`
      ) || [];
      if (admins.length <= 1)
        return res.status(400).json({ error: 'No puedes dejar la empresa sin un administrador activo' });
    }

    await sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', { activo: false });
    res.json({ ok: true });
  } catch(e) { console.error('❌ DELETE /usuarios/:id:', e.message); res.status(500).json({ error: e.message }); }
});

// ─── GESTIÓN DE AGENCIAS (admin_cliente only) ────────────

// GET /agencias — lista agencias de la empresa con contador de usuarios
app.get('/agencias', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const rows = await sbFetch(
      `/agencias_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=nombre.asc`
    ) || [];

    const ids = rows.map(a => encodeURIComponent(a.id)).join(',');
    let asignaciones = [];
    if (ids.length) {
      asignaciones = await sbFetch(
        `/usuario_agencias?agencia_id=in.(${ids})&select=agencia_id`
      ).catch(() => []) || [];
    }

    const conteoMap = {};
    for (const a of asignaciones) {
      conteoMap[a.agencia_id] = (conteoMap[a.agencia_id] || 0) + 1;
    }

    res.json(rows.map(a => ({
      id:           a.id,
      empresa_id:   a.empresa_cliente_id,
      nombre:       a.nombre      || '',
      ciudad:       a.ciudad      || '',
      activa:       a.activa      !== false,
      creado_en:    a.creado_en   || null,
      total_usuarios: conteoMap[a.id] || 0,
    })));
  } catch(e) {
    console.error('❌ GET /agencias:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /agencias — crear nueva agencia
app.post('/agencias', requireClienteAuth, requireAdminCliente, async (req, res) => {
  const { nombre, ciudad } = req.body || {};
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const created = await sbFetch('/agencias_cliente', 'POST', {
      empresa_cliente_id: req.empresaId,
      nombre:             nombre.trim(),
      ciudad:             ciudad ? ciudad.trim() : null,
      activa:             true,
      creado_en:          new Date().toISOString(),
    });
    if (!created) return res.status(500).json({ error: 'Error creando agencia' });
    const a = Array.isArray(created) ? created[0] : created;
    res.status(201).json({
      id:         a.id,
      empresa_id: a.empresa_cliente_id,
      nombre:     a.nombre     || '',
      ciudad:     a.ciudad     || '',
      activa:     a.activa     !== false,
      creado_en:  a.creado_en  || null,
      total_usuarios: 0,
    });
  } catch(e) {
    console.error('❌ POST /agencias:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /agencias/:id — editar nombre y/o ciudad
app.patch('/agencias/:id', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const agencias = await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&limit=1`
    ) || [];
    if (!agencias.length) return res.status(404).json({ error: 'Agencia no encontrada en esta empresa' });

    const { nombre, ciudad, activa } = req.body || {};
    const patch = {};
    if (nombre !== undefined) patch.nombre = nombre.trim();
    if (ciudad !== undefined) patch.ciudad = ciudad ? ciudad.trim() : null;
    if (activa !== undefined) patch.activa = Boolean(activa);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    const result = await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}`,
      'PATCH', patch
    );
    if (result === null) return res.status(500).json({ error: 'Error actualizando agencia' });

    const rows = await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}&limit=1`
    ) || [];
    const a = rows[0] || { ...agencias[0], ...patch };
    res.json({
      id:         a.id,
      empresa_id: a.empresa_cliente_id,
      nombre:     a.nombre    || '',
      ciudad:     a.ciudad    || '',
      activa:     a.activa    !== false,
      creado_en:  a.creado_en || null,
    });
  } catch(e) {
    console.error('❌ PATCH /agencias/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /agencias/:id — soft delete (activa = false)
app.delete('/agencias/:id', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const agencias = await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&limit=1`
    ) || [];
    if (!agencias.length) return res.status(404).json({ error: 'Agencia no encontrada en esta empresa' });
    if (agencias[0].activa === false) return res.status(400).json({ error: 'La agencia ya está inactiva' });

    await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}`,
      'PATCH', { activa: false }
    );
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /agencias/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /agencias/:id/usuarios — usuarios asignados a una agencia
app.get('/agencias/:id/usuarios', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const agencias = await sbFetch(
      `/agencias_cliente?id=eq.${encodeURIComponent(req.params.id)}&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&limit=1`
    ) || [];
    if (!agencias.length) return res.status(404).json({ error: 'Agencia no encontrada en esta empresa' });

    const asignaciones = await sbFetch(
      `/usuario_agencias?agencia_id=eq.${encodeURIComponent(req.params.id)}&select=usuario_id`
    ) || [];

    if (!asignaciones.length) return res.json([]);

    const uids = asignaciones.map(a => encodeURIComponent(a.usuario_id)).join(',');
    const perfiles = await sbFetch(
      `/usuarios_cliente?id=in.(${uids})&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=nombre.asc`
    ) || [];

    const authData = await sbAuthAdmin('/admin/users?per_page=1000').catch(() => null);
    const emailMap = {};
    ((authData || {}).users || []).forEach(u => { emailMap[u.id] = u.email || ''; });

    res.json(perfiles.map(p => ({
      id:           p.id,
      nombre:       p.nombre       || '',
      email:        emailMap[p.id] || '',
      cargo:        p.cargo        || '',
      rol:          p.rol          || 'encargado',
      activo:       p.activo       !== false,
    })));
  } catch(e) {
    console.error('❌ GET /agencias/:id/usuarios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── EMPRESA CONFIG (admin_cliente only) ──────────────────

// GET /empresa/config
app.get('/empresa/config', requireClienteAuth, requireAdminCliente, async (req, res) => {
  try {
    const rows = await sbFetch(
      `/empresas_cliente?id=eq.${encodeURIComponent(req.empresaId)}&limit=1`
    ) || [];
    if (!rows.length) return res.status(404).json({ error: 'Empresa no encontrada' });
    const e = rows[0];
    res.json({
      id:              e.id,
      razon_social:    e.razon_social    || '',
      nit:             e.nit             || '',
      nombre_controlt: e.nombre_controlt || '',
      activa:          e.activa          !== false,
      creado_en:       e.created_at      || null,
    });
  } catch(e) {
    console.error('❌ GET /empresa/config:', e.message);
    res.status(500).json({ error: e.message });
  }
});


// ─── SERVICIOS ───────────────────────────────────────────
app.get('/servicios', requireClienteAuth, async (req, res) => {
  try {
    const { estado, tipoOperacion, tipoVehiculo, agenciaIds, busqueda, desde, hasta } = req.query;
    let qs = `/solicitudes?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&order=creado_en.desc&limit=200`;
    if (estado)        qs += `&estado=eq.${encodeURIComponent(estado === 'aprobado' ? 'confirmado' : estado)}`;
    if (tipoOperacion) qs += `&tipo_operacion=eq.${encodeURIComponent(tipoOperacion)}`;
    if (tipoVehiculo)  qs += `&tipo_vehiculo=in.(${String(tipoVehiculo).split(',').map(encodeURIComponent).join(',')})`;
    if (agenciaIds)    qs += `&agencia_id=in.(${String(agenciaIds).split(',').map(encodeURIComponent).join(',')})`;
    if (desde)         qs += `&fecha_requerida=gte.${encodeURIComponent(desde)}`;
    if (hasta)         qs += `&fecha_requerida=lte.${encodeURIComponent(hasta + 'T23:59:59Z')}`;

    let solicitudes = await sbFetch(qs) || [];

    if (busqueda) {
      const q = busqueda.toLowerCase();
      solicitudes = solicitudes.filter(s =>
        [s.codigo_solicitud, s.origen, s.destino, s.manifiesto, s.external_ref]
          .some(v => v && String(v).toLowerCase().includes(q))
      );
    }

    const tripIds = [...new Set(solicitudes.filter(s => s.controlt_trip_number).map(s => s.controlt_trip_number))];

    // cache.viajes = viajes activos en ControlT (fuente de verdad para datos en tiempo real)
    const viajeMap = {};
    for (const v of cache.viajes.data) {
      if (v.trip_number) viajeMap[String(v.trip_number)] = v;
    }

    // cumplidos = fallback para viajes ya finalizados (no están en cache.viajes)
    const cumplMap = {};
    const tripIdsFinalizados = tripIds.filter(id => !viajeMap[String(id)]);
    if (tripIdsFinalizados.length) {
      const cs = await sbFetch(`/cumplidos?id=in.(${tripIdsFinalizados.map(encodeURIComponent).join(',')})&select=id,placa,conductor,conductor_tel,fecha_viaje,fecha_finalizacion`) || [];
      cs.forEach(c => { cumplMap[c.id] = c; });
    }

    res.json(solicitudes.map(s => {
      const tripNum = s.controlt_trip_number ? String(s.controlt_trip_number) : null;
      const viaje   = tripNum ? viajeMap[tripNum]  || null : null;
      const cumplido = tripNum ? cumplMap[tripNum] || null : null;
      return mapSolicitud(s, viaje, cumplido);
    }));
  } catch(e) {
    console.error('❌ GET /servicios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /servicios/:id
app.get('/servicios/:id', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    let viaje   = null;
    let cumplido = null;
    if (sol.controlt_trip_number) {
      const tripNum = String(sol.controlt_trip_number);
      // Buscar primero en viajes activos
      viaje = cache.viajes.data.find(v => String(v.trip_number) === tripNum) || null;
      // Si no está activo, buscar en histórico cumplidos
      if (!viaje) {
        const cs = await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(tripNum)}&select=id,placa,conductor,conductor_tel,fecha_viaje,fecha_finalizacion&limit=1`) || [];
        cumplido = cs[0] || null;
      }
    }
    res.json(mapSolicitud(sol, viaje, cumplido));
  } catch(e) {
    console.error('❌ GET /servicios/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /servicios/:id/paradas
app.get('/servicios/:id/paradas', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&select=id,empresa_cliente_id,origen,destino,estado&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });

    const estadoOrigen = sol.estado === 'completado' ? 'entregado'
      : sol.estado === 'en_ruta' ? 'en_camino' : 'pendiente';

    const estadoDestino = sol.estado === 'completado' ? 'entregado' : 'pendiente';

    res.json([
      {
        id: `${sol.id}-origen`,
        solicitud_id: sol.id,
        orden: 1,
        nombre: 'ORIGEN',
        direccion: sol.origen || '',
        tipo: 'origen',
        estado: estadoOrigen,
        hora_entrega: null,
        tiene_evidencia: false,
        lat: null, lng: null,
      },
      {
        id: `${sol.id}-destino`,
        solicitud_id: sol.id,
        orden: 99,
        nombre: 'DESTINO',
        direccion: sol.destino || '',
        tipo: 'destino',
        estado: estadoDestino,
        hora_entrega: null,
        tiene_evidencia: false,
        lat: null, lng: null,
      },
    ]);
  } catch(e) {
    console.error('❌ GET /servicios/:id/paradas:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /servicios/:id/vehiculo
app.get('/servicios/:id/vehiculo', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&select=controlt_trip_number&limit=1`) || [];
    const tripNum = sols[0]?.controlt_trip_number;
    if (!tripNum) return res.status(404).json({ error: 'Sin vehículo asignado' });
    const viaje = cache.viajes.data.find(v => String(v.trip_number) === String(tripNum));
    if (!viaje?.lat || !viaje?.lng) return res.status(404).json({ error: 'Sin posición GPS' });
    res.json({
      lat: parseFloat(viaje.lat), lng: parseFloat(viaje.lng),
      placa: viaje.license_plate || '',
      ultima_actualizacion: viaje.latest_gps_report || new Date().toISOString(),
    });
  } catch(e) {
    console.error('❌ GET /servicios/:id/vehiculo:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /servicios
app.post('/servicios', requireClienteAuth, async (req, res) => {
  try {
    const { tipo_vehiculo, tipo_operacion, origen, destino, fecha_requerida,
            observaciones, agencia_id, agencia_nombre, external_ref } = req.body || {};
    if (!fecha_requerida) return res.status(400).json({ error: 'fecha_requerida requerido' });

    const last = await sbFetch('/solicitudes?select=codigo_solicitud&order=creado_en.desc&limit=1') || [];
    const lastCode = last[0]?.codigo_solicitud;
    const n = lastCode?.startsWith('SOL-') ? parseInt(lastCode.slice(4), 10) : 0;
    const codigo_solicitud = 'SOL-' + String((isNaN(n) ? 0 : n) + 1).padStart(5, '0');

    const row = {
      codigo_solicitud,
      empresa_cliente_id: req.empresaId,
      creado_por:         req.userId,
      tipo_vehiculo:      tipo_vehiculo  || null,
      tipo_operacion:     tipo_operacion || null,
      origen:             origen         || null,
      destino:            destino        || null,
      agencia_id:         agencia_id     || null,
      agencia_nombre:     agencia_nombre || null,
      external_ref:       external_ref   || null,
      fecha_requerida,
      observacion_coordinadora: observaciones || null,
      estado:    'pendiente',
      creado_en: new Date().toISOString(),
    };

    const created = await sbFetch('/solicitudes', 'POST', row);
    if (!created) return res.status(500).json({ error: 'Error creando solicitud' });
    const sol = Array.isArray(created) ? created[0] : created;
    res.status(201).json(mapSolicitud(sol || row));
  } catch(e) {
    console.error('❌ POST /servicios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /servicios/:id
app.patch('/servicios/:id', requireClienteAuth, async (req, res) => {
  try {
    console.log(`🔧 PATCH /servicios/${req.params.id} — body keys: ${Object.keys(req.body || {}).join(', ')}`);
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    console.log(`🔧 sol encontrado: estado=${sol.estado} empresa=${sol.empresa_cliente_id} req.empresa=${req.empresaId}`);
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    if (sol.estado !== 'pendiente') return res.status(400).json({ error: `No editable en estado: ${sol.estado}` });

    const { fecha_requerida, observaciones, origen, destino, tipo_vehiculo, tipo_operacion, external_ref } = req.body || {};
    const patch = {};
    if (fecha_requerida) patch.fecha_requerida          = fecha_requerida;
    if (observaciones)   patch.observacion_coordinadora = observaciones;
    if (origen)          patch.origen                   = origen;
    if (destino)         patch.destino                  = destino;
    if (tipo_vehiculo)   patch.tipo_vehiculo             = tipo_vehiculo;
    if (tipo_operacion)  patch.tipo_operacion            = tipo_operacion;
    if (external_ref !== undefined) patch.external_ref  = external_ref || null;

    console.log(`🔧 patch a aplicar: ${JSON.stringify(patch)}`);
    if (Object.keys(patch).length === 0) {
      return res.json(mapSolicitud(sol));
    }
    const result = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', patch);
    console.log(`🔧 resultado Supabase: ${JSON.stringify(result)}`);
    if (result === null) {
      console.error(`❌ PATCH /servicios/${req.params.id}: Supabase rechazó el update`);
      return res.status(500).json({ error: 'No se pudo guardar en la base de datos' });
    }
    const actualizado = Array.isArray(result) ? result[0] : result;
    res.json(mapSolicitud(actualizado || { ...sol, ...patch }));
  } catch(e) {
    console.error('❌ PATCH /servicios/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /servicios/:id/cancelar
app.post('/servicios/:id/cancelar', requireClienteAuth, async (req, res) => {
  try {
    const sols = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}&limit=1`) || [];
    if (!sols.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    const sol = sols[0];
    if (sol.empresa_cliente_id !== req.empresaId) return res.status(403).json({ error: 'Acceso denegado' });
    if (!['pendiente', 'confirmado'].includes(sol.estado))
      return res.status(400).json({ error: `No cancelable en estado: ${sol.estado}` });
    const fecha_cancelacion = new Date().toISOString();
    await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', { estado: 'cancelado', fecha_cancelacion });
    res.json(mapSolicitud({ ...sol, estado: 'cancelado', fecha_cancelacion }));
  } catch(e) {
    console.error('❌ POST /servicios/:id/cancelar:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /notificaciones
app.get('/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    const notifs = await sbFetch(
      `/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}&order=creado_en.desc&limit=100`
    ) || [];
    const solIds = [...new Set(notifs.filter(n => n.solicitud_id).map(n => n.solicitud_id))];
    const solMap = {};
    if (solIds.length) {
      const sols = await sbFetch(`/solicitudes?id=in.(${solIds.map(encodeURIComponent).join(',')})&select=id,codigo_solicitud`) || [];
      sols.forEach(s => { solMap[s.id] = s.codigo_solicitud; });
    }
    res.json(notifs.map(n => ({
      id:               n.id,
      servicio_id:      n.solicitud_id || null,
      codigo_solicitud: solMap[n.solicitud_id] || null,
      tipo:             n.tipo === 'confirmacion' ? 'estado' : (n.tipo || 'info'),
      titulo:           n.titulo,
      mensaje:          n.mensaje,
      fecha:            n.creado_en,
      leida:            n.leida || false,
    })));
  } catch(e) {
    console.error('❌ GET /notificaciones:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /notificaciones/:id/leer
app.patch('/notificaciones/:id/leer', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(
      `/notificaciones_cliente?id=eq.${encodeURIComponent(req.params.id)}&usuario_id=eq.${encodeURIComponent(req.userId)}`,
      'PATCH', { leida: true, leida_en: new Date().toISOString() }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /notificaciones/marcar-todas-leidas
app.post('/notificaciones/marcar-todas-leidas', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(
      `/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}&leida=eq.false`,
      'PATCH', { leida: true, leida_en: new Date().toISOString() }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /notificaciones
app.delete('/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    await sbFetch(`/notificaciones_cliente?usuario_id=eq.${encodeURIComponent(req.userId)}`, 'DELETE');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /catalogos/agencias
app.get('/catalogos/agencias', requireClienteAuth, async (req, res) => {
  try {
    const rows = await sbFetch(`/agencias_cliente?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&activa=eq.true&order=nombre.asc`) || [];
    res.json(rows.map(a => ({ id: a.id, empresa_id: a.empresa_cliente_id, nombre: a.nombre, ciudad: a.ciudad || '' })));
  } catch(e) { res.json([]); }
});

// GET /catalogos/vehiculos
app.get('/catalogos/vehiculos', (req, res) => {
  res.json(['NHR', 'TURBO', 'NPR', 'NQR', 'MINIMULA', 'TURBO PLATÓN']);
});

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
