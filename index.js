import express from "express";
import fetch from "node-fetch";
import cors from "cors";


// ─── SUPABASE ───────────────────────────────────────
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
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));
app.get("/TorreControl.html", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));
