/**
 * Diagnóstico SOL-00018 / VE-2869
 *
 * Ejecutar en Railway (shell) o local con .env cargado:
 *   node diag-sol00018.mjs
 *
 * Responde exactamente:
 *   1. ¿Existe VE-2869 en cache.viajes.data? (Resume API en tiempo real)
 *   2. Si existe: trip_number, remission, number_order, estado
 *   3. ¿La clave "VE-2869" fue agregada a resumeByRemission?
 *   4/5. Causa exacta del fallo o del match
 */

import 'dotenv/config';

const SB_URL      = "https://gtyydandwcgoaratmnqh.supabase.co/rest/v1";
const SB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI";
const SB_KEY      = process.env.SUPABASE_SERVICE_KEY || SB_ANON_KEY;

const CT_PUBLIC_URL  = 'https://app.controlt.com.co/apipublic/api';
const CT_PUBLIC_USER = process.env.CT_PUBLIC_USER || 'Inlop';
const CT_PUBLIC_PASS = process.env.CT_PUBLIC_PASS || 'InLoPC4rg*24';

// Normalización idéntica a index.js líneas 2250-2261
function _normRemision(s) {
  return (s || '').trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}
function _splitRem(remission) {
  return (remission || '').split(',')
    .map(_normRemision)
    .filter(Boolean);
}

async function sbFetch(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function ctLogin() {
  const r = await fetch(`${CT_PUBLIC_URL}/login/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(CT_PUBLIC_USER)}&password=${encodeURIComponent(CT_PUBLIC_PASS)}`
  });
  if (!r.ok) throw new Error(`CT login HTTP ${r.status}`);
  const d = await r.json();
  return d.access_token || d.token || d.Token;
}

async function ctResumePage(token, page) {
  const r = await fetch(`${CT_PUBLIC_URL}/Resume?size=100&page=${page}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d) ? d : (d?.data || d?.result || []);
}

(async () => {
  const SEP = '═'.repeat(58);
  console.log(`\n${SEP}`);
  console.log(' DIAGNÓSTICO EXACTO — SOL-00018 / VE-2869');
  console.log(`${SEP}\n`);

  // ── PASO 1: SOL-00018 en Supabase ─────────────────────────────────────────
  console.log('PASO 1 — Solicitud SOL-00018 en base de datos');
  console.log('─'.repeat(58));
  let sol = null;
  try {
    const rows = await sbFetch(
      '/solicitudes?codigo_solicitud=eq.SOL-00018&select=codigo_solicitud,estado,external_ref,referencia_remision,created_at,updated_at'
    );
    if (!rows.length) {
      console.log('❌ SOL-00018 NO existe en la tabla solicitudes.');
      console.log('   → La solicitud no fue registrada en la DB. Fin del diagnóstico.');
      process.exit(0);
    }
    sol = rows[0];
    console.log(`   codigo_solicitud : ${sol.codigo_solicitud}`);
    console.log(`   estado           : ${sol.estado}`);
    console.log(`   external_ref     : ${JSON.stringify(sol.external_ref)}`);
    console.log(`   referencia_remision: ${JSON.stringify(sol.referencia_remision)}`);
    console.log(`   created_at       : ${sol.created_at}`);
    console.log(`   updated_at       : ${sol.updated_at}`);
  } catch(e) {
    console.log(`❌ Error consultando Supabase: ${e.message}`);
    process.exit(1);
  }

  const externalRef = sol.external_ref || '';
  const matchKey    = _normRemision(externalRef) || sol.codigo_solicitud;
  console.log(`\n   matchKey calculado (igual que index.js línea 2026):`);
  console.log(`   _normRemision("${externalRef}") → "${matchKey}"`);

  if (!externalRef) {
    console.log('\n⛔ external_ref es NULL o vacío.');
    console.log('   → syncSolicitudes usa codigo_solicitud como matchKey: "SOL-00018".');
    console.log('   → Ese valor nunca va a estar en resumeByRemission (no es un código ControlT).');
    console.log('   CAUSA RAÍZ: external_ref no fue asignado al planillar el servicio en el TMS.');
    process.exit(0);
  }

  // ── PASO 2: Login ControlT ─────────────────────────────────────────────────
  console.log('\nPASO 2 — Login ControlT Public API');
  console.log('─'.repeat(58));
  let ctToken;
  try {
    ctToken = await ctLogin();
    console.log(`✅ Token obtenido: ${ctToken.slice(0, 30)}...`);
  } catch(e) {
    console.log(`❌ Login falló: ${e.message}`);
    process.exit(1);
  }

  // ── PASO 3: Resume API — snapshot completo ─────────────────────────────────
  console.log('\nPASO 3 — Resume API (snapshot en tiempo real)');
  console.log('─'.repeat(58));
  let todosViajes = [];
  for (let p = 1; p <= 3; p++) {
    const page = await ctResumePage(ctToken, p);
    console.log(`   Página ${p}: ${page.length} viajes`);
    todosViajes = [...todosViajes, ...page];
    if (page.length < 100) break;
  }
  console.log(`   Total viajes activos en Resume: ${todosViajes.length}`);

  // ── PASO 4: ¿Existe VE-2869 en cache.viajes.data? ─────────────────────────
  console.log('\nPASO 4 — ¿Existe VE-2869 en cache.viajes.data?');
  console.log('─'.repeat(58));
  const TARGET = matchKey; // "VE-2869"

  // Buscar en remission (misma lógica que resumeByRemission)
  const porRemission = todosViajes.filter(v => {
    const remField = v.remission ?? v.Remission ?? v.remission_number ?? '';
    return _splitRem(remField).includes(TARGET);
  });

  // Buscar en CUALQUIER campo (misma lógica que [MATCH-HINT])
  const porCualquierCampo = todosViajes.filter(v =>
    Object.values(v).some(val => val != null && String(val).toUpperCase().includes(TARGET))
  );

  if (porRemission.length > 0) {
    console.log(`✅ SÍ — VE-2869 encontrado en campo remission:`);
    for (const v of porRemission) {
      const remField = v.remission ?? v.Remission ?? v.remission_number ?? '';
      console.log(`\n   trip_number    : ${v.trip_number}`);
      console.log(`   remission      : ${remField}`);
      console.log(`   number_order   : ${v.number_order}`);
      console.log(`   estado/status  : ${v.status ?? v.estado ?? v.state ?? v.trip_status}`);
      console.log(`   license_plate  : ${v.license_plate ?? v.placa}`);
      console.log(`   company        : ${v.company_customer_name ?? v.customer_name}`);
      const parts = _splitRem(remField);
      console.log(`\n   _splitRem("${remField}") → ${JSON.stringify(parts)}`);
      console.log(`   ¿"${TARGET}" en partes? : ${parts.includes(TARGET) ? 'SÍ' : 'NO'}`);
    }
  } else if (porCualquierCampo.length > 0) {
    console.log(`⚠️  NO en remission — pero VE-2869 aparece en OTROS campos:`);
    for (const v of porCualquierCampo) {
      const camposConValor = Object.entries(v)
        .filter(([, val]) => val != null && String(val).toUpperCase().includes(TARGET))
        .map(([k, val]) => `${k}="${val}"`);
      console.log(`\n   trip_number    : ${v.trip_number}`);
      console.log(`   remission      : ${v.remission ?? v.Remission ?? '—'}`);
      console.log(`   number_order   : ${v.number_order ?? '—'}`);
      console.log(`   estado/status  : ${v.status ?? v.estado ?? v.state ?? '—'}`);
      console.log(`   Campos con VE-2869: ${camposConValor.join(' | ')}`);
    }
  } else {
    console.log(`❌ NO — VE-2869 no existe en ningún campo de los ${todosViajes.length} viajes activos.`);
    if (todosViajes.length > 0) {
      console.log(`\n   Campos del objeto viaje disponibles:`);
      console.log(`   ${Object.keys(todosViajes[0]).join(', ')}`);
    }
  }

  // ── PASO 5: ¿La clave fue agregada a resumeByRemission? ───────────────────
  console.log('\nPASO 5 — ¿"VE-2869" está en resumeByRemission?');
  console.log('─'.repeat(58));
  const resumeByRemission = new Map();
  for (const v of todosViajes) {
    const remField = v.remission ?? v.Remission ?? v.remission_number ?? '';
    for (const p of _splitRem(remField)) resumeByRemission.set(p, v);
  }
  console.log(`   Claves totales en resumeByRemission: ${resumeByRemission.size}`);
  const enMap = resumeByRemission.has(TARGET);
  console.log(`   ¿"${TARGET}" en el Map? : ${enMap ? 'SÍ' : 'NO'}`);

  if (!enMap) {
    const parecidas = [...resumeByRemission.keys()].filter(k =>
      k.includes('VE') || k.includes('2869') || k.replace(/-/g,'') === TARGET.replace(/-/g,'')
    );
    if (parecidas.length) {
      console.log(`\n   Claves parecidas en el Map:`);
      for (const k of parecidas) console.log(`     "${k}"`);
    }
  }

  // ── CONCLUSIÓN ─────────────────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(' CONCLUSIÓN');
  console.log(SEP);
  if (!externalRef) {
    console.log('CAUSA RAÍZ: external_ref vacío en DB → matchKey = "SOL-00018" → nunca hace match.');
  } else if (porRemission.length > 0 && enMap) {
    console.log(`CAUSA RAÍZ: VE-2869 sí está en el Map. El match DEBERÍA funcionar.`);
    console.log(`           Verificar estado de la solicitud y ciclo de sync.`);
  } else if (porCualquierCampo.length > 0 && !enMap) {
    console.log(`CAUSA RAÍZ: VE-2869 existe en ControlT pero NO en campo remission.`);
    console.log(`           Está en otro campo (ver PASO 4). resumeByRemission no lo indexa.`);
  } else {
    console.log(`CAUSA RAÍZ: VE-2869 NO existe en ningún viaje activo del Resume API.`);
    console.log(`           El viaje puede estar cerrado/completado en ControlT, o`);
    console.log(`           no haber sido creado aún con ese número de remisión.`);
  }
  console.log(`${SEP}\n`);
})();
