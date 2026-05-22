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

async function proxyGet(path, res) {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (err) {
    console.error(`ERROR ${path}:`, err);
    res.status(500).json({ error: "Fallo proxy Railway", detail: err.message });
  }
}

// Viajes activos (Resume)
app.get("/api/data", (req, res) => proxyGet("/Resume", res));

// Alarmas históricas
app.get("/api/alarmas", (req, res) => proxyGet("/Alarm", res));

// Viajes pendientes de monitorear
app.get("/api/pendientes", (req, res) => proxyGet("/Travel/search", res));

app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 Servidor INLOP Torre de Control iniciado");
  try { await refreshToken(); }
  catch(e) { console.error("❌ Login inicial fallido:", e.message); }
});
