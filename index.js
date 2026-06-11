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
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();

  console.log("================================");
  console.log("URL:", `${BASE_URL}${path}`);
  console.log("STATUS:", response.status);
  console.log("CONTENT-TYPE:", response.headers.get("content-type"));
  console.log("BODY:", text.substring(0, 2000));
  console.log("================================");

  try {
    const data = JSON.parse(text);

    if (
      data &&
      data.Message &&
      data.Message.toLowerCase().includes("denied")
    ) {
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

// ─── SYNC PLANEADOS ─────────────────────────────────────
async function syncPlaneados() {
  try {
    // 1. Traer Travel/search con size grande
    const path = `/Travel/search?size=200&page=1`;
    const data = await safeFetch(path, []);
    const arr = Array.isArray(data) ? data : data.data || data.result || [];
    
    if (!arr.length) {
      console.log('📅 Planeados: Travel/search devolvió 0 viajes');
      return;
    }

    const ahora = new Date();

    // 2. Filtrar solo viajes con schedulate_origin >= hoy 00:00
    const hoyInicio = new Date(ahora);
    hoyInicio.setHours(0, 0, 0, 0);

    const viajesFuturos = arr.filter(v => {
      const f = parseSchedulate(v.schedulate_origin);
      if (!f || isNaN(f.getTime())) return false;
      return f >= hoyInicio;
    });

    console.log(`📅 Planeados: ${arr.length} en Travel/search → ${viajesFuturos.length} hoy o futuros`);

    if (!viajesFuturos.length) return;

    // 3. Obtener los que ya existen en Supabase para no pisar fecha_detectado
    const existentes = await sbFetch('/planeados?select=trip_number,fecha_detectado,company_customer_name');
    const existMap = {};
    (existentes || []).forEach(e => { existMap[e.trip_number] = e; });

    // 4. IDs activos en Resume para marcar activo_en_resume
    const activeIds = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    // 5. Upsert cada viaje — solo insertar nuevos, actualizar estado de activos
    const rows = viajesFuturos.map(v => {
      const f = parseSchedulate(v.schedulate_origin);
      const yaExiste = existMap[v.trip_number];
      const estaActivo = activeIds.has(v.trip_number);
      
      // Cliente: del viaje activo en Resume si existe, si no del Travel/search
      const viajeResume = cache.viajes.data.find(r => r.trip_number === v.trip_number);
      const cliente = viajeResume?.company_customer_name || v.company_customer_name || null;

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
      };

      // Si ya existe → mantener fecha_detectado original
      if (yaExiste) {
        row.fecha_detectado = yaExiste.fecha_detectado;
        // Solo actualizar activado_en si acaba de activarse
        if (estaActivo && !yaExiste.activo_en_resume) {
          row.activado_en = new Date().toISOString();
        }
      } else {
        row.fecha_detectado = new Date().toISOString();
        if (estaActivo) row.activado_en = new Date().toISOString();
      }

      return row;
    });

    // Upsert en lotes de 50
    for (let i = 0; i < rows.length; i += 50) {
      const lote = rows.slice(i, i + 50);
      await sbFetch('/planeados', 'POST', lote);
    }

    // 6. Limpiar viajes de días anteriores (fecha_programada_dia < hoy)
    const hoyStr = hoyInicio.toISOString().slice(0, 10);
    await sbFetch(`/planeados?fecha_programada_dia=lt.${hoyStr}`, 'DELETE');
    console.log(`📅 Planeados: ${rows.length} upsertados, limpieza de anteriores a ${hoyStr}`);

    // 7. Actualizar cliente en viajes ya activos que no tenían cliente
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

    // 1. Leer todos los cumplidos existentes en Supabase
    const existentesRaw = await sbFetch('/cumplidos?select=id,estado_cumplido,tiene_soporte,cliente&limit=1000');
    const existentes = new Map((existentesRaw || []).map(c => [c.id, c]));

    const ESTADOS_ACTIVOS = new Set(['LIVE', 'SOLICITADO', 'CUMPLIDO RECIBIDO']);
    const apiSet = new Set(cache.viajes.data.map(v => v.trip_number).filter(Boolean));

    // 2. Insertar viajes nuevos que aparecieron en el Resume
    let insertados = 0, actualizados = 0;
    for (const v of cache.viajes.data) {
      if (!v.trip_number) continue;
      const existe = existentes.get(v.trip_number);
      const cliente = (v.company_customer_name || '').split(',')[0].trim();

      if (!existe) {
        // Nuevo viaje — insertar con estado LIVE
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
        // Actualizar estado_controlt, pct y cliente si antes estaba vacío
        const patch = {
          estado_controlt: v.state_travel || '',
          pct:             parseFloat(v.percentage_travel) || 0,
        };
        if (!existe.cliente && cliente) patch.cliente = cliente;
        await sbFetch(`/cumplidos?id=eq.${encodeURIComponent(v.trip_number)}`, 'PATCH', patch);
        actualizados++;
      }
    }

    // 3. Detectar viajes que desaparecieron del Resume → finalizar en Supabase
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

// Planeados — desde Supabase
app.get("/api/planeados", async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().slice(0, 10);
    // Traer hoy y futuros ordenado por schedulate_origin
    const data = await sbFetch(
      `/planeados?fecha_programada_dia=gte.${hoyStr}&order=schedulate_origin.asc&limit=500`
    );
    res.json(data || []);
  } catch(e) {
    console.error("❌ /api/planeados:", e.message);
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
    await syncPlaneados();
    await syncCumplidos();
  } catch(e) {
    console.error("❌ Error inicialización:", e.message);
  }

  setInterval(syncViajes,    60 * 1000);
  setInterval(syncAlarmas,   70 * 1000);
  setInterval(syncPendientes, 5 * 60 * 1000);
  setInterval(syncPlaneados,  5 * 60 * 1000);
  setInterval(syncCumplidos,  60 * 1000); // Cumplidos cada 60s — mismo ciclo que viajes
});
