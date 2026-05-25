import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const LOGIN_URL = "https://integrations.controlt.io/Auth/login";
const BASE_URL  = "https://app.controlt.com.co/apipublic/api";
const TOKEN_TTL = 20 * 60 * 60 * 1000;
const CACHE_TTL = 60 * 1000; // 60 segundos — ControlT se consulta máximo 1 vez por minuto

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

setInterval(async () => {
  try { await refreshToken(); }
  catch(e) { console.error("❌ Error renovando token:", e.message); }
}, TOKEN_TTL);

// ─── FETCH SEGURO ───────────────────────────────────────
async function safeFetch(path, fallback = []) {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data && data.Message && data.Message.toLowerCase().includes('denied')) {
      console.warn(`⚠️  ${path} bloqueado por permisos`);
      return fallback;
    }
    return data;
  } catch(e) {
    console.warn(`⚠️  ${path} respuesta no-JSON`);
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
    // Travel/search necesita parámetros — buscar viajes de hoy hasta 7 días adelante
    const ahora   = new Date();
    const en7dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Formato DD/MM/YYYY para ControlT
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const desde = fmt(ahora);
    const hasta  = fmt(en7dias);

    // Probar con parámetros de fecha
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
      // Fallback: intentar sin parámetros de fecha pero con size grande
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
async function syncViajes() {
  try {
    // Página 1 — viajes activos principales
    const data1 = await safeFetch("/Resume?size=100&page=1", null);
    if (!data1) return;
    const arr1 = Array.isArray(data1) ? data1 : data1.data || data1.result || [];
    if (arr1.length === 0) {
      console.warn("⚠️  Resume devolvió 0 viajes — manteniendo caché anterior");
      return;
    }

    let todos = [...arr1];

    // Si la página 1 llegó llena (100 registros) puede haber más — traer página 2
    if (arr1.length >= 100) {
      try {
        const data2 = await safeFetch("/Resume?size=100&page=2", null);
        const arr2 = Array.isArray(data2) ? data2 : (data2?.data || data2?.result || []);
        if (arr2.length > 0) {
          todos = [...todos, ...arr2];
          console.log(`📄 Página 2 cargada: ${arr2.length} viajes adicionales`);

          // Si página 2 también llena, traer página 3
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

    // Deduplicar por trip_number
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

// Viajes activos
app.get("/api/data", (req, res) => {
  res.json(cache.viajes.data);
});

// Alarmas
app.get("/api/alarmas", (req, res) => {
  res.json(cache.alarmas.data);
});

// Pendientes — Travel/search: incluye pasado (3 días) y futuro (7 días)
app.get("/api/pendientes", async (req, res) => {
  try {
    // Usar caché si está vigente (5 min), si no refrescar
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
      // Si ya está activo en Resume → no mostrar
      if (activeIds.has(v.trip_number)) return false;
      const fecha = parseSchedulate(v.schedulate_origin);
      // Sin fecha parseable → incluir igual (no descartar por falta de dato)
      if (!fecha || isNaN(fecha.getTime())) return true;
      // Mostrar desde ayer hasta 7 días adelante
      // (ayer por si hay viajes programados de hoy temprano que aún no se activaron)
      return fecha >= hace1dia && fecha <= en7dias;
    });

    filtrados.sort((a, b) => {
      const dA = parseSchedulate(a.schedulate_origin) || new Date(0);
      const dB = parseSchedulate(b.schedulate_origin) || new Date(0);
      return dA - dB;
    });

    console.log(`⏳ Cache pendientes: ${arr.length} total, activeIds: ${activeIds.size}`);
    if(arr.length > 0){
      console.log(`⏳ Muestra schedulate_origin:`, arr.slice(0,3).map(v=>`${v.trip_number}=${v.schedulate_origin}`).join(' | '));
    }
    console.log(`⏳ Resultado filtrado: ${filtrados.length} futuros pendientes`);
    res.json(filtrados);
  } catch(err) {
    console.warn("⚠️  /api/pendientes error:", err.message);
    res.json([]);
  }
});

// Health check con info del caché
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
  } catch(e) {
    console.error("❌ Error inicialización:", e.message);
  }

  setInterval(syncViajes,    60 * 1000);
  setInterval(syncAlarmas,   70 * 1000);
  setInterval(syncPendientes, 5 * 60 * 1000); // cada 5 minutos
});
