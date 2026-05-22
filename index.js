import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const LOGIN_URL = "https://integrations.controlt.io/Auth/login";
const BASE_URL  = "https://app.controlt.com.co/apipublic/api";
const TOKEN_TTL = 20 * 60 * 60 * 1000;

let currentToken = null;
let lastLogin    = null;

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

// ─── PRIORIDAD OPERACIONAL POR ESTADO ───────────────────
const ESTADO_PRIORIDAD = {
  'en transíto': 1,
  'en tránsito': 1,
  'en transito': 1,
  'cargando':    2,
  'descargando': 3,
  'iniciado':    4,
  'pernoctando': 5,
  'sin activar': 6,
  'sin asignar': 7,
  'completado':  8,
  'finalizado':  9,
  'cancelado':  10,
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

// ─── HELPER — fetch seguro que siempre devuelve JSON válido ─
async function safeFetch(path, fallback = []) {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    // Si ControlT devuelve { Message: "Authorization has been denied..." }
    if (data && data.Message && data.Message.toLowerCase().includes('denied')) {
      console.warn(`⚠️  ${path} bloqueado por permisos — devolviendo fallback`);
      return fallback;
    }
    return data;
  } catch(e) {
    console.warn(`⚠️  ${path} devolvió respuesta no-JSON — devolviendo fallback`);
    return fallback;
  }
}

// ─── ENDPOINTS ──────────────────────────────────────────

// Viajes activos — ordenados por prioridad operacional
app.get("/api/data", async (req, res) => {
  try {
    const data = await safeFetch("/Resume", []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    const sorted = sortViajes(arr);
    console.log(`📦 ${sorted.length} viajes | ${sorted.map(v => v.state_travel).join(', ')}`);
    res.json(sorted);
  } catch(err) {
    console.error("ERROR /api/data:", err.message);
    res.status(500).json({ error: "Fallo proxy Railway", detail: err.message });
  }
});

// Alarmas históricas
app.get("/api/alarmas", async (req, res) => {
  try {
    const data = await safeFetch("/Alarm", []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    res.json(arr);
  } catch(err) {
    console.error("ERROR /api/alarmas:", err.message);
    res.json([]);
  }
});

// Viajes pendientes — filtrados por últimos 3 días, silencioso si está bloqueado
app.get("/api/pendientes", async (req, res) => {
  try {
    const data = await safeFetch("/Travel/search", []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];

    // created_on viene como MM/DD/YYYY HH:MM:SS — parseo correcto
    function parseCreatedOn(str) {
      if (!str) return null;
      // Formato MM/DD/YYYY HH:MM:SS
      const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, mm, dd, yyyy, hh, min, ss] = match;
        return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss}`);
      }
      return new Date(str); // fallback
    }

    const ahora = new Date();
    const hace3Dias = new Date(ahora.getTime() - (3 * 24 * 60 * 60 * 1000));

    const filtrados = arr.filter(v => {
      const fecha = parseCreatedOn(v.created_on);
      if (!fecha || isNaN(fecha.getTime())) return true; // si no parsea, incluir
      return fecha >= hace3Dias;
    });

    // Ordenar por created_on más reciente primero
    filtrados.sort((a, b) => {
      const dA = parseCreatedOn(a.created_on) || new Date(0);
      const dB = parseCreatedOn(b.created_on) || new Date(0);
      return dB - dA;
    });

    console.log(`⏳ Pendientes: ${arr.length} total → ${filtrados.length} en últimos 3 días`);
    res.json(filtrados);
  } catch(err) {
    console.warn("⚠️  /api/pendientes no disponible:", err.message);
    res.json([]);
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    tokenActivo: !!currentToken,
    ultimoLogin: lastLogin ? new Date(lastLogin).toISOString() : null
  });
});

app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 INLOP Torre de Control — Servidor iniciado");
  console.log("📊 Prioridad: En Tránsito > Cargando > Descargando > Iniciado > Pernoctando > Completado");
  try { await refreshToken(); }
  catch(e) { console.error("❌ Login inicial fallido:", e.message); }
});
