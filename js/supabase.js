/* ================================================================
   supabase.js — INLOP Business Intelligence
   Contiene:
     · Configuración de Supabase (URL, KEY)
     · supabaseQuery() — cliente HTTP genérico
     · saveToSupabase() / loadFromSupabase() — Operaciones (id=1)
     · saveOtifToSupabase() / loadOtifFromSupabase() — OTIF (id=2)
     · AZURE_CONFIG, initMsal(), signIn(), getAccessToken() — SharePoint
   DEPENDENCIAS: ninguna (se carga primero)
   ================================================================ */

const SUPABASE_URL = 'https://gtyydandwcgoaratmnqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI';

// Supabase client
async function supabaseQuery(method, endpoint, body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Supabase error: ${response.statusText}`);
  return response.json();
}

// Save data to Supabase
async function saveToSupabase() {
  try {
    toast('Guardando en la nube...', 'info');
    
    const dataToSave = {
      liq: DATA_LIQ,
      sec: DATA_SEC,
      actions: actions,
      causes: causesEdits,
      aiCauses: aiCausesData,
      meta: {
        updated: new Date().toISOString(),
        src: src
      }
    };
    
    // Update the single row (id=1)
    await supabaseQuery('PATCH', 'dashboard_data?id=eq.1', {
      data: dataToSave,
      updated_at: new Date().toISOString()
    });
    
    toast('✓ Datos guardados en la nube', 'ok');
    return true;
  } catch (error) {
    console.error('Supabase save error:', error);
    toast('Error al guardar en la nube: ' + error.message, 'err');
    return false;
  }
}

// Load data from Supabase
async function loadFromSupabase() {
  try {
    toast('Cargando datos de la nube...', 'info');
    
    const result = await supabaseQuery('GET', 'dashboard_data?id=eq.1&select=*');
    
    if (!result || !result[0] || !result[0].data) {
      toast('No hay datos en la nube.', 'info');
      return false;
    }
    
    const cloudData = result[0].data;
    
    // Load all data
    if (cloudData.liq && cloudData.liq.length) {
      DATA_LIQ = filterEmpty(cloudData.liq);
      DATA_SEC = filterEmpty(cloudData.sec || []);
      actions = cloudData.actions || {liq:{}, sec:{}};
      causesEdits = cloudData.causes || {};
      aiCausesData = cloudData.aiCauses || {};
      src = 'supabase';
      
      const ids = WKS().map(w => w.id);
      wkId = ids[ids.length - 1];
      
      updateXLUI();
      refresh();
      buildCausesFromExcel();
      
      const updated = cloudData.meta?.updated ? new Date(cloudData.meta.updated).toLocaleString('es-CO') : 'fecha desconocida';
      toast(`✓ Datos cargados desde la nube (actualizado: ${updated})`, 'ok');
      
      // Actualizar stats del portal
      if(typeof window.updatePortalStats === 'function'){
        setTimeout(function(){ window.updatePortalStats(); }, 100);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Supabase load error:', error);
    toast('Error al cargar de la nube: ' + error.message, 'err');
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// OTIF — Supabase Save/Load (id=2)
// ═══════════════════════════════════════════════════════
async function saveOtifToSupabase(otifData) {
  console.log('🔵 [OTIF SAVE] ═══════════ INICIO GUARDADO ═══════════');
  
  // Si no se pasa parámetro, intentar usar window.oData
  if (typeof otifData === 'undefined' || otifData === null) {
    console.log('🔵 [OTIF SAVE] No se pasó parámetro, intentando window.oData');
    if (typeof window !== 'undefined' && window.oData) {
      otifData = window.oData;
      console.log('🔵 [OTIF SAVE] window.oData encontrado');
    } else {
      console.error('❌ [OTIF SAVE] No hay datos OTIF para guardar (sin parámetro y sin window.oData)');
      if (typeof notif === 'function') notif('❌ No hay datos OTIF para guardar', 'err');
      return false;
    }
  }
  
  console.log('🔵 [OTIF SAVE] otifData recibido:', otifData);
  console.log('🔵 [OTIF SAVE] otifData keys count:', Object.keys(otifData).length);
  console.log('🔵 [OTIF SAVE] otifData keys:', Object.keys(otifData));
  
  // Filtrar claves válidas (sin las propiedades internas como _causasGlobal)
  var validKeys = Object.keys(otifData).filter(function(k){ 
    return !k.startsWith('_'); 
  });
  console.log('🔵 [OTIF SAVE] Claves válidas (sin _internas):', validKeys.length);
  console.log('🔵 [OTIF SAVE] Claves válidas:', validKeys);
  
  if (validKeys.length === 0) {
    console.error('❌ [OTIF SAVE] otifData no tiene clientes válidos (keys=0)');
    if (typeof notif === 'function') notif('❌ Sin datos válidos para guardar', 'err');
    return false;
  }
  
  // Verificar admin solo si está disponible
  if (typeof window !== 'undefined' && typeof window.oIsAdmin !== 'undefined' && !window.oIsAdmin) {
    console.warn('⚠ [OTIF SAVE] No eres admin (window.oIsAdmin=false), no se guardará');
    return false;
  }
  
  try {
    // Crear objeto limpio solo con datos de clientes (sin propiedades internas)
    var cleanData = {};
    validKeys.forEach(function(k){
      cleanData[k] = otifData[k];
    });
    
    // Incluir _causasGlobal por separado si existe
    if (otifData._causasGlobal) {
      cleanData._causasGlobal = otifData._causasGlobal;
    }
    
    console.log('🔵 [OTIF SAVE] cleanData keys:', Object.keys(cleanData).length);
    
    // Serializar y validar tamaño
    var jsonString;
    try {
      jsonString = JSON.stringify(cleanData);
      console.log('🔵 [OTIF SAVE] JSON serializado OK. Tamaño:', jsonString.length, 'bytes');
      console.log('🔵 [OTIF SAVE] Primeros 200 chars del JSON:', jsonString.substring(0, 200));
    } catch (jsonErr) {
      console.error('❌ [OTIF SAVE] Error serializando JSON:', jsonErr);
      if (typeof notif === 'function') notif('❌ Error al serializar datos: ' + jsonErr.message, 'err');
      return false;
    }
    
    // Validar que el JSON serializado no esté vacío
    if (jsonString === '{}' || jsonString.length < 10) {
      console.error('❌ [OTIF SAVE] JSON serializado está vacío. No se guardará.');
      if (typeof notif === 'function') notif('❌ Datos serializados vacíos', 'err');
      return false;
    }
    
    const dataToSave = {
      otif: cleanData,
      meta: { 
        updated: new Date().toISOString(),
        clientes: validKeys.length
      }
    };
    
    console.log('🔵 [OTIF SAVE] Tamaño total payload:', JSON.stringify(dataToSave).length, 'bytes');
    console.log('🔵 [OTIF SAVE] URL destino:', SUPABASE_URL + '/rest/v1/dashboard_data?id=eq.2');
    
    if (typeof notif === 'function') notif('⏳ Guardando OTIF en la nube...', 'info');
    
    console.log('🔵 [OTIF SAVE] Enviando PATCH a Supabase...');
    const response = await fetch(SUPABASE_URL + '/rest/v1/dashboard_data?id=eq.2', {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        data: dataToSave,
        updated_at: new Date().toISOString()
      })
    });
    
    console.log('🔵 [OTIF SAVE] Status HTTP:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [OTIF SAVE] Error HTTP:', response.status, errorText);
      throw new Error('HTTP ' + response.status + ': ' + errorText);
    }
    
    const responseData = await response.json();
    console.log('✅ [OTIF SAVE] Respuesta de Supabase:', responseData);
    console.log('✅ [OTIF SAVE] Filas afectadas:', responseData.length);
    
    if (responseData.length === 0) {
      console.warn('⚠ [OTIF SAVE] PATCH no afectó filas. Intentando INSERT con id=2...');
      const insertResponse = await fetch(SUPABASE_URL + '/rest/v1/dashboard_data', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: 2,
          data: dataToSave,
          updated_at: new Date().toISOString()
        })
      });
      
      console.log('🔵 [OTIF SAVE INSERT] Status:', insertResponse.status);
      
      if (!insertResponse.ok) {
        const insertErr = await insertResponse.text();
        console.error('❌ [OTIF SAVE INSERT] Error:', insertErr);
        throw new Error('INSERT HTTP ' + insertResponse.status + ': ' + insertErr);
      }
      
      const insertData = await insertResponse.json();
      console.log('✅ [OTIF SAVE INSERT] Resultado:', insertData);
    } else {
      // Verificar que se guardó correctamente
      var savedOtif = responseData[0].data && responseData[0].data.otif ? responseData[0].data.otif : {};
      var savedKeys = Object.keys(savedOtif).filter(function(k){return !k.startsWith('_');}).length;
      console.log('✅ [OTIF SAVE] Verificación: clientes guardados en Supabase =', savedKeys);
      
      if (savedKeys === 0) {
        console.error('❌ [OTIF SAVE] CRÍTICO: Supabase devolvió data.otif vacío después del PATCH');
      }
    }
    
    if (typeof notif === 'function') {
      notif('✅ OTIF guardado en la nube (' + validKeys.length + ' clientes)', 'ok');
    }
    console.log('🔵 [OTIF SAVE] ═══════════ FIN GUARDADO ═══════════');
    return true;
  } catch (error) {
    console.error('❌ [OTIF SAVE] EXCEPCIÓN:', error);
    console.error('❌ [OTIF SAVE] Mensaje:', error.message);
    console.error('❌ [OTIF SAVE] Stack:', error.stack);
    if (typeof notif === 'function') {
      notif('❌ ERROR al guardar OTIF: ' + error.message, 'err');
    }
    return false;
  }
}

async function loadOtifFromSupabase() {
  console.log('🟢 [OTIF LOAD] Iniciando carga desde Supabase...');
  
  try {
    console.log('🟢 [OTIF LOAD] Consultando id=2...');
    const response = await fetch(SUPABASE_URL + '/rest/v1/dashboard_data?id=eq.2&select=*', {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🟢 [OTIF LOAD] Status HTTP:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [OTIF LOAD] Error HTTP:', response.status, errorText);
      throw new Error('HTTP ' + response.status + ': ' + errorText);
    }
    
    const result = await response.json();
    console.log('🟢 [OTIF LOAD] Respuesta:', result);
    console.log('🟢 [OTIF LOAD] Filas encontradas:', result ? result.length : 0);
    
    if (!result || !result[0]) {
      console.warn('⚠ [OTIF LOAD] No existe la fila id=2');
      if (typeof notif === 'function') {
        notif('⚠ No existe registro id=2 en Supabase', 'info');
      }
      return false;
    }
    
    console.log('🟢 [OTIF LOAD] Estructura del data:', result[0].data);
    
    if (!result[0].data || !result[0].data.otif) {
      console.warn('⚠ [OTIF LOAD] Fila id=2 existe pero data.otif no existe');
      if (typeof oIsAdmin === 'undefined' || !oIsAdmin) {
        if (typeof notif === 'function') {
          notif('⚠ Sin datos OTIF en la nube. Espera a que el admin cargue.', 'info');
        }
      }
      return false;
    }
    
    // CRÍTICO: Verificar que data.otif tenga contenido REAL (no esté vacío)
    var cloudOtifKeys = Object.keys(result[0].data.otif).filter(function(k){
      return !k.startsWith('_');
    });
    console.log('🟢 [OTIF LOAD] Clientes en la nube:', cloudOtifKeys.length);
    
    if (cloudOtifKeys.length === 0) {
      console.warn('⚠ [OTIF LOAD] data.otif existe pero está vacío {}. NO se sobrescribirá oData');
      if (typeof oIsAdmin === 'undefined' || !oIsAdmin) {
        if (typeof notif === 'function') {
          notif('⚠ Sin datos OTIF en la nube. Espera a que el admin cargue.', 'info');
        }
      }
      return false;
    }
    
    console.log('✅ [OTIF LOAD] Datos OTIF VÁLIDOS encontrados, asignando...');
    
    // Asignar a window para acceso desde otros scopes
    window.oData = result[0].data.otif;
    
    console.log('✅ [OTIF LOAD] window.oData asignado. Clientes cargados:', Object.keys(window.oData).length);
    
    // CRÍTICO: Usar el bridge para asignar al scope local de OTIF
    if (typeof window.ohSetDataFromCloud === 'function') {
      console.log('✅ [OTIF LOAD] Llamando bridge ohSetDataFromCloud...');
      var bridgeResult = window.ohSetDataFromCloud(result[0].data.otif);
      console.log('✅ [OTIF LOAD] Bridge result:', bridgeResult);
    } else {
      console.error('❌ [OTIF LOAD] Bridge ohSetDataFromCloud no disponible');
    }
    
    // Actualizar indicadores de estado (UI)
    var ohSrcDotEl = document.getElementById('ohSrcDot');
    var ohSrcTxtEl = document.getElementById('ohSrcTxt');
    var ohXlDotEl = document.getElementById('ohXlDot');
    var ohXlTxtEl = document.getElementById('ohXlTxt');
    
    var totalViajes = 0;
    Object.values(window.oData).forEach(function(d){
      if (d && d.v) totalViajes += d.v;
    });
    
    var updatedTime = new Date(result[0].data.meta.updated).toLocaleString('es-CO', {
      day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
    });
    
    if (ohSrcDotEl) ohSrcDotEl.style.background = 'var(--green)';
    if (ohSrcTxtEl) {
      ohSrcTxtEl.style.color = 'var(--green)';
      ohSrcTxtEl.textContent = 'Nube · ' + totalViajes + ' viajes · ' + updatedTime;
    }
    if (ohXlDotEl) ohXlDotEl.style.background = 'var(--green)';
    if (ohXlTxtEl) ohXlTxtEl.textContent = 'Datos cargados ✓';
    
    if (typeof notif === 'function') {
      notif('✓ OTIF cargado desde la nube (' + updatedTime + ')', 'ok');
    }
    
    // Actualizar stats del portal
    if(typeof window.updatePortalStats === 'function'){
      setTimeout(function(){ window.updatePortalStats(); }, 100);
    }
    
    return true;
  } catch (error) {
    console.error('Load OTIF error:', error);
    return false;
  }
}


const K1='inlop_liq_v10',K2='inlop_sec_v10',K3='inlop_meta_v10',KA='inlop_act_v10',KC='inlop_cau_v10',KCA='inlop_excauses_v12';
function filterEmpty(wks){return wks.filter(w=>{const s=w.sol||w.rows.reduce((a,r)=>a+r.sol,0);const cv=w.carg||w.rows.reduce((a,r)=>a+r.carg,0);return s>0||cv>0;})}
let DATA_LIQ=filterEmpty(JSON.parse(JSON.stringify(EMBED.liq)));
let DATA_SEC=filterEmpty(JSON.parse(JSON.stringify(EMBED.sec)));
let cargo='liq',wkId='S16',flt='all',src='demo';
let actions=JSON.parse(JSON.stringify(ACTIONS_DEF));
let causesEdits={};
let editingAction=null;
let CH={};
let aiCausesData={};

const WKS=()=>cargo==='liq'?DATA_LIQ:DATA_SEC;
const AWK=()=>WKS().find(w=>w.id===wkId)||WKS()[WKS().length-1]||null;
const isSec=()=>cargo==='sec';
const META=95;


// ═══════════════════════════════════════════════════════
// MICROSOFT GRAPH API — Azure AD Configuration
// ═══════════════════════════════════════════════════════
const AZURE_CONFIG = {
  clientId: '7830c23a-2c32-4d90-af1e-1920e59854ce',
  tenantId: 'ddaf6284-e354-40bf-a04a-c0a6ec5fde95',
  redirectUri: window.location.origin + window.location.pathname,
  scopes: ['Files.Read.All', 'User.Read']
};

const SHAREPOINT_FILE_URL = 'https://inlop1.sharepoint.com/:x:/s/INLOP/IQA7_s7M6rcXTaiTdLmkFVK7Adb3-PNFKuiv4RNHLzbyIbE?e=qteqRp';

// Convert SharePoint sharing link to Graph API endpoint
function getGraphFileUrl(sharingUrl) {
  // Extract file ID from SharePoint URL
  const match = sharingUrl.match(/\/([A-Za-z0-9_-]+)\?e=/);
  if (!match) return null;
  const encodedUrl = match[1];
  
  // Graph API endpoint for the file
  return `https://graph.microsoft.com/v1.0/sites/inlop1.sharepoint.com,/drives//items/${encodedUrl}`;
}

// MSAL (Microsoft Authentication Library) using popup flow
let msalInstance = null;
let currentAccount = null;

async function initMsal() {
  if (msalInstance) return msalInstance;
  
  // Using MSAL.js via CDN
  if (!window.msal) {
    await loadScript('https://alcdn.msauth.net/browser/2.32.2/js/msal-browser.min.js');
  }
  
  const msalConfig = {
    auth: {
      clientId: AZURE_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}`,
      redirectUri: AZURE_CONFIG.redirectUri
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  };
  
  msalInstance = new msal.PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  
  // Check if user is already logged in
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
  }
  
  return msalInstance;
}

