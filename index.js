import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { randomUUID } from "crypto";
import { publishBusinessEvent } from './services/notificationOrchestrator.js';
import { buildLookupMap, normalizeClient, resolveCustomer, resolveTrip, isPlaceholderTmsCustomer } from './services/customerResolver.js';
import { resolverScopeUsuario, construirFiltroScope, obtenerSolicitudEnScope } from './services/authScope.js';
import { getUserPreferences, updatePreference, KNOWN_CHANNELS } from './services/preferenceResolver.js';
import { normalizeExternalRef } from './services/normalizeExternalRef.js';
import { fechaHoyColombia, parseFechaTMS, extraerFechaColombia } from './utils/fechas.js';
import controltDiagRouter from './routes/controltDiag.js';
import crearRouterGpsSeguimiento from './routes/gpsSeguimiento.js';
import { getTripDetail, makeSbFetchAdapter } from './services/controlt-soap/tripService.js';
import {
  transformarViajesActivos, transformarCentroGps, listarClientesDataset,
} from './services/reportes/datasetProvider.js';
import { ejecutarReporteManual } from './services/reportes/envioManual.js';
import { ejecutarTickScheduler, calcularProgramacionAlGuardar } from './services/reportes/scheduler.js';
import { obtenerCatalogo } from './services/rbac/catalogo.js';
import { calcularPermisosEfectivos, invalidarUsuario } from './services/rbac/resolver.js';
import { requirePermiso } from './services/rbac/middleware.js';

// ─── TIMEOUT EN LLAMADAS SALIENTES (Hotfix RC v1.0) ────────────────────
// Ninguna llamada a ControlT ni a Supabase tenía timeout — una respuesta
// lenta o colgada de cualquiera de esos servicios podía acumular conexiones
// abiertas indefinidamente. Envoltorio mínimo sobre fetch con AbortController;
// no cambia la firma de uso (misma llamada fetch(url, opts)).
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

async function fetchConTimeout(url, opts = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Mapa de resolución de clientes — reconstruido cada 10 min desde empresas_cliente
let customerLookupMap = new Map();
// Lookup inverso: id → razon_social (para resolveTrip sin queries extra)
let customerLookupById = new Map();
// Cache de identidad por viaje: trip_number → { empresa_cliente_id, razon_social }
// Alimentado por syncCumplidos. El endpoint /api/gps lo usa para mostrar razon_social.
let tripCustomerCache = new Map();


// ─── SUPABASE ───────────────────────────────────────────
// Decisión de arquitectura (INLOP Event Engine, Fase 3): este backend es el
// único escritor confiable de `notificaciones_cliente` (job syncSolicitudes
// y demás mutaciones REST). Habilitar RLS por usuario/empresa en esa tabla
// (requerido para exponer Supabase Realtime directo al navegador sin fugas
// entre empresas) exige que estas escrituras corran con la SERVICE KEY, que
// Postgres/PostgREST evalúa sin aplicar RLS. La ANON KEY (pública, usada
// hasta ahora para todo) se evalúa como rol "anon" sin auth.uid(), y las
// políticas RLS por usuario la habrían rechazado silenciosamente.
//
// Reutiliza el mismo SUPABASE_SERVICE_KEY que ya declara la sección de
// Gestión de Usuarios (ver SB_SERVICE_KEY más abajo) — es la misma service
// role key del proyecto, un solo nombre de variable de entorno para ambos
// usos. Debe configurarse en las variables de entorno del servidor (Railway)
// y NUNCA exponerse al navegador. Mientras no esté configurada, se conserva
// el fallback a la anon key para no interrumpir el servicio — pero las
// políticas RLS de notificaciones_cliente bloquearán las escrituras del
// backend hasta que se configure.
const SB_URL = "https://gtyydandwcgoaratmnqh.supabase.co/rest/v1";
const SB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI";
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || SB_ANON_KEY;
const SB_AUTH_URL    = 'https://gtyydandwcgoaratmnqh.supabase.co/auth/v1';
const SB_STORAGE_URL = 'https://gtyydandwcgoaratmnqh.supabase.co/storage/v1';

// ─── ControlT SOAP — adaptador para tripService (Fase 5) ────────────────────
// tripService.js (única puerta de entrada certificada a ControlT — Fase 4.3)
// espera un sbFetch con contrato { data, error, status }, distinto del
// sbFetch() global de este archivo (que retorna datos directos, ver más
// abajo). makeSbFetchAdapter() reutiliza las mismas credenciales de Supabase
// ya definidas arriba. SB_URL incluye el sufijo /rest/v1 pero
// persistenceLayer.js ya antepone /rest/v1/cumplidos a cada ruta — se retira
// aquí para no duplicarlo.
const SB_ROOT_URL = SB_URL.replace(/\/rest\/v1$/, '');
const controltSbFetch = makeSbFetchAdapter(SB_ROOT_URL, SB_KEY);

// Helper para Supabase Storage (bucket cumplidos).
// body puede ser un Buffer (upload binario) u objeto JSON (list/sign/delete).
async function sbStorageFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  const headers = {
    'apikey':        SB_ANON_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    ...extraHeaders,
  };
  const opts = { method, headers };
  if (body !== null) {
    if (Buffer.isBuffer(body)) {
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const r = await fetchConTimeout(`${SB_STORAGE_URL}${path}`, opts, 30_000);
  if (!r.ok) {
    const txt = await r.text();
    console.error(`SB Storage ${method} ${path} → ${r.status}: ${txt}`);
    return null;
  }
  if (method === 'DELETE') return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn(
    "⚠️  SUPABASE_SERVICE_KEY no configurada. Usando fallback (anon key). " +
    "Las políticas RLS de notificaciones_cliente (Event Engine Fase 3) bloquearán las " +
    "escrituras de este backend hasta configurar la service key en las variables de entorno."
  );
}

// ─── AUTHENTICATION HOTFIX v1.0.1 — redirect_to propio del Portal Cliente ──
// Antes, POST /auth/recuperar llamaba a Supabase Auth (/recover) sin
// `redirect_to`, por lo que GoTrue usaba el "Site URL" del proyecto Supabase
// compartido (config. única a nivel de proyecto) — hoy apuntado al ERP. El
// enlace del correo de recuperación llevaba a los usuarios del Portal
// Cliente al ERP en producción. Con esta variable, el Portal Cliente envía
// su propio destino en cada solicitud, sin tocar el Site URL global ni crear
// un proyecto Supabase nuevo (Supabase permite un `redirect_to` distinto por
// llamada, siempre que esté en la lista blanca de "Redirect URLs" del
// proyecto — paso manual en el dashboard de Supabase, fuera de este código).
const CLIENT_PORTAL_URL = process.env.CLIENT_PORTAL_URL || "";
if (!CLIENT_PORTAL_URL) {
  console.warn(
    "⚠️  CLIENT_PORTAL_URL no configurada. Los correos de recuperación de " +
    "contraseña del Portal Cliente usarán el Site URL por defecto del " +
    "proyecto Supabase (compartido con otros productos INLOP) en vez del " +
    "propio — configura esta variable en Railway."
  );
}

// URL pública base de seguimiento-gps/ (Fase 10C) — usada por
// services/reportes/enlaceGps.js (Fase 10D) para armar el CTA "Ver
// seguimiento GPS" del correo de un reporte. Sin esta variable, el CTA
// simplemente no se agrega (log de advertencia en el momento de un envío
// con seguimiento_gps activo) — el resto del envío no se ve afectado. No
// tiene fallback de warning al arranque porque, a diferencia de
// CLIENT_PORTAL_URL, todavía no hay ningún reporte usando la función salvo
// que un usuario la active explícitamente.
const SEGUIMIENTO_GPS_URL = process.env.SEGUIMIENTO_GPS_URL || "";

const SB_HEADERS = {
  "apikey": SB_ANON_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=merge-duplicates,return=representation"
};

async function sbFetch(path, method="GET", body=null, extraHeaders=null) {
  // extraHeaders: override puntual por llamada (ej. Prefer: return=minimal en
  // un PATCH cuyo caller no usa la fila devuelta) — NUNCA cambia SB_HEADERS
  // global ni afecta llamadas que no pasen este 4º argumento (Sprint EGRESS-1).
  const headers = extraHeaders ? { ...SB_HEADERS, ...extraHeaders } : SB_HEADERS;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetchConTimeout(`${SB_URL}${path}`, opts);
  if (!r.ok) {
    const txt = await r.text();
    console.error(`Supabase ${method} ${path} → ${r.status}: ${txt}`);
    return null;
  }
  if (method === "DELETE") return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// ⚠️ DEPRECATED (Sprint 5.0 — Notification Orchestrator, ver merge 2026-07-19):
// enviarPush() ya no tiene ningún call site. syncSolicitudes despacha push
// vía publishBusinessEvent() → services/channels/pushChannel.js, que cubre
// exactamente el mismo envío (mismas suscripciones activas, mismo
// webpush.sendNotification, misma desactivación en 404/410) con idempotencia
// y estados de entrega además. Se conserva este bloque sin eliminar en este
// PR — pendiente de retiro en un PR de limpieza separado.
//
// ─── PUSH NOTIFICATIONS (INLOP Event Engine, Fase 4A — Sprint 4.4) ────
// Canal Push: reutiliza exactamente el mismo insertsNotif que ya escribe
// notificaciones_cliente (ver syncSolicitudes/_notifs más abajo) — no existe
// un flujo paralelo de generación de notificaciones para Push.
//
// Degradación segura (mismo patrón que SUPABASE_SERVICE_KEY arriba): sin
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY configuradas, enviarPush() es un no-op
// con un único warning — el backend sigue funcionando con Realtime como
// único canal de entrega.
import webpush from "web-push";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || "mailto:soporte@inlop.com.co";

const PUSH_CONFIGURADO = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (PUSH_CONFIGURADO) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn(
    "⚠️  VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas. Push deshabilitado " +
    "(generar con: npx web-push generate-vapid-keys) — el backend continúa " +
    "funcionando con normalidad; las notificaciones siguen entregándose por Realtime."
  );
}

// Envía push a todas las suscripciones activas de un usuario. Nunca lanza:
// un fallo de Push no debe interrumpir syncSolicitudes ni ninguna mutación
// de negocio que ya escribió su notificación en notificaciones_cliente.
async function enviarPush(usuarioId, payload) {
  if (!PUSH_CONFIGURADO || !usuarioId) return;
  try {
    const subs = await sbFetch(
      `/push_subscriptions?usuario_id=eq.${encodeURIComponent(usuarioId)}&activo=eq.true`
    ) || [];
    if (!subs.length) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        // 404/410 → endpoint expirado/revocado por el navegador: desactivar,
        // no borrar (trazabilidad, ver migración 0002_push_subscriptions.sql).
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sbFetch(`/push_subscriptions?id=eq.${encodeURIComponent(s.id)}`, "PATCH", { activo: false });
        } else {
          console.error(`❌ Push a ${s.endpoint}:`, err.message);
        }
      }
    }));
  } catch (e) {
    console.error("❌ enviarPush:", e.message);
  }
}

// ─── PROTECCIÓN DE ENDPOINTS INTERNOS (Hotfix RC v1.0) ─────────────────
// Los endpoints /api/* (Torre de Control / ERP interno) no tenían ningún
// control de acceso — cualquiera que conociera la URL podía leer y mutar
// datos operativos. Fix mínimo: exigir un secreto compartido por header,
// fail-closed (si INTERNAL_API_KEY no está configurada, estos endpoints
// quedan inaccesibles en vez de abiertos). No reemplaza una autenticación
// por usuario — es la protección mínima estable para esta hotfix; ver
// informe de riesgos pendientes sobre TorreControl.html.
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

if (!INTERNAL_API_KEY) {
  console.warn(
    "⚠️  INTERNAL_API_KEY no configurada. Los endpoints internos /api/* " +
    "quedan inaccesibles (fail-closed) hasta configurar esta variable."
  );
}

function requireInternalApiKey(req, res, next) {
  if (!INTERNAL_API_KEY) {
    return res.status(503).json({ error: "Servicio no disponible: INTERNAL_API_KEY no configurada" });
  }
  if (req.headers["x-internal-api-key"] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

// ─── ACCESO LEGADO — SOLUCIÓN TEMPORAL ─────────────────────────────────────
// DECISIÓN TÉCNICA (LEGACY-01): TorreControl.html continúa operando mientras
// avanza la migración al ERP. Para no comprometer la seguridad del ERP
// (requireInternalApiKey, INTERNAL_API_KEY), se introduce un token separado
// (LEGACY_TC_TOKEN) que solo aplica a los 5 endpoints que TorreControl.html
// necesita. requireInternalApiKey permanece intacto y aplicado al resto de la API.
//
// ELIMINAR cuando TorreControl.html sea dado de baja definitivamente.
// Endpoints autorizados: GET /api/data, GET /api/alarmas, GET /api/pendientes,
//   GET /api/solicitudes, PATCH /api/solicitudes/:id/estado
// Bootstrap: GET /legacy/tc-init (sin auth) retorna { token } para que el
// cliente lo obtenga en tiempo de ejecución sin hardcodear en el HTML.
const LEGACY_TC_TOKEN = process.env.LEGACY_TC_TOKEN || "";

if (!LEGACY_TC_TOKEN) {
  console.warn(
    "⚠️  LEGACY_TC_TOKEN no configurada. Los endpoints legados quedarán inaccesibles " +
    "para el cliente de torre de control hasta configurar esta variable en Railway."
  );
}

function requireLegacyOrInternal(req, res, next) {
  // Acceso ERP: header x-internal-api-key con INTERNAL_API_KEY
  if (INTERNAL_API_KEY && req.headers["x-internal-api-key"] === INTERNAL_API_KEY) {
    return next();
  }
  // Acceso legado: header x-legacy-token con LEGACY_TC_TOKEN
  if (LEGACY_TC_TOKEN && req.headers["x-legacy-token"] === LEGACY_TC_TOKEN) {
    return next();
  }
  // Fail-closed: si ninguna key está configurada, responder 503
  if (!INTERNAL_API_KEY && !LEGACY_TC_TOKEN) {
    return res.status(503).json({ error: "Servicio no disponible: credenciales no configuradas" });
  }
  return res.status(401).json({ error: "No autorizado" });
}

// ─── AUTENTICACIÓN ERP — JWT DE SUPABASE (Sprint 2A) ─────────────────────────
// Middleware que acepta DOS mecanismos de autenticación del ERP:
//   1. Authorization: Bearer <jwt>  → verificado contra Supabase Auth (identidad confiable)
//   2. X-Internal-Api-Key           → secreto compartido (backward-compat, SIN identidad)
//
// Cuando el JWT es válido, coloca en el request:
//   req.erpUserId    — UUID del usuario en Supabase Auth
//   req.erpUserEmail — email verificado del JWT (NO del header X-User-Email)
//
// Los endpoints que usaban req.headers["x-user-email"] como "actor" deben
// preferir req.erpUserEmail — es una identidad verificada, no auto-declarada.
//
// IMPORTANTE: Este middleware NO implementa RBAC. Solo resuelve identidad.
// El RBAC se implementará en un sprint posterior.
//
// Backward-compatible: si el ERP aún envía X-Internal-Api-Key (sin JWT),
// sigue funcionando como antes. La transición es gradual.
function requireErpAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // ── Ruta 1: JWT de Supabase ──
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    fetchConTimeout(`${SB_AUTH_URL}/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_ANON_KEY },
    })
    .then(async (r) => {
      if (!r.ok) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
      const sbUser = await r.json();
      req.erpUserId    = sbUser.id;
      req.erpUserEmail = sbUser.email || '';
      next();
    })
    .catch((e) => {
      console.error('❌ requireErpAuth JWT verification:', e.message);
      res.status(500).json({ error: 'Error de autenticación' });
    });
    return;
  }

  // ── Ruta 2: API Key compartida (backward-compat) ──
  if (INTERNAL_API_KEY && req.headers["x-internal-api-key"] === INTERNAL_API_KEY) {
    // Sin JWT no hay identidad verificada — preservar el comportamiento actual:
    // tomar X-User-Email como actor (no verificado, pero compatible con el flujo existente).
    req.erpUserId    = null;
    req.erpUserEmail = req.headers["x-user-email"] || null;
    return next();
  }

  // ── Fail-closed ──
  if (!INTERNAL_API_KEY) {
    return res.status(503).json({ error: "Servicio no disponible: credenciales no configuradas" });
  }
  return res.status(401).json({ error: "No autorizado" });
}

// Helper: extrae la identidad del actor para auditoría.
// Prioriza la identidad verificada del JWT sobre el header auto-declarado.
function getActor(req) {
  return req.erpUserEmail || req.headers["x-user-email"] || "sistema";
}

// ─── ACCESO LEGACY+ERP — ENDPOINTS COMPARTIDOS (Sprint 2A) ───────────────────
// Middleware que acepta TRES mecanismos: JWT (ERP), API Key (ERP fallback),
// y legacy token (TorreControl.html). Los endpoints compartidos necesitan
// aceptar los tres durante la transición.
function requireLegacyOrErpAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // ── Ruta 1: JWT de Supabase (ERP moderno) ──
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    fetchConTimeout(`${SB_AUTH_URL}/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_ANON_KEY },
    })
    .then(async (r) => {
      if (!r.ok) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
      const sbUser = await r.json();
      req.erpUserId    = sbUser.id;
      req.erpUserEmail = sbUser.email || '';
      next();
    })
    .catch((e) => {
      console.error('❌ requireLegacyOrErpAuth JWT verification:', e.message);
      res.status(500).json({ error: 'Error de autenticación' });
    });
    return;
  }

  // ── Ruta 2: API Key compartida (ERP backward-compat) ──
  if (INTERNAL_API_KEY && req.headers["x-internal-api-key"] === INTERNAL_API_KEY) {
    req.erpUserId    = null;
    req.erpUserEmail = req.headers["x-user-email"] || null;
    return next();
  }

  // ── Ruta 3: Legacy token (TorreControl.html) ──
  if (LEGACY_TC_TOKEN && req.headers["x-legacy-token"] === LEGACY_TC_TOKEN) {
    req.erpUserId    = null;
    req.erpUserEmail = null;
    return next();
  }

  // ── Fail-closed ──
  if (!INTERNAL_API_KEY && !LEGACY_TC_TOKEN) {
    return res.status(503).json({ error: "Servicio no disponible: credenciales no configuradas" });
  }
  return res.status(401).json({ error: "No autorizado" });
}

// Wrapper de compatibilidad — usa parseFechaTMS('DMY') con offset −05:00. RESUELVE H-04.
function parseSchedulate(str) {
  return parseFechaTMS(str, 'DMY');
}

const app = express();

// ─── CORS — lista blanca por variable de entorno ─────────────────────────────
// Peticiones sin header Origin (server-to-server, curl, Postman, Railway health)
// pasan siempre. Solo las peticiones cross-origin del navegador se filtran.
// CLIENT_PORTAL_URL se incluye automáticamente si está configurada (reutiliza
// la misma variable que ya declara POST /auth/recuperar — no hay que duplicarla).
const _allowedOriginsSet = new Set(
  [
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
    CLIENT_PORTAL_URL,
  ].filter(Boolean)
);
// Localhost solo en entornos no-producción (desarrollo local y staging con NODE_ENV sin set)
if (process.env.NODE_ENV !== "production") {
  ["http://localhost:3000", "http://localhost:5173", "http://localhost:4173"].forEach(
    o => _allowedOriginsSet.add(o)
  );
}
if (!_allowedOriginsSet.size) {
  console.warn(
    "⚠️  CORS: ningún origen permitido configurado (ALLOWED_ORIGINS + CLIENT_PORTAL_URL vacíos). " +
    "Las peticiones cross-origin del navegador serán rechazadas — configura al menos CLIENT_PORTAL_URL."
  );
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / health checks
    if (_allowedOriginsSet.has(origin)) return callback(null, true);
    // Rechazar silenciosamente: callback(null, false) omite los headers CORS
    // sin generar un error Express (que causaría HTTP 500 + stack trace en logs).
    // El navegador bloquea la respuesta en el lado del cliente por falta de
    // Access-Control-Allow-Origin. Para preflight OPTIONS, el cors package
    // responde 204 sin Allow-Origin y el navegador cancela la petición real.
    console.warn(`[CORS] Origen rechazado: ${origin}`);
    callback(null, false);
  },
  credentials: true,
}));

// ─── SECURITY HEADERS ────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

app.use(express.json());

// Servir TorreControl.html directamente desde la raíz
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));
app.get("/TorreControl.html", (req, res) => res.sendFile(path.join(__dirname, "TorreControl.html")));

// Bootstrap legado — sin autenticación (intencional).
// Retorna el token que la torre de control necesita para llamar los endpoints autorizados.
// No expone datos de negocio. ELIMINAR junto con LEGACY-01.
app.get("/legacy/tc-init", (req, res) => {
  if (!LEGACY_TC_TOKEN) {
    return res.status(503).json({ error: "Token legado no configurado" });
  }
  res.json({ token: LEGACY_TC_TOKEN });
});

const LOGIN_URL = "https://integrations.controlt.io/Auth/login";
const BASE_URL  = "https://app.controlt.com.co/apipublic/api";
const TOKEN_TTL = 60 * 60 * 1000; // 1 hora — renovación proactiva cada hora
const CACHE_TTL = 60 * 1000;

let currentToken = null;
let lastLogin    = null;

// ─── CACHÉ EN MEMORIA ───────────────────────────────────
const cache = {
  viajes:    { data: [], ts: 0, completo: false },
  alarmas:   { data: [], ts: 0 },
  pendientes:{ data: [], ts: 0 },
};

let syncViajesRunning     = false;
let syncCumplidosRunning  = false;
let syncPlaneadosRunning  = false;

// Métricas del último ciclo de syncViajes — expuestas en /health para observabilidad.
let lastSnapshotMetrics = null;

// ─── DIAGNÓSTICO PROGRAMACIÓN ────────────────────────────────────────────────
// Variables y helpers para instrumentación temporal. No tocar reglas funcionales.
let syncCounter       = 0;   // SYNC_ID incremental; se incrementa en cada llamada
let lastSyncFinished  = 0;   // ID del último SYNC que terminó exitosamente
let getProgCounter    = 0;   // Contador de solicitudes GET /api/programacion

/** Hora actual en zona Colombia, formato HH:MM:SS, para logs de diagnóstico. */
function horaAhora() {
  return new Date().toLocaleTimeString('es-CO', {
    hour12: false, timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function cacheVigente(key) {
  return (Date.now() - cache[key].ts) < CACHE_TTL && cache[key].data.length > 0;
}

// ─── TOKEN ──────────────────────────────────────────────
async function refreshToken() {
  console.log("🔄 Renovando token ControlT...");
  const res = await fetchConTimeout(LOGIN_URL, {
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
  const res = await fetchConTimeout(`${CT_PUBLIC_URL}/login/oauth`, {
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
app.get('/api/ct/travel/:id', requireErpAuth, async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const r = await fetchConTimeout(`${CT_PUBLIC_URL}/Travel/${req.params.id}`, {
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

// GET /api/ct/travel/list — lista viajes activos via Travel API pública
app.get('/api/ct/travel/list', requireErpAuth, async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const r = await fetchConTimeout(`${CT_PUBLIC_URL}/Travel/List`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const txt = await r.text();
    if (!r.ok) {
      console.error(`❌ CT Travel/List → ${r.status}: ${txt.slice(0,300)}`);
      return res.status(r.status).json({ error: 'ControlT error', status: r.status, body: txt.slice(0,300) });
    }
    res.json(JSON.parse(txt));
  } catch(e) {
    console.error('❌ /api/ct/travel/list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ct/binnacle
app.post('/api/ct/binnacle', requireErpAuth, async (req, res) => {
  try {
    const token = await getCtPublicToken();
    const { trip_number, id_monitoring_order, date_start, date_end, take = 100, page = 1 } = req.body;

    const body = { take, page };
    if (trip_number)         body.trip_number         = trip_number;
    if (id_monitoring_order) body.id_monitoring_order = id_monitoring_order;
    if (date_start)          body.date_start          = date_start;
    if (date_end)            body.date_end            = date_end;

    const r = await fetchConTimeout(`${CT_PUBLIC_URL}/ControlTower/binnacle`, {
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
    return fetchConTimeout(`${BASE_URL}${path}`, {
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

  try {
    const data = JSON.parse(text);
    if (data && data.Message && data.Message.toLowerCase().includes("denied")) {
      console.warn(`⚠️ ${path} bloqueado por permisos`);
      return fallback;
    }
    return data;
  } catch (e) {
    console.warn(`⚠️ ${path} respuesta no-JSON: ${e.message}`);
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
const GRUPO_EN_RUTA     = new Set(['iniciado', 'cargando', 'en tránsito', 'en transito', 'en transíto', 'en tránsíto', 'pernoctando', 'descargando']);
const GRUPO_COMPLETADO  = new Set(['completado', 'finalizado']);
const GRUPO_CANCELADO   = new Set(['cancelado']);
const ORPHAN_HOURS = parseInt(process.env.ORPHAN_HOURS || '4', 10);

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

const ESTADOS_CUMPLIBLES = new Set(['completado', 'finalizado']);

// GPS_THRESHOLD_*, ESTADOS_MONITOREABLES, derivarEstadoGps() y parseLatLon()
// se movieron a services/reportes/datasetProvider.js (Fase 9B) — su único
// call site era GET /api/gps más abajo. Se importan de vuelta desde ahí para
// no duplicar la lógica entre el endpoint y el generador de reportes.

function primerNombreCliente(str) {
  return (str ?? '').split(',')[0].trim() || null;
}

// ─── SOPORTES DE CUMPLIDO — fuente única de verdad de tipos documentales ────
// Antes existían dos listas desconectadas (DOCUMENTOS_BASE en el backend,
// nunca persistida, y TIPOS_BASE en ExpedienteDocumental.tsx, la que realmente
// se usaba para nombrar archivos). Esta es la única lista ahora — el frontend
// la usa para mostrar el progreso ("3/5 requeridos") y para inferir el tipo
// documental a partir de la descripción que el usuario escribe al cargar.
const TIPOS_DOCUMENTO_CUMPLIDO = [
  { id: 'remesa',     label: 'Remesa',                  requerido: true  },
  { id: 'cumplido',   label: 'Cumplido',                requerido: true  },
  { id: 'manifiesto', label: 'Manifiesto',              requerido: true  },
  { id: 'evidencias', label: 'Evidencias fotográficas', requerido: false },
  { id: 'tiquete',    label: 'Tiquete báscula',         requerido: false },
];
const TIPO_DOCUMENTO_GUT = { id: 'gut', label: 'GUT', requerido: true };

function tiposDocumentoParaViaje(typeOperation) {
  const esGranel = (typeOperation ?? '').trim().toLowerCase() === 'granel liquido';
  return esGranel ? [...TIPOS_DOCUMENTO_CUMPLIDO, TIPO_DOCUMENTO_GUT] : TIPOS_DOCUMENTO_CUMPLIDO;
}

// Infiere el tipo documental a partir de la descripción opcional que el
// usuario escribe al cargar (coincidencia por label, sin distinguir mayúsculas
// ni acentos). Devuelve null cuando no hay descripción o no coincide con
// ningún tipo conocido — el soporte queda como "general", sin tipo asignado.
function normalizarTexto(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function inferirTipoDocumento(descripcion) {
  const norm = normalizarTexto(descripcion);
  if (!norm) return null;
  const todos = [...TIPOS_DOCUMENTO_CUMPLIDO, TIPO_DOCUMENTO_GUT];
  const match = todos.find(t => norm.includes(normalizarTexto(t.label)) || norm.includes(t.id));
  return match ? match.id : null;
}

// ─── Validación de archivos subidos como soporte de cumplido ───────────────
const SOPORTE_EXT_PERMITIDAS  = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
const SOPORTE_MIME_PERMITIDOS = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
]);
const SOPORTE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB por archivo

function validarArchivoSoporte({ ext, mime, size }) {
  if (!SOPORTE_EXT_PERMITIDAS.has(ext)) {
    return `Extensión ".${ext}" no permitida. Formatos válidos: ${[...SOPORTE_EXT_PERMITIDAS].join(', ')}.`;
  }
  if (!SOPORTE_MIME_PERMITIDOS.has(mime)) {
    return `Tipo de archivo "${mime}" no permitido.`;
  }
  if (size > SOPORTE_MAX_BYTES) {
    return `El archivo supera el límite de ${SOPORTE_MAX_BYTES / 1024 / 1024} MB.`;
  }
  if (size <= 0) {
    return 'El archivo está vacío.';
  }
  return null;
}

// Sanitiza texto libre (descripción, usuario) para uso seguro en nombre de
// archivo y en columnas de texto — quita caracteres de control y separadores
// de ruta, colapsa espacios, y limita longitud.
function sanitizarTextoLibre(str, maxLen = 80) {
  return (str || '')
    .replace(/[\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// Genera el nombre legible del soporte: FECHA_TRIPNUMBER_PLACA_DESCRIPCION.ext
// Este nombre es solo para mostrar en pantalla y como nombre de descarga —
// nunca se usa como clave física en Storage (ver ruta_storage, basada en uuid).
function generarNombreSoporte({ fecha, trip, placa, descripcion, ext }) {
  const partes = [fecha, sanitizarTextoLibre(trip, 40) || trip, sanitizarTextoLibre(placa, 20) || 'SINPLACA'];
  const desc = sanitizarTextoLibre(descripcion, 60);
  if (desc) partes.push(desc);
  return `${partes.join('_')}.${ext}`;
}

async function syncPendientes() {
  try {
    const ahora   = new Date();
    const en7dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const desde = fmt(ahora);
    const hasta  = fmt(en7dias);

    const path = `/Travel/search?dateStart=${encodeURIComponent(desde)}&dateEnd=${encodeURIComponent(hasta)}&size=200&page=1`;
    const data = await safeFetch(path, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    cache.pendientes.data = arr;
    cache.pendientes.ts   = Date.now();
    if (!arr.length) {
      const data2 = await safeFetch(`/Travel/search?size=200&page=1`, []);
      const arr2 = Array.isArray(data2) ? data2 : data2.data || data2.result || [];
      cache.pendientes.data = arr2;
      cache.pendientes.ts   = Date.now();
    }
  } catch(e) {
    console.error("❌ Error sync pendientes:", e.message);
  }
}

// ─── CUSTOMER LOOKUP ────────────────────────────────────
// Carga empresas_cliente y reconstruye el mapa de resolución.
// Se llama al inicio y cada 10 min para capturar nuevas homologaciones.
// Incluye todos los estados excepto 'inactivo': un cliente pendiente, suspendido
// o bloqueado sigue siendo un registro válido y no debe duplicarse.
async function refreshCustomerLookup() {
  try {
    // Excluir inactivos y fusionados — ambos no participan en resolución de nombres
    const empresas = await sbFetch('/empresas_cliente?estado=not.in.(inactivo,fusionado)&select=id,razon_social,nombre_controlt') || [];
    customerLookupMap  = buildLookupMap(empresas);
    customerLookupById = new Map(empresas.filter(e => e.id).map(e => [e.id, e.razon_social]));

    // Enriquecer con Identity Rules: nombres externos registrados por merges anteriores.
    // Cada regla añade una entrada adicional al mapa si aún no existe, permitiendo que
    // "FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA" resuelva al cliente oficial
    // sin crear un duplicado.
    const rules = await sbFetch('/cliente_alias?activo=eq.true&select=nombre_normalizado,empresa_cliente_id') || [];
    let rulesAdded = 0;
    for (const r of rules) {
      if (!customerLookupMap.has(r.nombre_normalizado)) {
        const razon_social = customerLookupById.get(r.empresa_cliente_id) ?? null;
        if (razon_social) {
          customerLookupMap.set(r.nombre_normalizado, { id: r.empresa_cliente_id, razon_social });
          rulesAdded++;
        }
      }
    }

    console.log(`🏢 Customer lookup: ${customerLookupMap.size} entradas (${rulesAdded} identity rules)`);
  } catch (e) {
    console.error('❌ refreshCustomerLookup:', e.message);
  }
}

// ─── SYNC PLANEADOS ─────────────────────────────────────
// Espejo operacional puro del TMS. No resuelve ni crea clientes.
// El módulo Clientes es responsable de la resolución comercial de forma independiente.
async function syncPlaneados(motivo = 'scheduler') {
  if (syncPlaneadosRunning) {
    console.warn(`⚠️  [SYNC] syncPlaneados bloqueada por mutex | hora: ${horaAhora()} | último SYNC completado: #${lastSyncFinished}`);
    return;
  }
  syncPlaneadosRunning = true;

  const syncId = ++syncCounter;
  const tTotal = Date.now();

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`[SYNC #${syncId}] ▶  Inicio`);
  console.log(`[SYNC #${syncId}]    Motivo           : ${motivo}`);
  console.log(`[SYNC #${syncId}]    Hora             : ${horaAhora()}`);
  console.log(`[SYNC #${syncId}]    Último completado: #${lastSyncFinished}`);
  console.log(`════════════════════════════════════════════════════════════════`);

  try {
    // ─── 1. Consulta TMS ──────────────────────────────────────────────────────
    const tTMS0 = Date.now();
    const path  = `/Travel/search?size=200&page=1`;
    const data  = await safeFetch(path, []);
    const tTMS  = Date.now() - tTMS0;
    const arr   = Array.isArray(data) ? data : data.data || data.result || [];

    console.log(`[SYNC #${syncId}] TMS | ${arr.length} viajes recibidos | ${tTMS}ms`);

    if (!arr.length) {
      console.log(`[SYNC #${syncId}] ⚠️  Travel/search devolvió 0 viajes — abortando`);
      lastSyncFinished = syncId;
      return;
    }

    const hoyStr = fechaHoyColombia();
    console.log(`[SYNC #${syncId}] Fecha de corte Colombia: ${hoyStr}`);

    // ─── 2. Filtrado y ordenamiento ───────────────────────────────────────────
    const descartados = [];
    const viajesFuturos = arr.filter(v => {
      const f = parseSchedulate(v.schedulate_origin);
      if (!f || isNaN(f.getTime())) {
        descartados.push({ trip: v.trip_number, motivo: `schedulate_origin inválido: "${v.schedulate_origin}"` });
        return false;
      }
      const fechaDia = extraerFechaColombia(f);
      if (fechaDia < hoyStr) {
        descartados.push({ trip: v.trip_number, motivo: `fecha pasada: ${fechaDia}` });
        return false;
      }
      return true;
    });

    // Orden determinista: fecha de programación ascendente
    viajesFuturos.sort((a, b) => {
      const fa = parseSchedulate(a.schedulate_origin);
      const fb = parseSchedulate(b.schedulate_origin);
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return fa.getTime() - fb.getTime();
    });

    console.log(`[SYNC #${syncId}] Filtro | ${arr.length} total → ${viajesFuturos.length} hoy/futuros | ${descartados.length} descartados`);
    if (descartados.length > 0 && descartados.length <= 20) {
      descartados.forEach(d => console.log(`  ✗ ${d.trip} — ${d.motivo}`));
    } else if (descartados.length > 20) {
      descartados.slice(0, 5).forEach(d => console.log(`  ✗ ${d.trip} — ${d.motivo}`));
      console.log(`  … y ${descartados.length - 5} más`);
    }

    if (!viajesFuturos.length) {
      console.log(`[SYNC #${syncId}] ⚠️  0 viajes futuros — abortando sin tocar BD`);
      lastSyncFinished = syncId;
      return;
    }

    // Log muestra TMS
    const fmtTMS = v => `${v.trip_number} | ${v.license_plate || '—'} | ${v.schedulate_origin || '—'}`;
    console.log(`[SYNC #${syncId}] Primeros 5 viajes futuros (TMS):`);
    viajesFuturos.slice(0, 5).forEach((v, i) => console.log(`  [${i + 1}] ${fmtTMS(v)}`));
    if (viajesFuturos.length > 5) {
      console.log(`[SYNC #${syncId}] Últimos 5 viajes futuros (TMS):`);
      viajesFuturos.slice(-5).forEach((v, i) =>
        console.log(`  [${viajesFuturos.length - 4 + i}] ${fmtTMS(v)}`)
      );
    }

    // ─── 3. Estado actual BD (PRE-BATCH) ──────────────────────────────────────
    const tPreCount0 = Date.now();
    const preSnap = await sbFetch('/planeados?select=trip_number');
    const preCount = (preSnap || []).length;
    console.log(`[SYNC #${syncId}] BD PRE-BATCH | ${preCount} filas totales | ${Date.now() - tPreCount0}ms`);

    // ─── 4. Construcción del lote ─────────────────────────────────────────────
    const tLot0    = Date.now();
    const existentes = await sbFetch('/planeados?select=trip_number,fecha_detectado,company_customer_name,activo_en_resume,empresa_cliente_id,estado_programacion');
    const existMap = {};
    (existentes || []).forEach(e => { existMap[e.trip_number] = e; });

    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    const ahora = Date.now();
    const rows  = [];
    for (const v of viajesFuturos) {
      const f          = parseSchedulate(v.schedulate_origin);
      const yaExiste   = existMap[v.trip_number];
      const estaActivo = activeIds.has(v.trip_number);
      const viajeResume = cache.viajes.data.find(r => r.trip_number === v.trip_number);
      const rawCliente = viajeResume?.company_customer_name || v.company_customer_name || null;
      const cliente    = rawCliente ? rawCliente.split(',')[0].trim() : null;

      // Derivar estado_programacion — backend es fuente de verdad
      const estadoActual = yaExiste?.estado_programacion || 'programado';
      let estado_programacion;
      if (estadoActual === 'cancelado') {
        estado_programacion = estadoActual; // cancelado: sticky, sync nunca lo revierte
      } else if (estadoActual === 'completado' && !estaActivo) {
        estado_programacion = 'completado'; // completado: sticky solo si el viaje ya no está en Resume
      } else if (estaActivo) {
        estado_programacion = (f && f.getTime() <= ahora) ? 'en_ruta' : 'asignado';
      } else {
        estado_programacion = (f && f.getTime() <= ahora) ? 'sin_asignar' : 'programado';
      }

      rows.push({
        trip_number:           v.trip_number,
        license_plate:         v.license_plate         || null,
        driver_name:           v.driver_name           || null,
        company_customer_name: cliente,
        city_origin:           v.city_origin           || null,
        city_destination:      v.city_destination      || null,
        origin_address:        v.origin_address        || null,
        schedulate_origin:     v.schedulate_origin     || null,
        fecha_programada_dia:  f ? extraerFechaColombia(f) : null,
        activo_en_resume:      estaActivo,
        estado_programacion,
        fecha_detectado:       yaExiste ? yaExiste.fecha_detectado : new Date().toISOString(),
        activado_en:           (estaActivo && yaExiste && !yaExiste.activo_en_resume) || (estaActivo && !yaExiste)
                                 ? new Date().toISOString()
                                 : null,
      });
    }

    const tLot = Date.now() - tLot0;
    console.log(`[SYNC #${syncId}] Lote | ${rows.length} filas preparadas | ${tLot}ms construcción`);

    // ─── 5. Deduplicar por trip_number ────────────────────────────────────────
    // El TMS puede devolver el mismo trip_number más de una vez (estado intermedio,
    // segmentos, retrasos de caché interna). PostgreSQL error 21000 ocurre cuando
    // ON CONFLICT DO UPDATE intenta actualizar la misma fila dos veces en un solo batch.
    // Solución: mantener la última aparición en el orden ya ordenado (schedulate_origin asc).
    const rowsUniq  = [...new Map(rows.map(r => [r.trip_number, r])).values()];
    const dupCount  = rows.length - rowsUniq.length;
    if (dupCount > 0) {
      console.warn(`[SYNC #${syncId}] ⚠️  ${dupCount} trip_number(s) duplicado(s) en el batch TMS — eliminados antes del upsert`);
    }

    // ─── 6. Batch upsert ──────────────────────────────────────────────────────
    // empresa_cliente_id se omite intencionalmente: merge-duplicates preserva el valor
    // existente en BD; nuevas filas lo dejan null (resuelto por el módulo Clientes).
    const tBatch0  = Date.now();
    const batchRes = await sbFetch('/planeados', 'POST', rowsUniq);
    const tBatch   = Date.now() - tBatch0;
    const retornadas = (batchRes || []).length;
    console.log(`[SYNC #${syncId}] Batch | ${rowsUniq.length} enviadas → ${retornadas} retornadas por Supabase | ${tBatch}ms`);
    if (!batchRes) {
      console.log(`[SYNC #${syncId}] ⚠️  Batch retornó null — ver error Supabase encima de este log`);
    }

    // ─── 7. Conteo BD post-batch (+0s / +2s / +5s) ───────────────────────────
    const tP0 = Date.now();
    const post0 = (await sbFetch('/planeados?select=trip_number') || []).length;
    console.log(`[SYNC #${syncId}] BD POST-BATCH (+0s) | ${post0} filas | ${Date.now() - tP0}ms`);

    await new Promise(r => setTimeout(r, 2000));
    const tP2 = Date.now();
    const post2 = (await sbFetch('/planeados?select=trip_number') || []).length;
    console.log(`[SYNC #${syncId}] BD POST-BATCH (+2s) | ${post2} filas | ${Date.now() - tP2}ms`);

    await new Promise(r => setTimeout(r, 3000));
    const tP5 = Date.now();
    const post5 = (await sbFetch('/planeados?select=trip_number') || []).length;
    console.log(`[SYNC #${syncId}] BD POST-BATCH (+5s) | ${post5} filas | ${Date.now() - tP5}ms`);

    // Muestra: primeras 10 y últimas 10 filas ordenadas por fecha
    const snapshot = await sbFetch(
      '/planeados?select=trip_number,fecha_programada_dia,estado_programacion,license_plate&order=fecha_programada_dia.asc&limit=10000'
    );
    const snRows = snapshot || [];
    console.log(`[SYNC #${syncId}] Muestra BD (${snRows.length} total) — primeras 10 por fecha asc:`);
    snRows.slice(0, 10).forEach((r, i) =>
      console.log(`  [${i + 1}] ${r.trip_number} | ${r.fecha_programada_dia} | ${r.estado_programacion} | ${r.license_plate || '—'}`)
    );
    if (snRows.length > 10) {
      console.log(`[SYNC #${syncId}] Muestra BD — últimas 10 por fecha asc:`);
      snRows.slice(-10).forEach((r, i) =>
        console.log(`  [${snRows.length - 9 + i}] ${r.trip_number} | ${r.fecha_programada_dia} | ${r.estado_programacion} | ${r.license_plate || '—'}`)
      );
    }

    // ─── 7. Retención ─────────────────────────────────────────────────────────
    const corte    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const corteStr = extraerFechaColombia(corte);
    await sbFetch(`/planeados?fecha_programada_dia=lt.${corteStr}`, 'DELETE');
    console.log(`[SYNC #${syncId}] Retención | eliminados anteriores a ${corteStr} (ventana 8 días)`);

    // ─── 8. Parche de respaldo: filas retenidas sin nombre de cliente ─────────
    const sinCliente = (existentes || []).filter(e => !e.company_customer_name);
    let parchesAplicados = 0;
    for (const e of sinCliente) {
      const viajeResume = cache.viajes.data.find(r => r.trip_number === e.trip_number);
      if (viajeResume?.company_customer_name) {
        await sbFetch(
          `/planeados?trip_number=eq.${encodeURIComponent(e.trip_number)}`,
          'PATCH',
          { company_customer_name: viajeResume.company_customer_name }
        );
        parchesAplicados++;
      }
    }
    if (parchesAplicados > 0) {
      console.log(`[SYNC #${syncId}] Parche sinCliente | ${parchesAplicados} filas actualizadas`);
    }

    // ─── 8b. Enriquecimiento SOAP: planificado_por ────────────────────────────
    // Planeados es el propietario del dato durante la etapa de planificación.
    // Solo se enriquecen filas sin planificado_por_nombre (nuevas o pendientes).
    // Límite por ciclo: 10 llamadas SOAP para no extender la duración del sync.
    // Best-effort: un fallo individual no interrumpe el ciclo ni el resto del lote.
    try {
      const sinResponsable = await sbFetch(
        `/planeados?planificado_por_nombre=is.null&fecha_programada_dia=gte.${hoyStr}&select=trip_number&limit=10`
      ) || [];
      if (sinResponsable.length > 0) {
        console.log(`[SYNC #${syncId}] SOAP enrich | ${sinResponsable.length} viajes sin planificado_por — iniciando`);
        let enriquecidos = 0;
        let fallidos     = 0;
        for (const fila of sinResponsable) {
          try {
            const detalle = await getTripDetail(fila.trip_number, { sbFetch: controltSbFetch });
            const nombre  = detalle.planificado_por?.fullname ?? null;
            if (nombre) {
              await sbFetch(
                `/planeados?trip_number=eq.${encodeURIComponent(fila.trip_number)}`,
                'PATCH',
                { planificado_por_nombre: nombre }
              );
              enriquecidos++;
            }
          } catch (soapErr) {
            fallidos++;
            console.warn(`[SYNC #${syncId}] SOAP enrich | fallo en ${fila.trip_number}: ${soapErr.message}`);
          }
        }
        console.log(`[SYNC #${syncId}] SOAP enrich | ${enriquecidos} enriquecidos, ${fallidos} fallidos`);
      }
    } catch (enrichErr) {
      console.warn(`[SYNC #${syncId}] SOAP enrich | error general (ignorado): ${enrichErr.message}`);
    }

    // ─── 9. Verificación de consistencia ─────────────────────────────────────
    const bdFuturos = await sbFetch(
      `/planeados?fecha_programada_dia=gte.${hoyStr}&select=trip_number,fecha_programada_dia,license_plate,estado_programacion`
    ) || [];
    const bdSet  = new Set(bdFuturos.map(r => r.trip_number));
    const tmsSet = new Set(viajesFuturos.map(v => v.trip_number));

    const faltanEnBD = viajesFuturos.filter(v => !bdSet.has(v.trip_number));
    const soloEnBD   = bdFuturos.filter(r => !tmsSet.has(r.trip_number));

    console.log(`[SYNC #${syncId}] ─── Verificación de Consistencia ─────────────────────────`);
    console.log(`[SYNC #${syncId}] TMS futuros enviados : ${viajesFuturos.length}`);
    console.log(`[SYNC #${syncId}] BD  futuros (hoy+)   : ${bdFuturos.length}`);
    if (faltanEnBD.length === 0) {
      console.log(`[SYNC #${syncId}] ✅ CONSISTENTE — todos los viajes TMS futuros están en BD`);
    } else {
      console.log(`[SYNC #${syncId}] ❌ INCONSISTENTE — ${faltanEnBD.length} viajes TMS NO encontrados en BD:`);
      faltanEnBD.forEach(v =>
        console.log(`  ✗ ${v.trip_number} | ${v.schedulate_origin || '—'} | ${v.license_plate || '—'}`)
      );
    }
    if (soloEnBD.length > 0) {
      console.log(`[SYNC #${syncId}] ℹ️  ${soloEnBD.length} filas BD hoy+ no vienen en este TMS response (retenidas de pasados o SYNCs previos):`);
      soloEnBD.slice(0, 10).forEach(r =>
        console.log(`  · ${r.trip_number} | ${r.fecha_programada_dia} | ${r.estado_programacion}`)
      );
    }
    console.log(`[SYNC #${syncId}] ─────────────────────────────────────────────────────────`);

    lastSyncFinished = syncId;

  } catch(e) {
    console.error(`[SYNC #${syncId}] ❌ Error: ${e.message}`, e.stack);
  } finally {
    syncPlaneadosRunning = false;
    console.log(`[SYNC #${syncId}] ■  Fin | Duración total: ${Date.now() - tTotal}ms | hora: ${horaAhora()}`);
    console.log(`════════════════════════════════════════════════════════════════\n`);
  }
}

async function syncViajes() {
  // Mutex: evitar ejecuciones concurrentes si un ciclo tarda más de 60 s.
  if (syncViajesRunning) {
    console.warn('⚠️  syncViajes: ciclo anterior aún activo — omitiendo.');
    return;
  }
  syncViajesRunning = true;
  const t0 = Date.now();

  // Objeto de métricas del ciclo — se persiste en lastSnapshotMetrics al finalizar.
  const metricas = {
    timestamp:           new Date().toISOString(),
    paginas_intentadas:  0,
    paginas_exitosas:    0,
    registros_p1:        0,
    registros_p2:        0,
    registros_p3:        0,
    total_viajes:        0,
    duplicados:          0,
    completo:            false,
    truncado_por_limite: false,
    errores:             [],
    duracion_ms:         0,
    estado:              'iniciando',
  };

  console.log('🔄 syncViajes: iniciando snapshot ControlT /Resume');

  try {
    // ── Página 1 ──────────────────────────────────────────────────────────────
    metricas.paginas_intentadas++;
    const data1 = await safeFetch("/Resume?size=100&page=1", null);

    // null indica error HTTP, parse failure o permisos denegados en safeFetch.
    // No actualizar caché para preservar el snapshot anterior.
    if (data1 === null) {
      metricas.errores.push({ pagina: 1, motivo: 'http_error_o_parse' });
      metricas.estado = 'abortado_p1_error';
      console.warn('❌ syncViajes: página 1 devolvió error — caché anterior preservada.');
      return;
    }

    const arr1 = Array.isArray(data1) ? data1 : (data1?.data || data1?.result || []);
    if (arr1.length === 0) {
      metricas.estado = 'abortado_p1_vacia';
      console.warn('⚠️  syncViajes: página 1 devolvió 0 viajes — caché anterior preservada.');
      return;
    }

    metricas.paginas_exitosas++;
    metricas.registros_p1 = arr1.length;
    console.log(`📄 syncViajes p1: ${arr1.length} viajes`);

    let todos    = [...arr1];
    let completo = true;

    // ── Página 2 ──────────────────────────────────────────────────────────────
    if (arr1.length >= 100) {
      metricas.paginas_intentadas++;
      try {
        const data2 = await safeFetch("/Resume?size=100&page=2", null);

        if (data2 === null) {
          // Error HTTP / parse silencioso: marcar snapshot incompleto.
          // Antes este caso quedaba como completo=true porque arr2=[] y no se lanzaba excepción.
          completo = false;
          metricas.errores.push({ pagina: 2, motivo: 'http_error_o_parse' });
          console.error('❌ syncViajes: página 2 falló con error HTTP/parse — snapshot INCOMPLETO. syncCumplidos suspenderá lógica de finalización.');
        } else {
          const arr2 = Array.isArray(data2) ? data2 : (data2?.data || data2?.result || []);
          metricas.paginas_exitosas++;
          metricas.registros_p2 = arr2.length;

          if (arr2.length > 0) {
            todos = [...todos, ...arr2];
            console.log(`📄 syncViajes p2: ${arr2.length} viajes adicionales`);

            // ── Página 3 ──────────────────────────────────────────────────────
            if (arr2.length >= 100) {
              metricas.paginas_intentadas++;
              try {
                const data3 = await safeFetch("/Resume?size=100&page=3", null);

                if (data3 === null) {
                  completo = false;
                  metricas.errores.push({ pagina: 3, motivo: 'http_error_o_parse' });
                  console.error('❌ syncViajes: página 3 falló con error HTTP/parse — snapshot INCOMPLETO.');
                } else {
                  const arr3 = Array.isArray(data3) ? data3 : (data3?.data || data3?.result || []);
                  metricas.paginas_exitosas++;
                  metricas.registros_p3 = arr3.length;

                  if (arr3.length > 0) {
                    todos = [...todos, ...arr3];
                    console.log(`📄 syncViajes p3: ${arr3.length} viajes adicionales`);
                  } else {
                    console.log('📄 syncViajes p3: 0 registros — paginación completa.');
                  }

                  // Página 3 llena: existen viajes más allá del límite de 3 páginas.
                  if (arr3.length >= 100) {
                    completo = false;
                    metricas.truncado_por_limite = true;
                    metricas.errores.push({ pagina: 3, motivo: 'limite_paginas_alcanzado' });
                    console.warn(`⚠️  syncViajes: página 3 completa (${arr3.length} registros). Límite de 3 páginas alcanzado — viajes adicionales no descargados. Snapshot INCOMPLETO.`);
                  }
                }
              } catch(e) {
                completo = false;
                metricas.errores.push({ pagina: 3, motivo: 'excepcion', detalle: e.message });
                console.error(`❌ syncViajes: página 3 — excepción: ${e.message}`);
              }
            }
          } else {
            console.log('📄 syncViajes p2: 0 registros — paginación completa.');
          }
        }
      } catch(e) {
        completo = false;
        metricas.errores.push({ pagina: 2, motivo: 'excepcion', detalle: e.message });
        console.error(`❌ syncViajes: página 2 — excepción: ${e.message}`);
      }
    }

    // ── Deduplicación ─────────────────────────────────────────────────────────
    const seen  = new Set();
    const dedup = todos.filter(v => {
      const k = v.trip_number || v.id_monitoring_order;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    metricas.duplicados   = todos.length - dedup.length;
    metricas.total_viajes = dedup.length;
    metricas.completo     = completo;
    metricas.estado       = completo ? 'completo' : 'parcial';

    cache.viajes.data     = sortViajes(dedup);
    cache.viajes.ts       = Date.now();
    cache.viajes.completo = completo;

    if (!completo) {
      const resumenErrores = metricas.errores.map(e => `p${e.pagina}:${e.motivo}`).join(', ');
      console.warn(`⚠️  syncViajes: snapshot PARCIAL (${dedup.length} viajes). Errores: [${resumenErrores}]. syncCumplidos suspenderá lógica de finalización.`);
    }

  } catch(e) {
    metricas.estado = 'error_fatal';
    metricas.errores.push({ pagina: 0, motivo: 'excepcion_fatal', detalle: e.message });
    console.error(`❌ syncViajes: error fatal — ${e.message}`);
  } finally {
    metricas.duracion_ms = Date.now() - t0;
    lastSnapshotMetrics  = metricas;
    syncViajesRunning    = false;
    console.log(
      `📊 syncViajes fin | estado:${metricas.estado}` +
      ` | viajes:${metricas.total_viajes}` +
      ` | páginas:${metricas.paginas_exitosas}/${metricas.paginas_intentadas}` +
      ` | p1:${metricas.registros_p1} p2:${metricas.registros_p2} p3:${metricas.registros_p3}` +
      ` | dedup:-${metricas.duplicados}` +
      ` | ${metricas.duracion_ms}ms`
    );
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

app.get("/api/data", requireLegacyOrErpAuth, (req, res) => {
  res.json(cache.viajes.data);
});

app.get("/api/alarmas", requireLegacyOrErpAuth, (req, res) => {
  res.json(cache.alarmas.data);
});

app.get("/api/pendientes", requireLegacyOrErpAuth, async (req, res) => {
  try {
    if ((Date.now() - cache.pendientes.ts) > 5 * 60 * 1000 || cache.pendientes.data.length === 0) {
      await syncPendientes();
    }
    const arr = cache.pendientes.data;

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

    res.json(filtrados);
  } catch(err) {
    console.warn("⚠️  /api/pendientes error:", err.message);
    res.json([]);
  }
});

// ─── ENDPOINTS DEDICADOS — ERP (requireInternalApiKey) ──────────────────────

// GET /api/viajes — datos del TMS normalizados para el módulo Viajes del ERP.
// Convierte strings crudos (latitude, longitude, percentage_travel) a tipos seguros
// y añade campos derivados (lat, lon, pct, cliente, conductor_tel).
// Transformación en services/reportes/datasetProvider.js (Fase 9B) — la misma
// función alimenta el generador de reportes automáticos, sin duplicarla.
app.get('/api/viajes', requireErpAuth, (req, res) => {
  res.json(transformarViajesActivos(cache.viajes.data, {
    tripCustomerCache, extraerTelefono, primerNombreCliente,
  }));
});

// ─── API CANÓNICA DEL VIAJE (Fase 6) ────────────────────────────────────────
// GET /api/viajes/:tripNumber — único punto de entrada al dominio operacional
// Viaje. Entrada exclusiva: el Trip Number de ControlT. El consumidor NO
// conoce ni necesita UUIDs internos ni identificadores de `solicitudes`.
//
// Coexiste con GET /servicios/:id (dominio Solicitud/ERP, no lo reemplaza).
// Reutilizable por ERP, Portal Cliente (backend), App Conductor, Torre de
// Control, BI e integraciones futuras — todas system-to-system, de ahí
// requireInternalApiKey (mismo mecanismo que el resto de /api/*).
//
// Toda comunicación con ControlT pasa por tripService.getTripDetail — este
// endpoint no reimplementa Login, SOAP, caché ni persistencia. A diferencia
// de construirControltEnriquecido() (Fase 5, que absorbe errores porque ahí
// ControlT es un enriquecimiento secundario de una Solicitud), aquí el Viaje
// ES el recurso principal: un error tipado de tripService (ver errors.js)
// se traduce 1:1 al status HTTP correspondiente (404, 502, 503, 504, etc.).
//
// vehiculo/telefono/ubicacion_actual: mismos campos en tiempo real que ya
// usa mapSolicitud()/construirControltEnriquecido() vía cache.viajes (Resume
// API) — no es una fuente nueva, es la misma ya establecida en Fase 5.
app.get('/api/viajes/:tripNumber', requireErpAuth, async (req, res) => {
  const tripNumber = String(req.params.tripNumber || '').trim();
  if (!tripNumber) {
    return res.status(400).json({ error: { code: 'INVALID_TRIP_NUMBER', mensaje: 'Trip Number requerido' } });
  }

  let detalle;
  try {
    detalle = await getTripDetail(tripNumber, { sbFetch: controltSbFetch });
  } catch (err) {
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    const code = err.code || 'INTERNAL_ERROR';
    console.error(`❌ GET /api/viajes/${tripNumber}:`, err.message);
    return res.status(statusCode).json({ error: { code, mensaje: err.message } });
  }

  const viajeActivo = cache.viajes.data.find(v => String(v.trip_number) === tripNumber) || null;

  const ubicacion_actual = (() => {
    if (!viajeActivo) return null;
    const lat = parseFloat(viajeActivo.latitude ?? viajeActivo.lat ?? '');
    const lng = parseFloat(viajeActivo.longitude ?? viajeActivo.lng ?? '');
    if (!lat || !lng) return null;
    return { lat, lng, ultima_actualizacion: viajeActivo.latest_gps_report || null };
  })();

  res.json({
    trip_number: detalle.codigo_controlt,
    codigo_controlt_secundario: detalle.codigo_controlt_secundario || null,
    codigo_empresa:             detalle.codigo_empresa || null,
    orden_operacional: {
      number_order:         viajeActivo?.number_order        || null,
      id_monitoring_order:  viajeActivo?.id_monitoring_order  || null,
    },
    codigo_ruta: detalle.codigo_ruta || null,
    estado_viaje: detalle.estado_viaje,
    // CORRECCIÓN DE MODELO (Fase 6, certificación final, Objetivo 2):
    // username/fullname del SOAP NO son datos del conductor — son el
    // usuario del TMS que planilló la orden (ver "planificado_por" abajo).
    // El nombre real del conductor, cuando existe, proviene de Resume
    // (cache.viajes.driver_name) — misma fuente que ya usa mapSolicitud()
    // en /servicios/:id. La cédula del conductor no tiene ninguna fuente
    // confirmada todavía (ni SOAP ni Resume la exponen) y permanece null
    // hasta que se confirme un origen real.
    conductor: (viajeActivo?.driver_name || detalle.conductor_nombre || detalle.conductor_cedula || viajeActivo) ? {
      cedula:   detalle.conductor_cedula || null,
      nombre:   viajeActivo?.driver_name || detalle.conductor_nombre || null,
      telefono: viajeActivo ? (extraerTelefono(viajeActivo.driver_phone, viajeActivo.full_driver) || null) : null,
    } : null,
    // planificado_por: usuario de ControlT/TMS que creó/planilló la orden
    // de monitoreo — NUNCA debe interpretarse como el conductor del viaje.
    planificado_por: detalle.planificado_por || null,
    vehiculo: viajeActivo ? { placa: viajeActivo.license_plate || null } : null,
    tipo_operacion_codigo: detalle.tipo_operacion_codigo,
    tipo_viaje_codigo:     detalle.tipo_viaje_codigo,
    tipo_carga_codigo:     detalle.tipo_carga_codigo,
    carga: {
      valor_mercancia: detalle.valor_mercancia,
      moneda:          detalle.moneda,
      valor_flete:     detalle.valor_flete,
      peso_total_ton:  detalle.peso_total_ton,
      volumen_total:   detalle.volumen_total,
      temperatura_min: detalle.temperatura_min,
      temperatura_max: detalle.temperatura_max,
    },
    instrucciones:      detalle.instrucciones,
    observaciones:      detalle.observaciones || null,
    referencia_doc1:    detalle.referencia_doc1 || null,
    referencia_doc2:    detalle.referencia_doc2 || null,
    campos_auxiliares:  detalle.campos_auxiliares || null,
    rastreo_nueva_ui:   detalle.rastreo_nueva_ui ?? null,
    paradas:          detalle.paradas || [],
    ubicacion_actual,
    fecha_evento:     detalle.fecha_evento,
    sincronizado_en:  detalle.soap_sincronizado_en || null,
  });
});

// GET /api/cumplidos — viajes finalizados desde Supabase (tabla cumplidos).
// Fuente: Supabase, nunca desde cache en memoria.
// Paginación interna para soportar crecimiento indefinido de la tabla.
app.get('/api/cumplidos', requireErpAuth, async (req, res) => {
  try {
    // ?limit=N — limita resultados (útil para previews en el wizard de reportes).
    // Si no se pasa, el comportamiento es el mismo de siempre (sin límite).
    const limitParam = req.query.limit ? Math.min(Math.max(1, parseInt(req.query.limit, 10) || 500), 500) : null;
    const SB_PAGE = limitParam ?? 500;
    let sbOffset = 0;
    const allRows = [];
    while (true) {
      const page = await sbFetch(
        `/cumplidos?select=id,manifiesto,placa,conductor,conductor_tel,cliente,origen,destino,estado_controlt,pct,fecha_viaje,fecha_finalizacion,tipo_negocio,estado_cumplido,tiene_soporte,estado_documental,obs,link_soporte&order=fecha_viaje.desc&limit=${SB_PAGE}&offset=${sbOffset}`
      );
      if (!page || page.length === 0) break;
      allRows.push(...page);
      if (limitParam && allRows.length >= limitParam) break; // stop early for preview
      if (page.length < SB_PAGE) break;
      sbOffset += SB_PAGE;
    }

    const cumplidos = allRows.map(r => ({
      id:                    r.id,
      trip_number:           r.id,
      number_order:          r.manifiesto  || null,
      company_customer_name: r.cliente     || null,
      license_plate:         r.placa       || null,
      driver_name:           r.conductor     || null,
      conductor_tel:         r.conductor_tel || null,
      origin_city_name:      r.origen      || null,
      destiny_city_name:     r.destino     || null,
      state_travel:          r.estado_controlt || '',
      activated_on:          r.fecha_viaje || null,
      created_on:            null,
      fecha_cumplido:        r.fecha_finalizacion || null,
      estado_documental:     r.estado_documental || 'pendiente',
      type_operation:   r.tipo_negocio    || null,
      estado_cumplido:  r.estado_cumplido || null,
      tiene_soporte:    r.tiene_soporte   ?? false,
      obs:              r.obs             || null,
      link_soporte:     r.link_soporte    || null,
    }));

    res.json(cumplidos);
  } catch(e) {
    console.error('❌ Error GET /api/cumplidos:', e.message);
    res.status(500).json({ error: 'Error interno al obtener viajes finalizados' });
  }
});

// ─── SOPORTES DE CUMPLIDO (bucket Supabase Storage "cumplidos" + tabla cumplidos_documentos) ─
//
// Arquitectura: el nombre físico del archivo en Storage es un UUID opaco
// (cumplidos/{trip}/{id}.{ext}) — nunca se usa para lógica del sistema. Toda la
// metadata (nombre legible, descripción, tipo, usuario, tamaño) vive en la
// tabla cumplidos_documentos, identificada por ese mismo UUID. El frontend
// referencia cada soporte por su id; nunca por nombre de archivo.

// Decodifica un header HTTP transmitido en base64 — evita que texto libre con
// tildes/ñ (descripción, usuario, nombre original) se corrompa en tránsito,
// ya que los headers HTTP no garantizan UTF-8 de punta a punta.
function decodeB64Header(h) {
  if (!h) return '';
  try { return Buffer.from(String(h), 'base64').toString('utf8'); }
  catch { return ''; }
}

// Recalcula tiene_soporte y avanza/revierte estado_documental entre
// 'pendiente' y 'en_revision' según la presencia real de soportes. Estados
// manuales más avanzados (con_observaciones / aprobado / rechazado /
// listo_facturacion) nunca se tocan aquí — pertenecen a una fase futura de
// revisión manual, para la que hoy no existe ninguna acción de UI.
async function refrescarEstadoSoportes(trip) {
  const docs = await sbFetch(`/cumplidos_documentos?trip_number=eq.${encodeURIComponent(trip)}&select=id`);
  const tieneSoporte = !!(docs && docs.length > 0);
  const actual = await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(trip)}&select=estado_documental`);
  const estadoActual = actual?.[0]?.estado_documental || 'pendiente';
  const patch = { tiene_soporte: tieneSoporte };
  if (tieneSoporte && estadoActual === 'pendiente')    patch.estado_documental = 'en_revision';
  if (!tieneSoporte && estadoActual === 'en_revision') patch.estado_documental = 'pendiente';
  await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(trip)}`, 'PATCH', patch);
}

// GET /api/cumplidos/:trip/documentos — lista los soportes persistidos para el viaje.
app.get('/api/cumplidos/:trip/documentos', requireErpAuth, async (req, res) => {
  try {
    const { trip } = req.params;
    const rows = await sbFetch(
      `/cumplidos_documentos?trip_number=eq.${encodeURIComponent(trip)}` +
      `&select=id,nombre_generado,nombre_original,descripcion,tipo_documento,tamano_bytes,mime_type,usuario,creado_en` +
      `&order=creado_en.desc`
    );
    res.json({ documentos: rows || [] });
  } catch(e) {
    console.error('❌ GET /api/cumplidos/:trip/documentos:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cumplidos/:trip/documentos — sube un soporte nuevo.
// Headers esperados: X-Filename-B64, X-Descripcion-B64 (opcional), X-Usuario-B64
// (opcional), X-Placa, Content-Type. El frontend hace una llamada por archivo
// cuando el usuario selecciona varios en el diálogo de carga.
app.post(
  '/api/cumplidos/:trip/documentos',
  requireErpAuth,
  express.raw({ type: '*/*', limit: '21mb' }),
  async (req, res) => {
    try {
      const { trip }     = req.params;
      const origName     = decodeB64Header(req.headers['x-filename-b64']) || req.headers['x-filename'] || 'archivo.bin';
      const descripcion  = decodeB64Header(req.headers['x-descripcion-b64']);
      const usuario      = sanitizarTextoLibre(decodeB64Header(req.headers['x-usuario-b64']), 120);
      const placa        = ((req.headers['x-placa'] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()) || 'SINPLACA';
      const mime         = req.headers['content-type'] || 'application/octet-stream';
      const ext          = origName.includes('.') ? origName.split('.').pop().toLowerCase() : '';
      const size         = Buffer.isBuffer(req.body) ? req.body.length : 0;

      const errorValidacion = validarArchivoSoporte({ ext, mime, size });
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });

      // El viaje debe existir ya en la tabla cumplidos — lo garantiza syncCumplidos
      // antes de que el panel de detalle esté disponible en el frontend.
      const existeViaje = await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(trip)}&select=id`);
      if (!existeViaje?.length) return res.status(404).json({ error: `Viaje ${trip} no encontrado` });

      const fecha          = fechaHoyColombia().replace(/-/g, '');
      const nombreGenerado = generarNombreSoporte({ fecha, trip, placa, descripcion, ext });
      const tipoDocumento  = inferirTipoDocumento(descripcion);
      const docId          = randomUUID();
      const rutaStorage    = `${trip}/${docId}.${ext}`;

      // sbStorageFetch devuelve null ante cualquier respuesta no-2xx de Storage
      // (ver index.js:93-96) — sin este chequeo, un upload rechazado quedaba
      // silencioso y la fila de metadata se creaba igual, apuntando a un
      // objeto que nunca llegó a existir en el bucket.
      const uploadResult = await sbStorageFetch(`/object/cumplidos/${rutaStorage}`, 'POST', req.body, {
        'Content-Type': mime,
        'x-upsert':     'true',
      });
      if (!uploadResult) {
        return res.status(502).json({ error: 'No se pudo subir el archivo a Storage. Intenta nuevamente.' });
      }

      await sbFetch('/cumplidos_documentos', 'POST', {
        id:              docId,
        trip_number:     trip,
        ruta_storage:    rutaStorage,
        nombre_generado: nombreGenerado,
        nombre_original: origName.slice(0, 200),
        descripcion:     descripcion || null,
        tipo_documento:  tipoDocumento,
        tamano_bytes:    size,
        mime_type:       mime,
        usuario:         usuario || null,
      });

      await refrescarEstadoSoportes(trip);

      res.json({
        ok: true,
        documento: {
          id: docId, nombre_generado: nombreGenerado, nombre_original: origName,
          descripcion: descripcion || null, tipo_documento: tipoDocumento,
          tamano_bytes: size, mime_type: mime, usuario: usuario || null,
          creado_en: new Date().toISOString(),
        },
      });
    } catch(e) {
      console.error('❌ POST /api/cumplidos/:trip/documentos:', e.message);
      res.status(500).json({ error: e.message });
    }
  },
);

// PUT /api/cumplidos/:trip/documentos/:id/reemplazar — elimina el soporte anterior
// del Storage y de la base, y sube el nuevo en su lugar. Nunca deja duplicados
// ni huérfanos: el borrado ocurre antes que la carga.
app.put(
  '/api/cumplidos/:trip/documentos/:id/reemplazar',
  requireErpAuth,
  express.raw({ type: '*/*', limit: '21mb' }),
  async (req, res) => {
    try {
      const { trip, id } = req.params;
      const rows = await sbFetch(
        `/cumplidos_documentos?id=eq.${encodeURIComponent(id)}&trip_number=eq.${encodeURIComponent(trip)}` +
        `&select=id,ruta_storage,descripcion,tipo_documento`
      );
      const anterior = rows?.[0];
      if (!anterior) return res.status(404).json({ error: 'Documento no encontrado' });

      const origName    = decodeB64Header(req.headers['x-filename-b64']) || req.headers['x-filename'] || 'archivo.bin';
      // Si el cliente no envía una nueva descripción, conserva la del documento reemplazado.
      const descripcion = req.headers['x-descripcion-b64'] !== undefined
        ? decodeB64Header(req.headers['x-descripcion-b64'])
        : (anterior.descripcion || '');
      const usuario = sanitizarTextoLibre(decodeB64Header(req.headers['x-usuario-b64']), 120);
      const placa   = ((req.headers['x-placa'] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()) || 'SINPLACA';
      const mime    = req.headers['content-type'] || 'application/octet-stream';
      const ext     = origName.includes('.') ? origName.split('.').pop().toLowerCase() : '';
      const size    = Buffer.isBuffer(req.body) ? req.body.length : 0;

      const errorValidacion = validarArchivoSoporte({ ext, mime, size });
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });

      const fecha          = fechaHoyColombia().replace(/-/g, '');
      const nombreGenerado = generarNombreSoporte({ fecha, trip, placa, descripcion, ext });
      const tipoDocumento  = inferirTipoDocumento(descripcion) ?? anterior.tipo_documento ?? null;
      const nuevoId        = randomUUID();
      const rutaStorage    = `${trip}/${nuevoId}.${ext}`;

      // 1) Subir primero el archivo nuevo y validar que Storage confirme éxito.
      // sbStorageFetch devuelve null ante cualquier respuesta no-2xx de Storage
      // (ver index.js:93-96) — si el upload falla, se corta aquí sin haber
      // tocado el archivo ni la metadata anteriores: quedan intactos.
      const uploadResult = await sbStorageFetch(`/object/cumplidos/${rutaStorage}`, 'POST', req.body, {
        'Content-Type': mime,
        'x-upsert':     'true',
      });
      if (!uploadResult) {
        return res.status(502).json({ error: 'No se pudo subir el archivo a Storage. El documento anterior no fue modificado.' });
      }

      // 2) Solo tras confirmar el upload, eliminar el archivo anterior del
      // Storage y actualizar la metadata para que apunte al nuevo archivo.
      await sbStorageFetch('/object/cumplidos', 'DELETE', { prefixes: [anterior.ruta_storage] });
      await sbFetch(`/cumplidos_documentos?id=eq.${encodeURIComponent(id)}`, 'DELETE');
      await sbFetch('/cumplidos_documentos', 'POST', {
        id:              nuevoId,
        trip_number:     trip,
        ruta_storage:    rutaStorage,
        nombre_generado: nombreGenerado,
        nombre_original: origName.slice(0, 200),
        descripcion:     descripcion || null,
        tipo_documento:  tipoDocumento,
        tamano_bytes:    size,
        mime_type:       mime,
        usuario:         usuario || null,
      });

      await refrescarEstadoSoportes(trip);

      res.json({
        ok: true,
        documento: {
          id: nuevoId, nombre_generado: nombreGenerado, nombre_original: origName,
          descripcion: descripcion || null, tipo_documento: tipoDocumento,
          tamano_bytes: size, mime_type: mime, usuario: usuario || null,
          creado_en: new Date().toISOString(),
        },
      });
    } catch(e) {
      console.error('❌ PUT /api/cumplidos/:trip/documentos/:id/reemplazar:', e.message);
      res.status(500).json({ error: e.message });
    }
  },
);

// DELETE /api/cumplidos/:trip/documentos/:id — elimina un soporte (Storage + metadata)
// y actualiza tiene_soporte / estado_documental si el viaje queda sin documentos.
app.delete('/api/cumplidos/:trip/documentos/:id', requireErpAuth, async (req, res) => {
  try {
    const { trip, id } = req.params;
    const rows = await sbFetch(
      `/cumplidos_documentos?id=eq.${encodeURIComponent(id)}&trip_number=eq.${encodeURIComponent(trip)}&select=id,ruta_storage`
    );
    const doc = rows?.[0];
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    await sbStorageFetch('/object/cumplidos', 'DELETE', { prefixes: [doc.ruta_storage] });
    await sbFetch(`/cumplidos_documentos?id=eq.${encodeURIComponent(id)}`, 'DELETE');
    await refrescarEstadoSoportes(trip);

    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /api/cumplidos/:trip/documentos/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cumplidos/:trip/documentos/:id/sign — URL firmada (1h) para ver/descargar.
// ?download=1 fuerza la descarga con el nombre legible (nombre_generado) en vez
// del UUID físico del Storage.
app.get('/api/cumplidos/:trip/documentos/:id/sign', requireErpAuth, async (req, res) => {
  try {
    const { trip, id } = req.params;
    const rows = await sbFetch(
      `/cumplidos_documentos?id=eq.${encodeURIComponent(id)}&trip_number=eq.${encodeURIComponent(trip)}&select=ruta_storage,nombre_generado`
    );
    const doc = rows?.[0];
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const result = await sbStorageFetch(`/object/sign/cumplidos/${doc.ruta_storage}`, 'POST', { expiresIn: 3600 });
    if (!result?.signedURL) return res.status(404).json({ error: 'No se pudo generar URL firmada' });
    // result.signedURL es un path relativo a /storage/v1 (ej. "/object/sign/cumplidos/{path}?token=..."),
    // NO relativo a la raíz del dominio. Anteponer solo el dominio omite el
    // segmento /storage/v1 y produce una ruta que Supabase Storage rechaza
    // con "requested path is invalid". SB_STORAGE_URL ya incluye /storage/v1
    // (línea 62) — es el mismo prefijo usado para todas las demás llamadas a
    // Storage en este archivo (carga, reemplazo, eliminación, listado).
    let url = result.signedURL.startsWith('http')
      ? result.signedURL
      : `${SB_STORAGE_URL}${result.signedURL}`;
    if (req.query.download === '1') {
      url += (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(doc.nombre_generado);
    }
    res.json({ url });
  } catch(e) {
    console.error('❌ GET /api/cumplidos/:trip/documentos/:id/sign:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/cumplidos/:trip/estado — actualiza estado_cumplido (y opcionalmente fecha_cumplido).
app.patch('/api/cumplidos/:trip/estado', requireErpAuth, async (req, res) => {
  try {
    const { trip }                    = req.params;
    const { estado_cumplido, fecha_cumplido } = req.body || {};
    if (!estado_cumplido) return res.status(400).json({ error: 'estado_cumplido requerido' });
    const patch = { estado_cumplido };
    if (fecha_cumplido) patch.fecha_cumplido = fecha_cumplido;
    await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(trip)}`, 'PATCH', patch);
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ PATCH /api/cumplidos/:trip/estado:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/gps — vehículos activos con estado GPS derivado y coordenadas como números.
// Transformación (derivarEstadoGps, parseLatLon, filtrado por
// ESTADOS_MONITOREABLES) en services/reportes/datasetProvider.js (Fase 9B) —
// la misma función alimenta el generador de reportes automáticos.
app.get('/api/gps', requireErpAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(transformarCentroGps(cache.viajes.data, { tripCustomerCache }));
});

// ─── SOLICITUDES (Módulo de Demanda) ─────────────────────────────────────────
app.get('/api/solicitudes', requireLegacyOrErpAuth, async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;
    // Usar fecha local Colombia para el default de "hoy"
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const fechaDesde = desde || hoy;
    const fechaHasta = hasta || hoy;

    // Columnas explícitas — actualizar aquí si se agrega alguna al schema
    const SOL_SELECT = [
      'id','codigo_solicitud','external_ref','estado','creado_en','creado_por',
      'empresa_cliente_id','agencia_id','agencia_nombre',
      'tipo_operacion','tipo_vehiculo','origen','destino',
      'fecha_requerida','observacion_coordinadora',
      'placa_asignada','conductor_nombre','conductor_tel',
      'controlt_trip_number','canal',
    ].join(',');
    let qs = `/solicitudes?order=creado_en.desc&limit=500&select=${SOL_SELECT}`;

    if (estado && estado !== 'todos' && estado !== '') {
      const dbEstado = estado === 'aprobado' ? 'confirmado' : estado;
      qs += `&estado=eq.${encodeURIComponent(dbEstado)}`;
    } else {
      qs += `&estado=in.(pendiente,confirmado,en_ruta,completado,cancelado)`;
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
      external_ref:     s.external_ref              || null,
      cliente:          empMap[s.empresa_cliente_id] || '—',
      agencia:          agMap[s.agencia_id]          || s.agencia_nombre || '—',
      solicitante:      usrMap[s.creado_por]         || '—',
      tipo_operacion:   s.tipo_operacion             || '',
      tipo_vehiculo:    s.tipo_vehiculo              || '',
      origen:           s.origen                    || '',
      destino:          s.destino                   || '',
      fecha_requerida:  s.fecha_requerida            || null,
      estado:           s.estado === 'confirmado' ? 'aprobado' : s.estado,
      creado_en:        s.creado_en,
      canal:            s.canal                     || 'APP',
      placa_asignada:   s.placa_asignada            || null,
      conductor_nombre: s.conductor_nombre          || null,
      conductor_tel:    s.conductor_tel             || null,
      controlt_trip_number: s.controlt_trip_number  || null,
    }));

    res.json(result);
  } catch(e) {
    console.error('❌ GET /api/solicitudes:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/solicitudes/:id — detalle completo para el ERP (interno, sin auth de cliente)
app.get('/api/solicitudes/:id', requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const SOL_SELECT_DETALLE = [
      'id','codigo_solicitud','external_ref','estado','creado_en','creado_por',
      'empresa_cliente_id','agencia_id','agencia_nombre',
      'tipo_operacion','tipo_vehiculo','origen','destino',
      'fecha_requerida','observacion_coordinadora',
      'placa_asignada','conductor_nombre','conductor_tel',
      'controlt_trip_number','canal',
      'fecha_confirmacion','fecha_inicio_real','fecha_fin_real',
      'manifiesto','pct','fecha_cancelacion',
    ].join(',');

    const sols = await sbFetch(
      `/solicitudes?id=eq.${encodeURIComponent(id)}&limit=1&select=${SOL_SELECT_DETALLE}`
    ) || [];
    if (!sols.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const sol = sols[0];

    // Enriquecer con nombres (misma lógica que GET /api/solicitudes)
    const [empresas, agencias, usuarios] = await Promise.all([
      sol.empresa_cliente_id
        ? sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(sol.empresa_cliente_id)}&select=id,razon_social`)
        : Promise.resolve([]),
      sol.agencia_id
        ? sbFetch(`/agencias_cliente?id=eq.${encodeURIComponent(sol.agencia_id)}&select=id,nombre`)
        : Promise.resolve([]),
      sol.creado_por
        ? sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(sol.creado_por)}&select=id,nombre`)
        : Promise.resolve([]),
    ]);

    const cliente     = empresas?.[0]?.razon_social || '—';
    const agencia     = agencias?.[0]?.nombre       || sol.agencia_nombre || '—';
    const solicitante = usuarios?.[0]?.nombre       || null;

    // Buscar viaje activo en caché de ControlT; si no, buscar en histórico cumplidos
    let viaje    = null;
    let cumplido = null;
    if (sol.controlt_trip_number) {
      const tripNum = String(sol.controlt_trip_number);
      viaje = cache.viajes.data.find(v => String(v.trip_number) === tripNum) || null;
      if (!viaje) {
        const cs = await sbFetch(
          `/cumplidos?id=eq.${encodeURIComponent(tripNum)}&select=id,placa,conductor,conductor_tel,fecha_viaje,fecha_finalizacion&limit=1`
        ) || [];
        cumplido = cs[0] || null;
      }
    }

    // Buscar fecha programada en planeados (schedulate_origin → ISO) + validar existencia
    let fechaProgramada  = null;
    let inProgramacion   = false;
    if (sol.controlt_trip_number) {
      const planeadosRows = await sbFetch(
        `/planeados?trip_number=eq.${encodeURIComponent(sol.controlt_trip_number)}&select=schedulate_origin&limit=1`
      ) || [];
      inProgramacion = planeadosRows.length > 0;
      const rawSched = planeadosRows[0]?.schedulate_origin ?? null;
      if (rawSched) {
        const m = String(rawSched).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        fechaProgramada = m
          ? `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}T${m[4]}:${m[5]}:00`
          : null;
      }
    }

    // Prioridad: viaje activo > campos en solicitud > cumplido histórico
    const conductor_nombre   = viaje?.driver_name   || sol.conductor_nombre || cumplido?.conductor  || null;
    const conductor_telefono = viaje
      ? extraerTelefono(viaje.driver_phone, viaje.full_driver) || null
      : (sol.conductor_tel || cumplido?.conductor_tel || null);
    const vehiculo_placa     = viaje?.license_plate  || sol.placa_asignada  || cumplido?.placa      || null;

    res.json({
      // Contrato Solicitud base
      id:               sol.id,
      codigo_solicitud: sol.codigo_solicitud,
      external_ref:     sol.external_ref   || null,
      canal:            sol.canal          || 'APP',
      creado_en:        sol.creado_en,
      solicitante,
      cliente,
      agencia,
      tipo_vehiculo:    sol.tipo_vehiculo  || '',
      tipo_operacion:   sol.tipo_operacion || '',
      origen:           sol.origen         || '',
      destino:          sol.destino        || '',
      fecha_requerida:  sol.fecha_requerida || null,
      estado:           sol.estado === 'confirmado' ? 'aprobado' : sol.estado,
      // Contrato SolicitudDetalle extendido
      conductor_nombre,
      conductor_cedula:   null,
      conductor_telefono,
      conductor_licencia: null,
      vehiculo_placa,
      vehiculo_tipo:      null,
      vehiculo_capacidad: null,
      historial:          [],
      actualizado_en:     sol.fecha_confirmacion || null,
      fecha_inicio_ruta:  cumplido?.fecha_viaje        || sol.fecha_inicio_real || null,
      fecha_fin_ruta:     cumplido?.fecha_finalizacion || sol.fecha_fin_real    || null,
      notas:              sol.observacion_coordinadora || null,
      distancia_km:       null,
      // Campos adicionales para el detalle de solicitud
      controlt_trip_number: sol.controlt_trip_number || null,
      pct:                  sol.pct                  ?? null,
      fecha_confirmacion:   sol.fecha_confirmacion   || null,
      fecha_cancelacion:    sol.fecha_cancelacion    || null,
      fecha_programada:     fechaProgramada,
      // Disponibilidad en módulos relacionados (para habilitar botones de conexión)
      in_programacion: inProgramacion,
      in_viajes:       viaje   !== null,
      in_cumplidos:    cumplido !== null,
    });
  } catch(e) {
    console.error('❌ GET /api/solicitudes/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/solicitudes/:id/estado — cambia estado manualmente (interno, sin auth)
app.patch('/api/solicitudes/:id/estado', requireLegacyOrErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, conductor_nombre, placa_asignada, conductor_tel } = req.body;
    // 'aprobado' es el nombre frontend; Supabase almacena 'confirmado' — igual que en GET.
    const permitidos = ['pendiente', 'aprobado', 'confirmado', 'en_ruta', 'completado', 'cancelado'];
    if (!estado || !permitidos.includes(estado)) {
      return res.status(400).json({ error: `estado inválido: ${estado}` });
    }
    const estadoDB = estado === 'aprobado' ? 'confirmado' : estado;
    const ahora = new Date().toISOString();
    const patch = { estado: estadoDB };
    if (estadoDB === 'confirmado') patch.fecha_confirmacion = ahora;
    if (estadoDB === 'en_ruta')    patch.fecha_inicio_real  = ahora;
    if (estadoDB === 'cancelado')  patch.fecha_cancelacion  = ahora;
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
  // Mutex: evitar ejecuciones concurrentes si un ciclo tarda más de 60 s.
  if (syncCumplidosRunning) {
    console.warn('⚠️  syncCumplidos: ciclo anterior aún activo — omitiendo.');
    return;
  }
  syncCumplidosRunning = true;
  try {
    if (!cache.viajes.data.length) return;

    const ESTADOS_ACTIVOS           = new Set(['LIVE', 'SOLICITADO', 'CUMPLIDO RECIBIDO']);
    // Estados escritos exclusivamente por syncCumplidos durante una finalización automática.
    // Usados para distinguir finalizaciones auto-generadas de estados asignados manualmente.
    const ESTADOS_AUTO_FINALIZACION = new Set(['FINALIZADO CONTROLT', 'PENDIENTE LIQUIDACION']);
    const apiSet = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    // Sprint EGRESS-CUMPLIDOS-1 (diseño aprobado): en vez de escanear TODA la
    // tabla `cumplidos` (crece indefinidamente con el histórico), se cargan
    // solo las filas que el resto de esta función puede llegar a necesitar —
    // la unión de dos conjuntos acotados:
    //   Query 1 (id in apiSet): filas del feed activo actual — cubre el
    //     lookup de insert-vs-update más abajo y la reconciliación
    //     (hayFinalizacion), que necesita encontrar la fila aunque ya esté
    //     marcada como finalizada en BD.
    //   Query 2 (estado_cumplido in ESTADOS_ACTIVOS): filas cuyo estado
    //     sigue activo en BD — cubre la detección de viajes que
    //     desaparecieron del feed (bucle de finalización, más abajo), que
    //     necesita encontrarlas aunque ya no estén en apiSet.
    // Toda fila fuera de ambos conjuntos es, por construcción, irrelevante
    // para el resto de esta función: si no está en apiSet, el lookup de
    // arriba no la usa; si además su estado no es activo, `estadoActivo`
    // (bucle de finalización) sería false de todos modos.
    // Dos queries separadas, no or=() — mismo motivo ya documentado en
    // services/customerResolver.js (PGRST100: el parser de or() falla con
    // valores que contienen comas/paréntesis).
    const SELECT_CUMPLIDOS = 'id,estado_cumplido,tiene_soporte,cliente,empresa_cliente_id,' +
      'fecha_finalizacion,estado_controlt,pct,tipo_negocio';
    const SB_PAGE = 500;

    async function cargarCumplidosPaginado(filtroQs) {
      let sbOffset = 0;
      const filas = [];
      while (true) {
        const page = await sbFetch(
          `/cumplidos?select=${SELECT_CUMPLIDOS}&${filtroQs}&limit=${SB_PAGE}&offset=${sbOffset}`
        );
        if (!page || page.length === 0) break;
        filas.push(...page);
        if (page.length < SB_PAGE) break;
        sbOffset += SB_PAGE;
      }
      return filas;
    }

    const idsFeedQs = [...apiSet].map(encodeURIComponent).join(',');
    const filasFeed = idsFeedQs
      ? await cargarCumplidosPaginado(`id=in.(${idsFeedQs})`)
      : [];
    const estadosActivosQs = [...ESTADOS_ACTIVOS].map(encodeURIComponent).join(',');
    const filasActivasEnBD = await cargarCumplidosPaginado(`estado_cumplido=in.(${estadosActivosQs})`);

    const existentes = new Map(
      [...filasFeed, ...filasActivasEnBD].map(c => [c.id, c])
    );

    let insertados = 0, actualizados = 0, revertidos = 0, clientesCreados = 0, placeholdersOmitidos = 0;
    for (const v of cache.viajes.data) {
      if (!v.trip_number) continue;
      const existe = existentes.get(v.trip_number);
      const cliente = (v.company_customer_name || '').split(',')[0].trim();
      const resolved = await resolveTrip(
        { rawName: cliente, existingEmpresaId: existe?.empresa_cliente_id ?? null },
        { lookupMap: customerLookupMap, empresaById: customerLookupById, sbFetch, generarCodigo: generarCodigoCliente, actor: 'sistema:tms' }
      );
      if (resolved.created)     clientesCreados++;
      if (resolved.placeholder) placeholdersOmitidos++;
      if (resolved.empresa_cliente_id) {
        tripCustomerCache.set(v.trip_number, {
          empresa_cliente_id: resolved.empresa_cliente_id,
          razon_social:       resolved.razon_social,
        });
      }

      if (!existe) {
        const row = {
          id:                  v.trip_number,
          manifiesto:          v.number_order || '',
          placa:               v.license_plate || '',
          conductor:           v.driver_name || '',
          conductor_tel:       extraerTelefono(v.driver_phone, v.full_driver),
          cliente:             cliente,
          empresa_cliente_id:  resolved.empresa_cliente_id,
          estado_controlt:     v.state_travel || '',
          estado_cumplido:     'LIVE',
          pct:                 parseFloat(v.percentage_travel) || 0,
          fecha_viaje:         v.activated_on || v.created_on || '',
          origen:              v.origin_city_name || '',
          destino:             v.destiny_city_name || '',
          tipo_negocio:        v.type_operation || '',
          tiene_soporte:       false,
        };
        // Solo contar inserción cuando Supabase confirma éxito.
        const resultado = await sbFetch('/cumplidos', 'POST', row);
        if (resultado !== null) insertados++;
      } else {
        const patch = {
          estado_controlt: v.state_travel || '',
          pct:             parseFloat(v.percentage_travel) || 0,
          tipo_negocio:    v.type_operation || '',
        };
        const existenteEsPlaceholder = isPlaceholderTmsCustomer(existe.cliente);
        if (cliente && !resolved.placeholder && (!existe.cliente || existenteEsPlaceholder)) {
          patch.cliente = cliente;
        }
        if (resolved.empresa_cliente_id && existe.empresa_cliente_id !== resolved.empresa_cliente_id) {
          patch.empresa_cliente_id = resolved.empresa_cliente_id;
        }

        // Reconciliación: cualquier viaje presente en el snapshot de ControlT no puede
        // tener fecha_finalizacion registrada. El snapshot es la única fuente de verdad.
        const hayFinalizacion = !!(existe.fecha_finalizacion);

        if (hayFinalizacion) {
          patch.fecha_finalizacion = null;
          // Solo restaurar a LIVE si el estado era de finalización automática.
          // Si ya es LIVE u otro estado activo (SOLICITADO, CUMPLIDO RECIBIDO), se conserva.
          if (ESTADOS_AUTO_FINALIZACION.has((existe.estado_cumplido || '').toUpperCase())) {
            patch.estado_cumplido = 'LIVE';
          }
        }

        // Sprint EGRESS-1: no reescribir campos cuyo valor ya es idéntico al
        // existente — antes se enviaba `patch` completo en cada ciclo (60s)
        // aunque nada hubiera cambiado (evidencia: 500 PATCH/8min sobre solo
        // ~30 IDs activos). `patch` (arriba) NO se modifica — sigue siendo la
        // fuente de verdad para el log de reconciliación de más abajo, que
        // sigue leyendo `patch.estado_cumplido`/`patch.fecha_finalizacion`
        // exactamente igual que antes. Solo se filtra lo que se envía por red.
        const patchReal = {};
        for (const campo of Object.keys(patch)) {
          if (existe[campo] !== patch[campo]) patchReal[campo] = patch[campo];
        }
        if (Object.keys(patchReal).length > 0) {
          // return=minimal: este PATCH no usa la fila devuelta (nunca se lee
          // el resultado) — override puntual, NO toca el header global
          // (que sigue siendo return=representation para todo lo demás).
          await sbFetch(
            `/cumplidos?id=eq.${encodeURIComponent(v.trip_number)}`,
            'PATCH',
            patchReal,
            { "Prefer": "return=minimal" }
          );
        }

        if (hayFinalizacion) {
          revertidos++;
          // Revertir planeados solo cuando estado_programacion sea 'completado'.
          // El filtro condicional de Supabase garantiza que no hay efecto si ya fue
          // revertido o si corresponde a una finalización legítima distinta.
          await sbFetch(
            `/planeados?trip_number=eq.${encodeURIComponent(v.trip_number)}&estado_programacion=eq.completado`,
            'PATCH',
            { estado_programacion: 'en_ruta', actualizado_en: new Date().toISOString() }
          );
          console.log(
            `↩  syncCumplidos reconciliación | trip:${v.trip_number}` +
            ` | estado_cumplido:${existe.estado_cumplido}${patch.estado_cumplido ? ` → ${patch.estado_cumplido}` : ' (sin cambio)'}` +
            ` | fecha_finalizacion:${existe.fecha_finalizacion} → null` +
            ` | planeados:completado → en_ruta (condicional)` +
            ` | motivo:presente en snapshot ControlT`
          );
        }

        actualizados++;
      }
    }

    // Detección de finalizados: solo ejecutar si el snapshot de ControlT fue completo.
    // Un snapshot parcial (fallo de página 2 o 3) generaría falsas finalizaciones.
    let finalizados = 0;
    if (!cache.viajes.completo) {
      console.warn('⚠️  syncCumplidos: snapshot parcial — lógica de finalización suspendida en este ciclo.');
    } else {
      for (const [id, c] of existentes) {
        const estadoActivo = ESTADOS_ACTIVOS.has((c.estado_cumplido || '').toUpperCase());
        if (estadoActivo && !apiSet.has(id)) {
          const nuevoEstado = c.tiene_soporte ? 'PENDIENTE LIQUIDACION' : 'FINALIZADO CONTROLT';
          await sbFetch(
            `/cumplidos?id=eq.${encodeURIComponent(id)}`,
            'PATCH',
            { estado_cumplido: nuevoEstado, fecha_finalizacion: new Date().toISOString() }
          );
          // Verificar estado sticky antes de propagar COMPLETADO — CANCELADO nunca se sobreescribe
          const planeadoActual = await sbFetch(
            `/planeados?trip_number=eq.${encodeURIComponent(id)}&select=estado_programacion`
          );
          if (planeadoActual?.[0]?.estado_programacion === 'cancelado') {
            console.log(`🔒 Cumplido ${id} → ${nuevoEstado} | Planeado cancelado — sticky, COMPLETADO omitido`);
          } else {
            await sbFetch(
              `/planeados?trip_number=eq.${encodeURIComponent(id)}`,
              'PATCH',
              { estado_programacion: 'completado', actualizado_en: new Date().toISOString() }
            );
            console.log(`🏁 Cumplido ${id} → ${nuevoEstado} | Planeado → completado`);
          }
          finalizados++;
        }
      }
    }

    console.log(`✅ Cumplidos sync: +${insertados} nuevos, ~${actualizados} actualizados, 🏁${finalizados} finalizados, ↩${revertidos} revertidos, 👤${clientesCreados} clientes creados, ⏳${placeholdersOmitidos} sin Match TMS`);
  } catch(e) {
    console.error('❌ Error syncCumplidos:', e.message);
  } finally {
    syncCumplidosRunning = false;
  }
}

// ─── SYNC SOLICITUDES — portal cliente, corre cada 65s ──
async function syncSolicitudes() {
  try {
    if (!cache.viajes.data.length) {
      console.log('📋 syncSolicitudes: cache.viajes vacío, omitiendo ciclo.');
      return;
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
    ) || [];
    // No retornar en 0 filas: el bloque de reconciliación (más abajo) debe
    // ejecutarse siempre, aunque no haya solicitudes pendiente/confirmado/en_ruta.
    if (!solicitudes.length) {
      console.log('📋 syncSolicitudes: sin solicitudes activas — continúa a reconciliación.');
    } else {
      console.log(`📋 syncSolicitudes: evaluando ${solicitudes.length} solicitudes.`);
    }

    const ahora        = new Date().toISOString();
    const orphanCutoff = new Date(Date.now() - ORPHAN_HOURS * 3600 * 1000).toISOString();
    const updates      = [];
    const insertsNotif = [];
    const pendVerif    = []; // trip_numbers ausentes de /Resume — se verifican contra cumplidos

    for (const sol of solicitudes) {
      const { id, codigo_solicitud, external_ref, estado, controlt_trip_number,
              creado_por, fecha_requerida, observacion_coordinadora, empresa_cliente_id: solEmpresaId } = sol;

      // Clave de match: external_ref normalizado si está puesto, sino codigo_solicitud.
      // _normRemision garantiza que "NHR-   TO-2743" == "NHR-TO-2743" == "nhr-to-2743".
      const matchKey = _normRemision(external_ref || '') || codigo_solicitud;

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
          console.log(`✅ [MATCH] ${codigo_solicitud} → trip ${vR.trip_number} (${vR.license_plate || '—'}) | pendiente → ${ne}`);
          updates.push({ id, fields: _fields(vR, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vR, 'pendiente'));
          if (solEmpresaId) await propagarEmpresaId(vR.trip_number, solEmpresaId);
          continue;
        }
        const vP = pendientesByRemission.get(matchKey);
        if (vP) {
          const g  = _grupo(vP.state_travel);
          const ne = (g === 'en_ruta' || g === 'completado' || g === 'cancelado') ? g : 'confirmado';
          console.log(`✅ [MATCH] ${codigo_solicitud} → trip ${vP.trip_number} (pendientes) | pendiente → ${ne}`);
          updates.push({ id, fields: _fields(vP, ne, ahora, true) });
          insertsNotif.push(..._notifs(sol, ne, vP, 'pendiente'));
          if (solEmpresaId) await propagarEmpresaId(vP.trip_number, solEmpresaId);
        }

      } else if (estado === 'confirmado') {
        const vR = controlt_trip_number
          ? resumeByTripNumber.get(controlt_trip_number)
          : resumeByRemission.get(matchKey);
        if (vR) {
          if (solEmpresaId) await propagarEmpresaId(vR.trip_number, solEmpresaId);
          const g = _grupo(vR.state_travel);
          if (g === 'en_ruta' || g === 'completado' || g === 'cancelado') {
            console.log(`🔄 [ESTADO] ${codigo_solicitud}: confirmado → ${g}`);
            updates.push({ id, fields: _fields(vR, g, ahora, false) });
            insertsNotif.push(..._notifs(sol, g, vR, 'confirmado'));
          } else {
            updates.push({ id, fields: { estado_controlt: (vR.state_travel||'').toLowerCase().trim(), ultima_actualizacion_controlt: ahora } });
          }
        } else if (controlt_trip_number) {
          pendVerif.push({ sol, controlt_trip_number });
        } else {
          console.warn(`⚠️ [syncSolicitudes] ${codigo_solicitud}: confirmado sin controlt_trip_number`);
        }

      } else if (estado === 'en_ruta') {
        const vR = controlt_trip_number ? resumeByTripNumber.get(controlt_trip_number) : null;
        if (vR) {
          if (solEmpresaId) await propagarEmpresaId(vR.trip_number, solEmpresaId);
          const g = _grupo(vR.state_travel);
          if (g === 'completado' || g === 'cancelado') {
            console.log(`🔄 [ESTADO] ${codigo_solicitud}: en_ruta → ${g}`);
            updates.push({ id, fields: _fields(vR, g, ahora, false) });
            insertsNotif.push(..._notifs(sol, g, vR, 'en_ruta'));
          } else {
            // Viaje sigue activo: actualizar estado_controlt y datos del conductor/vehículo
            const keepFresh = {
              estado_controlt:               (vR.state_travel||'').toLowerCase().trim(),
              ultima_actualizacion_controlt: ahora,
              pct:                           vR.percentage_travel != null ? parseFloat(vR.percentage_travel) : undefined,
            };
            if (vR.license_plate) keepFresh.placa_asignada   = vR.license_plate;
            if (vR.driver_name)   keepFresh.conductor_nombre = vR.driver_name;
            if (vR.driver_phone)  keepFresh.conductor_tel    = extraerTelefono(vR.driver_phone, vR.full_driver);
            if (keepFresh.pct === undefined) delete keepFresh.pct;
            updates.push({ id, fields: keepFresh });
          }
        } else if (controlt_trip_number) {
          pendVerif.push({ sol, controlt_trip_number });
        }
      }
    }

    // pendVerif: trips ausentes de /Resume — verificar en cumplidos si ya fueron finalizados.
    // ControlT (/Resume) sigue siendo la única fuente del estado operativo mientras el viaje
    // exista ahí; cumplidos actúa solo como validación final, y solo se confía en su marca de
    // finalización cuando ya lleva al menos un ciclo completo de /Resume sin que el viaje haya
    // reaparecido — así una ausencia transitoria de un único ciclo no cierra la solicitud.
    const PENDVERIF_GRACE_MS = 90 * 1000;
    if (pendVerif.length > 0) {
      const tripNums = [...new Set(pendVerif.map(p => p.controlt_trip_number))];
      const idsStr   = tripNums.map(encodeURIComponent).join(',');
      const finalizados = await sbFetch(
        `/cumplidos?id=in.(${idsStr})&estado_cumplido=eq.FINALIZADO%20CONTROLT&select=id,estado_cumplido,estado_controlt,fecha_finalizacion`
      ) || [];
      const finalizadosSet = new Map(finalizados.map(c => [c.id, c]));
      for (const { sol: pSol, controlt_trip_number: tripNum } of pendVerif) {
        const cumplido = finalizadosSet.get(tripNum);
        if (!cumplido) {
          console.log(`⏸ [pendVerif] ${pSol.codigo_solicitud}: trip ${tripNum} ausente de /Resume y de cumplidos finalizados — estado mantenido: ${pSol.estado}`);
          continue;
        }
        const antiguedadMs = cumplido.fecha_finalizacion
          ? Date.now() - new Date(cumplido.fecha_finalizacion).getTime()
          : Infinity;
        if (antiguedadMs < PENDVERIF_GRACE_MS) {
          console.log(`⏸ [pendVerif] ${pSol.codigo_solicitud}: trip ${tripNum} finalizado hace ${Math.round(antiguedadMs / 1000)}s (<${PENDVERIF_GRACE_MS / 1000}s) — esperando confirmación del próximo ciclo de /Resume antes de cerrar`);
          continue;
        }
        console.log(`✅ [pendVerif] ${pSol.codigo_solicitud}: trip ${tripNum} → FINALIZADO CONTROLT en cumplidos (confirmado hace ${Math.round(antiguedadMs / 1000)}s) — cerrando solicitud como completado`);
        updates.push({ id: pSol.id, fields: {
          estado:                        'completado',
          estado_controlt:               'finalizado controlt',
          ultima_actualizacion_controlt: ahora,
          pct:                           100,
          fecha_fin_real:                ahora,
        }});
        insertsNotif.push(..._notifs(pSol, 'completado', {}, pSol.estado));
      }
    }

    // Reconciliación: solicitudes en 'completado' cuyo viaje reaparece en /Resume
    // con estado operativo. Pase secundario acotado — solo consulta los trip_numbers
    // activos y operativos del ciclo actual.
    const operationalTrips = [];
    for (const [tripNum, v] of resumeByTripNumber) {
      const g = _grupo(v.state_travel);
      if (g === 'confirmado' || g === 'en_ruta') operationalTrips.push(tripNum);
    }
    if (operationalTrips.length > 0) {
      const idsStr = operationalTrips.map(encodeURIComponent).join(',');
      const completadas = await sbFetch(
        `/solicitudes?controlt_trip_number=in.(${idsStr})&estado=eq.completado` +
        `&select=id,codigo_solicitud,controlt_trip_number`
      ) || [];
      for (const sol of completadas) {
        const vR = resumeByTripNumber.get(sol.controlt_trip_number);
        if (!vR) continue;
        const g = _grupo(vR.state_travel);
        if (g === 'confirmado' || g === 'en_ruta') {
          console.log(`♻️ [RECONCILIAR] ${sol.codigo_solicitud}: completado → en_ruta (trip ${sol.controlt_trip_number}, state_travel=${vR.state_travel})`);
          updates.push({ id: sol.id, fields: {
            estado:                        'en_ruta',
            estado_controlt:               (vR.state_travel || '').toLowerCase().trim(),
            fecha_fin_real:                null,
            ultima_actualizacion_controlt: ahora,
          }});
        }
      }
    }

    let updOk = 0;
    for (const { id, fields } of updates) {
      const r = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(id)}`, 'PATCH', fields);
      if (r !== null) updOk++;
      else console.error(`❌ [syncSolicitudes] Supabase rechazó PATCH para solicitud ${id} — campos: ${Object.keys(fields).join(', ')}`);
    }
    for (let i = 0; i < insertsNotif.length; i += 50) {
      const lote = insertsNotif.slice(i, i + 50).map(({ _push, ...fila }) => fila);
      await sbFetch('/notificaciones_cliente', 'POST', lote);
    }

    // Despachar push vía Notification Orchestrator (fire-and-forget — nunca bloquea el sync)
    // Reemplaza el enviarPush() directo de Sprint 4.4/Fase 4A (ver nota junto a
    // su definición, más arriba): el Orchestrator ya cubre exactamente el mismo
    // envío (mismas suscripciones, mismo webpush.sendNotification, misma
    // desactivación en 404/410 — ver services/channels/pushChannel.js) más
    // idempotencia (business_events.idempotency_key) y estados de entrega
    // (delivered/failed/skipped/suppressed). Mantener ambas rutas activas
    // enviaría dos notificaciones push duplicadas por cada cambio de estado.
    if (insertsNotif.length > 0) {
      await Promise.allSettled(
        insertsNotif
          .filter((notif) => notif._push)
          .map((notif) => {
            const tag   = notif._push.tag;             // "push-{estado}-{uuid}"
            const parts = tag.split('-');               // ['push', 'confirmado'|'en_ruta'|…, ...uuid]
            const tipo  = `SERVICIO_${parts[1].toUpperCase()}`;
            return publishBusinessEvent({
              tipo,
              usuario_id:      notif.usuario_id,
              empresa_id:      null,
              solicitud_id:    notif.solicitud_id,
              titulo:          notif.titulo,
              mensaje:         notif.mensaje,
              pushPayload:     notif._push,
              prioridad:       'HIGH',
              idempotency_key: tag,
            }, { sbFetch, sbAuthAdmin });
          })
      );
    }

    console.log(`📋 syncSolicitudes OK: ${updOk}/${updates.length} upd | ${insertsNotif.length} notifs`);
  } catch(e) {
    console.error('❌ Error syncSolicitudes:', e.message);
  }
}

// Propaga empresa_cliente_id desde la solicitud hacia planeados/cumplidos y tripCustomerCache.
// Se llama cuando syncSolicitudes confirma un match entre solicitud y viaje del TMS.
async function propagarEmpresaId(tripNumber, empresaId) {
  if (!tripNumber || !empresaId) return;
  const razon_social = customerLookupById.get(empresaId) ?? null;
  tripCustomerCache.set(tripNumber, { empresa_cliente_id: empresaId, razon_social });
  const tn = encodeURIComponent(tripNumber);
  await Promise.all([
    sbFetch(`/planeados?trip_number=eq.${tn}`, 'PATCH', { empresa_cliente_id: empresaId }),
    sbFetch(`/cumplidos?id=eq.${tn}`, 'PATCH', { empresa_cliente_id: empresaId }),
  ]).catch(err => console.error('⚠️  propagarEmpresaId:', err.message));
}

// Normaliza una remisión para el matching: elimina espacios alrededor de guiones,
// colapsa espacios múltiples y convierte a mayúsculas.
// Exclusivamente para comparación — nunca modifica el dato almacenado.
function _normRemision(s) {
  return (s || '').trim()
    .replace(/\s*-\s*/g, '-')  // "NHR-  TO" → "NHR-TO", "NHR - TO" → "NHR-TO"
    .replace(/\s+/g, ' ')      // colapsar espacios múltiples residuales
    .toUpperCase();
}

function _splitRem(remission) {
  // ControlT devuelve remission como ",val1,val2". Se normaliza cada parte para matching.
  return (remission || '').split(',')
    .map(_normRemision)
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
  if (viaje?.trip_number)    f.controlt_trip_number = String(viaje.trip_number);
  if (viaje?.number_order)   f.manifiesto            = String(viaje.number_order);
  if (viaje?.license_plate)  f.placa_asignada        = viaje.license_plate;
  if (viaje?.driver_name)    f.conductor_nombre      = viaje.driver_name;
  if (viaje?.driver_phone)   f.conductor_tel         = extraerTelefono(viaje.driver_phone, viaje.full_driver);
  // Primer enlace: la solicitud se creó tarde, el viaje ya estaba activo
  if (esPrimerEnlace)        f.fecha_confirmacion    = ahora;
  // Si llega en_ruta (o salta de pendiente directo a en_ruta) registrar fecha_inicio_real
  if (nuevoEstado === 'en_ruta' || (esPrimerEnlace && nuevoEstado !== 'pendiente' && nuevoEstado !== 'confirmado')) {
    f.fecha_inicio_real = ahora;
  }
  if (nuevoEstado === 'completado') f.fecha_fin_real    = ahora;
  if (nuevoEstado === 'cancelado')  f.fecha_cancelacion = ahora;
  return f;
}

// `_push` viaja junto al registro pero NUNCA se persiste en notificaciones_cliente
// (no existe esa columna, ver supabase/migrations 0001) — se extrae y se
// descarta justo antes del INSERT (syncSolicitudes) y solo se usa para
// construir el payload del canal Push (mismo action_type/action_payload que
// consume executeEventAction en el frontend, Blueprint v3.0 §5.2/§5.4).
function _notifs(sol, nuevoEstado, viaje, estadoAnterior) {
  const cod   = sol.codigo_solicitud;
  const placa = viaje?.license_plate || '';
  const cond  = viaje?.driver_name   || '';
  const obs   = sol.observacion_coordinadora ? `\n${sol.observacion_coordinadora}` : '';
  const uid   = sol.creado_por;
  const sid   = sol.id;
  const push  = (actionType) => ({
    action_type:    actionType,
    action_payload: { servicio_id: sid },
    tag:            `push-${nuevoEstado}-${sid}`,
  });
  const n = (tipo, titulo, mensaje, actionType = 'OPEN_SERVICE') => ({
    usuario_id: uid, solicitud_id: sid, tipo, titulo, mensaje,
    _push: push(actionType),
  });
  if (nuevoEstado === 'confirmado' && estadoAnterior === 'pendiente')
    return [n('confirmacion', 'Servicio confirmado', `Tu servicio ${cod} ha sido confirmado. Vehículo: ${placa}. Conductor: ${cond}.${obs}`)];
  if (nuevoEstado === 'en_ruta' && estadoAnterior === 'pendiente')
    return [n('confirmacion', 'Servicio en camino', `Tu servicio ${cod} fue confirmado y ya está en operación. Vehículo: ${placa}. Conductor: ${cond}.${obs}`, 'OPEN_TRACKING')];
  if (nuevoEstado === 'en_ruta' && estadoAnterior === 'confirmado')
    return [n('info', 'Tu servicio está en camino', `El servicio ${cod} inició operación.`, 'OPEN_TRACKING')];
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
    const r = await fetchConTimeout(`${SB_AUTH_URL}/user`, {
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

// ─── UNIFIED AUTHORIZATION SCOPE — Sprint 4.7 ──────────────────────────────
// Resuelve una sola vez por request el Scope (empresa + agencia) del usuario
// ya autenticado por requireClienteAuth, y lo deja en req.scope para que
// todos los endpoints de /servicios* lo reutilicen (ver services/authScope.js
// y CLAUDE.md §5.5). Se monta después de requireClienteAuth, nunca antes —
// depende de req.userId/req.empresaId/req.userPerfil que esa función coloca.
async function attachScope(req, res, next) {
  try {
    req.scope = await resolverScopeUsuario(
      { userId: req.userId, empresaId: req.empresaId, perfil: req.userPerfil },
      { sbFetch }
    );
    next();
  } catch (e) {
    console.error('❌ attachScope:', e.message);
    res.status(500).json({ error: 'Error resolviendo permisos' });
  }
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
    fecha_fin_real:    cumplido?.fecha_finalizacion || sol.fecha_fin_real || null,
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

// ─── ENRIQUECIMIENTO CONTROLT (Fase 5) ──────────────────────────────────────
// Único punto del backend que agrega la información SOAP de ControlT a una
// respuesta de /servicios. Toda llamada a ControlT pasa por
// tripService.getTripDetail — este backend NUNCA importa soapGateway ni
// authManager directamente fuera del módulo controlt-soap.
//
// Contrato reutilizable: la forma de "controlt" es la misma sin importar el
// consumidor (Portal Cliente, ERP, App Conductor, APIs internas) — no existen
// variantes por cliente. `disponible` es el único indicador que el frontend
// necesita revisar; el resto de campos siempre tiene la misma forma (null
// cuando no hay dato, nunca ausente).
//
// Degradación: cualquier fallo de ControlT (timeout, red, viaje no
// encontrado, fault SOAP) se absorbe aquí y retorna controltVacio() — el
// endpoint jamás falla por una caída de ControlT.
function controltVacio() {
  return {
    disponible:            false,
    codigo_controlt:       null,
    estado_viaje:          null,
    conductor:             null,
    tipo_operacion_codigo: null,
    tipo_viaje_codigo:     null,
    tipo_carga_codigo:     null,
    carga: {
      valor_mercancia: null,
      moneda:          null,
      valor_flete:     null,
      peso_total_ton:  null,
      volumen_total:   null,
      temperatura_min: null,
      temperatura_max: null,
    },
    instrucciones:    null,
    paradas:          [],
    ubicacion_actual: null,
    fecha_evento:     null,
    sincronizado_en:  null,
  };
}

// viajeActivo: fila de cache.viajes (Resume API) — misma fuente que
// GET /servicios/:id/vehiculo usa para la posición GPS en vivo. Los paradas
// de ControlT (SOAP) son puntos fijos de la ruta; ubicacion_actual es la
// posición del vehículo en tiempo real, dato distinto que solo Resume expone.
async function construirControltEnriquecido(tripNumber, viajeActivo) {
  if (!tripNumber) return controltVacio();

  let detalle;
  try {
    detalle = await getTripDetail(String(tripNumber), { sbFetch: controltSbFetch });
  } catch (e) {
    console.error(`❌ tripService.getTripDetail(${tripNumber}):`, e.message);
    return controltVacio();
  }

  const ubicacion_actual = (() => {
    if (!viajeActivo) return null;
    const lat = parseFloat(viajeActivo.latitude ?? viajeActivo.lat ?? '');
    const lng = parseFloat(viajeActivo.longitude ?? viajeActivo.lng ?? '');
    if (!lat || !lng) return null;
    return { lat, lng, ultima_actualizacion: viajeActivo.latest_gps_report || null };
  })();

  return {
    disponible:      true,
    codigo_controlt: detalle.codigo_controlt,
    estado_viaje:    detalle.estado_viaje,
    conductor: (detalle.conductor_cedula || detalle.conductor_nombre)
      ? { cedula: detalle.conductor_cedula, nombre: detalle.conductor_nombre }
      : null,
    tipo_operacion_codigo: detalle.tipo_operacion_codigo,
    tipo_viaje_codigo:     detalle.tipo_viaje_codigo,
    tipo_carga_codigo:     detalle.tipo_carga_codigo,
    carga: {
      valor_mercancia: detalle.valor_mercancia,
      moneda:          detalle.moneda,
      valor_flete:     detalle.valor_flete,
      peso_total_ton:  detalle.peso_total_ton,
      volumen_total:   detalle.volumen_total,
      temperatura_min: detalle.temperatura_min,
      temperatura_max: detalle.temperatura_max,
    },
    instrucciones: detalle.instrucciones,
    paradas:       detalle.paradas || [],
    ubicacion_actual,
    fecha_evento:    detalle.fecha_evento,
    sincronizado_en: detalle.soap_sincronizado_en || null,
  };
}

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });
  try {
    const r = await fetchConTimeout(`${SB_AUTH_URL}/token?grant_type=password`, {
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
    const r = await fetchConTimeout(`${SB_AUTH_URL}/user`, {
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
    // redirect_to va como query param (no en el body) — así lo construye el
    // propio SDK de Supabase (auth-js `resetPasswordForEmail`) contra este
    // mismo endpoint GoTrue. Sin CLIENT_PORTAL_URL configurada, se omite el
    // parámetro y GoTrue cae a su comportamiento previo (Site URL del proyecto).
    const recoverUrl = CLIENT_PORTAL_URL
      ? `${SB_AUTH_URL}/recover?redirect_to=${encodeURIComponent(`${CLIENT_PORTAL_URL}/recuperar-confirmar`)}`
      : `${SB_AUTH_URL}/recover`;
    await fetchConTimeout(recoverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ email })
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── GESTIÓN DE USUARIOS (admin_cliente only) ────────────
// Requiere SUPABASE_SERVICE_KEY en Railway (service_role key de Supabase).
// Mismo secreto que SB_KEY (ver sección SUPABASE arriba) — un solo alias.

const SB_SERVICE_KEY = SB_KEY;

// Errores de Supabase Auth (GoTrue) que sabemos traducir a una respuesta
// clara para el frontend. `status` es el HTTP que devolvemos nosotros
// (no necesariamente el mismo que Supabase); `message` es el texto que
// termina mostrándose en un Toast al usuario — nunca el mensaje técnico
// original de Supabase.
const SUPABASE_AUTH_ERROR_MAP = {
  email_exists:            { status: 409, message: 'Ya existe un usuario registrado con este correo.' },
  weak_password:           { status: 400, message: 'La contraseña es demasiado débil. Usa al menos 8 caracteres, combinando letras y números.' },
  invalid_email:           { status: 400, message: 'El correo electrónico no es válido.' },
  email_address_invalid:   { status: 400, message: 'El correo electrónico no es válido.' },
  validation_failed:       { status: 400, message: 'Los datos ingresados no son válidos. Revisa el formulario.' },
  signup_disabled:         { status: 403, message: 'La creación de usuarios está deshabilitada temporalmente.' },
  over_request_rate_limit: { status: 429, message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
};

// Fallback para versiones de GoTrue que no envían `error_code` estructurado
// y solo devuelven un `msg` en texto libre — mismo mapeo, detectado por patrón.
const SUPABASE_AUTH_LEGACY_MESSAGE_PATTERNS = [
  { test: /already registered|already exists/i, code: 'email_exists' },
  { test: /password.*(weak|short|at least|should be)/i, code: 'weak_password' },
  { test: /invalid.*email|unable to validate email/i, code: 'invalid_email' },
];

function resolveSupabaseAuthErrorCode(errorCode, message) {
  if (errorCode && SUPABASE_AUTH_ERROR_MAP[errorCode]) return errorCode;
  if (!message) return null;
  const legacy = SUPABASE_AUTH_LEGACY_MESSAGE_PATTERNS.find(({ test }) => test.test(message));
  return legacy ? legacy.code : null;
}

// Error estructurado que preserva el status/código de Supabase Auth, para
// poder mapearlo en el handler sin perder la información (a diferencia de
// devolver `null`, que descartaba el motivo real del fallo).
class SupabaseAuthAdminError extends Error {
  constructor(httpStatus, rawBody) {
    let parsed = null;
    try { parsed = JSON.parse(rawBody); } catch { /* body no era JSON */ }
    const errorCode = parsed?.error_code || parsed?.code;
    const supaMessage = parsed?.msg || parsed?.message || parsed?.error_description || rawBody;
    super(supaMessage || `Supabase Auth Admin API respondió ${httpStatus}`);
    this.name = 'SupabaseAuthAdminError';
    this.httpStatus = httpStatus; // status HTTP que devolvió Supabase (ej. 422)
    this.errorCode = errorCode;   // ej. "email_exists" (puede ser undefined en respuestas legacy)
  }
}

// Traduce un SupabaseAuthAdminError a la respuesta que debe recibir el
// frontend. Reutilizable por cualquier endpoint que escriba en Supabase Auth
// (hoy solo POST /usuarios). Devuelve `true` si ya respondió, `false` si el
// error no es un SupabaseAuthAdminError y el caller debe manejarlo distinto.
function respondSupabaseAuthError(err, res, context) {
  if (!(err instanceof SupabaseAuthAdminError)) return false;

  const code = resolveSupabaseAuthErrorCode(err.errorCode, err.message);
  const mapped = code ? SUPABASE_AUTH_ERROR_MAP[code] : null;

  if (mapped) {
    res.status(mapped.status).json({ error: mapped.message });
    return true;
  }

  // Supabase respondió con un error conocido (4xx propio) pero sin mapeo
  // específico todavía — no es un fallo de nuestro backend, así que no es
  // un 500. Se registra el código real para poder agregarlo al mapeo, y se
  // responde con un mensaje genérico pero amigable (nunca el texto técnico
  // de Supabase ni un stack trace).
  console.error(`❌ ${context} — error_code de Supabase Auth sin mapear: ${err.errorCode || '(sin código)'} — ${err.message}`);
  const status = err.httpStatus >= 400 && err.httpStatus < 500 ? err.httpStatus : 400;
  res.status(status).json({ error: 'No se pudo completar la operación. Verifica los datos ingresados.' });
  return true;
}

async function sbAuthAdmin(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'apikey': SB_SERVICE_KEY, 'Authorization': `Bearer ${SB_SERVICE_KEY}`, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetchConTimeout(`${SB_AUTH_URL}${path}`, opts);
  if (!r.ok) {
    const txt = await r.text();
    console.error(`SbAuthAdmin ${method} ${path} → ${r.status}: ${txt}`);
    throw new SupabaseAuthAdminError(r.status, txt);
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
  } catch(e) {
    // Errores conocidos de Supabase Auth (ej. email_exists) no son un fallo
    // de nuestro backend — se mapean a un status/mensaje claro, sin 500 y
    // sin stack trace en la respuesta.
    if (respondSupabaseAuthError(e, res, 'POST /usuarios')) return;

    // Solo los errores verdaderamente inesperados conservan el stack trace,
    // y únicamente en los logs del servidor — el cliente nunca lo recibe.
    console.error('❌ POST /usuarios:', e.stack || e.message);
    res.status(500).json({ error: 'Ocurrió un error inesperado al crear el usuario. Intenta de nuevo.' });
  }
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
    await sbFetch(`/usuario_agencias?usuario_id=eq.${encodeURIComponent(req.params.id)}`, 'DELETE');
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
    const conteoMap = {};
    if (ids.length) {
      const pivotRows = await sbFetch(
        `/usuario_agencias?agencia_id=in.(${ids})&select=usuario_id,agencia_id`
      ).catch(() => []) || [];
      if (pivotRows.length > 0) {
        const uids = [...new Set(pivotRows.map(r => encodeURIComponent(r.usuario_id)))].join(',');
        const activosRows = await sbFetch(
          `/usuarios_cliente?id=in.(${uids})&activo=eq.true&select=id`
        ).catch(() => []) || [];
        const activoSet = new Set(activosRows.map(u => u.id));
        for (const r of pivotRows) {
          if (activoSet.has(r.usuario_id)) {
            conteoMap[r.agencia_id] = (conteoMap[r.agencia_id] || 0) + 1;
          }
        }
      }
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
      `/usuarios_cliente?id=in.(${uids})&empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&activo=eq.true&order=nombre.asc`
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
// Sprint 4.7: todas las rutas de /servicios* comparten un único Router con
// requireClienteAuth + attachScope montados una sola vez (antes se repetía
// requireClienteAuth por endpoint y cada uno validaba — o no — empresa/
// agencia por su cuenta). Todo acceso a `solicitudes` pasa por
// construirFiltroScope()/obtenerSolicitudEnScope() — ningún endpoint compara
// empresa_cliente_id/agencia_id manualmente. Recursos fuera del scope
// devuelven 404 de forma consistente (nunca 403): no se confirma a un
// usuario sin acceso que el recurso existe en otra empresa/agencia.
const serviciosRouter = express.Router();
serviciosRouter.use(requireClienteAuth, attachScope);

serviciosRouter.get('/', async (req, res) => {
  try {
    const { estado, tipoOperacion, tipoVehiculo, agenciaId, busqueda, desde, hasta } = req.query;
    const filtroScope = construirFiltroScope(req.scope, { agenciaId });
    if (filtroScope === null) return res.json([]);

    let qs = `/solicitudes?${filtroScope}&order=creado_en.desc&limit=200`;
    if (estado)        qs += `&estado=eq.${encodeURIComponent(estado === 'aprobado' ? 'confirmado' : estado)}`;
    if (tipoOperacion) qs += `&tipo_operacion=eq.${encodeURIComponent(tipoOperacion)}`;
    if (tipoVehiculo)  qs += `&tipo_vehiculo=in.(${String(tipoVehiculo).split(',').map(encodeURIComponent).join(',')})`;
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
serviciosRouter.get('/:id', async (req, res) => {
  try {
    const sol = await obtenerSolicitudEnScope(req.params.id, req.scope, { sbFetch });
    if (!sol) return res.status(404).json({ error: 'Servicio no encontrado' });
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
    const respuesta = mapSolicitud(sol, viaje, cumplido);
    // Fase 5: enriquecimiento ControlT — contrato reutilizable, ver
    // construirControltEnriquecido(). Nunca lanza: degrada a controltVacio().
    respuesta.controlt = await construirControltEnriquecido(sol.controlt_trip_number, viaje);
    res.json(respuesta);
  } catch(e) {
    console.error('❌ GET /servicios/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /servicios/:id/paradas
//
// Lógica de dos capas:
//   1) SI el viaje tiene controlt_trip_number → reutilizar tripService.getTripDetail
//      (única fuente autorizada de datos ControlT) para obtener las paradas
//      enriquecidas del SOAP: coordenadas, productos, horarios reales.
//   2) SOLO cuando no existan paradas enriquecidas (sin viaje asignado, tripService
//      falla, o el viaje no tiene paradas definidas) → fallback Origen/Destino.
//
// PROHIBIDO: llamar directamente a ControlT (CT_PUBLIC_URL, getCtPublicToken, etc.)
// desde este endpoint. Todo dato de ControlT pasa por tripService.getTripDetail —
// ver regla permanente en docs/integraciones/controlt/ARQUITECTURA_DATOS_VIAJE.md
// Apéndice C. Nunca modifica /api/viajes/:tripNumber, la integración SOAP, la
// persistencia, sincronización ni el caché.
serviciosRouter.get('/:id/paradas', async (req, res) => {
  try {
    const sol = await obtenerSolicitudEnScope(req.params.id, req.scope, {
      sbFetch, select: 'id,empresa_cliente_id,origen,destino,estado,controlt_trip_number',
    });
    if (!sol) return res.status(404).json({ error: 'Servicio no encontrado' });

    // ── Capa 1: paradas enriquecidas vía tripService (fuente única — SOAP/caché) ─
    if (sol.controlt_trip_number) {
      try {
        const detalle = await getTripDetail(String(sol.controlt_trip_number), { sbFetch: controltSbFetch });
        const paradasEnriquecidas = detalle.paradas || [];

        if (paradasEnriquecidas.length > 0) {
          return res.json(paradasEnriquecidas.map(p => ({
            solicitud_id:    sol.id,
            orden:           p.orden,
            nombre:          p.nombre ?? '',
            direccion:       p.direccion ?? '',
            tipo:            p.tipo ?? null,
            estado:          p.estado ?? null,
            hora_programada: p.hora_programada ?? null,
            hora_entrega:    p.hora_real ?? null,
            eta:             p.eta ?? null,
            lat:             p.lat,
            lng:             p.lng,
            remision:        p.remision ?? null,
            productos:       p.productos ?? [],
            cliente:         p.cliente ?? null,
          })));
        }
      } catch (tripErr) {
        // tripService falló (viaje no en ControlT, red, SOAP fault) → fallback
        console.warn(
          `⚠️ GET /servicios/${req.params.id}/paradas: getTripDetail falló para trip ${sol.controlt_trip_number} — usando fallback:`,
          tripErr.message,
        );
      }
    }

    // ── Capa 2: fallback Origen/Destino desde la solicitud ───────────────────────
    // Solo cuando controlt_trip_number no existe O tripService no devolvió paradas.
    const estadoOrigen = sol.estado === 'completado' ? 'entregado'
      : sol.estado === 'en_ruta' ? 'en_camino' : 'pendiente';
    const estadoDestino = sol.estado === 'completado' ? 'entregado' : 'pendiente';

    res.json([
      {
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
// Hallazgo Bloqueante (Auditoría 4.6): este endpoint no validaba empresa NI
// agencia — cualquier usuario autenticado, de cualquier empresa, podía leer
// GPS en vivo + placa de una solicitud ajena conociendo/adivinando su id.
// Ahora pasa por obtenerSolicitudEnScope como cualquier otro endpoint.
serviciosRouter.get('/:id/vehiculo', async (req, res) => {
  try {
    const sol = await obtenerSolicitudEnScope(req.params.id, req.scope, {
      sbFetch, select: 'controlt_trip_number',
    });
    if (!sol) return res.status(404).json({ error: 'Servicio no encontrado' });
    const tripNum = sol.controlt_trip_number;
    if (!tripNum) return res.status(404).json({ error: 'Sin vehículo asignado' });
    const viaje = cache.viajes.data.find(v => String(v.trip_number) === String(tripNum));
    const lat = parseFloat(viaje?.latitude || viaje?.lat || '');
    const lng = parseFloat(viaje?.longitude || viaje?.lng || '');
    if (!viaje || !lat || !lng) return res.status(404).json({ error: 'Sin posición GPS' });
    res.json({
      lat, lng,
      placa: viaje.license_plate || '',
      ultima_actualizacion: viaje.latest_gps_report || new Date().toISOString(),
    });
  } catch(e) {
    console.error('❌ GET /servicios/:id/vehiculo:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /servicios
serviciosRouter.post('/', async (req, res) => {
  try {
    const { tipo_vehiculo, tipo_operacion, origen, destino, fecha_requerida,
            observaciones, agencia_id, agencia_nombre, external_ref } = req.body || {};
    if (!fecha_requerida) return res.status(400).json({ error: 'fecha_requerida requerido' });

    // La agencia declarada debe pertenecer al scope de quien crea la
    // solicitud (mismo principio que ya aplicaba PUT /usuarios/:id/agencias,
    // ausente aquí hasta ahora — Auditoría 4.6, hallazgo Medio #6).
    if (agencia_id && req.scope.agenciaIds !== null && !req.scope.agenciaIds.includes(agencia_id)) {
      return res.status(403).json({ error: 'Agencia fuera de tu alcance' });
    }

    const last = await sbFetch('/solicitudes?select=codigo_solicitud&order=creado_en.desc&limit=1') || [];
    const lastCode = last[0]?.codigo_solicitud;
    const n = lastCode?.startsWith('SOL-') ? parseInt(lastCode.slice(4), 10) : 0;
    const codigo_solicitud = 'SOL-' + String((isNaN(n) ? 0 : n) + 1).padStart(5, '0');

    const normalizedRef = normalizeExternalRef(tipo_vehiculo, external_ref);

    // Validar duplicado de external_ref entre solicitudes activas de la misma empresa.
    // ESTADOS_ACTIVOS usa los nombres de BD (pendiente, confirmado, en_ruta).
    // "confirmado" es cómo la BD almacena el estado que la API expone como "aprobado".
    // "programado" no existe en este sistema — no incluir.
    if (normalizedRef) {
      const ESTADOS_ACTIVOS_DB  = ['pendiente', 'confirmado', 'en_ruta'];
      const ESTADO_LABEL_CLIENTE = {
        pendiente:  'Pendiente',
        confirmado: 'Aprobado',
        en_ruta:    'En Ruta',
      };
      const estadosFilter = ESTADOS_ACTIVOS_DB.join(',');
      const duplicados = await sbFetch(
        `/solicitudes?empresa_cliente_id=eq.${encodeURIComponent(req.empresaId)}&external_ref=eq.${encodeURIComponent(normalizedRef)}&estado=in.(${estadosFilter})&select=codigo_solicitud,estado&limit=1`
      ) || [];
      if (duplicados.length > 0) {
        const dup = duplicados[0];
        const estadoLabel = ESTADO_LABEL_CLIENTE[dup.estado] || dup.estado;
        const estadoApi   = dup.estado === 'confirmado' ? 'aprobado' : dup.estado;
        return res.status(409).json({
          error: `Ya existe una Solicitud activa con esta Referencia Externa. Solicitud: ${dup.codigo_solicitud} — Estado: ${estadoLabel}. Si corresponde a un nuevo servicio, utilice una Referencia Externa diferente.`,
          codigo_solicitud: dup.codigo_solicitud,
          estado:           estadoApi,
        });
      }
    }

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
      external_ref:       normalizedRef,
      fecha_requerida,
      observacion_coordinadora: observaciones || null,
      estado:    'pendiente',
      creado_en: new Date().toISOString(),
    };

    const created = await sbFetch('/solicitudes', 'POST', row);
    if (!created) return res.status(500).json({ error: 'Error creando solicitud' });
    const sol = Array.isArray(created) ? created[0] : created;

    // Despachar SOLICITUD_CREADA vía Notification Orchestrator (fire-and-forget
    // — nunca bloquea la respuesta ni el fallo de notificación afecta al
    // request). Único canal registrado para este evento: email a INLOP ops
    // (EVENT_CHANNELS en notificationOrchestrator.js) — no hay push que
    // esperar aquí, la solicitud aún no tiene destinatario cliente relevante
    // más allá de quien la creó.
    if (sol?.id) {
      publishBusinessEvent({
        tipo:            'SOLICITUD_CREADA',
        usuario_id:      req.userId,
        empresa_id:      req.empresaId,
        solicitud_id:    sol.id,
        titulo:          'Nueva solicitud registrada',
        mensaje:         `Se registró la solicitud ${sol.codigo_solicitud || codigo_solicitud} (${sol.origen || origen || '—'} → ${sol.destino || destino || '—'}), requerida para ${sol.fecha_requerida || fecha_requerida}.`,
        pushPayload:     null,
        prioridad:       'HIGH',
        idempotency_key: `solicitud_creada-${sol.id}`,
      }, { sbFetch, sbAuthAdmin });
    }

    res.status(201).json(mapSolicitud(sol || row));
  } catch(e) {
    console.error('❌ POST /servicios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /servicios/:id
serviciosRouter.patch('/:id', async (req, res) => {
  try {
    const sol = await obtenerSolicitudEnScope(req.params.id, req.scope, { sbFetch });
    if (!sol) return res.status(404).json({ error: 'Servicio no encontrado' });
    if (sol.estado !== 'pendiente') return res.status(400).json({ error: `No editable en estado: ${sol.estado}` });

    const { fecha_requerida, observaciones, origen, destino, tipo_vehiculo, tipo_operacion, external_ref } = req.body || {};
    const patch = {};
    if (fecha_requerida) patch.fecha_requerida          = fecha_requerida;
    if (observaciones)   patch.observacion_coordinadora = observaciones;
    if (origen)          patch.origen                   = origen;
    if (destino)         patch.destino                  = destino;
    if (tipo_vehiculo)   patch.tipo_vehiculo  = tipo_vehiculo;
    if (tipo_operacion)  patch.tipo_operacion = tipo_operacion;

    // Mantener tipo_vehiculo y external_ref como unidad lógica.
    // Cuando el tipo cambia (con o sin nueva ref), se quita el prefijo viejo
    // y se aplica el nuevo, sin acumular: NHR-TO-234 + NKR → NKR-TO-234.
    if (external_ref !== undefined || (tipo_vehiculo && sol.external_ref)) {
      const efectiveTipo = tipo_vehiculo || sol.tipo_vehiculo;
      const efectivoRef  = external_ref !== undefined ? external_ref : sol.external_ref;
      const oldPfx = (sol.tipo_vehiculo || '').trim().toUpperCase()
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
      const payload = (oldPfx && (efectivoRef || '').toUpperCase().startsWith(oldPfx + '-'))
        ? efectivoRef.slice(oldPfx.length + 1)
        : efectivoRef;
      patch.external_ref = normalizeExternalRef(efectiveTipo, payload);
    }

    if (Object.keys(patch).length === 0) {
      return res.json(mapSolicitud(sol));
    }
    const result = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(req.params.id)}`, 'PATCH', patch);
    if (result === null) {
      console.error(`❌ PATCH /servicios/${req.params.id}: Supabase rechazó el update — campos: ${Object.keys(patch).join(', ')}`);
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
serviciosRouter.post('/:id/cancelar', async (req, res) => {
  try {
    const sol = await obtenerSolicitudEnScope(req.params.id, req.scope, { sbFetch });
    if (!sol) return res.status(404).json({ error: 'Servicio no encontrado' });
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

app.use('/servicios', serviciosRouter);

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

// POST /push/suscripcion — registra (o actualiza, si el endpoint ya existía)
// la suscripción Push de este dispositivo/navegador (Fase 4A, Sprint 4.4).
// Upsert vía Prefer: resolution=merge-duplicates (SB_HEADERS, ya default en
// sbFetch) sobre la unicidad de `endpoint` (migración 0002_push_subscriptions.sql).
app.post('/push/suscripcion', requireClienteAuth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'endpoint y keys.{p256dh,auth} son requeridos' });
    }
    const result = await sbFetch('/push_subscriptions?on_conflict=endpoint', 'POST', [{
      usuario_id: req.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: req.headers['user-agent'] || null,
      activo: true,
    }]);
    if (!result) return res.status(500).json({ error: 'Error al registrar la suscripción' });
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ POST /push/suscripcion:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /push/suscripcion — el usuario desactivó Push desde Perfil, o el
// navegador canceló la suscripción. Solo borra la propia (usuario_id + endpoint).
app.delete('/push/suscripcion', requireClienteAuth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint es requerido' });
    await sbFetch(
      `/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&usuario_id=eq.${encodeURIComponent(req.userId)}`,
      'DELETE',
    );
    res.json({ ok: true });
  } catch(e) {
    console.error('❌ DELETE /push/suscripcion:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PREFERENCIAS DE NOTIFICACIÓN (Sprint 6.0) ─────────────────────────
// GET /preferencias/notificaciones — retorna las preferencias de canal del usuario.
// Modelo opt-out: canales sin fila se consideran habilitados.
app.get('/preferencias/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    const prefs = await getUserPreferences(req.userId, { sbFetch });
    res.json(prefs);
  } catch (e) {
    console.error('❌ GET /preferencias/notificaciones:', e.message);
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

// PUT /preferencias/notificaciones — actualiza (upsert) la preferencia de un canal.
app.put('/preferencias/notificaciones', requireClienteAuth, async (req, res) => {
  try {
    const { canal, habilitado } = req.body || {};
    if (!canal || typeof habilitado !== 'boolean') {
      return res.status(400).json({ error: 'canal (string) y habilitado (boolean) son requeridos' });
    }
    if (!KNOWN_CHANNELS.includes(canal)) {
      return res.status(400).json({ error: `Canal no válido. Canales disponibles: ${KNOWN_CHANNELS.join(', ')}` });
    }
    const ok = await updatePreference(req.userId, req.empresaId, canal, habilitado, { sbFetch });
    if (!ok) return res.status(500).json({ error: 'Error al actualizar preferencia' });
    res.json({ ok: true, canal, habilitado });
  } catch (e) {
    console.error('❌ PUT /preferencias/notificaciones:', e.message);
    res.status(500).json({ error: 'Error al actualizar preferencia' });
  }
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
  res.json(['NHR', 'NKR', 'TURBO', 'SENCILLO', 'DOBLE TROQUE', 'MINIMULA', 'TRACTOMULA']);
});

// Planeados — desde Supabase
app.get("/api/planeados", requireErpAuth, async (req, res) => {
  try {
    const hoyStr = fechaHoyColombia();
    const data = await sbFetch(
      `/planeados?fecha_programada_dia=gte.${hoyStr}&order=schedulate_origin.asc&limit=500`
    );
    res.json(data || []);
  } catch(e) {
    console.error("❌ /api/planeados:", e.message);
    res.json([]);
  }
});

// ─── PROGRAMACIÓN ───────────────────────────────────────────────────────────
// REQUIERE migración Supabase (ejecutar una vez):
//   ALTER TABLE planeados
//     ADD COLUMN IF NOT EXISTS estado_programacion text NOT NULL DEFAULT 'programado',
//     ADD COLUMN IF NOT EXISTS observaciones        text,
//     ADD COLUMN IF NOT EXISTS actualizado_en       timestamptz,
//     ADD COLUMN IF NOT EXISTS empresa_cliente_id   uuid REFERENCES empresas_cliente(id);
//   ALTER TABLE cumplidos
//     ADD COLUMN IF NOT EXISTS empresa_cliente_id   uuid REFERENCES empresas_cliente(id);

// GET /api/programacion — bandeja operativa completa del día
// Enriquece cada fila con nombre_cliente: razon_social oficial cuando existe,
// company_customer_name como fallback. El original siempre se conserva.
app.get("/api/programacion", requireErpAuth, async (req, res) => {
  const getId  = ++getProgCounter;
  const tGet0  = Date.now();
  try {
    const { desde, hasta } = req.query;
    const hoyStr = fechaHoyColombia();
    const desdeStr = desde || hoyStr;
    const hastaStr = hasta || hoyStr;

    console.log(`[GET PROGRAMACION #${getId}] hora: ${horaAhora()} | desde: ${desdeStr} | hasta: ${hastaStr} | último SYNC completado: #${lastSyncFinished} | mutex activo: ${syncPlaneadosRunning}`);

    const data = await sbFetch(
      `/planeados?fecha_programada_dia=gte.${desdeStr}&fecha_programada_dia=lte.${hastaStr}&order=schedulate_origin.asc&limit=500`
    );

    const rows = data || [];

    // Resolver razon_social para filas con empresa_cliente_id
    const empIds = [...new Set(rows.map(r => r.empresa_cliente_id).filter(Boolean))];
    let empMap = {};
    if (empIds.length) {
      const empresas = await sbFetch(
        `/empresas_cliente?id=in.(${empIds.map(encodeURIComponent).join(',')})&select=id,razon_social`
      ) || [];
      empresas.forEach(e => { empMap[e.id] = e.razon_social; });
    }

    // Reglas de identidad (Maestro = única fuente de verdad):
    //  1. Si hay empresa_cliente_id → razon_social del Maestro (autoritativa).
    //  2. Si el nombre crudo del TMS es el placeholder (viaje sin Match) → null,
    //     para que Programación NO muestre "Integral Logistics Operations…".
    //  3. En cualquier otro caso, fallback al nombre crudo.
    // Índice de cache.viajes por trip_number para enriquecer con datos del TMS en vivo.
    const viajesIdx = new Map(cache.viajes.data.map(v => [v.trip_number, v]));

    // Fallback de conductor_tel para viajes no activos en TMS (completados, sin_asignar…):
    // solicitudes persiste el teléfono durante todo el ciclo de vida del viaje, mientras
    // que cache.viajes solo contiene viajes activos en este instante.
    // Una sola query batch — sin N+1.
    const tripNums = rows.map(r => r.trip_number).filter(Boolean);
    let solTelMap = {};
    if (tripNums.length) {
      const solRows = await sbFetch(
        `/solicitudes?controlt_trip_number=in.(${tripNums.map(encodeURIComponent).join(',')})&select=controlt_trip_number,conductor_tel`
      ) || [];
      solRows.forEach(s => {
        if (s.controlt_trip_number && s.conductor_tel) {
          solTelMap[s.controlt_trip_number] = s.conductor_tel;
        }
      });
    }

    const enriched = rows.map(r => {
      let nombre_cliente = null;
      if (r.empresa_cliente_id && empMap[r.empresa_cliente_id]) {
        nombre_cliente = empMap[r.empresa_cliente_id];
      } else if (r.company_customer_name && !isPlaceholderTmsCustomer(r.company_customer_name)) {
        nombre_cliente = r.company_customer_name;
      }
      const vivo = viajesIdx.get(r.trip_number) || null;
      // tipo_servicio: no existe campo oficial en el JSON de ControlT para esto.
      // Regla de negocio: Origen == Destino → Urbano, Origen ≠ Destino → Nacional.
      const origen  = (r.city_origin  || '').trim().toLowerCase();
      const destino = (r.city_destination || '').trim().toLowerCase();
      const tipo_servicio = (origen && destino)
        ? (origen === destino ? 'Urbano' : 'Nacional')
        : null;
      return {
        ...r,
        nombre_cliente,
        match_tms_pendiente: !r.empresa_cliente_id && isPlaceholderTmsCustomer(r.company_customer_name),
        tipo_servicio,
        type_operation: vivo?.type_operation || null,
        // Fuente primaria: TMS en vivo (vivo != null = viaje activo ahora mismo).
        // Fallback: solicitudes.conductor_tel (persistido durante el ciclo de vida del viaje).
        conductor_tel: vivo
          ? (extraerTelefono(vivo.driver_phone, vivo.full_driver) || solTelMap[r.trip_number] || null)
          : (solTelMap[r.trip_number] || null),
      };
    });

    const primeraFecha = enriched[0]?.fecha_programada_dia ?? null;
    const ultimaFecha  = enriched[enriched.length - 1]?.fecha_programada_dia ?? null;
    console.log(`[GET PROGRAMACION #${getId}] resultado: ${enriched.length} filas | primera fecha: ${primeraFecha} | última fecha: ${ultimaFecha} | ${Date.now() - tGet0}ms`);

    res.json(enriched);
  } catch (e) {
    console.error(`[GET PROGRAMACION #${getId}] ❌ Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/programacion/:id/solicitud — solicitud origen vinculada al viaje
// Un viaje sin solicitud asociada es un estado de negocio válido → { vinculada: false }.
// Solo un error de infraestructura devuelve 500.
app.get("/api/programacion/:id/solicitud", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const SOL_SELECT = [
      'id','codigo_solicitud','external_ref','canal','creado_en','creado_por',
      'empresa_cliente_id','agencia_id','agencia_nombre',
      'estado','fecha_confirmacion',
    ].join(',');

    const sols = await sbFetch(
      `/solicitudes?controlt_trip_number=eq.${encodeURIComponent(id)}&limit=1&select=${SOL_SELECT}`
    );

    if (sols === null) {
      return res.status(500).json({ error: "Error consultando solicitudes" });
    }

    if (sols.length === 0) {
      return res.json({ vinculada: false });
    }

    const sol = sols[0];

    const [empresas, agencias, usuarios] = await Promise.all([
      sol.empresa_cliente_id
        ? sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(sol.empresa_cliente_id)}&select=id,razon_social`)
        : Promise.resolve([]),
      sol.agencia_id
        ? sbFetch(`/agencias_cliente?id=eq.${encodeURIComponent(sol.agencia_id)}&select=id,nombre`)
        : Promise.resolve([]),
      sol.creado_por
        ? sbFetch(`/usuarios_cliente?id=eq.${encodeURIComponent(sol.creado_por)}&select=id,nombre`)
        : Promise.resolve([]),
    ]);

    res.json({
      vinculada:          true,
      id:                 sol.id,
      codigo_solicitud:   sol.codigo_solicitud,
      external_ref:       sol.external_ref          || null,
      canal:              sol.canal                 || null,
      creado_en:          sol.creado_en,
      fecha_confirmacion: sol.fecha_confirmacion    || null,
      estado:             sol.estado === 'confirmado' ? 'aprobado' : sol.estado,
      solicitante:        usuarios?.[0]?.nombre     || null,
      cliente:            empresas?.[0]?.razon_social || '—',
      agencia:            agencias?.[0]?.nombre     || sol.agencia_nombre || '—',
    });
  } catch (e) {
    console.error("❌ GET /api/programacion/:id/solicitud:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/programacion/:id — detalle de un viaje planeado por trip_number
app.get("/api/programacion/:id", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await sbFetch(
      `/planeados?trip_number=eq.${encodeURIComponent(id)}&limit=1`
    );
    if (!data || data.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(data[0]);
  } catch (e) {
    console.error("❌ GET /api/programacion/:id:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/programacion/:id/estado — cambia estado ERP del viaje
// Solo actualiza estado_programacion. Las observaciones son exclusivas de /observaciones.
app.patch("/api/programacion/:id/estado", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};
    // Solo se admiten transiciones manuales; los estados automáticos los gestiona syncPlaneados/syncCumplidos
    const ESTADOS_MANUALES = ["programado", "cancelado"];
    if (!ESTADOS_MANUALES.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Transiciones manuales permitidas: ${ESTADOS_MANUALES.join(", ")}` });
    }
    await sbFetch(
      `/planeados?trip_number=eq.${encodeURIComponent(id)}`,
      "PATCH",
      { estado_programacion: estado, actualizado_en: new Date().toISOString() }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ PATCH /api/programacion/:id/estado:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/programacion/:id/observaciones — guarda nota del operador
// Endpoint exclusivo para observaciones; no toca estado_programacion.
app.patch("/api/programacion/:id/observaciones", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body || {};
    if (observaciones === undefined) {
      return res.status(400).json({ error: "El campo observaciones es requerido" });
    }
    await sbFetch(
      `/planeados?trip_number=eq.${encodeURIComponent(id)}`,
      "PATCH",
      { observaciones, actualizado_en: new Date().toISOString() }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ PATCH /api/programacion/:id/observaciones:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/programacion/:id/sync — reintenta sincronizar un viaje individual con la caché de la plataforma
app.post("/api/programacion/:id/sync", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));
    const estaActivo = activeIds.has(id);

    const viajeCache = [...cache.viajes.data, ...(cache.pendientes.data || [])].find(v => v.trip_number === id);

    // Leer estado actual para respetar estados sticky (cancelado, completado)
    const planeadoRows = await sbFetch(`/planeados?trip_number=eq.${encodeURIComponent(id)}&select=estado_programacion,schedulate_origin`);
    const planeadoActual   = planeadoRows?.[0] || null;
    const estadoActual     = planeadoActual?.estado_programacion || 'programado';
    const schedulateRaw    = viajeCache?.schedulate_origin || planeadoActual?.schedulate_origin;
    const fSync            = schedulateRaw ? parseSchedulate(schedulateRaw) : null;
    const ahoraSync        = Date.now();

    let estado_programacion;
    if (estadoActual === 'cancelado' || estadoActual === 'completado') {
      estado_programacion = estadoActual;
    } else if (estaActivo) {
      estado_programacion = (fSync && fSync.getTime() <= ahoraSync) ? 'en_ruta' : 'asignado';
    } else {
      estado_programacion = (fSync && fSync.getTime() <= ahoraSync) ? 'sin_asignar' : 'programado';
    }

    if (viajeCache) {
      const f = parseSchedulate(viajeCache.schedulate_origin);
      await sbFetch(
        `/planeados?trip_number=eq.${encodeURIComponent(id)}`,
        'PATCH',
        {
          license_plate:         viajeCache.license_plate         || null,
          driver_name:           viajeCache.driver_name           || null,
          company_customer_name: viajeCache.company_customer_name || null,
          city_origin:           viajeCache.city_origin           || null,
          city_destination:      viajeCache.city_destination      || null,
          origin_address:        viajeCache.origin_address        || null,
          schedulate_origin:     viajeCache.schedulate_origin     || null,
          fecha_programada_dia:  f ? extraerFechaColombia(f) : null,
          activo_en_resume:      estaActivo,
          estado_programacion,
          actualizado_en:        new Date().toISOString(),
        }
      );
    } else {
      await sbFetch(
        `/planeados?trip_number=eq.${encodeURIComponent(id)}`,
        'PATCH',
        { activo_en_resume: estaActivo, estado_programacion, actualizado_en: new Date().toISOString() }
      );
    }

    res.json({ ok: true, activo_en_resume: estaActivo, estado_programacion });
  } catch (e) {
    console.error("❌ POST /api/programacion/:id/sync:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── MAESTRO DE CLIENTES ────────────────────────────────────────────────────────

// Campos base (ClienteListItem) — usado por listar y por creación
function mapEmpresaToCliente(e, general = null, relaciones = null) {
  return {
    id:                  e.id,
    codigo_cliente:      e.codigo_cliente ?? null,
    razon_social:        e.razon_social ?? "",
    nit:                 e.nit ?? null,
    dv:                  e.dv ?? null,
    nombre_comercial:    e.nombre_controlt ?? general?.nombre_comercial ?? null,
    activa:              e.activa ?? true,
    estado:              e.estado ?? (e.activa === false ? "inactivo" : "activo"),
    sector_economico:    general?.sector_economico ?? null,
    ciudad_principal:    general?.ciudad_principal ?? null,
    tipo_cliente:        general?.tipo_cliente ?? null,
    ejecutivo_comercial: relaciones?.ejecutivo_comercial ?? null,
    clasificacion_abc:   relaciones?.clasificacion_abc ?? null,
    nivel_estrategico:   relaciones?.nivel_estrategico ?? null,
    etiquetas:           relaciones?.etiquetas ?? [],
    alertas_count:       0,
    created_at:          e.created_at ?? null,
    created_by:          e.created_by ?? null,
    actualizado_en:      e.updated_at ?? null,
  };
}

// Campos completos (ClienteDetalle) — incluye todas las tablas satélite para edición
function mapEmpresaToClienteDetalle(e, general = null, relaciones = null, tributaria = null) {
  return {
    ...mapEmpresaToCliente(e, general, relaciones),
    // clientes_info_general
    tipo_empresa:          general?.tipo_empresa ?? null,
    departamento:          general?.departamento ?? null,
    pais:                  general?.pais ?? null,
    direccion:             general?.direccion ?? null,
    telefono:              general?.telefono ?? null,
    email_principal:       general?.email_principal ?? null,
    pagina_web:            general?.pagina_web ?? null,
    descripcion:           general?.descripcion ?? null,
    // clientes_relaciones_comerciales
    director_comercial:    relaciones?.director_comercial ?? null,
    coordinador_operativo: relaciones?.coordinador_operativo ?? null,
    canal_comercial:       relaciones?.canal_comercial ?? null,
    segmento:              relaciones?.segmento ?? null,
    // clientes_info_tributaria
    regimen_tributario:    tributaria?.regimen_tributario ?? null,
    tipo_contribuyente:    tributaria?.tipo_contribuyente ?? null,
    responsable_iva:       tributaria?.responsable_iva ?? false,
    gran_contribuyente:    tributaria?.gran_contribuyente ?? false,
    autorretenedor:        tributaria?.autorretenedor ?? false,
    actividad_economica:   tributaria?.actividad_economica ?? null,
  };
}

// Carga un cliente completo (4 tablas en paralelo) — usado por GET/:id y PATCH/:id
async function fetchClienteDetalle(id) {
  const [empresaRows, generales, relaciones, tributarias] = await Promise.all([
    sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(id)}&limit=1`),
    sbFetch(`/clientes_info_general?empresa_id=eq.${encodeURIComponent(id)}&limit=1`),
    sbFetch(`/clientes_relaciones_comerciales?empresa_id=eq.${encodeURIComponent(id)}&limit=1`),
    sbFetch(`/clientes_info_tributaria?empresa_id=eq.${encodeURIComponent(id)}&limit=1`),
  ]);
  if (!empresaRows || !empresaRows[0]) return null;
  return mapEmpresaToClienteDetalle(
    empresaRows[0],
    generales?.[0] ?? null,
    relaciones?.[0] ?? null,
    tributarias?.[0] ?? null,
  );
}

// Enriquece un array de empresas con sus satélites en 2 queries paralelas
async function enrichClientes(empresas) {
  if (!empresas || empresas.length === 0) return [];
  const ids = empresas.map(e => e.id).join(",");
  const [generales, relaciones] = await Promise.all([
    sbFetch(`/clientes_info_general?empresa_id=in.(${ids})`),
    sbFetch(`/clientes_relaciones_comerciales?empresa_id=in.(${ids})`),
  ]);
  const genMap  = Object.fromEntries((generales  ?? []).map(g => [g.empresa_id, g]));
  const relMap  = Object.fromEntries((relaciones ?? []).map(r => [r.empresa_id, r]));
  return empresas.map(e => mapEmpresaToCliente(e, genMap[e.id] ?? null, relMap[e.id] ?? null));
}

app.get("/api/clientes", requireErpAuth, async (req, res) => {
  try {
    const data = await sbFetch("/empresas_cliente?order=razon_social.asc&limit=1000");
    if (!data) return res.status(502).json({ error: "Error al consultar clientes" });
    res.json(await enrichClientes(data));
  } catch (e) {
    console.error("GET /api/clientes error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/clientes/:id", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await fetchClienteDetalle(id);
    if (!detalle) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(detalle);
  } catch (e) {
    console.error("GET /api/clientes/:id error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Obtiene el próximo código CLI-XXXXXX vía RPC de Supabase
async function generarCodigoCliente() {
  try {
    const SB_FUNC_URL = "https://gtyydandwcgoaratmnqh.supabase.co/rest/v1/rpc/next_codigo_cliente";
    const r = await fetchConTimeout(SB_FUNC_URL, { method: "POST", headers: SB_HEADERS });
    if (r.ok) {
      const val = await r.json();
      return typeof val === "string" ? val : null;
    }
  } catch {}
  // Fallback: MAX actual + 1
  const rows = await sbFetch("/empresas_cliente?select=codigo_cliente&codigo_cliente=not.is.null&order=codigo_cliente.desc&limit=1");
  if (rows && rows[0]?.codigo_cliente) {
    const num = parseInt(rows[0].codigo_cliente.replace("CLI-", ""), 10);
    return `CLI-${String(num + 1).padStart(6, "0")}`;
  }
  return "CLI-000001";
}

app.post("/api/clientes", requireErpAuth, async (req, res) => {
  try {
    const actor = getActor(req);
    const {
      razon_social, nit, dv, nombre_comercial, estado = "prospecto",
      sector_economico, ciudad_principal, departamento, pais, direccion,
      telefono, email_principal, pagina_web, tipo_empresa, tipo_cliente, descripcion,
      ejecutivo_comercial, director_comercial, coordinador_operativo,
      canal_comercial, clasificacion_abc, nivel_estrategico, segmento, etiquetas = [],
      regimen_tributario, tipo_contribuyente,
      responsable_iva = false, gran_contribuyente = false, autorretenedor = false,
      actividad_economica,
    } = req.body ?? {};

    if (!razon_social?.trim()) {
      return res.status(400).json({ error: "La razón social es obligatoria" });
    }

    const codigo_cliente = await generarCodigoCliente();
    const now = new Date().toISOString();

    // 1. Crear empresa
    const empresaRows = await sbFetch("/empresas_cliente", "POST", {
      razon_social:    razon_social.trim(),
      nit:             nit?.trim() || null,
      dv:              dv?.trim() || null,
      nombre_controlt: nombre_comercial?.trim() || null,
      activa:          estado !== "inactivo",
      estado,
      codigo_cliente,
      created_by:      actor,
      updated_at:      now,
      updated_by:      actor,
    });
    if (!empresaRows || !empresaRows[0]) {
      return res.status(502).json({ error: "No se pudo crear el cliente" });
    }
    const empresa = empresaRows[0];

    // 2. Crear registros satélite en paralelo
    await Promise.all([
      sbFetch("/clientes_info_general", "POST", {
        empresa_id: empresa.id,
        nombre_comercial: nombre_comercial?.trim() || null,
        sector_economico: sector_economico || null,
        ciudad_principal: ciudad_principal || null,
        departamento:     departamento || null,
        pais:             pais || "Colombia",
        direccion:        direccion || null,
        telefono:         telefono || null,
        email_principal:  email_principal || null,
        pagina_web:       pagina_web || null,
        tipo_empresa:     tipo_empresa || null,
        tipo_cliente:     tipo_cliente || null,
        descripcion:      descripcion || null,
        updated_by:       actor,
      }),
      sbFetch("/clientes_relaciones_comerciales", "POST", {
        empresa_id:            empresa.id,
        ejecutivo_comercial:   ejecutivo_comercial || null,
        director_comercial:    director_comercial || null,
        coordinador_operativo: coordinador_operativo || null,
        canal_comercial:       canal_comercial || null,
        clasificacion_abc:     clasificacion_abc || null,
        nivel_estrategico:     nivel_estrategico || null,
        segmento:              segmento || null,
        etiquetas:             etiquetas,
        estado_comercial:      estado,
        updated_by:            actor,
      }),
      sbFetch("/clientes_info_tributaria", "POST", {
        empresa_id:          empresa.id,
        regimen_tributario:  regimen_tributario || null,
        tipo_contribuyente:  tipo_contribuyente || null,
        responsable_iva,
        gran_contribuyente,
        autorretenedor,
        actividad_economica: actividad_economica || null,
        updated_by:          actor,
      }),
      sbFetch("/clientes_historial", "POST", {
        empresa_id:    empresa.id,
        tipo:          "creacion",
        descripcion:   `Cliente creado con código ${codigo_cliente}`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { estado_inicial: estado, codigo_cliente },
      }),
    ]);

    res.status(201).json(mapEmpresaToCliente(empresa));
  } catch (e) {
    console.error("POST /api/clientes error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.patch("/api/clientes/:id", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const {
      razon_social, nit, dv, nombre_comercial,
      sector_economico, ciudad_principal, departamento, pais, direccion,
      telefono, email_principal, pagina_web, tipo_empresa, tipo_cliente, descripcion,
      ejecutivo_comercial, director_comercial, coordinador_operativo,
      canal_comercial, clasificacion_abc, nivel_estrategico, segmento, etiquetas,
      regimen_tributario, tipo_contribuyente,
      responsable_iva, gran_contribuyente, autorretenedor, actividad_economica,
    } = req.body ?? {};

    const now = new Date().toISOString();

    // Campos de empresas_cliente
    const empresaPatch = {};
    if (razon_social    !== undefined) empresaPatch.razon_social    = razon_social.trim();
    if (nit             !== undefined) empresaPatch.nit             = nit?.trim() || null;
    if (dv              !== undefined) empresaPatch.dv              = dv?.trim() || null;
    if (nombre_comercial !== undefined) empresaPatch.nombre_controlt = nombre_comercial?.trim() || null;
    empresaPatch.updated_at = now;
    empresaPatch.updated_by = actor;

    // Campos de clientes_info_general
    const genPatch = {};
    if (nombre_comercial  !== undefined) genPatch.nombre_comercial  = nombre_comercial?.trim() || null;
    if (sector_economico  !== undefined) genPatch.sector_economico  = sector_economico || null;
    if (ciudad_principal  !== undefined) genPatch.ciudad_principal  = ciudad_principal || null;
    if (departamento      !== undefined) genPatch.departamento      = departamento || null;
    if (pais              !== undefined) genPatch.pais              = pais || "Colombia";
    if (direccion         !== undefined) genPatch.direccion         = direccion || null;
    if (telefono          !== undefined) genPatch.telefono          = telefono || null;
    if (email_principal   !== undefined) genPatch.email_principal   = email_principal || null;
    if (pagina_web        !== undefined) genPatch.pagina_web        = pagina_web || null;
    if (tipo_empresa      !== undefined) genPatch.tipo_empresa      = tipo_empresa || null;
    if (tipo_cliente      !== undefined) genPatch.tipo_cliente      = tipo_cliente || null;
    if (descripcion       !== undefined) genPatch.descripcion       = descripcion || null;
    genPatch.updated_at = now;
    genPatch.updated_by = actor;

    // Campos de clientes_relaciones_comerciales
    const relPatch = {};
    if (ejecutivo_comercial   !== undefined) relPatch.ejecutivo_comercial   = ejecutivo_comercial || null;
    if (director_comercial    !== undefined) relPatch.director_comercial    = director_comercial || null;
    if (coordinador_operativo !== undefined) relPatch.coordinador_operativo = coordinador_operativo || null;
    if (canal_comercial       !== undefined) relPatch.canal_comercial       = canal_comercial || null;
    if (clasificacion_abc     !== undefined) relPatch.clasificacion_abc     = clasificacion_abc || null;
    if (nivel_estrategico     !== undefined) relPatch.nivel_estrategico     = nivel_estrategico || null;
    if (segmento              !== undefined) relPatch.segmento              = segmento || null;
    if (etiquetas             !== undefined) relPatch.etiquetas             = etiquetas;
    relPatch.updated_at = now;
    relPatch.updated_by = actor;

    // Campos de clientes_info_tributaria
    const tribPatch = {};
    if (regimen_tributario  !== undefined) tribPatch.regimen_tributario  = regimen_tributario || null;
    if (tipo_contribuyente  !== undefined) tribPatch.tipo_contribuyente  = tipo_contribuyente || null;
    if (responsable_iva     !== undefined) tribPatch.responsable_iva     = responsable_iva;
    if (gran_contribuyente  !== undefined) tribPatch.gran_contribuyente  = gran_contribuyente;
    if (autorretenedor      !== undefined) tribPatch.autorretenedor      = autorretenedor;
    if (actividad_economica !== undefined) tribPatch.actividad_economica = actividad_economica || null;
    tribPatch.updated_at = now;
    tribPatch.updated_by = actor;

    // Campos modificados en esta operación (para historial)
    const camposModificados = Object.keys(req.body ?? {})
      .filter(k => !["updated_at", "updated_by", "activa"].includes(k));

    await Promise.all([
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(id)}`, "PATCH", empresaPatch),
      sbFetch(`/clientes_info_general?empresa_id=eq.${encodeURIComponent(id)}`, "PATCH", genPatch),
      sbFetch(`/clientes_relaciones_comerciales?empresa_id=eq.${encodeURIComponent(id)}`, "PATCH", relPatch),
      sbFetch(`/clientes_info_tributaria?empresa_id=eq.${encodeURIComponent(id)}`, "PATCH", tribPatch),
      sbFetch("/clientes_historial", "POST", {
        empresa_id:    id,
        tipo:          "edicion_perfil",
        descripcion:   `Perfil actualizado. Campos modificados: ${camposModificados.join(", ")}`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { campos_modificados: camposModificados },
      }),
    ]);

    const detalle = await fetchClienteDetalle(id);
    if (!detalle) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(detalle);
  } catch (e) {
    console.error("PATCH /api/clientes/:id error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.patch("/api/clientes/:id/estado", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const { estado, motivo, observacion } = req.body ?? {};

    const ESTADOS_VALIDOS = ["activo", "inactivo", "suspendido", "prospecto", "bloqueado"];
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    if (!motivo?.trim()) {
      return res.status(400).json({ error: "El motivo es obligatorio para cambiar el estado" });
    }

    const now = new Date().toISOString();

    await Promise.all([
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(id)}`, "PATCH", {
        estado,
        activa:     estado === "activo",
        updated_at: now,
        updated_by: actor,
      }),
      sbFetch(`/clientes_relaciones_comerciales?empresa_id=eq.${encodeURIComponent(id)}`, "PATCH", {
        estado_comercial: estado,
        updated_at:       now,
        updated_by:       actor,
      }),
      sbFetch("/clientes_historial", "POST", {
        empresa_id:    id,
        tipo:          "cambio_estado",
        descripcion:   `Estado cambiado a "${estado}". Motivo: ${motivo}`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { nuevo_estado: estado, motivo, observacion: observacion || null },
      }),
    ]);

    res.json({ ok: true, estado });
  } catch (e) {
    console.error("PATCH /api/clientes/:id/estado error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── CUSTOMER MERGE ─────────────────────────────────────────────────────────

// Preview: cuántos registros se reasignarán al fusionar duplicado_id en :id.
app.get("/api/clientes/:id/merge-preview", requireErpAuth, async (req, res) => {
  try {
    const { id: oficialId } = req.params;
    const { duplicado_id } = req.query;

    if (!duplicado_id) return res.status(400).json({ error: "duplicado_id es requerido" });
    if (oficialId === duplicado_id) return res.status(400).json({ error: "No se puede fusionar un cliente consigo mismo" });

    const dup = encodeURIComponent(duplicado_id);
    const [oficialRows, duplicadoRows, planeados, cumplidos, solicitudes] = await Promise.all([
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(oficialId)}&select=id,razon_social,codigo_cliente&limit=1`),
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(duplicado_id)}&select=id,razon_social,codigo_cliente,nombre_controlt&limit=1`),
      sbFetch(`/planeados?empresa_cliente_id=eq.${dup}&select=trip_number&limit=500`),
      sbFetch(`/cumplidos?empresa_cliente_id=eq.${dup}&select=id&limit=2000`),
      sbFetch(`/solicitudes?empresa_cliente_id=eq.${dup}&select=id&limit=500`),
    ]);

    if (!oficialRows?.[0]) return res.status(404).json({ error: "Cliente oficial no encontrado" });
    if (!duplicadoRows?.[0]) return res.status(404).json({ error: "Cliente duplicado no encontrado" });

    const oficial   = oficialRows[0];
    const duplicado = duplicadoRows[0];

    res.json({
      oficial:   { id: oficialId,    razon_social: oficial.razon_social,   codigo_cliente: oficial.codigo_cliente   },
      duplicado: { id: duplicado_id, razon_social: duplicado.razon_social, codigo_cliente: duplicado.codigo_cliente },
      referencias: {
        planeados:   (planeados   ?? []).length,
        cumplidos:   (cumplidos   ?? []).length,
        solicitudes: (solicitudes ?? []).length,
      },
      identity_rules: [duplicado.razon_social, duplicado.nombre_controlt].filter(Boolean),
    });
  } catch (e) {
    console.error("GET /api/clientes/:id/merge-preview error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Merge: fusiona duplicado_id en :id (cliente oficial).
// Operaciones atómicas (secuenciales donde importa el orden):
//   1. Crear Identity Rules para los nombres del duplicado.
//   2. Reasignar FKs en planeados, cumplidos, solicitudes.
//   3. Marcar duplicado como fusionado.
//   4. Registrar historial en ambos clientes.
//   5. Refrescar lookup in-memory.
app.post("/api/clientes/:id/merge", requireErpAuth, async (req, res) => {
  try {
    const { id: oficialId } = req.params;
    const actor = getActor(req);
    const { duplicado_id, motivo = "Fusión de clientes duplicados" } = req.body ?? {};

    if (!duplicado_id) return res.status(400).json({ error: "duplicado_id es requerido" });
    if (oficialId === duplicado_id) return res.status(400).json({ error: "No se puede fusionar un cliente consigo mismo" });

    const [oficialRows, duplicadoRows] = await Promise.all([
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(oficialId)}&select=id,razon_social,codigo_cliente,estado&limit=1`),
      sbFetch(`/empresas_cliente?id=eq.${encodeURIComponent(duplicado_id)}&select=id,razon_social,codigo_cliente,estado,nombre_controlt&limit=1`),
    ]);

    const oficial   = oficialRows?.[0];
    const duplicado = duplicadoRows?.[0];
    if (!oficial)   return res.status(404).json({ error: "Cliente oficial no encontrado" });
    if (!duplicado) return res.status(404).json({ error: "Cliente duplicado no encontrado" });
    if (oficial.estado   === 'fusionado') return res.status(400).json({ error: "El cliente oficial ya está fusionado" });
    if (duplicado.estado === 'fusionado') return res.status(400).json({ error: "El cliente duplicado ya está fusionado" });

    const now = new Date().toISOString();
    const dup = encodeURIComponent(duplicado_id);

    // 1. Crear Identity Rules para todos los nombres conocidos del duplicado.
    //    Si ya existe una regla para ese nombre, el índice único la ignora (no falla).
    const namesToRegister = [...new Set(
      [duplicado.razon_social, duplicado.nombre_controlt].filter(Boolean)
    )];
    for (const nombre of namesToRegister) {
      const nombre_normalizado = normalizeClient(nombre);
      if (!nombre_normalizado) continue;
      await sbFetch('/cliente_alias', 'POST', {
        empresa_cliente_id: oficialId,
        nombre_normalizado,
        nombre_raw:         nombre,
        integracion:        'controlt',
        creado_via:         'merge',
        creado_por:         actor,
      }).catch(() => {}); // el índice único ya impide duplicados; silenciar error
    }

    // 2. Reasignar todas las FK de duplicado_id → oficialId
    await Promise.all([
      sbFetch(`/planeados?empresa_cliente_id=eq.${dup}`,   'PATCH', { empresa_cliente_id: oficialId }),
      sbFetch(`/cumplidos?empresa_cliente_id=eq.${dup}`,   'PATCH', { empresa_cliente_id: oficialId }),
      sbFetch(`/solicitudes?empresa_cliente_id=eq.${dup}`, 'PATCH', { empresa_cliente_id: oficialId }),
    ]);

    // 3. Marcar duplicado como fusionado (estado terminal — nunca eliminar el registro)
    await sbFetch(`/empresas_cliente?id=eq.${dup}`, 'PATCH', {
      estado:     'fusionado',
      activa:     false,
      updated_at: now,
      updated_by: actor,
    });

    // 4. Historial en ambos registros
    await Promise.all([
      sbFetch('/clientes_historial', 'POST', {
        empresa_id:    oficialId,
        tipo:          'fusion_recibida',
        descripcion:   `Cliente "${duplicado.razon_social}" (${duplicado.codigo_cliente ?? duplicado_id}) fusionado en este registro. Motivo: ${motivo}`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { duplicado_id, duplicado_razon_social: duplicado.razon_social, motivo, identity_rules: namesToRegister },
      }),
      sbFetch('/clientes_historial', 'POST', {
        empresa_id:    duplicado_id,
        tipo:          'fusion_ejecutada',
        descripcion:   `Este registro fue fusionado en "${oficial.razon_social}" (${oficial.codigo_cliente ?? oficialId}). Motivo: ${motivo}`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { oficial_id: oficialId, oficial_razon_social: oficial.razon_social, motivo },
      }),
    ]).catch(err => console.error('⚠️  merge historial:', err.message));

    // 5. Refrescar lookup in-memory para que las próximas syncs usen las nuevas reglas
    await refreshCustomerLookup();

    console.log(`🔀 Merge: "${duplicado.razon_social}" → "${oficial.razon_social}" por ${actor}. Rules: ${namesToRegister.join(', ')}`);
    res.json({
      ok:                     true,
      oficial_id:             oficialId,
      duplicado_id,
      identity_rules_created: namesToRegister.length,
    });
  } catch (e) {
    console.error("POST /api/clientes/:id/merge error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── ALIAS CRUD ─────────────────────────────────────────────────────────────

// Listar todos los alias de un cliente (activos e inactivos)
app.get("/api/clientes/:id/alias", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await sbFetch(
      `/cliente_alias?empresa_cliente_id=eq.${encodeURIComponent(id)}&order=creado_en.desc`
    );
    res.json(rows ?? []);
  } catch (e) {
    console.error("GET /api/clientes/:id/alias error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Crear un alias manualmente para un cliente
app.post("/api/clientes/:id/alias", requireErpAuth, async (req, res) => {
  try {
    const { id: empresa_cliente_id } = req.params;
    const actor = getActor(req);
    const { nombre_raw, integracion = 'controlt', observacion } = req.body ?? {};

    if (!nombre_raw?.trim()) return res.status(400).json({ error: "nombre_raw es requerido" });

    const nombre_normalizado = normalizeClient(nombre_raw);
    if (!nombre_normalizado) return res.status(400).json({ error: "El nombre no es válido" });

    const inserted = await sbFetch('/cliente_alias', 'POST', {
      empresa_cliente_id,
      nombre_raw:         nombre_raw.trim(),
      nombre_normalizado,
      integracion:        String(integracion || 'controlt'),
      creado_via:         'manual',
      creado_por:         actor,
      ...(observacion ? { observacion: String(observacion) } : {}),
    });

    if (!inserted?.[0]) return res.status(500).json({ error: "No se pudo crear el alias" });

    // Refrescar lookup para que las próximas syncs lo consideren de inmediato
    refreshCustomerLookup().catch(() => {});

    res.status(201).json(inserted[0]);
  } catch (e) {
    console.error("POST /api/clientes/:id/alias error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Activar / desactivar un alias (nunca se elimina físicamente)
app.patch("/api/clientes/:id/alias/:aliasId", requireErpAuth, async (req, res) => {
  try {
    const { id: empresa_cliente_id, aliasId } = req.params;
    const { activo, observacion } = req.body ?? {};

    if (typeof activo !== 'boolean') return res.status(400).json({ error: "activo (boolean) es requerido" });

    const patch = { activo };
    if (observacion !== undefined) patch.observacion = String(observacion);

    await sbFetch(
      `/cliente_alias?id=eq.${encodeURIComponent(aliasId)}&empresa_cliente_id=eq.${encodeURIComponent(empresa_cliente_id)}`,
      'PATCH',
      patch
    );

    // Refrescar lookup para que el cambio de activo se refleje en syncs
    refreshCustomerLookup().catch(() => {});

    res.json({ ok: true, activo });
  } catch (e) {
    console.error("PATCH /api/clientes/:id/alias/:aliasId error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── PERSONAL INLOP ───────────────────────────────────────────────────────────
// Fuente oficial: tabla `personal` (SQL_04_personal.sql) — el maestro de
// personal de INLOP, independiente de Auth y base futura de Talento Humano.
// NO es `profiles` (cuenta de acceso al ERP, puede no existir) ni
// `usuarios_cliente` (portal de clientes externos).
//
// Columnas reales de `personal`: id, nombre, cargo, area, correo_compartido
// (el correo NO es individual — varias personas de una misma área pueden
// compartir un solo correo institucional, ej. 3 controladores de tráfico →
// trafico@inlop.com.co: es dato real, no se deduplica), observaciones,
// profile_id (nullable, solo si la persona tiene acceso al ERP), activo.
//
// Protegido con requireInternalApiKey — mismo perímetro que el resto de
// endpoints internos sensibles del ERP (/api/programacion, /api/planeados).
//
// Usado por Configuración → Reportes Automáticos → Etapa 05 · Destinatarios
// para poblar la lista de "Personal INLOP" seleccionable — nunca hardcodeada.
app.get("/api/personal", requireErpAuth, async (req, res) => {
  try {
    const rows = await sbFetch(
      "/personal?select=id,nombre,cargo,correo_compartido&activo=eq.true&order=nombre.asc"
    );

    // Solo los campos necesarios para el selector de destinatarios. Se
    // excluye personal inactivo (activo=eq.true arriba, estado real de la
    // tabla) y personal sin correo asignado (no puede ser destinatario).
    const personal = (rows ?? [])
      .map(p => ({
        id:     p.id,
        nombre: p.nombre || "",
        cargo:  p.cargo  || "",
        email:  (p.correo_compartido || "").trim(),
      }))
      .filter(p => p.email);

    res.json(personal);
  } catch (e) {
    console.error("GET /api/personal error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── RBAC — API de solo lectura (Sprint 3D-3) ──────────────────────────────
// Módulo: Configuración → Parámetros → Usuarios / Roles / Permisos (UI aún
// no construida — estos 4 endpoints son la capa de lectura que la
// alimentará). Ninguno escribe: sin INSERT/UPDATE/DELETE, sin tocar
// profiles, usuario_roles ni usuario_permisos.
//
// Los 3 endpoints administrativos (/api/usuarios, /api/roles, /api/permisos)
// están protegidos con requirePermiso('rbac:gestionar') — primer uso real de
// ese middleware (Sprint 3D-2). Como usuario_roles está vacía todavía (la
// migración de usuarios es un sprint separado, aún no ejecutado), estos 3
// endpoints son inalcanzables hasta que exista al menos una fila de
// usuario_roles apuntando al rol master — consecuencia esperada del orden de
// sprints ya decidido (Sprint 3D-3, diseño aprobado, sección F/R1), no un bug.
//
// GET /api/me/permisos es la excepción deliberada: solo requireErpAuth, sin
// requirePermiso — su propósito es que CUALQUIER usuario autenticado sepa
// qué puede hacer, nunca condicionado a un permiso administrativo.

// GET /api/usuarios — profiles + sus roles RBAC activos.
// profiles.rol es el campo legacy (texto libre, aún no migrado) — se expone
// solo como contexto para la futura migración; NUNCA se usa aquí para
// derivar permisos. Esa es exclusivamente la función de roles_rbac (vía
// usuario_roles + roles, ambos con activo=true).
app.get("/api/usuarios", requireErpAuth, requirePermiso('rbac:gestionar', { sbFetch }), async (req, res) => {
  try {
    const [perfiles, asignaciones, catalogo] = await Promise.all([
      sbFetch("/profiles?select=id,nombre,email,rol,activo,created_at&order=nombre.asc"),
      sbFetch("/usuario_roles?activo=eq.true&select=profile_id,rol_id"),
      obtenerCatalogo({ sbFetch }),
    ]);

    const rolesPorProfile = new Map(); // profile_id -> [{id, nombre}]
    for (const a of (asignaciones ?? [])) {
      const rolInfo = catalogo.rolesPorId.get(a.rol_id);
      if (!rolInfo || rolInfo.activo !== true) continue; // rol desactivado globalmente — no cuenta
      if (!rolesPorProfile.has(a.profile_id)) rolesPorProfile.set(a.profile_id, []);
      rolesPorProfile.get(a.profile_id).push({ id: a.rol_id, nombre: rolInfo.nombre });
    }

    const usuarios = (perfiles ?? []).map(p => ({
      id:         p.id,
      nombre:     p.nombre || "",
      email:      p.email  || "",
      rol:        p.rol    || "", // legacy — solo contexto, ver comentario arriba
      activo:     p.activo === true,
      created_at: p.created_at,
      roles_rbac: rolesPorProfile.get(p.id) ?? [],
    }));

    res.json(usuarios);
  } catch (e) {
    console.error("GET /api/usuarios error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/roles — catálogo de roles + conteo de usuarios asignados.
app.get("/api/roles", requireErpAuth, requirePermiso('rbac:gestionar', { sbFetch }), async (req, res) => {
  try {
    const [rolesRaw, asignaciones] = await Promise.all([
      sbFetch("/roles?select=id,nombre,descripcion,es_sistema,activo&order=nombre.asc"),
      sbFetch("/usuario_roles?activo=eq.true&select=rol_id"),
    ]);

    const conteoPorRol = new Map();
    for (const a of (asignaciones ?? [])) {
      conteoPorRol.set(a.rol_id, (conteoPorRol.get(a.rol_id) ?? 0) + 1);
    }

    const roles = (rolesRaw ?? []).map(r => ({
      id:                 r.id,
      nombre:             r.nombre,
      descripcion:        r.descripcion || "",
      es_sistema:         r.es_sistema === true,
      activo:             r.activo === true,
      usuarios_asignados: conteoPorRol.get(r.id) ?? 0,
    }));

    res.json(roles);
  } catch (e) {
    console.error("GET /api/roles error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/permisos — catálogo de permisos + roles que los poseen.
// El reverse-map (permiso → roles) se calcula en memoria contra el catálogo
// ya cacheado por el motor RBAC (obtenerCatalogo, Sprint 3D-2) — sin
// duplicar su lógica ni agregar consultas adicionales a Supabase.
app.get("/api/permisos", requireErpAuth, requirePermiso('rbac:gestionar', { sbFetch }), async (req, res) => {
  try {
    const [permisosRaw, catalogo] = await Promise.all([
      sbFetch("/permisos?select=id,nombre,modulo,descripcion&order=modulo.asc,nombre.asc"),
      obtenerCatalogo({ sbFetch }),
    ]);

    const rolesPorPermiso = new Map(); // permiso_id -> [{id, nombre}]
    for (const [rolId, permisoIds] of catalogo.permisosPorRol) {
      const rolInfo = catalogo.rolesPorId.get(rolId);
      if (!rolInfo) continue;
      for (const permisoId of permisoIds) {
        if (!rolesPorPermiso.has(permisoId)) rolesPorPermiso.set(permisoId, []);
        rolesPorPermiso.get(permisoId).push({ id: rolId, nombre: rolInfo.nombre });
      }
    }

    const permisos = (permisosRaw ?? []).map(p => ({
      id:          p.id,
      nombre:      p.nombre,
      modulo:      p.modulo || "",
      descripcion: p.descripcion || "",
      roles:       rolesPorPermiso.get(p.id) ?? [],
    }));

    res.json(permisos);
  } catch (e) {
    console.error("GET /api/permisos error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/me/permisos — permisos efectivos del usuario autenticado.
// Usa req.erpUserId directamente (identidad verificada por requireErpAuth
// vía JWT) — NUNCA acepta un profile_id por parámetro, para que nadie pueda
// pedir los permisos de otra persona por esta vía (evita IDOR).
app.get("/api/me/permisos", requireErpAuth, async (req, res) => {
  try {
    if (!req.erpUserId) {
      // Ruta de compatibilidad X-Internal-Api-Key: sin JWT no hay identidad
      // verificada contra la que resolver RBAC — mismo criterio fail-closed
      // que requirePermiso() (Sprint 3D-2, decisión G1).
      return res.status(403).json({ error: "Identidad verificada requerida (JWT)" });
    }
    const resultado = await calcularPermisosEfectivos(req.erpUserId, { sbFetch });
    res.json({
      esMaster: resultado.esMaster,
      permisos: Array.from(resultado.permisos),
    });
  } catch (e) {
    console.error("GET /api/me/permisos error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

const UUID_REGEX_RBAC = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOMBRE_ROL_MASTER_RBAC = 'master';

// PUT /api/usuarios/:id/roles — reemplaza el conjunto COMPLETO de roles RBAC
// activos de un usuario (Sprint 3D-7.2 — primer endpoint de escritura RBAC).
//
// Body: { rol_ids: string[] } — el conjunto deseado. Reconciliación de
// conjunto sobre usuario_roles: activa (upsert) los rol_id presentes que no
// estaban activos, desactiva LÓGICAMENTE (activo=false, nunca DELETE físico
// — usuario_roles no tiene historial propio, ver diseño 3D-7) los que
// estaban activos y ya no están en la lista. Sin cambios para el resto —
// idempotente: reenviar el mismo conjunto no escribe nada.
//
// Guard reforzado (diseño 3D-7, "poderes reforzados"): si la operación
// agrega o quita el rol `master` para este usuario, el ACTOR debe ser
// master real (esMaster===true vía el motor RBAC), no basta con tener
// `rbac:gestionar` genérico — evita que alguien con rbac:gestionar por otra
// vía se auto-promueva o promueva a terceros a master.
//
// Guard de integridad: nunca se permite dejar el sistema sin al menos un
// master "funcionando" (usuario_roles.activo=true Y profiles.activo=true) —
// 409 si la operación dejaría ese conteo en cero.
app.put("/api/usuarios/:id/roles", requireErpAuth, requirePermiso('rbac:gestionar', { sbFetch }), async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX_RBAC.test(id || "")) {
      return res.status(400).json({ error: "id de usuario inválido" });
    }

    const { rol_ids } = req.body || {};
    if (!Array.isArray(rol_ids) || rol_ids.some(r => typeof r !== "string" || !UUID_REGEX_RBAC.test(r))) {
      return res.status(400).json({ error: "rol_ids debe ser un arreglo de UUID válidos" });
    }
    const targetSet = new Set(rol_ids); // dedup — reenviar el mismo id dos veces no es un error

    // Profile debe existir.
    const perfiles = await sbFetch(`/profiles?id=eq.${encodeURIComponent(id)}&select=id,activo`);
    const perfil = perfiles?.[0];
    if (!perfil) return res.status(404).json({ error: "Usuario no encontrado" });

    // profiles.rol NO participa en autorización ni en esta validación —
    // solo profiles.activo, que sí es relevante: un usuario inactivo no
    // puede recibir roles activos nuevos (sí puede recibir un rol_ids=[]
    // para limpiar sus asignaciones existentes).
    if (rol_ids.length > 0 && perfil.activo !== true) {
      return res.status(400).json({ error: "El usuario está inactivo — no puede recibir roles activos" });
    }

    // Catálogo — valida que cada rol_id exista y esté activo. Reutiliza el
    // motor RBAC ya cacheado (catalogo.js), sin duplicar su lógica.
    const catalogo = await obtenerCatalogo({ sbFetch });
    for (const rolId of targetSet) {
      const info = catalogo.rolesPorId.get(rolId);
      if (!info) return res.status(400).json({ error: `rol_id inexistente: ${rolId}` });
      if (info.activo !== true) return res.status(400).json({ error: `rol inactivo, no asignable: ${info.nombre}` });
    }

    let rolIdMaster = null;
    for (const [rolId, info] of catalogo.rolesPorId) {
      if (info.nombre?.toLowerCase() === NOMBRE_ROL_MASTER_RBAC) { rolIdMaster = rolId; break; }
    }

    // Estado actual de asignaciones activas de este usuario.
    const asignacionesActuales = await sbFetch(
      `/usuario_roles?profile_id=eq.${encodeURIComponent(id)}&activo=eq.true&select=rol_id`
    ) || [];
    const activosActuales = new Set(asignacionesActuales.map(a => a.rol_id));

    const toActivate   = [...targetSet].filter(rolId => !activosActuales.has(rolId));
    const toDeactivate = [...activosActuales].filter(rolId => !targetSet.has(rolId));

    const tocaMaster = rolIdMaster !== null && (toActivate.includes(rolIdMaster) || toDeactivate.includes(rolIdMaster));
    if (tocaMaster) {
      const actorResuelto = await calcularPermisosEfectivos(req.erpUserId, { sbFetch });
      if (!actorResuelto.esMaster) {
        return res.status(403).json({ error: "Solo un master puede asignar o quitar el rol master" });
      }
    }

    // Último master: si esta operación desactiva el rol master de este
    // usuario, verificar que quede al menos otro master "funcionando"
    // (asignación activa + profile activo) en el resto del sistema.
    if (rolIdMaster !== null && toDeactivate.includes(rolIdMaster)) {
      const filasMaster = await sbFetch(
        `/usuario_roles?rol_id=eq.${encodeURIComponent(rolIdMaster)}&activo=eq.true&select=profile_id`
      ) || [];
      const otrosIds = filasMaster.map(f => f.profile_id).filter(pid => pid !== id);
      let otrosMasterFuncionando = 0;
      if (otrosIds.length > 0) {
        const perfilesOtros = await sbFetch(
          `/profiles?id=in.(${otrosIds.map(encodeURIComponent).join(',')})&activo=eq.true&select=id`
        ) || [];
        otrosMasterFuncionando = perfilesOtros.length;
      }
      if (otrosMasterFuncionando === 0) {
        return res.status(409).json({ error: "No se puede quitar master: quedaría el sistema sin ningún master activo" });
      }
    }

    const actor = getActor(req);
    const nowIso = new Date().toISOString();

    // Reconciliación en dos escrituras atómicas (no granulares) — cada
    // dirección de cambio (desactivar / activar) se envía como UNA sola
    // sentencia PostgREST sobre múltiples filas, en vez de un loop de N
    // llamadas sbFetch. Esto evita el riesgo real (Sprint 3D-7.2, auditoría)
    // de que una falla a mitad de un loop deje usuario_roles parcialmente
    // modificada: al ser una sola sentencia por dirección, o se aplica
    // completa o sbFetch devuelve null y no se aplica nada de esa dirección.
    // No se usa ninguna transacción ni dependencia nueva — mismo mecanismo
    // (sbFetch + filtros PostgREST) ya usado en el resto del endpoint.
    //
    // Orden fail-closed: primero desactivar, luego activar. Si la activación
    // falla después de una desactivación ya confirmada, el usuario queda con
    // MENOS permisos de los deseados (seguro), nunca con roles obsoletos de
    // más. invalidarUsuario() se llama tras cada escritura confirmada, no
    // solo al final, para que el cache nunca quede desalineado con una
    // escritura parcial ya aplicada en la base de datos.
    if (toDeactivate.length > 0) {
      const resultado = await sbFetch(
        `/usuario_roles?profile_id=eq.${encodeURIComponent(id)}&rol_id=in.(${toDeactivate.map(encodeURIComponent).join(',')})`,
        'PATCH',
        { activo: false, asignado_por: actor, asignado_en: nowIso }
      );
      if (resultado === null) {
        console.error("PUT /api/usuarios/:id/roles: falló la desactivación en lote, abortando sin activar");
        return res.status(500).json({ error: "Error interno" });
      }
      invalidarUsuario(id);
    }
    if (toActivate.length > 0) {
      const resultado = await sbFetch('/usuario_roles?on_conflict=profile_id,rol_id', 'POST', toActivate.map(rolId => ({
        profile_id:   id,
        rol_id:       rolId,
        asignado_por: actor,
        asignado_en:  nowIso,
        activo:       true,
      })));
      if (resultado === null) {
        console.error("PUT /api/usuarios/:id/roles: falló la activación en lote");
        return res.status(500).json({ error: "Error interno" });
      }
      invalidarUsuario(id);
    }

    const roles_rbac = [...targetSet].map(rolId => ({ id: rolId, nombre: catalogo.rolesPorId.get(rolId).nombre }));
    res.json({ id, roles_rbac });
  } catch (e) {
    console.error("PUT /api/usuarios/:id/roles error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── REPORTES AUTOMÁTICOS ─────────────────────────────────────────────────────
// Módulo: Configuración → Parámetros → Reportes Automáticos (Fase 2 — CRUD base)

const FRECUENCIAS_VALIDAS_RA = new Set(["diaria", "semanal", "mensual"]);
const FORMATOS_VALIDOS_RA    = new Set(["excel", "html_filas", "html_columnas"]);
// Mismo valor que services/gps/enlaces.js#MODULO_PERMITIDO (Fase 10B) y que
// el default de modulo_id un poco más abajo — repetido aquí como literal
// para no tener que importar todo services/gps/* en index.js solo por esta
// constante de validación del CRUD (Fase 10D).
const MODULO_GESTION_LOGISTICA = "gestion_logistica";

/** Valida la forma de `destinatarios` — { personal_ids: string[], correos_externos: string[] }. */
function errorDestinatarios(destinatarios) {
  if (typeof destinatarios !== "object" || destinatarios === null || Array.isArray(destinatarios)) {
    return "destinatarios debe ser un objeto";
  }
  if (destinatarios.personal_ids !== undefined && !Array.isArray(destinatarios.personal_ids)) {
    return "destinatarios.personal_ids debe ser un array";
  }
  if (destinatarios.correos_externos !== undefined && !Array.isArray(destinatarios.correos_externos)) {
    return "destinatarios.correos_externos debe ser un array";
  }
  return null;
}

app.get("/api/reportes-automaticos", requireErpAuth, async (req, res) => {
  try {
    const rows = await sbFetch("/reportes_automaticos?order=created_at.desc&limit=500");
    res.json(rows ?? []);
  } catch (e) {
    console.error("GET /api/reportes-automaticos error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/reportes-automaticos", requireErpAuth, async (req, res) => {
  try {
    const actor = getActor(req);
    const {
      nombre,
      modulo_id    = "gestion_logistica",
      tipo_reporte,
      asunto,
      cuerpo,
      formato      = "excel",
      activo       = true,
      borrador     = false,
      frecuencia   = "diaria",
      filtros,
      columnas,
      recurrencia,
      destinatarios,
      seguimiento_gps = false,
    } = req.body ?? {};

    if (!nombre?.trim())       return res.status(400).json({ error: "El nombre es obligatorio" });
    if (!tipo_reporte?.trim()) return res.status(400).json({ error: "El tipo de reporte es obligatorio" });
    if (!modulo_id?.trim())    return res.status(400).json({ error: "El módulo es obligatorio" });
    if (!FORMATOS_VALIDOS_RA.has(formato)) {
      return res.status(400).json({ error: "Formato inválido. Use: excel, html_filas o html_columnas" });
    }
    if (!FRECUENCIAS_VALIDAS_RA.has(frecuencia)) {
      return res.status(400).json({ error: "Frecuencia inválida. Use: diaria, semanal o mensual" });
    }
    if (filtros  !== undefined && !Array.isArray(filtros)) {
      return res.status(400).json({ error: "filtros debe ser un array" });
    }
    if (columnas !== undefined && !Array.isArray(columnas)) {
      return res.status(400).json({ error: "columnas debe ser un array" });
    }
    if (recurrencia !== undefined && (typeof recurrencia !== "object" || recurrencia === null || Array.isArray(recurrencia))) {
      return res.status(400).json({ error: "recurrencia debe ser un objeto" });
    }
    if (destinatarios !== undefined) {
      const err = errorDestinatarios(destinatarios);
      if (err) return res.status(400).json({ error: err });
    }
    if (seguimiento_gps === true && modulo_id.trim() !== MODULO_GESTION_LOGISTICA) {
      return res.status(400).json({ error: "El seguimiento GPS solo aplica a reportes de Gestión Logística" });
    }

    const recurrenciaFinal = recurrencia ?? {};
    // Fase 11D.1 — calcula proxima_ejecucion de una vez, en vez de dejarla
    // en null a la espera del siguiente tick del scheduler (hasta 60s).
    const { proximaEjecucion, slotDeHoyVencido } = calcularProgramacionAlGuardar(recurrenciaFinal);

    const rows = await sbFetch("/reportes_automaticos", "POST", {
      nombre:       nombre.trim(),
      modulo_id:    modulo_id.trim(),
      tipo_reporte: tipo_reporte.trim(),
      asunto:       asunto?.trim()  ?? null,
      cuerpo:       cuerpo?.trim()  ?? null,
      formato,
      activo:       typeof activo === "boolean" ? activo : true,
      borrador:     typeof borrador === "boolean" ? borrador : false,
      frecuencia,
      filtros:       Array.isArray(filtros)  ? filtros  : [],
      columnas:      Array.isArray(columnas) ? columnas : [],
      recurrencia:   recurrenciaFinal,
      proxima_ejecucion: proximaEjecucion ? proximaEjecucion.toISOString() : null,
      destinatarios: destinatarios ?? { personal_ids: [], correos_externos: [] },
      seguimiento_gps: typeof seguimiento_gps === "boolean" ? seguimiento_gps : false,
      created_by:   actor,
      updated_by:   actor,
    });
    if (!rows?.[0]) return res.status(502).json({ error: "No se pudo crear el reporte" });
    res.status(201).json({ ...rows[0], slotDeHoyVencido });
  } catch (e) {
    console.error("POST /api/reportes-automaticos error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.patch("/api/reportes-automaticos/:id", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const { nombre, modulo_id, tipo_reporte, asunto, cuerpo, formato, activo, borrador, frecuencia, filtros, columnas, recurrencia, destinatarios, seguimiento_gps } = req.body ?? {};

    const patch = { updated_by: actor };
    let slotDeHoyVencido = false; // Fase 11D.1 — solo se vuelve true si esta solicitud recalcula recurrencia
    if (nombre       !== undefined) patch.nombre       = nombre.trim();
    if (modulo_id    !== undefined) patch.modulo_id    = modulo_id.trim();
    if (tipo_reporte !== undefined) patch.tipo_reporte = tipo_reporte.trim();
    if (asunto       !== undefined) patch.asunto       = asunto?.trim() ?? null;
    if (cuerpo       !== undefined) patch.cuerpo       = cuerpo?.trim() ?? null;
    if (activo       !== undefined) patch.activo       = Boolean(activo);
    if (borrador     !== undefined) patch.borrador     = Boolean(borrador);
    if (formato !== undefined) {
      if (!FORMATOS_VALIDOS_RA.has(formato)) {
        return res.status(400).json({ error: "Formato inválido. Use: excel, html_filas o html_columnas" });
      }
      patch.formato = formato;
    }
    if (frecuencia !== undefined) {
      if (!FRECUENCIAS_VALIDAS_RA.has(frecuencia)) {
        return res.status(400).json({ error: "Frecuencia inválida. Use: diaria, semanal o mensual" });
      }
      patch.frecuencia = frecuencia;
    }
    if (filtros !== undefined) {
      if (!Array.isArray(filtros)) {
        return res.status(400).json({ error: "filtros debe ser un array" });
      }
      patch.filtros = filtros;
    }
    if (columnas !== undefined) {
      if (!Array.isArray(columnas)) {
        return res.status(400).json({ error: "columnas debe ser un array" });
      }
      patch.columnas = columnas;
    }
    if (recurrencia !== undefined) {
      if (typeof recurrencia !== "object" || recurrencia === null || Array.isArray(recurrencia)) {
        return res.status(400).json({ error: "recurrencia debe ser un objeto" });
      }
      patch.recurrencia = recurrencia;
      // Fase 9G — hallazgo de auditoría: si no se recalcula proxima_ejecucion
      // aquí, un reporte activo cuya recurrencia se edita conserva el
      // próximo disparo calculado con el horario ANTERIOR (ej. seguía
      // "diaria 08:00" aunque el usuario ya cambió a "semanal lunes 14:00").
      // Fase 11D.1 — antes se ponía en null y se esperaba hasta 60s al
      // siguiente tick del scheduler; ahora se recalcula de una vez con la
      // MISMA función que usa el scheduler (calcularProgramacionAlGuardar
      // → primerSlotFuturo), con la misma garantía de nunca dejar un slot
      // ya vencido.
      const programacion = calcularProgramacionAlGuardar(recurrencia);
      patch.proxima_ejecucion = programacion.proximaEjecucion ? programacion.proximaEjecucion.toISOString() : null;
      slotDeHoyVencido = programacion.slotDeHoyVencido;
    }
    if (destinatarios !== undefined) {
      const err = errorDestinatarios(destinatarios);
      if (err) return res.status(400).json({ error: err });
      patch.destinatarios = destinatarios;
    }
    if (seguimiento_gps !== undefined) {
      if (typeof seguimiento_gps !== "boolean") {
        return res.status(400).json({ error: "'seguimiento_gps' debe ser boolean" });
      }
      // Solo se valida contra el modulo_id de ESTA misma solicitud — el
      // wizard (Etapa 01) siempre envía ambos juntos (Fase 10D). La
      // verdadera barrera de seguridad no es esta validación de guardado:
      // es que la ejecución (services/reportes/enlaceGps.js) vuelve a
      // comprobar modulo_id === 'gestion_logistica' cada vez, sin importar
      // lo que haya quedado persistido aquí.
      if (seguimiento_gps && modulo_id !== undefined && modulo_id.trim() !== MODULO_GESTION_LOGISTICA) {
        return res.status(400).json({ error: "El seguimiento GPS solo aplica a reportes de Gestión Logística" });
      }
      patch.seguimiento_gps = seguimiento_gps;
    }

    const rows = await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(id)}`, "PATCH", patch);
    if (!rows?.[0]) return res.status(404).json({ error: "Reporte no encontrado" });
    res.json({ ...rows[0], slotDeHoyVencido });
  } catch (e) {
    console.error("PATCH /api/reportes-automaticos/:id error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

app.patch("/api/reportes-automaticos/:id/activo", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const { activo } = req.body ?? {};

    if (typeof activo !== "boolean") {
      return res.status(400).json({ error: "'activo' debe ser boolean" });
    }
    const patch = { activo, updated_by: actor };
    let slotDeHoyVencido = false;
    // Fase 11D — mismo criterio que el cambio de recurrencia (Fase 9G, ver
    // PATCH /:id más arriba): al REACTIVAR un reporte, proxima_ejecucion
    // puede seguir apuntando a un slot calculado antes de pausarlo — si ese
    // slot ya quedó en el pasado mientras estaba inactivo, reactivarlo lo
    // dejaría "vencido" y el scheduler lo ejecutaría de inmediato en su
    // próximo tick ("Activar → NO enviar" es una regla de producto, no solo
    // para la primera activación). Al desactivar no aplica: activo=false ya
    // excluye al reporte de ambas consultas del scheduler, sin importar qué
    // traiga proxima_ejecucion.
    //
    // Fase 11D.1 — antes se ponía en null y se esperaba hasta 60s al
    // siguiente tick del scheduler; ahora se recalcula de una vez con la
    // recurrencia actual del reporte (este endpoint no la recibe en el
    // body, así que se lee de la fila existente) usando la MISMA función
    // que usa el scheduler (calcularProgramacionAlGuardar →
    // primerSlotFuturo) — sin duplicar el cálculo.
    if (activo === true) {
      const filaActual = await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(id)}&select=recurrencia`);
      const recurrenciaActual = filaActual?.[0]?.recurrencia ?? null;
      const programacion = calcularProgramacionAlGuardar(recurrenciaActual);
      patch.proxima_ejecucion = programacion.proximaEjecucion ? programacion.proximaEjecucion.toISOString() : null;
      slotDeHoyVencido = programacion.slotDeHoyVencido;
    }
    const rows = await sbFetch(
      `/reportes_automaticos?id=eq.${encodeURIComponent(id)}`,
      "PATCH",
      patch
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reporte no encontrado" });
    res.json({ ok: true, activo: rows[0].activo, proxima_ejecucion: rows[0].proxima_ejecucion, slotDeHoyVencido });
  } catch (e) {
    console.error("PATCH /api/reportes-automaticos/:id/activo error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/reportes-automaticos/:id — eliminación definitiva (Fase 9I).
// No toca el motor de generación/envío/scheduler: un reporte eliminado deja
// de existir en reportes_automaticos, así que scheduler.js (que solo procesa
// filas existentes con proxima_ejecucion vencida) simplemente nunca vuelve a
// encontrarlo — no requiere ninguna lógica adicional de "cancelación".
// sbFetch(..., "DELETE") siempre devuelve null (ver sbFetch arriba), así que
// primero se verifica existencia — mismo patrón que
// DELETE /api/cumplidos/:trip/documentos/:id más arriba.
app.delete("/api/reportes-automaticos/:id", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(id)}&select=id`);
    if (!existente?.[0]) return res.status(404).json({ error: "Reporte no encontrado" });

    await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(id)}`, "DELETE");
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/reportes-automaticos/:id error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/reportes-automaticos/clientes?tipo_reporte=X — Fase 11A: lista de
// clientes disponibles para el selector "Cliente" del wizard (etapa
// Filtros), derivada del MISMO dataset y la MISMA normalización que aplica
// el filtro real en generación (ver services/reportes/datasetProvider.js —
// listarClientesDataset / cliente_normalizado) — nunca un catálogo aparte
// que pueda desalinearse de lo que el filtro realmente hace.
app.get("/api/reportes-automaticos/clientes", requireErpAuth, async (req, res) => {
  try {
    const tipoReporte = String(req.query.tipo_reporte ?? "").trim();
    if (!tipoReporte) return res.status(400).json({ error: "tipo_reporte es obligatorio" });

    const clientes = await listarClientesDataset(tipoReporte, {
      sbFetch,
      viajesCache: cache.viajes.data,
      tripCustomerCache,
      extraerTelefono,
      primerNombreCliente,
    });
    res.json(clientes);
  } catch (e) {
    console.error("GET /api/reportes-automaticos/clientes error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/reportes-automaticos/:id/enviar — ejecución manual (Fase 9E).
// Genera el archivo (Excel/HTML, según reporte.formato) con el pipeline de
// 9B-9D y lo envía por correo a los destinatarios configurados. No toca
// proxima_ejecucion ni recurrencia, no persiste historial de ejecución —
// acción ad-hoc, fuera del scheduler (no implementado todavía).
// requireInternalApiKey: mismo perímetro que el resto de endpoints
// administrativos/internos del ERP (ej. GET /api/personal, arriba).
const STATUS_POR_CODIGO_ENVIO = {
  reporte_id_requerido: 400,
  deps_incompletas:     500,
  no_encontrado:        404,
  borrador:              400,
  inactivo:              400,
  sin_destinatarios:    400,
  error_generacion:     500,
  error_envio:           502,
};

app.post("/api/reportes-automaticos/:id/enviar", requireErpAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await ejecutarReporteManual(id, {
      sbFetch,
      viajesCache:         cache.viajes.data,
      tripCustomerCache,
      extraerTelefono,
      primerNombreCliente,
      seguimientoGpsUrl:   SEGUIMIENTO_GPS_URL, // Fase 10D — ver services/reportes/enlaceGps.js
      origenEjecucion:     "manual",
    });
    if (!resultado.ok) {
      const status = STATUS_POR_CODIGO_ENVIO[resultado.codigo] ?? 500;
      return res.status(status).json(resultado);
    }
    res.json(resultado);
  } catch (e) {
    console.error(`POST /api/reportes-automaticos/${req.params.id}/enviar error:`, e.message);
    res.status(500).json({ ok: false, codigo: "error_interno", error: "Error interno al enviar el reporte" });
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
        cantidad:  cache.viajes.data.length,
        edad_seg:  Math.round((Date.now() - cache.viajes.ts) / 1000),
        completo:  cache.viajes.completo,
        por_estado: estados,
      },
      alarmas: {
        cantidad: cache.alarmas.data.length,
        edad_seg: Math.round((Date.now() - cache.alarmas.ts) / 1000),
      },
    },
    ultimo_snapshot: lastSnapshotMetrics,
  });
});

// ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────────────────────

// POST /push/suscripcion — registrar o actualizar suscripción push del usuario
app.post('/push/suscripcion', requireClienteAuth, async (req, res) => {
  const { endpoint, p256dh, auth } = req.body || {};
  if (!endpoint || !p256dh || !auth)
    return res.status(400).json({ error: 'endpoint, p256dh y auth son requeridos' });
  try {
    await sbFetch('/push_subscriptions?on_conflict=endpoint', 'POST', [{
      usuario_id:  req.userId,
      endpoint,
      p256dh,
      auth,
      user_agent:  req.headers['user-agent'] || null,
      activo:      true,
    }]);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('❌ POST /push/suscripcion:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /push/suscripcion — eliminar suscripción push del usuario
app.delete('/push/suscripcion', requireClienteAuth, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint)
    return res.status(400).json({ error: 'endpoint requerido' });
  try {
    await sbFetch(
      `/push_subscriptions?usuario_id=eq.${encodeURIComponent(req.userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`,
      'DELETE'
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /push/suscripcion:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DIAGNÓSTICO CONTROLT SOAP ───────────────────────────────────────────────
app.use('/api/controlt', requireErpAuth, controltDiagRouter);

// ─── SEGUIMIENTO GPS EXTERNO (Fase 10B) ──────────────────────────────────────
// Rutas PÚBLICAS (sin requireInternalApiKey — decisión cerrada de Fase 10B:
// el enlace/OTP/sesión son su propio mecanismo de autorización, nunca la
// clave interna del ERP). `cache` se pasa completo (no `cache.viajes.data`)
// para que el router siempre lea el snapshot más reciente — ver
// routes/gpsSeguimiento.js.
app.use('/api/seguimiento-gps', crearRouterGpsSeguimiento({
  sbFetch, cache, tripCustomerCache, extraerTelefono, primerNombreCliente,
}));

// ─── MANEJADOR DE ERRORES — respuestas JSON limpias para fallos de body-parser ──
// (ej. archivo de soporte que excede el límite de express.raw). Sin este
// handler, Express respondería con una página HTML de error por defecto.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'El archivo enviado excede el tamaño máximo permitido.' });
  }
  console.error('❌ Error no manejado:', err?.message || err);
  res.status(err?.status || 500).json({ error: err?.message || 'Error interno del servidor' });
});

// ─── SCHEDULER DE REPORTES AUTOMÁTICOS (Fase 9F) ────────────────────────────
// Wrapper delgado: toda la lógica (qué reportes están vencidos, cómo se
// calcula la próxima ejecución, el mutex de un tick a la vez) vive en
// services/reportes/scheduler.js — aquí solo se inyectan las dependencias
// del proceso (sbFetch, caché de viajes, helpers) y se registra el log,
// mismo patrón que el bloque de syncPlaneados de abajo.
async function tickSchedulerReportes(origen) {
  try {
    const resultado = await ejecutarTickScheduler({
      sbFetch,
      viajesCache: cache.viajes.data,
      tripCustomerCache,
      extraerTelefono,
      primerNombreCliente,
      seguimientoGpsUrl: SEGUIMIENTO_GPS_URL, // Fase 10D — ver services/reportes/enlaceGps.js
      origenEjecucion:   "scheduler",
    });
    if (!resultado.ok) {
      if (resultado.motivo !== 'tick_en_curso') {
        console.warn(`[SCHEDULER REPORTES] (${origen}) tick omitido: ${resultado.motivo}`);
      }
      return;
    }
    if (resultado.inicializados.length || resultado.ejecutados.length) {
      const exitosos = resultado.ejecutados.filter(r => r.ok).length;
      const fallidos  = resultado.ejecutados.length - exitosos;
      console.log(
        `[SCHEDULER REPORTES] (${origen}) inicializados: ${resultado.inicializados.length} | ` +
        `ejecutados: ${resultado.ejecutados.length} (ok: ${exitosos}, error: ${fallidos})`
      );
    }
  } catch (e) {
    console.error(`[SCHEDULER REPORTES] (${origen}) Error inesperado:`, e.message);
  }
}

// ─── INICIO ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 INLOP Torre de Control — Servidor iniciado en puerto ${PORT}`);
  console.log(`📊 Sync: viajes cada 60s | solicitudes cada 65s | planeados cada 5min | reportes automáticos cada 60s`);

  try {
    await refreshCustomerLookup();
    await refreshToken();
    await syncViajes();
    await syncAlarmas();
    await syncPendientes();
    await syncPlaneados('inicio-servidor');
    await syncCumplidos();
    await syncSolicitudes();
  } catch(e) {
    console.error("❌ Error inicialización:", e.message);
  }

  await tickSchedulerReportes('inicio-servidor');

  setInterval(refreshCustomerLookup, 10 * 60 * 1000);
  setInterval(syncViajes,             60 * 1000);
  setInterval(syncAlarmas,            70 * 1000);
  setInterval(syncPendientes,          5 * 60 * 1000);
  setInterval(async () => {
    const tSched0 = Date.now();
    console.log(`[SCHEDULER] syncPlaneados — hora: ${horaAhora()} | mutex: ${syncPlaneadosRunning ? 'BLOQUEADO (omitiendo)' : 'libre'} | último SYNC: #${lastSyncFinished}`);
    await syncPlaneados('scheduler');
    console.log(`[SCHEDULER] syncPlaneados — fin | ${Date.now() - tSched0}ms`);
  }, 5 * 60 * 1000);
  setInterval(syncCumplidos,          60 * 1000);
  setInterval(syncSolicitudes,        65 * 1000);
  setInterval(() => tickSchedulerReportes('scheduler'), 60 * 1000);
});
