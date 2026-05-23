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
  viajes:   { data: [], ts: 0 },
  alarmas:  { data: [], ts: 0 },
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

// ─── SYNC PROACTIVO — llama a ControlT cada 60s en background ─
async function syncViajes() {
  try {
    const data = await safeFetch("/Resume?size=100&page=1", null);
    if (!data) return; // respuesta inválida — mantener caché anterior
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    if (arr.length === 0) {
      console.warn("⚠️  Resume devolvió 0 viajes — manteniendo caché anterior");
      return;
    }
    cache.viajes.data = sortViajes(arr);
    cache.viajes.ts   = Date.now();
    console.log(`📦 Caché actualizado: ${arr.length} viajes | ${arr.map(v => v.state_travel).join(', ')}`);
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

// Pendientes — filtrado del caché de viajes
app.get("/api/pendientes", (req, res) => {
  const pendientes = cache.viajes.data.filter(v => {
    const estado = (v.state_travel || '').toLowerCase().trim();
    return estado.includes('sin activar') || estado.includes('sin asignar');
  }).sort((a, b) => parseCreated(b.created_on) - parseCreated(a.created_on));
  res.json(pendientes);
});

// Health check con info del caché
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    tokenActivo: !!currentToken,
    ultimoLogin: lastLogin ? new Date(lastLogin).toISOString() : null,
    cache: {
      viajes:  { cantidad: cache.viajes.data.length,  edad_seg: Math.round((Date.now() - cache.viajes.ts) / 1000) },
      alarmas: { cantidad: cache.alarmas.data.length, edad_seg: Math.round((Date.now() - cache.alarmas.ts) / 1000) }
    }
  });
});

// ─── INICIO ─────────────────────────────────────────────
app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 INLOP Torre de Control — Servidor iniciado");
  console.log("📊 Modo caché: ControlT se consulta 1 vez/minuto en background");

  try {
    await refreshToken();
    // Primer sync al arrancar
    await syncViajes();
    await syncAlarmas();
  } catch(e) {
    console.error("❌ Error inicialización:", e.message);
  }

  // Sync en background cada 60 segundos — escalonado para no saturar
  setInterval(syncViajes,   60 * 1000);
  setInterval(syncAlarmas, 70 * 1000); // 10s después para no coincidir
});
