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
  'en transíto':  1,
  'en tránsito':  1,
  'en transito':  1,
  'cargando':     2,
  'descargando':  3,
  'iniciado':     4,
  'pernoctando':  5,
  'sin activar':  6,
  'sin asignar':  7,
  'completado':   8,
  'finalizado':   9,
  'cancelado':   10,
};

function getPrioridad(state_travel) {
  const s = (state_travel || '').toLowerCase().trim();
  for (const [key, prio] of Object.entries(ESTADO_PRIORIDAD)) {
    if (s.includes(key)) return prio;
  }
  return 5; // default medio
}

function sortViajes(data) {
  return data.sort((a, b) => {
    const pA = getPrioridad(a.state_travel);
    const pB = getPrioridad(b.state_travel);

    // 1. Primero por prioridad de estado
    if (pA !== pB) return pA - pB;

    // 2. Dentro del mismo estado, más reciente primero (GPS)
    const dateA = new Date(a.latest_gps_report || 0);
    const dateB = new Date(b.latest_gps_report || 0);
    return dateB - dateA;
  });
}

async function proxyGet(path, res, transform) {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const text = await response.text();

    if (transform) {
      try {
        const data = JSON.parse(text);
        const result = transform(data);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(result));
        return;
      } catch(e) {
        console.error("Error transformando datos:", e.message);
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (err) {
    console.error(`ERROR ${path}:`, err);
    res.status(500).json({ error: "Fallo proxy Railway", detail: err.message });
  }
}

// ─── ENDPOINTS ──────────────────────────────────────────

// Viajes activos — ordenados por prioridad operacional
app.get("/api/data", (req, res) => {
  proxyGet("/Resume", res, (data) => {
    if (!Array.isArray(data)) return data;

    const sorted = sortViajes(data);

    // Log para debug en Railway Logs
    console.log(`📦 ${sorted.length} viajes | Estados: ${
      sorted.map(v => v.state_travel).join(', ')
    }`);

    return sorted;
  });
});

// Alarmas históricas
app.get("/api/alarmas", (req, res) => proxyGet("/Alarm", res));

// Viajes pendientes de monitorear
app.get("/api/pendientes", (req, res) => proxyGet("/Travel/search", res));

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
  console.log("📊 Lógica: En Tránsito > Cargando > Descargando > Iniciado > Pernoctando > Completado");
  try { await refreshToken(); }
  catch(e) { console.error("❌ Login inicial fallido:", e.message); }
});
