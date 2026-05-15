/* ================================================================
   operaciones.js — INLOP Business Intelligence
   Módulo Centro de Control Operativo (Carga Líquida + Seca)

   DEPENDENCIAS (cargadas antes en index.html):
     · Chart.js, XLSX.js, docx.js (CDN en <head>)
     · supabase.js   → supabaseQuery, save/load Supabase
     · charts.js     → AX, AX_GRID, TB_BG, TB_BD, tip, chartScales
     · utils.js      → toast, fmtShort

   EXPONE (vía window) para app.js:
     · window.DATA_LIQ, window.DATA_SEC  → stats del portal
     · window.refresh()                  → recarga vista ops
     · window.ws()                       → calc. semana (stats portal)
     · window.updatePortalStats()        → actualiza portada
   ================================================================ */

/* ════════════════════════════════════════════
   EMBEDDED DATA — S10 to S16 both modules
════════════════════════════════════════════ */
const EMBED={liq:[],sec:[]};

const CAUSES_DEF={
  liq:{S16:[
    {type:'crit',icon:'🚨',title:'C.I. PRODEXPORT — Cuervas',sub:'0% · 4 viajes sin ejecutar · Causa controlada',body:'La nominación fue lanzada el viernes 17 de abril al cierre de la semana, lo que no permitió posicionar la flota en los tiempos requeridos. El cliente trasladó formalmente estos 4 viajes a S17. No es una falla operativa de flota — se trata de una restricción de tiempo. Se requiere cumplimiento inmediato en S17.'},
    {type:'crit',icon:'⚠️',title:'INDUSTRIA AMBIENTAL — LUBRYESP SAS',sub:'0% · Segundo ciclo consecutivo · Problema estructural',body:'Segundo ciclo consecutivo sin ejecución (0% en S15 y S16). Se requiere verificar disponibilidad de vehículo habilitado para la ruta Galapa–Cartagena. El problema tiene carácter estructural y no puede dejarse pasar a un tercer ciclo.'},
    {type:'warn',icon:'📉',title:'FRONTERA ENERGY — Araguaney',sub:'83% · Cuarta semana consecutiva con 1 faltante',body:'El campo Araguaney (Yopal–Girardota) registra exactamente 1 viaje faltante durante cuatro semanas consecutivas. El patrón sostenido indica un problema de capacidad de flota en esta ruta específica. Se requiere análisis de disponibilidad y vinculación de vehículo dedicado para S17.'},
    {type:'warn',icon:'🔶',title:'AMF — Dorotea',sub:'92% · 1 vehículo trasladado a S17 por cierre de ciclo',body:'1 vehículo despachado no logró cargar dentro de los tiempos de cierre semanal. El servicio quedó trasladado a S17. No es una falla operativa — el vehículo estuvo disponible y en ruta. El incumplimiento obedece a un desfase de tiempo al cierre del ciclo, no a ausencia de flota.'},
  ]},
  sec:{S16:[
    {type:'ok',icon:'✅',title:'PRODUCTOS RAMO — Cumplimiento perfecto',sub:'100% · 92 viajes · Cliente ancla del módulo',body:'Ramo concentra el 86% del volumen del módulo de carga seca y logró ejecución perfecta. Su desempeño sólido y consistente sostiene el indicador global. Es el estándar operativo a replicar con otros clientes.'},
    {type:'ok',icon:'⭐',title:'LHOIST COLOMBIA — Nuevo cliente, arranque impecable',sub:'100% · 6 viajes · Primer ciclo con INLOP',body:'Primer ciclo de operación: 6 viajes ejecutados en su totalidad (1 urbano + 5 nacionales). Arranque sin novedades. Se recomienda consolidar la relación operativa y garantizar capacidad de flota para sostener el 100% en S17.'},
    {type:'crit',icon:'🔴',title:'JURADO TORRES y JUANCAMOLE — 0%',sub:'1 viaje cada uno · Incumplimiento total en única nominación',body:'En clientes de bajo volumen, un solo viaje faltante equivale al 100% de incumplimiento. Aunque el impacto global es mínimo, la percepción del cliente es total. Se debe investigar la causa, informar directamente a cada cliente y garantizar cobertura en S17.'},
    {type:'warn',icon:'🆕',title:'JEHS INGENIERÍA — Primer ciclo con 1 faltante',sub:'50% · Nuevo cliente · 2 sol. / 1 carg.',body:'Primer ciclo de operación: 1 de 2 viajes ejecutado. Es prioritario establecer protocolo de comunicación temprana para S17 y garantizar cobertura total desde el inicio de la relación comercial con este nuevo cliente.'},
  ]}
};

const ACTIONS_DEF={
  liq:{S16:[
    {id:1,txt:'Dar seguimiento a los 4 viajes de campo Cuervas (CI PRODEXPORT) trasladados a S17. Confirmar ejecución e informar al cliente.',resp:'Líder Operaciones',date:'21-abr',status:'urgente'},
    {id:2,txt:'Resolver disponibilidad de vehículo habilitado para ruta LUBRYESP SAS Galapa–Cartagena (IND. AMBIENTAL) — segundo ciclo sin ejecución.',resp:'Líder Operaciones',date:'21-abr',status:'urgente'},
    {id:3,txt:'Confirmar cargue del vehículo de campo Dorotea (AMF) trasladado a S17 en el primer turno disponible.',resp:'Líder Operaciones',date:'20-abr',status:'ejecutado'},
  ]},
  sec:{S16:[
    {id:1,txt:'Investigar causa de viaje no ejecutado — JUANCAMOLE (Nacional, S16) y establecer plan de mejora.',resp:'Líder Operaciones',date:'21-abr',status:'pendiente'},
    {id:2,txt:'Gestionar protocolo de comunicación con JEHS INGENIERÍA para garantizar cobertura total en S17.',resp:'Líder Oper. / Comercial',date:'21-abr',status:'ejecucion'},
    {id:3,txt:'Confirmar capacidad de flota para LHOIST COLOMBIA de cara a S17 — sostener el 100%.',resp:'Líder Operaciones',date:'21-abr',status:'ejecucion'},
  ]}
};

/* ════════════ STATE ════════════ */

const K1='inlop_liq_v10', K2='inlop_sec_v10', K3='inlop_meta_v10';
const KA='inlop_act_v10', KC='inlop_cau_v10', KCA='inlop_excauses_v12';

function filterEmpty(wks) {
  return wks.filter(w => {
    const s  = w.sol  || w.rows.reduce((a,r) => a + r.sol,  0);
    const cv = w.carg || w.rows.reduce((a,r) => a + r.carg, 0);
    return s > 0 || cv > 0;
  });
}

let DATA_LIQ = filterEmpty(JSON.parse(JSON.stringify(EMBED.liq)));
let DATA_SEC  = filterEmpty(JSON.parse(JSON.stringify(EMBED.sec)));
let cargo = 'liq', wkId = 'S16', flt = 'all', src = 'demo';
let actions      = JSON.parse(JSON.stringify(ACTIONS_DEF));
let causesEdits  = {};
let editingAction = null;
let CH           = {};
let aiCausesData = {};

const WKS   = () => cargo === 'liq' ? DATA_LIQ : DATA_SEC;
const AWK   = () => WKS().find(w => w.id === wkId) || WKS()[WKS().length-1] || null;
const isSec = () => cargo === 'sec';
const META  = 95;


// ═══════════════════════════════════════════════════════
// SUPABASE CONFIGURATION
// ═══════════════════════════════════════════════════════

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function signIn() {
  try {
    const msal = await initMsal();
    const loginRequest = {
      scopes: AZURE_CONFIG.scopes,
      prompt: 'select_account'
    };
    
    const response = await msal.loginPopup(loginRequest);
    currentAccount = response.account;
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

async function getAccessToken() {
  try {
    const msal = await initMsal();
    
    if (!currentAccount) {
      const accounts = msal.getAllAccounts();
      if (accounts.length === 0) {
        // User not logged in — sign in first
        await signIn();
        return getAccessToken(); // Retry after sign in
      }
      currentAccount = accounts[0];
    }
    
    const tokenRequest = {
      scopes: AZURE_CONFIG.scopes,
      account: currentAccount
    };
    
    // Try silent token acquisition first
    try {
      const response = await msal.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (silentError) {
      // Silent acquisition failed — use popup
      const response = await msal.acquireTokenPopup(tokenRequest);
      return response.accessToken;
    }
  } catch (error) {
    console.error('Token acquisition failed:', error);
    throw error;
  }
}

async function loadExcelFromSharePoint(){
  try {
    const wb = await downloadExcelFromSharePoint();
    await processWorkbook(wb);
  } catch(error) {
    console.error('Error loading from SharePoint:', error);
  }
}

async function downloadExcelFromSharePoint() {
  try {
    toast('Descargando Excel de SharePoint...', 'info');
    
    // Direct SharePoint download link (no auth needed for INLOP users)
    // Convert sharing link to download link
    const shareLink = 'https://inlop1.sharepoint.com/:x:/s/INLOP/IQA7_s7M6rcXTaiTdLmkFVK7AS-_1oaThXbqJ8QCEYyUZSw?e=mq7vbt';
    const downloadLink = shareLink.replace(':x:', ':x:').replace('?e=', '?download=1&e=');
    
    const response = await fetch(downloadLink, {
      method: 'GET',
      credentials: 'include', // Include cookies for SharePoint auth
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    // Parse with XLSX
    const workbook = XLSX.read(arrayBuffer, {type: 'array'});
    
    toast('✓ Excel cargado desde SharePoint', 'ok');
    
    return workbook;
  } catch (error) {
    console.error('SharePoint download error:', error);
    toast('Error al descargar de SharePoint: ' + error.message, 'err');
    throw error;
  }
}

/* ════════════ STORAGE ════════════ */
function saveMem(fn){try{localStorage.setItem(K1,JSON.stringify(DATA_LIQ));localStorage.setItem(K2,JSON.stringify(DATA_SEC));localStorage.setItem(K3,JSON.stringify({fn,at:new Date().toISOString()}));localStorage.setItem(KA,JSON.stringify(actions));localStorage.setItem(KC,JSON.stringify(causesEdits));return true}catch(e){return false}}
function loadMem(){try{const l=localStorage.getItem(K1),s=localStorage.getItem(K2),m=localStorage.getItem(K3);if(!l||!s)return null;return{liq:JSON.parse(l),sec:JSON.parse(s),meta:JSON.parse(m||'{}')} }catch(e){return null}}
async function clearMem(){
  [K1,K2,K3,KA,KC,KCA].forEach(k=>localStorage.removeItem(k));
  DATA_LIQ=[];DATA_SEC=[];actions={liq:{},sec:{}};causesEdits={};aiCausesData={};src='';wkId='';
  
  // Clear Supabase too
  try {
    await supabaseQuery('PATCH', 'dashboard_data?id=eq.1', {
      data: {},
      updated_at: new Date().toISOString()
    });
  } catch(e) { console.error('Clear Supabase error:', e); }
  
  updateXLUI();refresh();toast('✓ Datos eliminados. Dashboard vacío.','ok');
}
function fdt(iso){if(!iso)return'';return new Date(iso).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
function saveLocal(){try{localStorage.setItem(KA,JSON.stringify(actions));localStorage.setItem(KC,JSON.stringify(causesEdits))}catch(e){}}

/* ════════════ EXCEL ════════════ */
function loadExcel(input){const f=input.files[0];if(!f)return;input.value='';const r=new FileReader();r.onload=e=>{try{parseWB(XLSX.read(e.target.result,{type:'binary'}),f.name)}catch(er){toast('Error: '+er.message,'err')}};r.readAsBinaryString(f)}
function parseWB(wb,fn){
  let lW=[],sW=[],warns=[];
  wb.SheetNames.forEach(n=>{
    const nl=n.toLowerCase();
    const isL=nl.includes('líquid')||nl.includes('liquid')||nl.includes('liq');
    const isS=nl.includes('seca')||nl.includes('sec');
    if(!isL&&!isS)return;
    const json=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:''});
    const meta=json[2]||[];const sem=String(meta[1]||'').trim();const rango=String(meta[3]||'').trim();
    if(!sem||isNaN(parseInt(sem))){warns.push(`"${n}": sin número en B3`);return}
    const hdr=(json[4]||[]).map(h=>String(h).toLowerCase().trim());
    const iC=hdr.findIndex(h=>h.includes('cliente')),iF=hdr.findIndex(h=>h.includes('campo')||h.includes('tipo'));
    const iO=hdr.findIndex(h=>h.includes('origen')),iD=hdr.findIndex(h=>h.includes('destino'));
    const iS=hdr.findIndex(h=>h.includes('solicit')),iCg=hdr.findIndex(h=>h.includes('cargad'));
    const iCausa=hdr.findIndex(h=>h.includes('causa'));
    if(iC<0||iS<0||iCg<0){warns.push(`"${n}": columnas no encontradas`);return}
    const rows=[];
    for(let ri=5;ri<json.length;ri++){
      const row=json[ri];if(!row||!row.length)continue;
      const cl=String(row[iC]||'').trim();
      if(!cl||cl.toUpperCase()==='TOTAL'||cl.toUpperCase()==='CLIENTE')continue;
      rows.push({
        c:cl,
        f:iF>=0?String(row[iF]||'').trim():'',
        o:iO>=0?String(row[iO]||'').trim():'',
        d:iD>=0?String(row[iD]||'').trim():'',
        sol:parseFloat(row[iS])||0,
        carg:parseFloat(row[iCg])||0,
        // Read causa: try header index first, then last non-empty cell in row
        causa:(()=>{
          if(iCausa>=0&&row[iCausa]!==undefined&&row[iCausa]!=='') return String(row[iCausa]).trim();
          // Fallback: scan from end of row for text content beyond % cumplimiento
          for(let ci=row.length-1;ci>iCg;ci--){
            const v=String(row[ci]||'').trim();
            if(v&&isNaN(parseFloat(v))&&v!=='0') return v;
          }
          return '';
        })()
      });
    }
    if(!rows.length)return;
    const wk={id:'S'+String(parseInt(sem)).padStart(2,'0'),label:'S'+String(parseInt(sem)).padStart(2,'0'),rango:rango||`Sem. ${sem}`,rows};
    wk.sol=rows.reduce((a,r)=>a+r.sol,0);wk.carg=rows.reduce((a,r)=>a+r.carg,0);
    // Skip weeks with no data at all
    if(wk.sol===0&&wk.carg===0)return;
    if(isL)lW.push(wk);else sW.push(wk);
  });
  const tot=lW.length+sW.length;
  if(!tot){toast('Sin hojas válidas. Nombres deben incluir "Carga Líquida" o "Carga Seca".','err');return}
  function merge(b,i){const m=[...b];i.forEach(w=>{const x=m.findIndex(a=>a.id===w.id);if(x>=0)m[x]=w;else m.push(w)});return m.sort((a,b)=>a.id.localeCompare(b.id))}
  if(lW.length)DATA_LIQ=merge(DATA_LIQ,lW);
  if(sW.length)DATA_SEC=merge(DATA_SEC,sW);
  const ids=WKS().map(w=>w.id);wkId=ids[ids.length-1];flt='all';
  src='live';saveMem(fn);updateXLUI();
  // Mostrar dashboard, ocultar pantalla vacía (igual que loadFromSupabase)
  const emptyEl = document.getElementById('opsEmpty');
  const shellEl = document.getElementById('opsShell');
  if (emptyEl) emptyEl.style.display = 'none';
  if (shellEl) shellEl.style.display = '';
  refresh();saveToSupabase();
  // Auto-build causes from Excel causa column
  buildCausesFromExcel();
  toast(`✓ ${tot} semana(s) cargada(s) desde "${fn}".${warns.length?'\n'+warns.join(', '):''}`,warns.length?'err':'ok');
  // Actualizar stats del portal
  if(typeof window.updatePortalStats === 'function'){
    setTimeout(function(){ window.updatePortalStats(); }, 100);
  }
  // Auto-generate AI analysis after Excel load
  if(getApiKey()){
    setTimeout(()=>generateAiAnalysis(true),500);
  }
}

function updateXLUI(){
  const z=document.getElementById('xlZone'),t=document.getElementById('xlTxt'),h=document.getElementById('xlHint'),clr=document.getElementById('xlClr');
  const meta=JSON.parse(localStorage.getItem(K3)||'{}');const fn=meta.fn||'';const dt=fdt(meta.at);
  if(src==='demo'){z.className='xl-zone';t.textContent='Cargar Excel';h.textContent='Arrastra o haz clic';clr.style.display='none'}
  else{z.className='xl-zone on';t.textContent=fn.length>22?fn.slice(0,22)+'…':fn;h.textContent=(src==='live'?'Cargado':'Memoria')+' · '+dt;clr.style.display='block'}
  document.getElementById('footDate').textContent=dt?'Última carga: '+dt:new Date().toLocaleDateString('es-CO',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toUpperCase();
}

/* ════════════ CARGO ════════════ */
function setCargo(m){
  cargo=m;
  document.getElementById('tabLiq').className='ct'+(m==='liq'?' liq':'');
  document.getElementById('tabSec').className='ct'+(m==='sec'?' sec':'');
  if(!WKS().find(w=>w.id===wkId)){const ids=WKS().map(w=>w.id);wkId=ids.length?ids[ids.length-1]:'S16'}
  flt='all';refresh();
}

/* ════════════ TABS ════════════ */
function showTab(id){
  document.querySelectorAll('.tc').forEach(el=>el.classList.remove('show'));
  document.querySelectorAll('.tb').forEach(el=>{el.classList.remove('on','sec')});
  const tc=document.getElementById('tc-'+id);
  if(tc)tc.classList.add('show');
  const btn=document.getElementById('tab-'+id);
  if(btn){btn.classList.add('on');if(isSec()&&id!=='pre')btn.classList.add('sec');}
  // Sync sidebar
  document.querySelectorAll('.sb-item[id^="sb-"]').forEach(el=>el.classList.remove('active'));
  const sbEl=document.getElementById('sb-'+id);
  if(sbEl)sbEl.classList.add('active');
  if(id==='pre')renderPresident();
}

/* ════════════ HELPERS ════════════ */
function ws(w){const sol=w.sol||w.rows.reduce((a,r)=>a+r.sol,0),carg=w.carg||w.rows.reduce((a,r)=>a+r.carg,0);return{sol,carg,pct:sol>0?Math.round(carg/sol*100*10)/10:0,deficit:sol-carg}}
function rp(r){return r.sol>0?Math.round(r.carg/r.sol*100):0}
function rst(r){if(r.sol===0)return'none';const p=rp(r);return p===100?'ok':p>=70?'warn':'bad'}
function pc(p){return p===100?'var(--green)':p>=70?'var(--amber)':'var(--danger)'}

/* CHART THEME — high contrast axes */
/* ════════════ BANNER ════════════ */
function updateBanner(){
  const w=AWK();if(!w)return;
  const s=ws(w),banner=document.getElementById('alertBanner'),txt=document.getElementById('bannerTxt');
  const cLabel=isSec()?'CARGA SECA':'CARGA LÍQUIDA';
  if(s.pct>=META){banner.className='alert-banner banner-ok';txt.textContent=`OPERACIÓN NORMAL · ${cLabel} ${w.label} — Cumplimiento ${s.pct}% · Meta ${META}% superada`}
  else if(s.pct>=80){banner.className='alert-banner banner-warn';txt.textContent=`ALERTA · ${cLabel} ${w.label} — Cumplimiento ${s.pct}% · Por debajo de meta ${META}%`}
  else{banner.className='alert-banner banner-crit';txt.textContent=`CRÍTICO · ${cLabel} ${w.label} — Cumplimiento ${s.pct}% · Déficit de ${s.deficit} viajes`}
  document.getElementById('bannerDate').textContent=new Date().toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
}

/* ════════════ NAV ════════════ */
function renderNav(){
  document.getElementById('weekNav').innerHTML=WKS().map(w=>`<button class="wk${w.id===wkId?(isSec()?' on sec':' on'):''}" onclick="selWk('${w.id}')">${w.label}</button>`).join('');
  const w=AWK();if(w){document.getElementById('wkBadge').textContent=`${w.label} · ${w.rango}`;document.getElementById('wkBadge').className='wk-badge'+(isSec()?' sec':'');}}

/* ════════════ KPIs — ORDER: Sol → Carg → Balance → Cumpl → Rutas ════════════ */
function renderKPIs(){
  const wks=WKS(),cur=AWK();if(!cur)return;
  const idx=wks.indexOf(cur),prev=idx>0?wks[idx-1]:null;
  const s=ws(cur),sp=prev?ws(prev):null;
  function dl(c,p,up=true){
    if(p==null)return`<span class="d-eq">—</span>`;
    const d=Math.round((c-p)*10)/10,cls=d===0?'d-eq':((up?d>0:d<0)?'d-up':'d-dn');
    return`<span class="${cls}">${d===0?'Sin cambio':d>0?`▲ +${d}`:`▼ ${d}`} vs ${prev.label}</span>`;
  }
  function dlp(c,p){
    if(p==null)return`<span class="d-eq">—</span>`;
    const d=Math.round((c-p)*10)/10;
    return`<span class="${d===0?'d-eq':d>0?'d-up':'d-dn'}">${d===0?'Sin cambio':d>0?`▲ +${d}pp`:`▼ ${d}pp`} vs ${prev.label}</span>`;
  }
  const bw=s.sol>0?Math.round(s.carg/s.sol*100):0;
  const dc=s.deficit===0?'var(--green)':'var(--danger)';
  const pp=s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)';
  const active=cur.rows.filter(r=>r.sol>0);
  const r100=active.filter(r=>rp(r)===100).length;
  const rCrit=active.filter(r=>rp(r)<70).length;

  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi k1 fade"><div class="kpi-lbl">Viajes solicitados</div>
      <div class="kpi-val" style="color:var(--blue)">${s.sol}</div>
      <div class="kpi-delta">${dl(s.sol,sp?.sol)}</div>
      <div class="kpi-sub">Nominación ${cur.label} · ${cur.rango}</div>
      <div class="kpi-bar"><div class="kpi-bg"><div class="kpi-fill" style="width:100%;background:var(--blue)"></div></div></div>
    </div>
    <div class="kpi k2 fade" style="animation-delay:.05s"><div class="kpi-lbl">Viajes cargados</div>
      <div class="kpi-val" style="color:var(--green)">${s.carg}</div>
      <div class="kpi-delta">${dl(s.carg,sp?.carg)}</div>
      <div class="kpi-sub">${bw}% de la nominación</div>
      <div class="kpi-bar"><div class="kpi-bg"><div class="kpi-fill" style="width:${bw}%;background:var(--green)"></div></div></div>
    </div>
    <div class="kpi k3 fade" style="animation-delay:.10s"><div class="kpi-lbl">Balance faltantes</div>
      <div class="kpi-val" style="color:${dc}">${s.deficit>0?'−':''}${s.deficit}</div>
      <div class="kpi-delta">${dl(-s.deficit,sp!=null?-sp.deficit:null,false)}</div>
      <div class="kpi-sub">${s.deficit===0?'Sin déficit esta semana':'Viajes no atendidos'}</div>
    </div>
    <div class="kpi k4 fade" style="animation-delay:.15s"><div class="kpi-lbl">% Cumplimiento ${cur.label}</div>
      <div class="kpi-val" style="color:${pp}">${s.pct}%</div>
      <div class="kpi-delta">${dlp(s.pct,sp?.pct)}</div>
      <div class="kpi-sub">Meta: ${META}%</div>
      <div class="kpi-bar"><div class="kpi-bg"><div class="kpi-fill" style="width:${s.pct}%;background:${pp}"></div></div></div>
    </div>
    <div class="kpi k5 fade" style="animation-delay:.20s"><div class="kpi-lbl">Rutas críticas / totales</div>
      <div class="kpi-val" style="color:${rCrit>0?'var(--danger)':'var(--green)'}">${rCrit}<span style="font-size:18px;color:var(--w4)"> / ${active.length}</span></div>
      <div class="kpi-delta"><span class="${r100>0?'d-up':'d-eq'}">${r100} ruta(s) al 100%</span></div>
      <div class="kpi-sub">${rCrit>0?rCrit+' ruta(s) por debajo del 70%':'Operación dentro de rangos'}</div>
    </div>`;
}

/* ════════════ SEMÁFORO ════════════ */
function renderGauge(){
  const w=AWK();if(!w)return;
  const byC={};
  w.rows.forEach(r=>{if(!byC[r.c])byC[r.c]={sol:0,carg:0};byC[r.c].sol+=r.sol;byC[r.c].carg+=r.carg});
  const sorted=Object.entries(byC).filter(([,v])=>v.sol>0).sort((a,b)=>b[1].sol-a[1].sol);
  document.getElementById('clienteGauge').innerHTML=sorted.map(([c,v])=>{
    const p=Math.round(v.carg/v.sol*100),col=pc(p);
    return`<div class="bh-row">
      <div class="bh-lbl" title="${c}">${c.length>12?c.slice(0,12)+'…':c}</div>
      <div class="bh-track"><div class="bh-fill" style="width:${p}%;background:${col}"></div></div>
      <span style="font-size:11px;font-weight:600;color:${col};min-width:36px;text-align:right">${p}%</span>
    </div>`;
  }).join('');
}

/* ════════════ ALERTS ════════════ */
function renderAlerts(){
  const w=AWK();if(!w)return;const alerts=[];
  const crits=w.rows.filter(r=>r.sol>0&&rp(r)===0);
  crits.forEach(r=>alerts.push({t:'crit',title:`${r.c} — ${r.f}`,body:`${r.sol} viaje(s) nominados, 0 ejecutados. Ruta ${r.o} → ${r.d}. Acción inmediata requerida.`}));
  const partials=w.rows.filter(r=>r.sol>0&&rp(r)>0&&rp(r)<70);
  partials.forEach(r=>alerts.push({t:'warn',title:`${r.c} — ${r.f} (${rp(r)}%)`,body:`${r.sol-r.carg} viaje(s) faltante(s). Ruta ${r.o} → ${r.d}.`}));
  const byC={};w.rows.forEach(r=>{if(!byC[r.c])byC[r.c]={sol:0,carg:0};byC[r.c].sol+=r.sol;byC[r.c].carg+=r.carg});
  const ok100=Object.entries(byC).filter(([,v])=>v.sol>0&&v.carg===v.sol).map(([c])=>c);
  if(ok100.length)alerts.push({t:'ok',title:`${ok100.length} cliente(s) al 100%`,body:ok100.join(', ')+'. Operación completa sin novedades.'});
  const noMov=w.rows.filter(r=>r.sol===0).map(r=>r.c).filter((v,i,a)=>a.indexOf(v)===i);
  if(noMov.length)alerts.push({t:'info',title:`${noMov.length} cliente(s) sin movimiento`,body:noMov.slice(0,4).join(', ')+(noMov.length>4?` y ${noMov.length-4} más`:'')+'. Sin nominaciones esta semana.'});
  const map={crit:['ac-crit','var(--danger)'],warn:['ac-warn','var(--amber)'],ok:['ac-ok','var(--green)'],info:['ac-info','var(--blue)']};
  document.getElementById('alertsGrid').innerHTML=alerts.slice(0,6).map(a=>{const[cls,col]=map[a.t];return`<div class="ac ${cls}"><div class="ac-dot" style="background:${col}"></div><div class="ac-title">${a.title}</div><div class="ac-body">${a.body}</div></div>`}).join('');
}

/* ════════════ ANALYSIS SUMMARY (Resumen Ejecutivo) ════════════ */
function renderResAnalysis(){
  // If AI has generated content, don't overwrite
  const ck=getCacheKey();
  if(aiCache&&aiCache[ck]&&aiCache[ck].resumen){
    const r=aiCache[ck].resumen;
    const g=document.getElementById('resAnalysisGrid');
    if(g)g.innerHTML=`<div class="ab-item"><div class="ab-item-title">Estado general</div><div class="ab-item-body">${r.estado_general||''}</div></div><div class="ab-item"><div class="ab-item-title">Tendencia vs período</div><div class="ab-item-body">${r.tendencia||''}</div></div><div class="ab-item"><div class="ab-item-title">Atención prioritaria</div><div class="ab-item-body">${r.atencion_prioritaria||''}</div></div>`;
    return;
  }
  const wks=WKS(),cur=AWK();if(!cur)return;
  const s=ws(cur),idx=wks.indexOf(cur),prev=idx>0?wks[idx-1]:null,sp=prev?ws(prev):null;
  const active=cur.rows.filter(r=>r.sol>0);
  const crits=active.filter(r=>rp(r)===0);
  const ok100=active.filter(r=>rp(r)===100);
  const pcts=wks.map(w=>ws(w).pct);
  const avg=Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length*10)/10;
  const trend=sp?Math.round((s.pct-sp.pct)*10)/10:null;
  const trendTxt=trend===null?'Primera semana del período':trend>0?`Mejoró ${trend}pp vs semana anterior`:trend<0?`Retrocedió ${Math.abs(trend)}pp vs semana anterior`:'Sin cambio vs semana anterior';
  const sec=isSec();

  const items=[
    {title:'Estado general',body:`El cumplimiento de ${cur.label} fue del <strong>${s.pct}%</strong> sobre ${s.sol} viajes nominados. Se cargaron ${s.carg} viajes, quedando un déficit de <strong>${s.deficit}</strong> ${s.deficit===1?'viaje':'viajes'} sin atender. ${s.pct>=META?'La meta del '+META+'% fue superada.':'La meta del '+META+'% no fue alcanzada.'}`},
    {title:'Tendencia vs período',body:`${trendTxt}. El promedio del período S${wks[0].label.replace('S','')}–${cur.label} es de <strong>${avg}%</strong>. La semana actual está <strong>${s.pct>=avg?'+':''}${Math.round((s.pct-avg)*10)/10}pp ${s.pct>=avg?'por encima':'por debajo'}</strong> del promedio.`},
    {title:'Atención prioritaria',body:crits.length>0?`<strong>${crits.length} ruta(s) con 0%</strong>: ${crits.map(r=>r.c+' / '+r.f).join(', ')}. Requieren gestión inmediata antes de S${parseInt(wkId.replace('S',''))+1}.`:`Sin rutas en 0% esta semana. <strong>${ok100.length} ruta(s)</strong> cerraron al 100%. ${s.deficit===0?'Operación sin déficit.':'El déficit es gestionable.'}`},
  ];

  document.getElementById('resAnalysisGrid').innerHTML=items.map(i=>`<div class="ab-item"><div class="ab-item-title">${i.title}</div><div class="ab-item-body">${i.body}</div></div>`).join('');
  const block=document.getElementById('resAnalysis');
  block.className=`analysis-block fade${sec?' sec-ab':''}`;
  const title=block.querySelector('.ab-title');
  title.className=`ab-title${sec?' sec-abt':''}`;
}

/* ════════════ CHARTS ════════════ */
function dC(k){if(CH[k]){CH[k].destroy();delete CH[k]}}

function buildTrend(){
  dC('t');
  const wks=WKS(),labels=wks.map(w=>w.label),pcts=wks.map(w=>ws(w).pct);
  let proj=wks.map(()=>null);
  if(wks.length>=2){const l=pcts[pcts.length-1],p2=pcts[pcts.length-2];proj=[...wks.map(()=>null),Math.max(0,Math.round((l+(l-p2))*10)/10)]}
  const nxt='S'+String(parseInt(wks[wks.length-1].id.replace('S',''))+1).toString().padStart(2,'0')+'*';
  CH['t']=new Chart(document.getElementById('cTrend'),{type:'line',data:{labels:[...labels,nxt],datasets:[
    {data:[...pcts,null],borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,.1)',fill:true,tension:.4,pointRadius:5,pointBackgroundColor:pcts.map(p=>p>=META?'#00d97e':p>=80?'#f59e0b':'#ef4444'),borderWidth:2.5,pointHoverRadius:8,pointBorderColor:'#131b2a',pointBorderWidth:2},
    {data:[...wks.map(()=>META),META],borderColor:'rgba(239,68,68,.7)',borderDash:[6,4],borderWidth:2,pointRadius:0,fill:false},
    {data:proj,borderColor:'rgba(245,158,11,.6)',borderDash:[3,3],borderWidth:1.5,pointRadius:[...wks.map(()=>0),6],pointBackgroundColor:'#f59e0b',fill:false},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:i=>`${i.raw!=null?i.raw+'%':'—'}`}}},
    scales:{...chartScales(false,Math.max(0,Math.min(...pcts)-15)),y:{...chartScales().y,max:110,ticks:{...chartScales().y.ticks,callback:v=>v+'%'}}}}});
}

function buildVol(){
  dC('v');
  const wks=WKS();
  CH['v']=new Chart(document.getElementById('cVol'),{type:'bar',data:{labels:wks.map(w=>w.label),datasets:[
    {data:wks.map(w=>ws(w).sol),backgroundColor:'rgba(74,158,255,.45)',borderColor:'#4a9eff',borderWidth:1.5,borderRadius:5,order:2,label:'Solicitados'},
    {data:wks.map(w=>ws(w).carg),backgroundColor:'rgba(0,217,126,.4)',borderColor:'#00d97e',borderWidth:1.5,borderRadius:5,order:2,label:'Cargados'},
    {data:wks.map(w=>ws(w).deficit),type:'line',borderColor:'#ff5252',backgroundColor:'rgba(255,82,82,.07)',fill:false,tension:.4,pointRadius:5,borderWidth:2.5,order:1,label:'Déficit',pointBackgroundColor:'#ff5252',pointBorderColor:'#131b2a',pointBorderWidth:2},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip}},scales:chartScales(true)}});
}

function buildDist(){
  dC('d');
  const active=AWK()?.rows.filter(r=>r.sol>0)||[];
  const ok=active.filter(r=>rp(r)===100).length,warn=active.filter(r=>rp(r)>=70&&rp(r)<100).length,bad=active.filter(r=>rp(r)<70).length,none=AWK()?.rows.filter(r=>r.sol===0).length||0;
  CH['d']=new Chart(document.getElementById('cDist'),{type:'doughnut',data:{labels:['100%','≥70%','<70%','Sin mov.'],datasets:[{data:[ok,warn,bad,none],backgroundColor:['rgba(0,217,126,.75)','rgba(245,158,11,.7)','rgba(239,68,68,.8)','rgba(255,255,255,.1)'],borderColor:['#00d97e','#f59e0b','#ef4444','rgba(255,255,255,.2)'],borderWidth:2,hoverOffset:8}]},
  options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{position:'bottom',labels:{color:AX,font:{size:11},padding:12}},tooltip:{...tip,callbacks:{label:i=>`${i.label}: ${i.raw} rutas`}}}}});
}

function buildCliente(){
  dC('c');
  const w=AWK();if(!w)return;
  const activeRows=w.rows.filter(r=>r.sol>0);
  if(!activeRows.length)return;

  // Group by client, preserve route detail
  const byClient={};
  activeRows.forEach(r=>{
    if(!byClient[r.c]) byClient[r.c]=[];
    byClient[r.c].push(r);
  });

  const labels=[], data=[], bgColors=[], bdColors=[];

  Object.entries(byClient).forEach(([cli,routes])=>{
    routes.forEach(r=>{
      const hasMultiDest=routes.filter(rx=>rx.f===r.f).length>1;
      const destPart=hasMultiDest&&r.d?` → ${r.d}`:'';
      const lbl=`${cli} · ${r.f}${destPart}`;
      labels.push(lbl.length>55?lbl.slice(0,53)+'…':lbl);
      const p=rp(r);
      data.push(p);
      // Rich gradient-style colors by performance
      if(p===100){
        bgColors.push('rgba(0,210,110,.55)');
        bdColors.push('#00d97e');
      } else if(p>=90){
        bgColors.push('rgba(0,180,90,.42)');
        bdColors.push('#00c870');
      } else if(p>=70){
        bgColors.push('rgba(245,158,11,.55)');
        bdColors.push('#f59e0b');
      } else if(p>0){
        bgColors.push('rgba(239,68,68,.55)');
        bdColors.push('#ef4444');
      } else {
        bgColors.push('rgba(239,68,68,.25)');
        bdColors.push('rgba(239,68,68,.5)');
      }
    });
  });

  const h=Math.max(200, labels.length*36+60);
  document.getElementById('cClienteWrap').style.height=h+'px';

  CH['c']=new Chart(document.getElementById('cCliente'),{
    type:'bar',
    data:{
      labels,
      datasets:[
        {
          data,
          backgroundColor:bgColors,
          borderColor:bdColors,
          borderWidth:2,
          borderRadius:5,
          barThickness:18,
        },
        {
          data:labels.map(()=>100),
          backgroundColor:'transparent',
          borderColor:'rgba(255,255,255,.07)',
          borderWidth:1,
          borderRadius:5,
          barThickness:18,
        }
      ]
    },
    options:{
      indexAxis:'y',
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          ...tip,
          callbacks:{
            label:i=>{
              if(i.datasetIndex!==0) return '';
              const r=activeRows[i.dataIndex];
              return r?`${r.carg} de ${r.sol} viajes · ${i.raw}%`:`${i.raw}%`;
            }
          }
        }
      },
      scales:{
        x:{
          grid:{color:AX_GRID},
          ticks:{color:AX,font:{size:11},callback:v=>v+'%'},
          border:{color:AX},
          min:0,max:115
        },
        y:{
          grid:{color:'transparent'},
          ticks:{color:AX,font:{size:10}},
          border:{color:'transparent'}
        }
      }
    }
  });
}

function buildHisCharts(){
  dC('ht');dC('hd');
  const wks=WKS(),labels=wks.map(w=>w.label),pcts=wks.map(w=>ws(w).pct);
  CH['ht']=new Chart(document.getElementById('cHisTrend'),{type:'line',data:{labels,datasets:[
    {data:pcts,borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,.1)',fill:true,tension:.4,pointRadius:6,pointBackgroundColor:pcts.map(p=>p>=META?'#00d97e':p>=80?'#f59e0b':'#ef4444'),borderWidth:2.5,pointBorderColor:'#131b2a',pointBorderWidth:2},
    {data:wks.map(()=>META),borderColor:'rgba(239,68,68,.7)',borderDash:[6,4],borderWidth:2,pointRadius:0,fill:false},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:i=>`${i.raw}%`}}},
    scales:{...chartScales(false,0),x:{...chartScales().x},y:{...chartScales().y,max:110,ticks:{...chartScales().y.ticks,callback:v=>v+'%'}}}}});

  const deficits=wks.map(w=>ws(w).deficit);
  CH['hd']=new Chart(document.getElementById('cHisDef'),{type:'bar',data:{labels,datasets:[{
    data:deficits,
    backgroundColor:deficits.map(d=>d===0?'rgba(0,217,126,.55)':d<=5?'rgba(245,158,11,.65)':'rgba(239,68,68,.75)'),
    borderColor:deficits.map(d=>d===0?'#00d97e':d<=5?'#f59e0b':'#ef4444'),
    borderWidth:1.5,borderRadius:5,
  }]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:i=>`Déficit: ${i.raw} viajes`}}},scales:chartScales(true)}});
}

/* ════════════ RUTA CARDS ════════════ */
function renderRutaCards(){
  const w=AWK();if(!w)return;
  const s=ws(w),active=w.rows.filter(r=>r.sol>0);
  const crits=active.filter(r=>rp(r)===0);
  const ok100=active.filter(r=>rp(r)===100);

  // Build client aggregates (only clients with sol>0)
  const byC={};
  active.forEach(r=>{
    if(!byC[r.c]) byC[r.c]={sol:0,carg:0};
    byC[r.c].sol+=r.sol;
    byC[r.c].carg+=r.carg;
  });
  const clients=Object.entries(byC).filter(([,v])=>v.sol>0);

  // Best client: highest % — if tie, most viajes executed
  const bestClient=clients.length
    ? clients.sort((a,b)=>{
        const pa=a[1].carg/a[1].sol, pb=b[1].carg/b[1].sol;
        return pa!==pb ? pb-pa : b[1].carg-a[1].carg;
      })[0]
    : null;

  // All at 100%?
  const allPerfect=clients.length>0&&clients.every(([,v])=>v.carg>=v.sol);

  // Worst client: prioritize 0% (total non-compliance) first, then largest absolute deficit
  const clientsWithDeficit=clients.filter(([,v])=>v.carg<v.sol);
  let worstClient=null;
  if(clientsWithDeficit.length){
    // Separate: clients at 0% vs partial
    const zeroClients=clientsWithDeficit.filter(([,v])=>v.carg===0);
    if(zeroClients.length){
      // Among 0% clients → the one with most promised trips (biggest operational impact)
      worstClient=zeroClients.sort((a,b)=>b[1].sol-a[1].sol)[0];
    } else {
      // No 0% clients → the one with most absolute missing trips
      worstClient=clientsWithDeficit.sort((a,b)=>(b[1].sol-b[1].carg)-(a[1].sol-a[1].carg))[0];
    }
  }

  // Best client card content
  const bestPct=bestClient?Math.round(bestClient[1].carg/bestClient[1].sol*100):0;
  const bestDesc=bestClient
    ? (allPerfect&&clients.length>1
        ? `${bestClient[1].carg} viajes ejecutados · mayor volumen al 100%`
        : `${bestPct}% · ${bestClient[1].carg} de ${bestClient[1].sol} viajes`)
    : 'Sin datos.';

  // Worst client card content
  let worstHtml='';
  if(allPerfect){
    worstHtml=`
      <div class="rc" style="border-color:rgba(0,217,126,.4);background:rgba(0,217,126,.06)">
        <div class="rc-lbl">Estado de la semana</div>
        <div class="rc-num" style="color:var(--green);font-size:28px">🏆</div>
        <div class="rc-desc" style="color:var(--green)">Semana perfecta — todos los clientes al 100%.</div>
      </div>`;
  } else {
    const worstDef=worstClient?worstClient[1].sol-worstClient[1].carg:0;
    const worstPct=worstClient?Math.round(worstClient[1].carg/worstClient[1].sol*100):0;
    const worstIsZero=worstClient&&worstClient[1].carg===0;
    const worstDesc=worstClient
      ? worstIsZero
        ? `0% · ${worstClient[1].sol} viaje(s) prometidos sin ejecutar ninguno`
        : `${worstDef} viaje(s) sin cargar · ${worstPct}%`
      : 'Todos los clientes al 100%.';
    const worstColor=worstIsZero?'var(--danger)':'var(--amber)';
    worstHtml=`
      <div class="rc">
        <div class="rc-lbl">Mayor déficit${worstIsZero?' 🔴':' ⚠️'}</div>
        <div class="rc-num" style="color:${worstColor};font-size:24px">${worstClient?worstClient[0]:'—'}</div>
        <div class="rc-desc" style="color:${worstIsZero?'var(--danger)':'inherit'}">${worstDesc}</div>
      </div>`;
  }

  document.getElementById('rutaCards').innerHTML=`
    <div class="rc">
      <div class="rc-lbl">Rutas al 100%</div>
      <div class="rc-num" style="color:var(--green)">${ok100.length}</div>
      <div class="rc-desc">de ${active.length} rutas activas. ${ok100.length===active.length?'Todas las rutas cumplieron.':'Las demás requieren seguimiento.'}</div>
    </div>
    <div class="rc">
      <div class="rc-lbl">Rutas críticas (0%)</div>
      <div class="rc-num" style="color:${crits.length>0?'var(--danger)':'var(--green)'}">${crits.length}</div>
      <div class="rc-desc">${crits.length>0?crits.map(r=>r.c+' / '+r.f).join(', '):'Sin rutas en 0% esta semana.'}</div>
    </div>
    <div class="rc">
      <div class="rc-lbl">Mayor cumplimiento</div>
      <div class="rc-num" style="color:var(--green);font-size:24px">${bestClient?bestClient[0]:'—'}</div>
      <div class="rc-desc">${bestDesc}</div>
    </div>
    ${worstHtml}`
}

/* ════════════ TABLE ════════════ */
function renderTable(){
  const w=AWK();if(!w)return;
  const rows=flt==='all'?w.rows:w.rows.filter(r=>rst(r)===flt);
  const s=ws(w),sec=isSec();
  document.getElementById('tblTitle').textContent=sec?'Registro semanal · Tipo de operación':'Registro semanal · Por campo / ruta';
  document.getElementById('filRow').innerHTML=['all','ok','warn','bad','none'].map(f=>{
    const lbl={all:'Todos',ok:'100%',warn:'Parcial',bad:'Crítico',none:'Sin mov.'};
    return`<button class="fil${flt===f?' on'+(sec?' sf':''):''}" onclick="setFlt('${f}')">${lbl[f]}</button>`;
  }).join('');
  document.getElementById('tHead').innerHTML=sec
    ?`<tr><th>Cliente</th><th>Tipo operación</th><th class="c">Sol.</th><th class="c">Carg.</th><th class="c">Balance</th><th style="min-width:130px">Cumplimiento</th><th>Estado</th></tr>`
    :`<tr><th>Cliente</th><th>Campo</th><th>Ruta</th><th class="c">Sol.</th><th class="c">Carg.</th><th class="c">Balance</th><th style="min-width:130px">Cumplimiento</th><th>Estado</th></tr>`;
  const pBar=r=>{
    if(!r.sol)return'<span style="color:var(--w4);font-size:11px">—</span>';
    const p=rp(r),col=pc(p);
    return`<div class="pbar"><div class="pbar-bg"><div class="pbar-fill" style="width:${p}%;background:${col}"></div></div><span class="pbar-txt" style="color:${col}">${p}%</span></div>`;
  };
  const chip=r=>{
    if(r.nuevo)return`<span class="badge b-new">★ Nuevo</span>`;
    const m={ok:['b-ok','100%'],warn:['b-warn','Parcial'],bad:['b-crit','Crítico'],none:['b-none','Sin mov.']};
    const[cl,lb]=m[rst(r)];return`<span class="badge ${cl}">${lb}</span>`;
  };
  const bal=r=>{const d=r.sol-r.carg;return`<span style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;color:${d>0?'var(--danger)':d===0?'var(--green)':'var(--green)'}">${d>0?'−':''}${d}</span>`};
  // Mobile cards
  const mobEl=document.getElementById('mobCards');
  if(mobEl) mobEl.innerHTML=renderMobileCards(w);
  
  document.getElementById('tBody').innerHTML=
    rows.map(r=>`<tr${rst(r)==='bad'&&r.sol>0?' class="crit-row"':''}>
      <td class="bold">${r.c}${r.nuevo?'<span class="badge b-new" style="margin-left:6px;font-size:8px;vertical-align:middle">★</span>':''}</td>
      <td style="color:var(--w3)">${r.f}</td>
      ${!sec?`<td style="color:var(--w4);font-size:12px">${r.o||''} → ${r.d||''}</td>`:''}
      <td class="c">${r.sol}</td><td class="c">${r.carg}</td>
      <td class="c">${bal(r)}</td>
      <td>${pBar(r)}</td>
      <td>${chip(r)}</td>
    </tr>`).join('')+
    (flt==='all'?`<tr class="tot-row${sec?' sec':''}"><td colspan="${sec?2:3}">TOTAL · ${w.label} · ${w.rango}</td><td class="c">${s.sol}</td><td class="c">${s.carg}</td><td class="c" style="color:${s.deficit>0?'var(--danger)':'var(--green)'};font-family:'Oswald',sans-serif;font-weight:600">${s.deficit>0?'−':''}${s.deficit}</td><td>${pBar({sol:s.sol,carg:s.carg})}</td><td></td></tr>`:'');
}

/* ════════════ CAUSAS — editable ════════════ */
function getCausesForWk(){
  const key=`${cargo}_${wkId}`;
  const def=(CAUSES_DEF[cargo]||{})[wkId]||[];
  const edits=causesEdits[key]||{};
  return def.map((c,i)=>({...c,body:edits[i]!==undefined?edits[i]:c.body,idx:i}));
}
function saveCauseEdit(idx,val){
  const key=`${cargo}_${wkId}`;
  if(!causesEdits[key])causesEdits[key]={};
  causesEdits[key][idx]=val;
  saveLocal();
}
function toggleCauseEdit(idx){
  const ta=document.getElementById(`cta_${idx}`);
  const btn=document.getElementById(`ceb_${idx}`);
  const body=document.getElementById(`cb_${idx}`);
  if(ta.style.display==='none'||ta.style.display===''){
    ta.style.display='block';body.style.display='none';btn.textContent='✓ Guardar';
  } else {
    saveCauseEdit(idx,ta.value);body.textContent=ta.value;body.style.display='block';ta.style.display='none';btn.textContent='✎ Editar texto';
    toast('Causa actualizada y guardada.','ok');
  }
}

function renderCausas(){
  // Check all-weeks cache first
  const allWkCacheKey=`inlop_allcauses_${cargo}_v12_${wkId}`;
  if(aiCache&&aiCache[allWkCacheKey]&&aiCache[allWkCacheKey].causas){
    aiCausesData[`${cargo}_${wkId}`]=aiCache[allWkCacheKey].causas;
  }
  // Check if AI causes exist for this week
  const aiKey2=`${cargo}_${wkId}`;
  if(aiCausesData&&aiCausesData[aiKey2]){
    renderCausasFromAi(aiCausesData[aiKey2]);
    return;
  }
  const causes=getCausesForWk();
  if(!causes||!causes.length){
    document.getElementById('causasContent').innerHTML=`<div style="padding:60px;text-align:center;color:var(--w4)"><div style="font-size:36px;opacity:.4;margin-bottom:12px">📋</div><div style="font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--w3)">Sin análisis registrado para ${wkId}</div></div>`;
    return;
  }
  const w=AWK(),s=ws(w),sec=isSec();
  // Context — ORDER: Sol → Carg → Balance → Cumpl
  let html=`<div class="card cp" style="margin-bottom:16px">
    <div class="card-ttl">Contexto operativo — ${wkId} · ${w?.rango||''}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:4px">
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--blue)">${s.sol}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Solicitados</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--green)">${s.carg}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Cargados</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:${s.deficit>0?'var(--danger)':'var(--green)'}">−${s.deficit}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Balance</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:${s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)'}">${s.pct}%</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Cumplimiento</div></div>
    </div>
  </div>`;

  causes.forEach((c,i)=>{
    const map={crit:['ci-r','var(--danger)'],warn:['ci-y','var(--amber)'],ok:['ci-g','var(--green)']};
    const[ci,col]=map[c.type]||map['warn'];
    html+=`<div class="cause-card">
      <div class="cause-hdr">
        <div class="cause-icon ${ci}">${c.icon}</div>
        <div style="flex:1">
          <div class="cause-title">${c.title}</div>
          <div class="cause-sub" style="color:${col}">${c.sub}</div>
        </div>
      </div>
      <div class="cause-body" id="cb_${i}">${c.body}</div>
      <textarea class="cause-textarea" id="cta_${i}" style="display:none">${c.body}</textarea>
      <button class="cause-edit-btn" id="ceb_${i}" onclick="toggleCauseEdit(${i})">✎ Editar texto</button>
    </div>`;
  });
  document.getElementById('causasContent').innerHTML=html;
}

/* ════════════ ACCIONES ════════════ */
function getActions(){
  // Check all-weeks AI cache
  const allWkCacheKey=`inlop_allcauses_${cargo}_v12_${wkId}`;
  if(!actions[cargo])actions[cargo]={};
  if((!actions[cargo][wkId]||!actions[cargo][wkId].length)&&aiCache&&aiCache[allWkCacheKey]&&aiCache[allWkCacheKey].acciones){
    actions[cargo][wkId]=aiCache[allWkCacheKey].acciones;
  }
  if(!actions[cargo][wkId])actions[cargo][wkId]=[];
  return actions[cargo][wkId];
}
function renderActions(){
  const acts=getActions();
  const stMap={urgente:['as-urg','Urgente'],ejecucion:['as-exec','En ejecución'],ejecutado:['as-done','Ejecutado'],pendiente:['as-pend','Pendiente']};
  document.getElementById('actionsContainer').innerHTML=acts.length===0
    ?`<div style="padding:40px;text-align:center;color:var(--w4)"><div style="font-size:32px;opacity:.4;margin-bottom:10px">✅</div>Sin acciones registradas para esta semana.</div>`
    :acts.map((a,i)=>{const[cls,lbl]=stMap[a.status]||stMap['pendiente'];return`<div class="action-row"><div class="action-txt">${a.txt}</div><div class="action-resp">${a.resp}</div><div class="action-date">${a.date}</div><div class="action-status-cell"><span class="as ${cls}">${lbl}</span></div><button class="edit-btn" onclick="editAction(${i})" title="Editar">✎</button></div>`}).join('');
}
function editAction(i){const acts=getActions();editingAction={idx:i};const a=acts[i];document.getElementById('mTxt').value=a.txt;document.getElementById('mResp').value=a.resp;document.getElementById('mDate').value=a.date;document.getElementById('mStatus').value=a.status;document.getElementById('modalBg').classList.add('show')}
function addAction(){editingAction={idx:-1};document.getElementById('mTxt').value='';document.getElementById('mResp').value='';document.getElementById('mDate').value='';document.getElementById('mStatus').value='pendiente';document.getElementById('modalBg').classList.add('show')}
function closeModal(){document.getElementById('modalBg').classList.remove('show');editingAction=null}
function saveAction(){if(!editingAction)return;const acts=getActions();const d={id:Date.now(),txt:document.getElementById('mTxt').value,resp:document.getElementById('mResp').value,date:document.getElementById('mDate').value,status:document.getElementById('mStatus').value};if(editingAction.idx>=0)acts[editingAction.idx]=d;else acts.push(d);saveLocal();closeModal();renderActions();toast('Acción guardada.','ok')}

/* ════════════ HISTÓRICO TABLE ════════════ */
function renderHisTable(){
  const wks=WKS();
  document.getElementById('hisHead').innerHTML=`<tr><th>Semana</th><th>Rango</th><th class="c">Sol.</th><th class="c">Carg.</th><th class="c">Déficit</th><th style="min-width:140px">Cumplimiento</th><th>vs S. Anterior</th><th>vs Meta 95%</th></tr>`;
  // Mobile history cards
  const mhc=document.getElementById('mobHisCards');
  if(mhc) mhc.innerHTML=wks.map((w,i)=>{
    const s=ws(w),prev=i>0?ws(wks[i-1]):null;
    const delta=prev?Math.round((s.pct-prev.pct)*10)/10:null;
    const col=s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)';
    const active=w.id===wkId;
    return `<div class="mob-card${active?' mob-ok':''}" style="${active?'border-color:rgba(74,158,255,.4);background:rgba(74,158,255,.05)':''}">
      <div class="mob-card-header">
        <div class="mob-card-title">${w.label}</div>
        <div style="font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:${col}">${s.pct}%</div>
      </div>
      <div style="font-size:10px;color:var(--w4);margin-bottom:8px">${w.rango}</div>
      <div class="mob-card-row"><span class="mob-card-lbl">Solicitados</span><span class="mob-card-val">${s.sol}</span></div>
      <div class="mob-card-row"><span class="mob-card-lbl">Cargados</span><span class="mob-card-val" style="color:var(--green)">${s.carg}</span></div>
      <div class="mob-card-row"><span class="mob-card-lbl">Déficit</span><span class="mob-card-val" style="color:${s.deficit>0?'var(--danger)':'var(--green)'}">${s.deficit>0?'−':''}${s.deficit}</span></div>
      ${delta!==null?`<div class="mob-card-row"><span class="mob-card-lbl">vs anterior</span><span class="mob-card-val" style="color:${delta>=0?'var(--green)':'var(--danger)'}">
        ${delta>=0?'▲ +'+delta+'pp':'▼ '+delta+'pp'}</span></div>`:''}
      <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:8px;overflow:hidden">
        <div style="height:100%;width:${s.pct}%;background:${col};border-radius:2px"></div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('hisBody').innerHTML=wks.map((w,i)=>{
    const s=ws(w),prev=i>0?ws(wks[i-1]):null;
    const delta=prev?Math.round((s.pct-prev.pct)*10)/10:null;
    const col=s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)';
    const metaDiff=Math.round((s.pct-META)*10)/10;
    const dStr=delta!=null?(delta>0?`<span class="d-up">▲ +${delta}pp</span>`:delta<0?`<span class="d-dn">▼ ${delta}pp</span>`:`<span class="d-eq">Sin cambio</span>`):`<span class="d-eq">—</span>`;
    return`<tr${w.id===wkId?' style="background:rgba(74,158,255,.06)"':''}>
      <td class="bold">${w.label}</td>
      <td style="color:var(--w3)">${w.rango}</td>
      <td class="c">${s.sol}</td><td class="c">${s.carg}</td>
      <td class="c" style="font-family:'Oswald',sans-serif;font-weight:600;color:${s.deficit>0?'var(--danger)':'var(--green)'}">${s.deficit>0?'−':''}${s.deficit}</td>
      <td><div class="pbar"><div class="pbar-bg"><div class="pbar-fill" style="width:${s.pct}%;background:${col}"></div></div><span class="pbar-txt" style="color:${col}">${s.pct}%</span></div></td>
      <td>${dStr}</td>
      <td>${metaDiff>=0?`<span class="d-up">+${metaDiff}pp</span>`:`<span class="d-dn">${metaDiff}pp</span>`}</td>
    </tr>`;
  }).join('');
}

/* ════════════ ANÁLISIS GERENCIAL HISTÓRICO ════════════ */
function renderHisAnalysis(){
  const ck=getCacheKey();
  if(aiCache&&aiCache[ck]&&aiCache[ck].historico){
    const r=aiCache[ck].historico;
    const g=document.getElementById('hisAnalysisGrid');
    if(g)g.innerHTML=`<div class="ha-item"><div class="ha-item-title">Balance del período</div><div class="ha-item-body">${r.balance_periodo||''}</div></div><div class="ha-item"><div class="ha-item-title">Semanas destacadas</div><div class="ha-item-body">${r.semanas_destacadas||''}</div></div><div class="ha-item"><div class="ha-item-title">Clientes a priorizar</div><div class="ha-item-body">${r.clientes_priorizar||''}</div></div>`;
    return;
  }
  const wks=WKS();if(!wks.length)return;
  const pcts=wks.map(w=>ws(w).pct);
  const defs=wks.map(w=>ws(w).deficit);
  const maxPct=Math.max(...pcts),minPct=Math.min(...pcts);
  const maxWk=wks[pcts.indexOf(maxPct)],minWk=wks[pcts.indexOf(minPct)];
  const avg=Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length*10)/10;
  const last=wks[wks.length-1],lastS=ws(last);
  const totalDef=defs.reduce((a,b)=>a+b,0);
  const weeksAboveMeta=wks.filter(w=>ws(w).pct>=META).length;
  const trend3=wks.length>=3?Math.round((pcts[pcts.length-1]-pcts[pcts.length-3])*10)/10:null;

  // Detect recurring issues
  const defByClient={};
  wks.forEach(w=>w.rows.forEach(r=>{if(r.sol>0&&r.carg<r.sol){if(!defByClient[r.c])defByClient[r.c]=0;defByClient[r.c]+=(r.sol-r.carg)}}));
  const topDef=Object.entries(defByClient).sort((a,b)=>b[1]-a[1]).slice(0,2);

  const items=[
    {title:'Balance del período S10→'+last.label,body:`En ${wks.length} semanas analizadas, el cumplimiento promedio fue de <span class="ha-highlight hh-b">${avg}%</span> sobre una meta de <span class="ha-highlight hh-r">${META}%</span>. Solo <span class="ha-highlight ${weeksAboveMeta>=wks.length/2?'hh-g':'hh-r'}">${weeksAboveMeta} de ${wks.length} semanas</span> superaron la meta. El déficit acumulado del período es de <span class="ha-highlight hh-r">${totalDef} viajes</span> sin cargar.`},
    {title:'Semanas destacadas',body:`La mejor semana fue <span class="ha-highlight hh-g">${maxWk.label} con ${maxPct}%</span>, y la más crítica fue <span class="ha-highlight hh-r">${minWk.label} con ${minPct}%</span>. La semana actual <span class="ha-highlight ${lastS.pct>=avg?'hh-g':'hh-y'}">${last.label} (${lastS.pct}%)</span> está <span class="ha-highlight ${lastS.pct>=avg?'hh-g':'hh-r'}">${lastS.pct>=avg?'+':''}${Math.round((lastS.pct-avg)*10)/10}pp ${lastS.pct>=avg?'por encima':'por debajo'}</span> del promedio del período.${trend3!==null?' La tendencia de las últimas 3 semanas es <span class="ha-highlight '+(trend3>=0?'hh-g':'hh-r')+'">'+(trend3>=0?'positiva ▲':'negativa ▼')+' '+Math.abs(trend3)+'pp</span>.':''}`},
    {title:'Clientes y rutas a priorizar',body:`Los clientes con mayor déficit acumulado son: ${topDef.map(([c,d])=>`<span class="ha-highlight hh-r">${c} (${d} viajes)</span>`).join(' y ')}. Estos requieren atención estructural, no solo correcciones semana a semana. La brecha recurrente en estas rutas sugiere un problema de <strong>capacidad de flota instalada</strong>, no de gestión operativa puntual.`},
  ];
  document.getElementById('hisAnalysisGrid').innerHTML=items.map(i=>`<div class="ha-item"><div class="ha-item-title">${i.title}</div><div class="ha-item-body">${i.body}</div></div>`).join('');
}

/* ════════════ MAIN ════════════ */
function setFlt(f){flt=f;renderTable()}
function selWk(id){wkId=id;refresh()}

function refresh(){
  // Guard: no renderizar si no hay datos cargados
  if(!WKS() || WKS().length === 0) return;
  renderNav();updateBanner();renderKPIs();renderGauge();renderAlerts();renderResAnalysis();
  buildTrend();buildVol();buildDist();buildCliente();
  renderRutaCards();renderTable();
  renderCausas();renderActions();
  buildHisCharts();renderHisTable();renderHisAnalysis();
  // Sync tab style
  document.querySelectorAll('.tb').forEach(el=>{el.classList.remove('sec');if(el.classList.contains('on')&&isSec())el.classList.add('sec')});
  if(typeof updateAiStatus==='function')updateAiStatus();
  renderPresident();
}


/* ════════════════════════════════════════════════════════
   AI ENGINE — Claude API integration
   Generates ALL analytical text from operational data
════════════════════════════════════════════════════════ */
const KAI='inlop_apikey_v11';
const KAI_CACHE='inlop_ai_cache_v11';
let aiKey='';
let aiCache={};
let aiLoading=false;

function getApiKey(){return localStorage.getItem(KAI)||''}
function setApiKey(k){localStorage.setItem(KAI,k);aiKey=k}

function loadAiCache(){try{const c=localStorage.getItem(KAI_CACHE);if(c)aiCache=JSON.parse(c)}catch(e){aiCache={}}}
function saveAiCache(){try{localStorage.setItem(KAI_CACHE,JSON.stringify(aiCache))}catch(e){}}

function getCacheKey(){return`${cargo}_${wkId}_${JSON.stringify(WKS().map(w=>({id:w.id,sol:w.sol||w.rows.reduce((a,r)=>a+r.sol,0),carg:w.carg||w.rows.reduce((a,r)=>a+r.carg,0)})))}`}

function buildAiPrompt(){
  const wks=WKS();
  const cur=AWK();
  const s=ws(cur);
  const prev=wks.indexOf(cur)>0?ws(wks[wks.indexOf(cur)-1]):null;
  const tipo=isSec()?'Carga Seca (transporte nacional, urbano y portuario)':'Carga Líquida (transporte de hidrocarburos)';
  const meta=META;

  // Build historical data
  const histRows=wks.map(w=>{const st=ws(w);return`${w.label} (${w.rango}): ${st.sol} sol / ${st.carg} carg / déficit ${st.deficit} / ${st.pct}%`}).join('\n');

  // Build current week detail
  const detRows=cur.rows.filter(r=>r.sol>0).map(r=>`  - ${r.c} / ${r.f}: ${r.sol} sol, ${r.carg} carg, ${r.sol-r.carg} faltantes, ${rp(r)}%`).join('\n');

  return`Eres el asistente de análisis operativo de INLOP (Integral Logistics Operations SAS), empresa colombiana de transporte de carga.

MÓDULO: ${tipo}
SEMANA ACTIVA: ${cur.label} (${cur.rango})
META DE CUMPLIMIENTO: ${meta}%

DATOS SEMANA ${cur.label}:
- Viajes solicitados: ${s.sol}
- Viajes cargados: ${s.carg}
- Balance (faltantes): ${s.deficit}
- % Cumplimiento: ${s.pct}%
${prev?`- Semana anterior: ${s.pct-prev.pct>=0?'+':''}${Math.round((s.pct-prev.pct)*10)/10}pp vs ${wks[wks.indexOf(cur)-1].label}`:''}

DETALLE POR CLIENTE/RUTA ${cur.label}:
${detRows}

HISTÓRICO (${wks.length} semanas):
${histRows}

Genera un análisis operativo completo en formato JSON con EXACTAMENTE esta estructura (sin markdown, sin texto extra, solo JSON puro):
{
  "resumen": {
    "estado_general": "párrafo de 2-3 oraciones sobre el estado general de la operación esta semana",
    "tendencia": "párrafo de 2-3 oraciones sobre la tendencia vs semanas anteriores y promedio del período",
    "atencion_prioritaria": "párrafo de 2-3 oraciones indicando qué rutas/clientes requieren atención inmediata"
  },
  "causas": [
    {
      "type": "crit|warn|ok",
      "icon": "emoji apropiado",
      "title": "CLIENTE — Campo/Ruta",
      "sub": "% · descripción corta de la situación",
      "body": "análisis detallado de 3-4 oraciones explicando la causa, el contexto y la recomendación"
    }
  ],
  "acciones": [
    {
      "txt": "descripción concreta de la acción a tomar",
      "resp": "Líder Operaciones",
      "date": "fecha sugerida en formato dd-mes",
      "status": "urgente|ejecucion|pendiente|ejecutado"
    }
  ],
  "ruta_cards": {
    "rutas_100": "texto descriptivo sobre las rutas al 100%",
    "rutas_criticas": "texto descriptivo sobre rutas críticas",
    "mejor_cliente": "texto descriptivo sobre el cliente con mejor desempeño",
    "mayor_deficit": "texto descriptivo sobre el cliente con mayor déficit"
  },
  "historico": {
    "balance_periodo": "análisis de 3-4 oraciones sobre el balance histórico del período completo con datos específicos",
    "semanas_destacadas": "análisis de 3-4 oraciones sobre las semanas más relevantes (mejor, peor, tendencia reciente)",
    "clientes_priorizar": "análisis de 3-4 oraciones identificando patrones de incumplimiento recurrente y recomendaciones estratégicas"
  }
}

IMPORTANTE: 
- Responde SOLO con el JSON, sin texto adicional, sin bloques de código
- Usa lenguaje ejecutivo y directo, como lo haría un Líder de Operaciones colombiano
- Para "causas", incluye TODOS los clientes/rutas con movimiento (tanto los que cumplen como los que no)
- Para "acciones", genera entre 2-5 acciones concretas y priorizadas
- Los campos "type" en causas: "crit" para 0% o problemas graves, "warn" para parcial o tendencia negativa, "ok" para 100% o logros
- La semana siguiente a ${cur.label} es S${String(parseInt(cur.id.replace('S',''))+1).padStart(2,'0')}`;
}

async function generateAiAnalysis(force=false){
  const key=getApiKey();
  if(!key){showApiKeyModal();return}

  const cacheKey=getCacheKey()+'_v2';
  if(!force&&aiCache[cacheKey]){
    applyAiResults(aiCache[cacheKey]);
    toast('Análisis cargado desde caché.','info');
    return;
  }

  aiLoading=true;
  showAiLoading(true);

  try{
    const wks=WKS(),cur=AWK();
    if(!cur){toast('Sin datos. Carga el Excel primero.','err');return}
    const s=ws(cur);
    const prev=wks.indexOf(cur)>0?ws(wks[wks.indexOf(cur)-1]):null;
    const tipo=isSec()?'Carga Seca':'Carga Líquida';
    const detRows=cur.rows.filter(r=>r.sol>0).map(r=>`${r.c}/${r.f}: ${r.sol} sol, ${r.carg} carg, ${rp(r)}%`).join(' | ');
    const histRows=wks.map(w=>`${w.label}=${ws(w).pct}%`).join(', ');

    const prompt=`Eres el líder de operaciones de INLOP (Cartagena, Colombia). Analiza la semana ${cur.label} de ${tipo}.

Resultado: ${s.sol} sol / ${s.carg} carg / ${s.deficit} faltantes / ${s.pct}% (meta ${META}%)
${prev?`Anterior: ${prev.pct}%`:''}
Histórico: ${histRows}
Rutas: ${detRows}

Escribe exactamente en este formato, sin títulos adicionales:

ESTADO_GENERAL: [2 oraciones sobre el estado operativo de esta semana]
TENDENCIA: [2 oraciones sobre la tendencia vs semanas anteriores]
ATENCION: [2 oraciones sobre qué requiere atención inmediata]
BALANCE_PERIODO: [2 oraciones sobre el acumulado histórico]
SEMANAS_DESTACADAS: [2 oraciones sobre mejor y peor semana]
CLIENTES_PRIORIZAR: [2 oraciones sobre clientes con patrones de incumplimiento]

Sin markdown, sin texto extra. Solo las 6 líneas.`;

    const text = await callClaude(prompt);

    // Parse plain text response
    const result={resumen:{},historico:{}};
    const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.includes(':'));
    lines.forEach(line=>{
      const idx=line.indexOf(':');
      const key2=line.slice(0,idx).trim();
      const val=line.slice(idx+1).trim();
      if(key2==='ESTADO_GENERAL') result.resumen.estado_general=val;
      else if(key2==='TENDENCIA') result.resumen.tendencia=val;
      else if(key2==='ATENCION') result.resumen.atencion_prioritaria=val;
      else if(key2==='BALANCE_PERIODO') result.historico.balance_periodo=val;
      else if(key2==='SEMANAS_DESTACADAS') result.historico.semanas_destacadas=val;
      else if(key2==='CLIENTES_PRIORIZAR') result.historico.clientes_priorizar=val;
    });

    aiCache[cacheKey]=result;
    saveAiCache();
    applyAiResults(result);
    toast('✓ Análisis generado con IA.','ok');
  }catch(e){
    toast('Error generando análisis: '+e.message,'err');
    console.error('AI error:',e);
  }finally{
    aiLoading=false;
    showAiLoading(false);
  }
}

function applyAiResults(r){
  if(!r)return;
  // 1. Resumen ejecutivo
  if(r.resumen){
    const g=document.getElementById('resAnalysisGrid');
    if(g)g.innerHTML=`
      <div class="ab-item"><div class="ab-item-title">Estado general</div><div class="ab-item-body">${r.resumen.estado_general||''}</div></div>
      <div class="ab-item"><div class="ab-item-title">Tendencia vs período</div><div class="ab-item-body">${r.resumen.tendencia||''}</div></div>
      <div class="ab-item"><div class="ab-item-title">Atención prioritaria</div><div class="ab-item-body">${r.resumen.atencion_prioritaria||''}</div></div>`;
  }
  // 2. Causas
  if(r.causas&&r.causas.length){
    const key=`${cargo}_${wkId}`;
    if(!causesEdits[key])causesEdits[key]={};
    // Store AI causes as the base for this week
    aiCausesData[key]=r.causas;
    renderCausasFromAi(r.causas);
  }
  // 3. Acciones
  if(r.acciones&&r.acciones.length){
    if(!actions[cargo])actions[cargo]={};
    actions[cargo][wkId]=r.acciones.map((a,i)=>({...a,id:Date.now()+i}));
    renderActions();
  }
  // 4. Ruta cards (update descriptions)
  if(r.ruta_cards){
    const cards=document.querySelectorAll('.rc .rc-desc');
    if(cards[0])cards[0].textContent=r.ruta_cards.rutas_100||cards[0].textContent;
    if(cards[1])cards[1].textContent=r.ruta_cards.rutas_criticas||cards[1].textContent;
    if(cards[2])cards[2].textContent=r.ruta_cards.mejor_cliente||cards[2].textContent;
    if(cards[3])cards[3].textContent=r.ruta_cards.mayor_deficit||cards[3].textContent;
  }
  // 5. Histórico
  if(r.historico){
    const g=document.getElementById('hisAnalysisGrid');
    if(g)g.innerHTML=`
      <div class="ha-item"><div class="ha-item-title">Balance del período</div><div class="ha-item-body">${r.historico.balance_periodo||''}</div></div>
      <div class="ha-item"><div class="ha-item-title">Semanas destacadas</div><div class="ha-item-body">${r.historico.semanas_destacadas||''}</div></div>
      <div class="ha-item"><div class="ha-item-title">Clientes a priorizar</div><div class="ha-item-body">${r.historico.clientes_priorizar||''}</div></div>`;
  }
  saveLocal();
}

function renderCausasFromAi(causes){
  if(!causes||!causes.length)return;
  const w=AWK(),s=ws(w),sec=isSec();
  let html=`<div class="card cp" style="margin-bottom:16px">
    <div class="card-ttl">Contexto operativo — ${wkId} · ${w?.rango||''}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--blue)">${s.sol}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Solicitados</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--green)">${s.carg}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Cargados</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:${s.deficit>0?'var(--danger)':'var(--green)'}">−${s.deficit}</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Balance</div></div>
      <div style="text-align:center"><div style="font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:${s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)'}">${s.pct}%</div><div style="font-size:10px;color:var(--w3);text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">Cumplimiento</div></div>
    </div>
  </div>`;
  const key=`${cargo}_${wkId}`;
  const edits=causesEdits[key]||{};
  causes.forEach((c,i)=>{
    const map={crit:['ci-r','var(--danger)'],warn:['ci-y','var(--amber)'],ok:['ci-g','var(--green)']};
    const[ci,col]=map[c.type]||map['warn'];
    const body=edits[i]!==undefined?edits[i]:c.body;
    html+=`<div class="cause-card">
      <div class="cause-hdr">
        <div class="cause-icon ${ci}">${c.icon}</div>
        <div style="flex:1"><div class="cause-title">${c.title}</div><div class="cause-sub" style="color:${col}">${c.sub}</div></div>
      </div>
      <div class="cause-body" id="cb_${i}">${body}</div>
      <textarea class="cause-textarea" id="cta_${i}" style="display:none">${body}</textarea>
      <button class="cause-edit-btn" id="ceb_${i}" onclick="toggleCauseEdit(${i})">✎ Editar texto</button>
    </div>`;
  });
  document.getElementById('causasContent').innerHTML=html;
}

function showAiLoading(show){
  const btns=document.querySelectorAll('.ai-gen-btn');
  btns.forEach(b=>{
    b.disabled=show;
    b.textContent=show?'✦ Generando análisis...':'✦ Generar con IA';
    b.style.opacity=show?'.6':'1';
  });
  if(show){
    const els=['resAnalysisGrid','causasContent','actionsContainer','hisAnalysisGrid'];
    els.forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--w4)"><div class="ai-spinner"></div><span style="font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase">Generando análisis con IA...</span></div>`;
    });
  }
}

/* API Key Modal */
function showApiKeyModal(){document.getElementById('apiKeyModal').classList.add('show')}
function closeApiKeyModal(){document.getElementById('apiKeyModal').classList.remove('show')}
function saveApiKey(){
  const v=document.getElementById('apiKeyInput').value.trim();
  if(!v.startsWith('sk-ant-')){toast('La API key debe comenzar con sk-ant-','err');return}
  setApiKey(v);closeApiKeyModal();
  toast('API Key guardada. Generando análisis...','ok');
  setTimeout(()=>generateAiAnalysis(true),300);
}


/* ════════════════════════════════════════════════════════
   WHATSAPP SHARE
════════════════════════════════════════════════════════ */
function sendWhatsApp(){
  const w=AWK();if(!w)return;
  const s=ws(w);
  const tipo=isSec()?'Carga Seca':'Carga Líquida';
  const estado=s.pct>=META?'✅ META SUPERADA':s.pct>=80?'⚠️ ALERTA':'🔴 CRÍTICO';
  const url=window.location.href.split('?')[0];
  const msg=`*INLOP — Dashboard Operativo ${w.label}*
${tipo} · ${w.rango}

${estado} — Cumplimiento: *${s.pct}%* (meta ${META}%)
• Solicitados: ${s.sol}
• Cargados: ${s.carg}
• Balance: ${s.deficit>0?'−':''}${s.deficit} viajes

Ver dashboard completo:
${url}

_Generado automáticamente · INLOP Operations_`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

/* ════════════════════════════════════════════════════════
   PWA — Progressive Web App
════════════════════════════════════════════════════════ */
function setupPWA(){
  const manifest={
    name:'INLOP Dashboard Operativo',
    short_name:'INLOP Ops',
    description:'Dashboard de nominación semanal INLOP',
    start_url:window.location.href,
    display:'standalone',
    background_color:'#0a0e17',
    theme_color:'#0e1420',
    orientation:'any',
    icons:[
      {src:'data:image/png;base64,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',sizes:'192x192',type:'image/png'},
      {src:'data:image/png;base64,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',sizes:'512x512',type:'image/png'}
    ]
  };
  const blob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  document.getElementById('pwaManifest').href=url;
}

/* ════════════════════════════════════════════════════════
   AI STATUS BAR UPDATE
════════════════════════════════════════════════════════ */
function updateAiStatus(){
  // Update sidebar mini status
  const miniLabel = document.getElementById('aiMiniLabel');
  if (miniLabel) {
    miniLabel.textContent = aiKey ? '✦ IA configurada' : 'IA no configurada';
    miniLabel.style.color = aiKey ? '#818cf8' : 'var(--w4)';
  }
  const key=getApiKey();
  const label=document.getElementById('aiStatusLabel');
  const detail=document.getElementById('aiStatusDetail');
  if(!label)return;
  if(!key){
    label.textContent='Sin configurar';label.className='ai-status-warn';
    if(detail)detail.textContent='· Configura tu API Key para análisis automáticos';
  } else {
    const cacheKey=getCacheKey();
    if(aiCache[cacheKey]){
      label.textContent='Análisis listo';label.className='ai-status-ok';
      if(detail)detail.textContent='· Cargado desde caché — clic en "Generar" para actualizar';
    } else {
      label.textContent='Lista para generar';label.className='ai-status-ok';
      if(detail)detail.textContent='· Haz clic en "Generar con IA" para crear el análisis';
    }
  }
}


/* ════════════════════════════════════════════════════════
   PRESIDENTIAL VIEW — renderPresident()
════════════════════════════════════════════════════════ */
function renderPresident(){
  const liqWks = DATA_LIQ;
  const secWks = DATA_SEC;
  if(!liqWks.length && !secWks.length) return;

  // Sync with active week selected by user
  const activeId = wkId;
  const liqCur = liqWks.find(w=>w.id===activeId) || liqWks[liqWks.length-1] || null;
  const secCur = secWks.find(w=>w.id===activeId) || secWks[secWks.length-1] || null;
  const liqS = liqCur ? ws(liqCur) : {sol:0,carg:0,pct:0,deficit:0};
  const secS = secCur ? ws(secCur) : {sol:0,carg:0,pct:0,deficit:0};

  // Consolidated
  const totSol = liqS.sol + secS.sol;
  const totCarg = liqS.carg + secS.carg;
  const totDef = liqS.deficit + secS.deficit;
  const totPct = totSol > 0 ? Math.round(totCarg/totSol*100*10)/10 : 0;

  // Presidential header date
  const now = new Date();
  document.getElementById('presDate').textContent =
    now.toLocaleDateString('es-CO',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toUpperCase() +
    ' · SEMANA ' + (liqCur||secCur||{label:'—'}).label;

  // Estado global
  const estado = document.getElementById('presEstado');
  const estadoTxt = document.getElementById('presEstadoTxt');
  if(totPct >= META){
    estado.className='pres-estado pe-ok';
    document.querySelector('#presEstado .pe-dot').style.background='var(--green)';
    estadoTxt.textContent='OPERACIÓN NORMAL';
  } else if(totPct >= 80){
    estado.className='pres-estado pe-warn';
    document.querySelector('#presEstado .pe-dot').style.background='var(--amber)';
    estadoTxt.textContent='ALERTA OPERATIVA';
  } else {
    estado.className='pres-estado pe-crit';
    document.querySelector('#presEstado .pe-dot').style.background='var(--danger)';
    estadoTxt.textContent='ESTADO CRÍTICO';
  }

  // Prev week for deltas
  const liqPrev = liqWks.length>1 ? ws(liqWks[liqWks.length-2]) : null;
  const secPrev = secWks.length>1 ? ws(secWks[secWks.length-2]) : null;
  const prevTotPct = liqPrev&&secPrev ? Math.round((liqPrev.carg+secPrev.carg)/(liqPrev.sol+secPrev.sol)*100*10)/10 : null;
  const deltaP = prevTotPct ? Math.round((totPct-prevTotPct)*10)/10 : null;

  // BIG KPIs
  const pp = totPct>=META?'var(--green)':totPct>=80?'var(--amber)':'var(--danger)';
  document.getElementById('presKpiGrid').innerHTML = `
    <div class="pk" style="--pk-c:var(--blue)">
      <div class="pk::before" style="background:var(--blue)"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--blue);border-radius:12px 12px 0 0"></div>
      <div class="pk-lbl">Viajes solicitados</div>
      <div class="pk-val" style="color:var(--blue)">${totSol}</div>
      <div class="pk-meta">Líquida: ${liqS.sol} · Seca: ${secS.sol}</div>
    </div>
    <div class="pk">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--green);border-radius:12px 12px 0 0"></div>
      <div class="pk-lbl">Viajes cargados</div>
      <div class="pk-val" style="color:var(--green)">${totCarg}</div>
      <div class="pk-meta">Líquida: ${liqS.carg} · Seca: ${secS.carg}</div>
    </div>
    <div class="pk">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${totDef>0?'var(--danger)':'var(--green)'};border-radius:12px 12px 0 0"></div>
      <div class="pk-lbl">Balance faltantes</div>
      <div class="pk-val" style="color:${totDef>0?'var(--danger)':'var(--green)'}">${totDef>0?'−':''}${totDef}</div>
      <div class="pk-meta">${totDef===0?'Sin déficit esta semana':'Requieren gestión urgente'}</div>
    </div>
    <div class="pk">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${pp};border-radius:12px 12px 0 0"></div>
      <div class="pk-lbl">% Cumplimiento global</div>
      <div class="pk-val" style="color:${pp}">${totPct}%</div>
      <div class="pk-meta">${deltaP!==null?(deltaP>=0?'▲ +'+deltaP+'pp':'▼ '+deltaP+'pp')+' vs semana anterior':'Meta: '+META+'%'}</div>
    </div>`;

  // PIPELINE — Líquida + Seca
  function pipeCard(label, wkData, s, color){
    if(!wkData) return `<div class="pipeline-card"><div class="pipeline-header"><div class="pipeline-title">${label}</div><div class="pipeline-total" style="color:var(--w4)">Sin datos</div></div></div>`;
    const active = wkData.rows.filter(r=>r.sol>0);
    const ok100 = active.filter(r=>rp(r)===100);
    const partial = active.filter(r=>rp(r)>0&&rp(r)<100);
    const zero = active.filter(r=>rp(r)===0);
    const noMov = wkData.rows.filter(r=>r.sol===0);
    const noMovClients=[...new Set(noMov.map(r=>r.c))].filter(cli=>!active.find(ar=>ar.c===cli));
    const pct = s.pct;
    const pCol = pct>=META?'var(--green)':pct>=80?'var(--amber)':'var(--danger)';

    // Bar segments proportional
    const t = s.sol || 1;
    const okW = Math.round(s.carg/t*100);
    const defW = Math.round(s.deficit/t*100);

    return `<div class="pipeline-card">
      <div class="pipeline-header">
        <div>
          <div class="pipeline-title">${label}</div>
          <div style="font-size:10px;color:var(--w4);margin-top:2px">${wkData.rango}</div>
        </div>
        <div style="text-align:right">
          <div class="pipeline-total" style="color:${pCol}">${pct}%</div>
          <div style="font-size:10px;color:var(--w4)">${s.carg} / ${s.sol} viajes</div>
        </div>
      </div>
      <div class="pipeline-body">
        <div class="pipe-stage">
          <div class="pipe-stage-left">
            <div class="pipe-dot" style="background:var(--green)"></div>
            <div><div class="pipe-lbl">Ejecutados al 100%</div><div class="pipe-sub">${ok100.map(r=>r.c).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3).join(', ')}</div></div>
          </div>
          <div class="pipe-num" style="color:var(--green)">${s.carg}</div>
        </div>
        <div class="pipe-stage">
          <div class="pipe-stage-left">
            <div class="pipe-dot" style="background:var(--amber)"></div>
            <div><div class="pipe-lbl">Cumplimiento parcial</div><div class="pipe-sub">${partial.length} ruta(s) entre 1-99%</div></div>
          </div>
          <div class="pipe-num" style="color:var(--amber)">${partial.length}</div>
        </div>
        <div class="pipe-stage">
          <div class="pipe-stage-left">
            <div class="pipe-dot" style="background:var(--danger)"></div>
            <div><div class="pipe-lbl">Rutas en 0% — Crítico</div><div class="pipe-sub">${zero.length>0?zero.map(r=>r.c+'/'+r.f).join(', '):'Sin rutas críticas'}</div></div>
          </div>
          <div class="pipe-num" style="color:${zero.length>0?'var(--danger)':'var(--green)'}">${zero.length}</div>
        </div>
        <div class="pipe-stage">
          <div class="pipe-stage-left">
            <div class="pipe-dot" style="background:var(--w4)"></div>
            <div><div class="pipe-lbl">Sin movimiento</div><div class="pipe-sub">${noMovClients.length>0?noMovClients.slice(0,3).join(', '):'Todos activos'}</div></div>
          </div>
          <div class="pipe-num" style="color:var(--w4)">${noMovClients.length}</div>
        </div>
        <div class="pipe-bar-wrap">
          <div class="pipe-full-bar">
            <div class="pipe-seg" style="width:${okW}%;background:var(--green)"></div>
            <div class="pipe-seg" style="width:${defW}%;background:var(--danger)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:10px;color:var(--w4)">
            <span style="color:var(--green)">${okW}% ejecutado</span>
            <span style="color:${defW>0?'var(--danger)':'var(--w4)'}">−${s.deficit} faltantes</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  document.getElementById('pipelineGrid').innerHTML =
    pipeCard('🔵 Carga Líquida — Hidrocarburos', liqCur, liqS, 'var(--blue)') +
    pipeCard('🟠 Carga Seca — Nacional y Urbana', secCur, secS, 'var(--amber)');

  // TOP PERFORMERS
  function topClient(wks){
    // Use current week only for performers
    const curWk = wks.find(w=>w.id===activeId)||wks[wks.length-1];
    if(!curWk) return null;
    const byC = {};
    curWk.rows.forEach(r=>{
      if(!byC[r.c])byC[r.c]={sol:0,carg:0};
      byC[r.c].sol+=r.sol; byC[r.c].carg+=r.carg;
    });
    // Sort by % first, then by volume as tiebreaker
    const sorted = Object.entries(byC).filter(([,v])=>v.sol>0)
      .sort((a,b)=>{
        const pa=a[1].carg/a[1].sol, pb=b[1].carg/b[1].sol;
        return pa!==pb?pb-pa:b[1].carg-a[1].carg;
      });
    return sorted[0]?{name:sorted[0][0],carg:sorted[0][1].carg,sol:sorted[0][1].sol}:null;
  }
  function topCorredor(liqWks, secWks){
    const byR = {};
    // Include both modules
    [...liqWks,...secWks].forEach(w=>w.rows.forEach(r=>{
      if(!r.o||!r.d) return;
      const key = r.o+'→'+r.d;
      if(!byR[key])byR[key]={sol:0,carg:0};
      byR[key].sol+=r.sol; byR[key].carg+=r.carg;
    }));
    const sorted = Object.entries(byR).filter(([,v])=>v.sol>0)
      .sort((a,b)=>b[1].carg-a[1].carg);
    return sorted[0]?{name:sorted[0][0].replace('→',' → '),carg:sorted[0][1].carg,sol:sorted[0][1].sol}:null;
  }

  const topLiq = topClient(liqWks);
  const topSec = topClient(secWks);
  const topCor = topCorredor(liqWks, secWks);
  const cumplPct = totPct;
  const bestWkLiq = liqWks.length ? liqWks.reduce((a,b)=>ws(a).pct>ws(b).pct?a:b) : null;

  document.getElementById('performersGrid').innerHTML = `
    <div class="perf-card">
      <div class="perf-rank"><span class="perf-medal">🏆</span><div class="perf-title">Cliente ancla — Carga Seca</div></div>
      <div class="perf-name">${topSec?topSec.name:'—'}</div>
      <div class="perf-val" style="color:var(--green)">${topSec?topSec.carg:0}<span style="font-size:14px;color:var(--w4)"> viajes</span></div>
      <div class="perf-desc">${topSec?Math.round(topSec.carg/topSec.sol*100)+'% cumplimiento · '+topSec.carg+'/'+topSec.sol+' viajes':'Sin datos'}</div>
    </div>
    <div class="perf-card">
      <div class="perf-rank"><span class="perf-medal">🛢️</span><div class="perf-title">Cliente principal — Carga Líquida</div></div>
      <div class="perf-name">${topLiq?topLiq.name:'—'}</div>
      <div class="perf-val" style="color:var(--blue)">${topLiq?topLiq.carg:0}<span style="font-size:14px;color:var(--w4)"> viajes</span></div>
      <div class="perf-desc">${topLiq?Math.round(topLiq.carg/topLiq.sol*100)+'% cumplimiento · '+topLiq.carg+'/'+topLiq.sol+' viajes':'Sin datos'}</div>
    </div>
    <div class="perf-card">
      <div class="perf-rank"><span class="perf-medal">🗺️</span><div class="perf-title">Corredor más activo — período</div></div>
      <div class="perf-name" style="font-size:12px">${topCor?topCor.name:'—'}</div>
      <div class="perf-val" style="color:var(--amber)">${topCor?topCor.carg:0}<span style="font-size:14px;color:var(--w4)"> viajes</span></div>
      <div class="perf-desc">${topCor?Math.round(topCor.carg/topCor.sol*100)+'% efectividad en '+liqWks.length+' semanas':'Sin datos de ruta'}</div>
    </div>`;

  // MONTHLY CONSOLIDADO — only weeks in same month as active week
  const activeWkRef = liqCur||secCur;
  const activeMonth = activeWkRef ? (activeWkRef.start ? activeWkRef.start.getMonth() : null) : null;
  // Filter weeks by label proximity (last 4-5 weeks) as month approximation
  // Use all loaded weeks as period total since we don't have exact month dates
  const periodLiqStats = liqWks.map(w=>({...ws(w),label:w.label}));
  const periodSecStats = secWks.map(w=>({...ws(w),label:w.label}));
  const monthSol = periodLiqStats.reduce((a,s)=>a+s.sol,0) + periodSecStats.reduce((a,s)=>a+s.sol,0);
  const monthCarg = periodLiqStats.reduce((a,s)=>a+s.carg,0) + periodSecStats.reduce((a,s)=>a+s.carg,0);
  const monthDef = monthSol - monthCarg;
  const monthPct = monthSol>0?Math.round(monthCarg/monthSol*100*10)/10:0;
  const monthPp = monthPct>=META?'var(--green)':monthPct>=80?'var(--amber)':'var(--danger)';
  const periodLabel = liqWks.length>0?`${liqWks[0].label} — ${liqWks[liqWks.length-1].label}`:'Período';

  document.getElementById('monthlyKpis').innerHTML = `
    <div class="mk"><div class="mk-val" style="color:var(--blue)">${monthSol}</div><div class="mk-lbl">Total Solicitados</div></div>
    <div class="mk"><div class="mk-val" style="color:var(--green)">${monthCarg}</div><div class="mk-lbl">Total Cargados</div></div>
    <div class="mk"><div class="mk-val" style="color:${monthDef>0?'var(--danger)':'var(--green)'}">−${monthDef}</div><div class="mk-lbl">Total Déficit</div></div>
    <div class="mk"><div class="mk-val" style="color:${monthPp}">${monthPct}%</div><div class="mk-lbl">Cumpl. Promedio</div></div>
    <div class="mk"><div class="mk-val" style="color:var(--w2)">${liqWks.length}</div><div class="mk-lbl">Semanas · ${periodLabel}</div></div>`;

  // Monthly chart
  if(CH['monthly']){CH['monthly'].destroy();delete CH['monthly']}
  const labels = liqWks.map(w=>w.label);
  const liqPcts = liqWks.map(w=>ws(w).pct);
  const secPcts = secWks.filter(w=>liqWks.find(l=>l.id===w.id)).map(w=>ws(w).pct);
  CH['monthly'] = new Chart(document.getElementById('cMonthly'),{
    type:'line',
    data:{labels,datasets:[
      {data:liqPcts,borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,.1)',fill:true,tension:.4,pointRadius:4,borderWidth:2.5,pointBackgroundColor:liqPcts.map(p=>p>=META?'#00d97e':p>=80?'#f59e0b':'#ef4444'),pointBorderColor:'var(--c1)',pointBorderWidth:2,label:'Líquida'},
      {data:secPcts,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.08)',fill:true,tension:.4,pointRadius:4,borderWidth:2.5,pointBackgroundColor:secPcts.map(p=>p>=META?'#00d97e':p>=80?'#f59e0b':'#ef4444'),pointBorderColor:'var(--c1)',pointBorderWidth:2,label:'Seca'},
      {data:liqWks.map(()=>META),borderColor:'rgba(192,6,19,.5)',borderDash:[5,4],borderWidth:1.5,pointRadius:0,fill:false,label:'Meta'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{color:AX,font:{size:10},padding:12}},tooltip:{...tip}},
      scales:{x:{grid:{color:AX_GRID,borderColor:AX},ticks:{color:AX,font:{size:10}},border:{color:AX}},
              y:{grid:{color:AX_GRID,borderColor:AX},ticks:{color:AX,font:{size:10},callback:v=>v+'%'},border:{color:AX},min:0,max:110}}}
  });
}

/* PRESIDENTIAL AI */
async function generatePresAi(){
  const key = getApiKey();
  if(!key){showApiKeyModal();return}

  const liqCur = DATA_LIQ[DATA_LIQ.length-1];
  const secCur = DATA_SEC[DATA_SEC.length-1];
  if(!liqCur&&!secCur){toast('Carga el Excel primero.','err');return}

  const liqS = liqCur?ws(liqCur):{sol:0,carg:0,pct:0,deficit:0};
  const secS = secCur?ws(secCur):{sol:0,carg:0,pct:0,deficit:0};
  const totPct = (liqS.sol+secS.sol)>0?Math.round((liqS.carg+secS.carg)/(liqS.sol+secS.sol)*100*10)/10:0;

  // Historical context
  const liqHist = DATA_LIQ.map(w=>({sem:w.label,...ws(w)}));
  const secHist = DATA_SEC.map(w=>({sem:w.label,...ws(w)}));

  const grid = document.getElementById('presAiGrid');
  grid.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--w4);grid-column:1/-1"><div class="ai-spinner"></div><span style="font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase">Analizando operación completa...</span></div>';

  const prompt = `Eres el Presidente de Operaciones de INLOP (Cartagena, Colombia).

Consolidado semana actual:
- Carga Liquida: ${liqS.sol} sol / ${liqS.carg} carg / ${liqS.deficit} falt / ${liqS.pct}%
- Carga Seca: ${secS.sol} sol / ${secS.carg} carg / ${secS.deficit} falt / ${secS.pct}%
- Global: ${totPct}% (meta ${META}%)
Historial Liquida: ${liqHist.map(h=>h.sem+'='+h.pct+'%').join(', ')}
Historial Seca: ${secHist.map(h=>h.sem+'='+h.pct+'%').join(', ')}

Escribe exactamente en este formato, sin markdown, sin texto extra:

DIAGNOSTICO: [2 oraciones sobre el estado actual de la operacion]
PATRON: [2 oraciones sobre el patron mas preocupante en el historico]
OPORTUNIDAD: [2 oraciones sobre la mayor oportunidad de mejora]
DECISION: [2 oraciones con la decision estrategica mas importante]

Solo las 4 lineas.`;

  try{
    const text = await callClaude(prompt);
    const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.includes(':'));
    const r={diagnostico:'',patron_critico:'',oportunidad:'',decision_estrategica:''};
    lines.forEach(line=>{
      const idx=line.indexOf(':');
      const k=line.slice(0,idx).trim();
      const v=line.slice(idx+1).trim();
      if(k==='DIAGNOSTICO') r.diagnostico=v;
      else if(k==='PATRON') r.patron_critico=v;
      else if(k==='OPORTUNIDAD') r.oportunidad=v;
      else if(k==='DECISION') r.decision_estrategica=v;
    });
    grid.innerHTML = `
      <div class="pai-item"><div class="pai-item-title">🎯 Diagnóstico ejecutivo</div><div class="pai-item-body">${r.diagnostico||'Sin datos suficientes.'}</div></div>
      <div class="pai-item"><div class="pai-item-title">⚠️ Patrón crítico identificado</div><div class="pai-item-body">${r.patron_critico||'Sin datos suficientes.'}</div></div>
      <div class="pai-item"><div class="pai-item-title">📈 Mayor oportunidad</div><div class="pai-item-body">${r.oportunidad||'Sin datos suficientes.'}</div></div>
      <div class="pai-item"><div class="pai-item-title">✦ Decisión estratégica</div><div class="pai-item-body">${r.decision_estrategica||'Sin datos suficientes.'}</div></div>`;
    toast('✓ Análisis de Gerencia generado.','ok');
  }catch(e){
    grid.innerHTML = '<div style="color:var(--danger);padding:20px;grid-column:1/-1">Error: '+e.message+'</div>';
    toast('Error: '+e.message,'err');
  }
}

/* ════════════════════════════════════════════════════════
   ADMIN PIN SYSTEM
════════════════════════════════════════════════════════ */
const ADMIN_PIN = '1926'; // Change this PIN
const PIN_KEY = 'inlop_admin_v12';
let pinBuffer = '';
let isAdmin = false;
let brandClickCount = 0;
let brandClickTimer = null;

function checkAdminSession(){
  const s = sessionStorage.getItem(PIN_KEY);
  if(s === 'ok'){ isAdmin=true; showAdminControls(); }
}

function handleBrandClick(){
  brandClickCount++;
  clearTimeout(brandClickTimer);
  brandClickTimer = setTimeout(()=>{ brandClickCount=0; }, 800);
  if(brandClickCount >= 5){
    brandClickCount=0;
    if(isAdmin){ logoutAdmin(); }
    else { openPinModal(); }
  }
}

function openPinModal(){
  pinBuffer=''; updatePinDots();
  document.getElementById('pinError').textContent='';
  document.getElementById('pinModal').classList.add('show');
}
function closePinModal(){ document.getElementById('pinModal').classList.remove('show'); pinBuffer=''; updatePinDots(); }

function pinPress(n){
  if(pinBuffer.length>=4) return;
  pinBuffer += n;
  updatePinDots();
  if(pinBuffer.length===4) setTimeout(validatePin,120);
}
function pinClear(){ pinBuffer=''; updatePinDots(); document.getElementById('pinError').textContent=''; }

function updatePinDots(){
  const dots=document.querySelectorAll('.pin-dot');
  dots.forEach((d,i)=>{ d.className='pin-dot'+(i<pinBuffer.length?' filled':''); });
}

function validatePin(){
  if(pinBuffer===ADMIN_PIN){
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.add('filled'));
    sessionStorage.setItem(PIN_KEY,'ok');
    isAdmin=true;
    setTimeout(()=>{ closePinModal(); showAdminControls(); toast('✓ Modo administrador activado.','ok'); },300);
  } else {
    document.querySelectorAll('.pin-dot').forEach(d=>{ d.className='pin-dot error'; });
    document.getElementById('pinError').textContent='PIN incorrecto';
    setTimeout(()=>{ pinBuffer=''; updatePinDots(); document.getElementById('pinError').textContent=''; },900);
  }
}

function showAdminControls(){
  const ac=document.getElementById('adminControls');
  const sb=document.getElementById('aiStatusBar');
  if(ac){ ac.style.display='flex'; }
  if(sb){ sb.style.display='flex'; }
  document.getElementById('brandBlock').title='Clic 5 veces para salir del modo admin';
}

function logoutAdmin(){
  isAdmin=false;
  sessionStorage.removeItem(PIN_KEY);
  const ac=document.getElementById('adminControls');
  const sb=document.getElementById('aiStatusBar');
  if(ac) ac.style.display='none';
  if(sb) sb.style.display='none';
  toast('Modo administrador desactivado.','info');
}

/* ════════════════════════════════════════════════════════
   WEEK DROPDOWN — renderNav updated
════════════════════════════════════════════════════════ */
function renderNav(){
  const sel = document.getElementById('weekSelect');
  if(sel){
    const wks = WKS();
    sel.innerHTML = wks.map(w=>
      `<option value="${w.id}" ${w.id===wkId?'selected':''} style="background:#131b2a;color:#e8eef8">${w.label} · ${w.rango}</option>`
    ).join('');
  }
  const w=AWK();
  if(w){
    document.getElementById('wkBadge').textContent=`${w.label} · ${w.rango}`;
    document.getElementById('wkBadge').className='wk-badge'+(isSec()?' sec':'');
  }
}

/* ════════════════════════════════════════════════════════
   MOBILE CARDS — render table as cards on mobile
════════════════════════════════════════════════════════ */
function renderMobileCards(w){
  if(!w) return '';
  const sec=isSec();
  const allRows=flt==='all'?w.rows:w.rows.filter(r=>rst(r)===flt);
  const s=ws(w);

  // Group by client
  const byClient={};
  allRows.forEach(r=>{
    if(!byClient[r.c]) byClient[r.c]=[];
    byClient[r.c].push(r);
  });

  const clientCards=Object.entries(byClient).map(([cli,routes])=>{
    const cSol=routes.reduce((a,r)=>a+r.sol,0);
    const cCarg=routes.reduce((a,r)=>a+r.carg,0);
    const cBal=cCarg-cSol;
    const cPct=cSol>0?Math.round(cCarg/cSol*100):0;
    const col=pc(cPct);
    const hasNew=routes.some(r=>r.nuevo);
    const hasCrit=routes.some(r=>r.sol>0&&rp(r)===0);
    const hasWarn=routes.some(r=>r.sol>0&&rp(r)>0&&rp(r)<100);
    const clsCli=cSol===0?'':hasCrit?'cli-crit':hasWarn?'cli-warn':'cli-ok';

    // Badge: % + label
    const badgeLbl=cSol===0?'Sin mov.':cPct===100?'100%':cPct>=70?'Parcial':'Crítico';
    const badgeCls=cSol===0?'b-none':cPct===100?'b-ok':cPct>=70?'b-warn':'b-crit';

    // Route rows — only active routes
    const activeRoutes=routes.filter(r=>r.sol>0);
    const routeHtml=activeRoutes.map(r=>{
      const p=rp(r); const col2=pc(p);
      const bal2=r.carg-r.sol;
      const rBadge=p===100?'b-ok':p>=70?'b-warn':'b-crit';
      const rLbl=p===100?'100%':p>=70?'Parcial':'Crítico';
      return `<div class="cli-route">
        <div class="cli-route-top">
          <div>
            <div class="cli-route-name">${r.f||r.c}</div>
            ${!sec&&r.o?`<div class="cli-route-path">${r.o} → ${r.d}</div>`:''}
          </div>
          <span class="badge ${rBadge}" style="font-size:9px">${rLbl}</span>
        </div>
        <div class="cli-route-nums">
          <div class="cli-route-num">
            <span class="cli-route-num-val" style="color:var(--w2)">${r.sol}</span>
            <span class="cli-route-num-lbl">Sol.</span>
          </div>
          <div style="width:1px;height:20px;background:var(--line)"></div>
          <div class="cli-route-num">
            <span class="cli-route-num-val" style="color:var(--green)">${r.carg}</span>
            <span class="cli-route-num-lbl">Carg.</span>
          </div>
          <div style="width:1px;height:20px;background:var(--line)"></div>
          <div class="cli-route-num">
            <span class="cli-route-num-val" style="color:${bal2<0?'var(--danger)':'var(--green)'}">${bal2<0?'−':''}${Math.abs(bal2)}</span>
            <span class="cli-route-num-lbl">Bal.</span>
          </div>
          <div style="flex:1;margin-left:8px">
            <div style="display:flex;justify-content:flex-end;margin-bottom:3px">
              <span style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;color:${col2}">${r.sol>0?p+'%':'—'}</span>
            </div>
            <div class="cli-route-bar"><div class="cli-route-bar-fill" style="width:${p}%;background:${col2}"></div></div>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="cli-card ${clsCli}">
      <div class="cli-card-header">
        <div class="cli-card-name">${cli}${hasNew?'<span class="badge b-new" style="margin-left:8px;font-size:8px;vertical-align:middle">★ Nuevo</span>':''}</div>
        <div class="cli-card-badge">
          <span class="cli-pct" style="color:${col}">${cSol>0?cPct+'%':'—'}</span>
          <span class="badge ${badgeCls}">${badgeLbl}</span>
        </div>
      </div>
      ${routeHtml}
      ${activeRoutes.length>1?`<div class="cli-total">
        <span class="cli-total-lbl">Total ${cli}</span>
        <div class="cli-total-nums">
          <span class="cli-total-num">${cSol} sol · ${cCarg} carg · <span style="color:${cBal<0?'var(--danger)':'var(--green)'}">bal ${cBal<0?'−':''}${Math.abs(cBal)}</span></span>
          <span class="cli-total-pct" style="color:${col}">${cSol>0?cPct+'%':'—'}</span>
        </div>
      </div>`:''}
    </div>`;
  }).join('');

  // Total card
  const totalCard=flt==='all'?`<div class="mob-card" style="border-color:rgba(1,42,107,.4);background:rgba(1,42,107,.12)">
    <div class="mob-card-header">
      <div class="mob-card-title" style="color:#7ab4f0">TOTAL · ${w.label}</div>
      <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:${s.pct>=META?'var(--green)':s.pct>=80?'var(--amber)':'var(--danger)'}">${s.pct}%</div>
    </div>
    <div class="mob-card-row"><span class="mob-card-lbl">Solicitados</span><span class="mob-card-val">${s.sol}</span></div>
    <div class="mob-card-row"><span class="mob-card-lbl">Cargados</span><span class="mob-card-val" style="color:var(--green)">${s.carg}</span></div>
    <div class="mob-card-row"><span class="mob-card-lbl">Balance</span><span class="mob-card-val" style="color:${s.deficit>0?'var(--danger)':'var(--green)'}">${s.deficit>0?'−':''}${s.deficit}</span></div>
  </div>`:'';

  return clientCards + totalCard;
}

async function callClaude(prompt){
  const key=getApiKey();
  if(!key) throw new Error('Sin API Key');
  const resp=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1024,messages:[{role:'user',content:prompt}]})
  });
  if(!resp.ok){
    const err=await resp.json().catch(()=>({}));
    if(resp.status===401){showApiKeyModal();throw new Error('API Key inválida');}
    throw new Error(err.error?.message||'Error API '+resp.status);
  }
  const data=await resp.json();
  return data.content[0].text.trim();
}

async function generateCausesForWeek(wkData, cargoType, allWks){
  const s=ws(wkData);
  const wkIdx=allWks.findIndex(w=>w.id===wkData.id);
  const prev=wkIdx>0?allWks[wkIdx-1]:null;
  const prevS=prev?ws(prev):null;
  const nextWk=wkIdx<allWks.length-1?allWks[wkIdx+1]:null;
  const nextS=nextWk?ws(nextWk):null;

  const detRows=wkData.rows.filter(r=>r.sol>0)
    .map(r=>`- ${r.c} / ${r.f}: ${r.sol} sol, ${r.carg} carg, ${r.sol-r.carg} faltantes, ${rp(r)}%`).join('\n');

  const statusHint=nextS===null?'semana más reciente, usar gravedad actual':
    nextS.pct>=META?'el problema se resolvió → acciones: ejecutado':
    nextS.pct>=85?'mejoró parcialmente → acciones: ejecucion':
    'persiste → acciones: urgente';

  // S16 REAL EXAMPLE as reference (from actual reports)
  const s16Example=cargoType==='liq'?`
EJEMPLO REAL S16 CARGA LÍQUIDA (úsalo como guía de estilo y profundidad):
CAUSA1|CI PRODEXPORT|Cuervas|0%|La nominación fue lanzada el viernes 17 de abril al cierre de semana, lo que no permitió posicionar flota en los tiempos requeridos. El cliente trasladó los 4 viajes a S17. Causa controlada, no es falla de flota.
CAUSA2|IND. AMBIENTAL|LUBRYESP SAS|0%|Segundo ciclo consecutivo sin ejecución en ruta Galapa-Cartagena. Se requiere verificar disponibilidad de vehículo habilitado. El problema tiene carácter estructural.
CAUSA3|FRONTERA ENERGY|Araguaney|83%|Cuarta semana consecutiva con exactamente 1 viaje faltante. El patrón indica problema de capacidad de flota en esta ruta. Se requiere vinculación de vehículo dedicado.
CAUSA4|AMF|Dorotea|92%|1 vehículo despachado no logró cargar dentro de los tiempos de cierre semanal. El vehículo estuvo disponible y en ruta — es un desfase de tiempo al cierre del ciclo, no falla operativa.
ACCION1|Dar seguimiento a los 4 viajes de Cuervas (CI PRODEXPORT) trasladados a S17. Confirmar ejecución e informar al cliente.|Líder Operaciones|21-abr|urgente
ACCION2|Resolver disponibilidad de vehículo habilitado para ruta LUBRYESP SAS Galapa-Cartagena — segundo ciclo sin ejecución.|Líder Operaciones|21-abr|urgente
ACCION3|Confirmar cargue del vehículo de Dorotea (AMF) en el primer turno disponible de S17.|Líder Operaciones|20-abr|ejecutado`:
`
EJEMPLO REAL S16 CARGA SECA (úsalo como guía de estilo y profundidad):
CAUSA1|RAMO|Nacional|100%|92 viajes nacionales ejecutados en su totalidad. Ramo concentra el 86% del volumen del módulo y sostiene su ejecución perfecta. Desempeño sólido y consistente que debe replicarse con otros clientes.
CAUSA2|LHOIST COLOMBIA|Nacional+Urbana|100%|Primer ciclo de operación con INLOP: 6 viajes ejecutados (1 urbano + 5 nacionales). Arranque impecable. Se recomienda consolidar la relación operativa y garantizar flota para S17.
CAUSA3|JURADO TORRES|Nacional|0%|1 viaje nacional solicitado, 0 ejecutados. En clientes de bajo volumen un viaje faltante es 100% de incumplimiento. Requiere investigación de causa e informe al cliente.
CAUSA4|JEHS INGENIERÍA|Urbana|50%|Primer ciclo con 1 de 2 viajes ejecutado. Es prioritario establecer protocolo de comunicación temprana para garantizar cobertura total desde el inicio de la relación comercial.
ACCION1|Investigar causa del viaje no ejecutado de JUANCAMOLE y establecer plan de mejora.|Líder Operaciones|21-abr|pendiente
ACCION2|Gestionar protocolo de comunicación con JEHS INGENIERÍA para garantizar cobertura total en S17.|Líder Oper. / Comercial|21-abr|ejecucion
ACCION3|Confirmar capacidad de flota para LHOIST COLOMBIA de cara a S17 — sostener el 100%.|Líder Operaciones|21-abr|ejecucion`;

  const prompt=`Eres el líder de operaciones de INLOP (Cartagena, Colombia). Analiza la semana ${wkData.label} siguiendo exactamente el mismo estilo del ejemplo real de S16.
${s16Example}

AHORA ANALIZA ESTA SEMANA:
Semana: ${wkData.label} (${wkData.rango}) | ${cargoType==='liq'?'CARGA LÍQUIDA':'CARGA SECA'} | Meta ${META}%
Resultado: ${s.sol} sol / ${s.carg} carg / ${s.deficit} faltantes / ${s.pct}%
${prevS?`Anterior ${prev.label}: ${prevS.pct}%`:'Primera semana del período'}
${nextS?`Siguiente ${nextWk.label}: ${nextS.pct}% → ${statusHint}`:''}

Rutas activas:
${detRows}

Responde ÚNICAMENTE con líneas CAUSA y ACCION en el mismo formato del ejemplo. Sin títulos, sin explicaciones, sin markdown. Entre 2 y 4 causas, entre 1 y 3 acciones.`;

  const text = await callClaude(prompt);
  return parsePlainTextResponse(text, wkData, cargoType);
}

function parsePlainTextResponse(text, wkData, cargoType){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('CAUSA')||l.startsWith('ACCION'));
  const causas=[];
  const acciones=[];

  // Determine icons and types based on performance
  const getType=(pctStr)=>{
    const p=parseInt(pctStr)||0;
    return p===0?'crit':p<META?'warn':'ok';
  };
  const getIcon=(type)=>type==='crit'?'🚨':type==='warn'?'⚠️':'✅';

  lines.forEach(line=>{
    const parts=line.split('|');
    if(line.startsWith('CAUSA')&&parts.length>=5){
      const cliente=parts[1]?.trim()||'';
      const campo=parts[2]?.trim()||'';
      const pctStr=parts[3]?.trim()||'';
      const body=parts.slice(4).join('|').trim();
      const type=getType(pctStr);
      causas.push({
        type,
        icon:getIcon(type),
        title:`${cliente} — ${campo}`,
        sub:`${pctStr} · ${wkData.label}`,
        body:body||`Operación ${pctStr} en ${campo}.`
      });
    } else if(line.startsWith('ACCION')&&parts.length>=5){
      acciones.push({
        txt:parts[1]?.trim()||'Acción correctiva',
        resp:parts[2]?.trim()||'Líder Operaciones',
        date:parts[3]?.trim()||'próx. semana',
        status:parts[4]?.trim()||'pendiente'
      });
    }
  });

  // If parsing failed, generate basic causes from data
  if(!causas.length){
    wkData.rows.filter(r=>r.sol>0).slice(0,3).forEach(r=>{
      const p=rp(r);
      const type=p===0?'crit':p<META?'warn':'ok';
      causas.push({
        type,icon:getIcon(type),
        title:`${r.c} — ${r.f}`,
        sub:`${p}% · ${wkData.label}`,
        body:`${r.carg} de ${r.sol} viajes ejecutados (${p}%). ${p===0?'Requiere atención inmediata.':p<META?'Cumplimiento parcial, revisar causa.':'Operación completada exitosamente.'}`
      });
    });
  }

  if(!acciones.length){
    const crits=wkData.rows.filter(r=>r.sol>0&&rp(r)<META);
    if(crits.length){
      acciones.push({
        txt:`Gestionar ${crits.length} ruta(s) con incumplimiento: ${crits.map(r=>r.c).slice(0,2).join(', ')}`,
        resp:'Líder Operaciones',date:'próx. semana',status:'urgente'
      });
    }
  }

  return {causas, acciones};
}

async function generateCausesForWeek(wkData, cargoType, allWks){
  const s=ws(wkData);
  const wkIdx=allWks.findIndex(w=>w.id===wkData.id);
  const prev=wkIdx>0?allWks[wkIdx-1]:null;
  const prevS=prev?ws(prev):null;
  const nextWks=allWks.slice(wkIdx+1,wkIdx+3);
  const isLast=wkIdx===allWks.length-1;

  const detRows=wkData.rows.filter(r=>r.sol>0)
    .map(r=>`${r.c}/${r.f}: sol=${r.sol} carg=${r.carg} bal=${r.sol-r.carg} pct=${rp(r)}%`)
    .join('\n');
  const histCtx=allWks.slice(Math.max(0,wkIdx-3),wkIdx).map(w=>`${w.label}=${ws(w).pct}%`).join(' | ');
  const nextCtx=nextWks.map(w=>`${w.label}=${ws(w).pct}%`).join(' | ');

  // Smart status logic based on subsequent weeks
  const nextAvgPct=nextWks.length?Math.round(nextWks.reduce((a,w)=>a+ws(w).pct,0)/nextWks.length):null;
  const statusHint=nextAvgPct===null?'semana más reciente, usar gravedad actual':
    nextAvgPct>=META?'problema resuelto en semanas posteriores → acciones "ejecutado"':
    nextAvgPct>=85?'mejoró parcialmente → acciones "ejecucion"':
    'problema persiste → acciones "urgente"';

  const prompt=`Analiza operación INLOP ${wkData.label} (${wkData.rango}) - ${cargoType==='liq'?'Carga Líquida':'Carga Seca'} - Meta ${META}%

Resultado: ${s.sol} sol / ${s.carg} carg / ${s.deficit} falt / ${s.pct}%
${prevS?`Anterior ${prev.label}: ${prevS.pct}%`:''}
${histCtx?`Historial: ${histCtx}`:''}
${nextCtx?`Siguientes: ${nextCtx} → ${statusHint}`:''}

Rutas:
${detRows}

Responde SOLO JSON sin texto extra:
{"causas":[{"type":"crit|warn|ok","icon":"emoji","title":"CLIENTE — Campo","sub":"X% · situación breve","body":"análisis 2 oraciones máximo"}],"acciones":[{"txt":"acción concreta breve","resp":"Líder Operaciones","date":"próx. semana","status":"urgente|ejecucion|ejecutado|pendiente"}]}

Máximo 3 causas y 3 acciones. Textos cortos. Solo JSON válido.`;

  return await callClaude(prompt);
}

async function generateAllWeeksCauses(){
  const key=getApiKey();
  if(!key){showApiKeyModal();return}

  // Generate for BOTH modules
  const modules=[
    {type:'liq',wks:DATA_LIQ,label:'Carga Líquida'},
    {type:'sec',wks:DATA_SEC,label:'Carga Seca'}
  ];

  let totalWks=DATA_LIQ.length+DATA_SEC.length;
  if(!totalWks){toast('No hay datos cargados. Abre el dashboard con el Excel.','err');return}

  const lbl=document.getElementById('aiStatusLabel');
  toast(`Generando análisis IA para ${totalWks} semanas en ambos módulos...`,'info');

  let completed=0;
  let errors=0;

  for(const mod of modules){
    if(!mod.wks.length) continue;
    const prefix=`inlop_allcauses_${mod.type}_v12`;
    if(!actions[mod.type]) actions[mod.type]={};

    for(const wk of mod.wks){
      const cacheKey=`${prefix}_${wk.id}`;
      if(aiCache[cacheKey]){
        // Already cached — restore
        if(aiCache[cacheKey].causas) aiCausesData[`${mod.type}_${wk.id}`]=aiCache[cacheKey].causas;
        if(aiCache[cacheKey].acciones&&(!actions[mod.type][wk.id]||!actions[mod.type][wk.id].length)){
          actions[mod.type][wk.id]=aiCache[cacheKey].acciones;
        }
        completed++;
        if(lbl) lbl.textContent=`Generando... ${completed}/${totalWks}`;
        continue;
      }

      try{
        if(lbl) lbl.textContent=`${mod.label} ${wk.label}... (${completed+1}/${totalWks})`;
        const result=await generateCausesForWeek(wk,mod.type,mod.wks);
        if(result){
          aiCache[cacheKey]=result;
          if(result.causas) aiCausesData[`${mod.type}_${wk.id}`]=result.causas;
          if(result.acciones) actions[mod.type][wk.id]=result.acciones;
        }
      }catch(e){
        console.error(`Error ${mod.label} ${wk.id}:`,e);
        errors++;
        toast(`Error en ${mod.label} ${wk.label}: ${e.message}`,'err');
      }
      completed++;
      if(lbl) lbl.textContent=`Generando... ${completed}/${totalWks}`;
      await new Promise(r=>setTimeout(r,500)); // Delay to avoid rate limits
    }
  }

  saveAiCache();
  saveLocal();
  updateAiStatus();
  refresh();

  if(errors===0){
    toast(`✓ Análisis IA completo — ${totalWks} semanas generadas para Líquida y Seca.`,'ok');
  } else {
    toast(`Completado con ${errors} error(es). Revisa la consola para detalles.`,'err');
  }
}


/* ════════════════════════════════════════════════════════
   BUILD CAUSES FROM EXCEL — reads causa column automatically
════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   CAUSA REWRITER — rules-based fallback (no API needed)
════════════════════════════════════════════════════════ */
function rewriteCausaRules(causa, cliente, campo, pct, sol, carg){
  const t = causa.toLowerCase();
  const faltantes = sol - carg;
  const sigSem = 'la próxima semana';

  // Detect cause type by keywords
  let tipo = 'generico';
  if(t.includes('conductor') && (t.includes('cancel') || t.includes('no llegó') || t.includes('no se present'))) tipo='conductor';
  else if(t.includes('disponib') && (t.includes('flota') || t.includes('vehículo') || t.includes('vehiculo') || t.includes('plaza'))) tipo='disponibilidad';
  else if(t.includes('mecáni') || t.includes('mecani') || t.includes('falla') || t.includes('daño') || t.includes('avería')) tipo='mecanica';
  else if(t.includes('campo') && (t.includes('cerr') || t.includes('paro') || t.includes('suspendió') || t.includes('mantenimiento'))) tipo='campo';
  else if(t.includes('nominó tarde') || t.includes('nominacion tarde') || t.includes('último momento') || t.includes('no hubo tiempo')) tipo='nominacion_tarde';
  else if(t.includes('client') && (t.includes('canceló') || t.includes('cancelo') || t.includes('no confirmó') || t.includes('no confirmo'))) tipo='cliente_cancelo';
  else if(t.includes('flete') || t.includes('tarifa') || t.includes('precio')) tipo='flete';
  else if(t.includes('cupo') || t.includes('terminal') || t.includes('restricción') || t.includes('restriccion')) tipo='cupo';
  else if(t.includes('document') || t.includes('permiso') || t.includes('habilitac')) tipo='documentos';
  else if(t.includes('vía') || t.includes('via') || t.includes('orden público') || t.includes('bloqueo')) tipo='via';

  // Build first sentence from original causa (cleaned up)
  let limpia = causa.trim()
    .replace(/^[a-z]/, m => m.toUpperCase())
    .replace(/no se logró /gi, '')
    .replace(/en consecuión /gi, '')
    .replace(/en consecución /gi, '')
    .replace(/se procedió a /gi, '')
    .replace(/se realizó /gi, 'se realizó ')
    .replace(/\s+/g, ' ').trim();
  if(!limpia.endsWith('.')) limpia += '.';

  // Build second sentence (recommendation) by type
  const recom = {
    conductor: `Se debe garantizar conductores de respaldo disponibles para rutas de alto volumen.`,
    disponibilidad: `Se recomienda vincular un proveedor adicional que cubra esta ruta cuando falle el principal.`,
    mecanica: `Se debe revisar el plan de mantenimiento preventivo para reducir novedades en ruta.`,
    campo: `Se debe establecer comunicación directa con el cliente para anticipar cierres y reprogramar con tiempo.`,
    nominacion_tarde: `Se debe acordar con el cliente un tiempo mínimo de nominación para garantizar posicionamiento de flota.`,
    cliente_cancelo: `Se debe establecer un protocolo de confirmación con el cliente mínimo 24 horas antes del servicio.`,
    flete: `Se debe revisar la estructura tarifaria de esta ruta y evaluar alternativas de cobertura.`,
    cupo: `Se debe coordinar con el cliente los horarios de recepción para evitar restricciones de cupo.`,
    documentos: `Se debe revisar el estado de documentación de los vehículos asignados a esta ruta.`,
    via: `Se debe activar ruta alterna y comunicar al cliente el impacto en tiempos de entrega.`,
    generico: `Se debe investigar la causa raíz y tomar acciones correctivas para ${sigSem}.`
  }[tipo];

  return `${limpia} ${recom}`;
}

/* ════════════════════════════════════════════════════════
   ACTIONS GENERATOR — rules-based, no API needed
════════════════════════════════════════════════════════ */
function generateActionsRules(wk, cargoType){
  const allWks = cargoType==='liq' ? DATA_LIQ : DATA_SEC;
  const wkIdx = allWks.findIndex(w=>w.id===wk.id);
  const nextWk = wkIdx>=0&&wkIdx<allWks.length-1 ? allWks[wkIdx+1] : null;
  const nextS = nextWk ? ws(nextWk) : null;
  const isLast = wkIdx === allWks.length-1;

  const actions = [];

  // 1. Critical routes (0%)
  const crits = wk.rows.filter(r=>r.sol>0&&rp(r)===0);
  crits.forEach(r=>{
    // Smart status: if next week same route improved → ejecutado
    let status = 'urgente';
    if(nextWk){
      const nextRoute = nextWk.rows.find(nr=>nr.c===r.c&&nr.f===r.f);
      if(nextRoute&&rp(nextRoute)>=95) status='ejecutado';
      else if(nextRoute&&rp(nextRoute)>0) status='ejecucion';
    }
    actions.push({
      txt:`Gestionar con ${r.c} los ${r.sol} viaje(s) pendientes de campo ${r.f} y confirmar ejecución en ${nextWk?nextWk.label:'la próxima semana'}.`,
      resp:'Líder Operaciones',
      date: nextWk ? nextWk.rango.split(' al ')[0]+' próx.' : 'Próx. semana',
      status
    });
  });

  // 2. Routes with written causa → generate matching action
  wk.rows.filter(r=>r.causa&&r.causa.trim()&&r.sol>0&&rp(r)<100).forEach(r=>{
    const t = r.causa.toLowerCase();
    let txt='';
    let status = isLast ? 'urgente' : (nextS&&nextS.pct>=95?'ejecutado':'ejecucion');

    if(t.includes('conductor')&&(t.includes('cancel')||t.includes('no llegó'))) {
      txt=`Garantizar conductor de respaldo para ruta ${r.f} (${r.c}) antes del cierre de ${nextWk?nextWk.label:'la próxima semana'}.`;
    } else if(t.includes('disponib')||(t.includes('flete')&&t.includes('plaza'))) {
      txt=`Vincular proveedor alternativo para cobertura de ${r.c} / ${r.f} cuando falle flota principal.`;
    } else if(t.includes('mecáni')||t.includes('falla')||t.includes('daño')) {
      txt=`Revisar estado mecánico de vehículos asignados a ruta ${r.f} (${r.c}) antes de ${nextWk?nextWk.label:'la próxima semana'}.`;
    } else if(t.includes('campo')&&(t.includes('cerr')||t.includes('mantenimiento'))) {
      txt=`Confirmar con ${r.c} fecha de reapertura de campo ${r.f} y reprogramar nominación.`;
    } else if(t.includes('nominó tarde')||t.includes('último momento')) {
      txt=`Acordar con ${r.c} tiempo mínimo de nominación — mínimo 48h de anticipación.`;
    } else if(t.includes('cupo')||t.includes('terminal')) {
      txt=`Coordinar con ${r.c} horarios de recepción en terminal para evitar restricciones de cupo.`;
    } else {
      txt=`Hacer seguimiento a incumplimiento de ${r.c} / ${r.f} y confirmar normalización en ${nextWk?nextWk.label:'la próxima semana'}.`;
    }
    if(txt) actions.push({txt, resp:'Líder Operaciones', date: nextWk?nextWk.rango.split(' al ')[0]+' próx.':'Próx. semana', status});
  });

  // 3. Partial routes without causa — generic follow-up
  wk.rows.filter(r=>r.sol>0&&rp(r)>0&&rp(r)<70&&(!r.causa||!r.causa.trim())).forEach(r=>{
    let status = isLast ? 'pendiente' : (nextS&&nextS.pct>=95?'ejecutado':'pendiente');
    actions.push({
      txt:`Revisar capacidad de flota para ${r.c} / ${r.f} — cumplimiento del ${rp(r)}% requiere atención.`,
      resp:'Coord. Operaciones',
      date: nextWk?nextWk.rango.split(' al ')[0]+' próx.':'Próx. semana',
      status
    });
  });

  // 4. Recurrence check: same route failed last 2+ weeks
  if(wkIdx>=1){
    const prevWk = allWks[wkIdx-1];
    wk.rows.filter(r=>r.sol>0&&rp(r)<95).forEach(r=>{
      const prevRoute = prevWk.rows.find(pr=>pr.c===r.c&&pr.f===r.f&&pr.sol>0&&rp(pr)<95);
      if(prevRoute&&!actions.find(a=>a.txt.includes(r.c)&&a.txt.includes(r.f))){
        actions.push({
          txt:`${r.c} / ${r.f} lleva 2 o más semanas con incumplimiento. Escalar a gerencia y revisar acuerdo de servicio.`,
          resp:'Líder Operaciones',
          date:'Esta semana',
          status:'urgente'
        });
      }
    });
  }

  return actions.slice(0,5); // Max 5 actions
}

async function rewriteCausa(causa, cliente, campo, pct, sol, carg){
  const key = getApiKey();
  // Without API key — use rules-based rewriter
  if(!key) return rewriteCausaRules(causa, cliente, campo, pct, sol, carg);
  const prompt = `Eres el líder de operaciones de INLOP presentando resultados a los dueños de la empresa.

Un coordinador escribió esta causa de incumplimiento:
"${causa}"

Contexto: Cliente ${cliente}, campo/ruta ${campo}. ${carg} de ${sol} viajes cargados (${pct}%).

Reescríbela en máximo 2 oraciones como la diría el líder en una reunión: lenguaje natural, directo, sin palabras rebuscadas. Primera oración explica qué pasó. Segunda dice qué se debe hacer. Solo el texto, sin comillas ni etiquetas.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:120,messages:[{role:'user',content:prompt}]})
    });
    if(!resp.ok) return causa;
    const data = await resp.json();
    return data.content[0].text.trim();
  } catch(e){ return causa; }
}

async function buildCausesFromExcel(){
  const apiKey = getApiKey();
  const KCA = 'inlop_excauses_v12';
  // Load persisted rewritten causes
  try{ const saved=localStorage.getItem(KCA); if(saved){ const parsed=JSON.parse(saved); Object.assign(aiCausesData,parsed); } }catch(e){}

  for(const ct of ['liq','sec']){
    const wks = ct==='liq'?DATA_LIQ:DATA_SEC;
    for(const wk of wks){
      const key=`${ct}_${wk.id}`;
      // Skip if already built
      if(aiCausesData[key]&&aiCausesData[key].length) continue;

      const causes=[];

      // Rows with explicit causa text — rewrite with AI
      const withCausa = wk.rows.filter(r=>{
        // Fix: check all possible positions for causa
        // The causa column might be read as undefined if row array is shorter
        const rawCausa = r.causa||'';
        return rawCausa.trim().length>0;
      });

      for(const r of withCausa){
        const p=rp(r);
        const type=p===0?'crit':p<95?'warn':'ok';
        const icon=type==='crit'?'🚨':type==='warn'?'⚠️':'✅';
        // Rewrite causa with AI if available
        const body = apiKey
          ? await rewriteCausa(r.causa.trim(), r.c, r.f, p, r.sol, r.carg)
          : r.causa.trim();
        causes.push({
          type, icon,
          title:`${r.c} — ${r.f}`,
          sub:`${p}% · ${r.sol-r.carg>0?r.sol-r.carg+' viaje(s) faltante(s)':r.carg+' viajes ejecutados'}`,
          body
        });
      }

      // Rows with incumplimiento but NO causa written
      wk.rows.filter(r=>r.sol>0&&rp(r)<100&&(!r.causa||!r.causa.trim())).forEach(r=>{
        const p=rp(r);
        const type=p===0?'crit':'warn';
        causes.push({
          type, icon:type==='crit'?'🚨':'⚠️',
          title:`${r.c} — ${r.f}`,
          sub:`${p}% · ${r.sol-r.carg} viaje(s) faltante(s)`,
          body:`${r.sol-r.carg} viaje(s) sin ejecutar en ruta ${r.o||''}${r.d?' → '+r.d:''}. Causa pendiente de registrar por el coordinador.`
        });
      });

      // Good performers block
      const perfects=wk.rows.filter(r=>r.sol>0&&rp(r)===100);
      if(perfects.length){
        const clients=[...new Set(perfects.map(r=>r.c))];
        causes.push({
          type:'ok', icon:'✅',
          title:`${clients.length} cliente(s) al 100%`,
          sub:`${perfects.reduce((a,r)=>a+r.carg,0)} viajes ejecutados sin novedad`,
          body:`Operación sin novedades: ${clients.join(', ')}. Todos los viajes nominados fueron ejecutados.`
        });
      }

      if(causes.length){
        aiCausesData[key]=causes;
      }

      // Generate actions from rules
      if(!actions[ct]) actions[ct]={};
      if(!actions[ct][wk.id]||!actions[ct][wk.id].length){
        const generated = generateActionsRules(wk, ct);
        if(generated.length) actions[ct][wk.id] = generated;
      }
    }
  }

  // Persist to localStorage
  try{ localStorage.setItem(KCA,JSON.stringify(aiCausesData)); }catch(e){}
  saveLocal();
  renderCausas();
  renderActions();
  toast('✓ Causas y acciones generadas desde Excel.','ok');
}

/* TOAST */

/* INIT */

// Generate compact WhatsApp message (both lines, <280 chars)
function generateWhatsAppMessage() {
  if (!wkId) {
    toast('Selecciona una semana primero', 'err');
    return;
  }
  
  const liqWk = DATA_LIQ.find(w => w.id === wkId);
  const secWk = DATA_SEC.find(w => w.id === wkId);
  
  if (!liqWk && !secWk) {
    toast('No hay datos para esta semana', 'err');
    return;
  }
  
  const rango = (liqWk || secWk).rango;
  
  // Helper: calculate KPIs
  function getKPIs(wk) {
    if (!wk) return null;
    const sol = wk.sol || wk.rows.reduce((a,r)=>a+r.sol,0);
    const carg = wk.carg || wk.rows.reduce((a,r)=>a+r.carg,0);
    const pct = sol > 0 ? Math.round((carg/sol)*10)/10 : 0;
    const bal = carg - sol;
    return {sol, carg, pct, bal};
  }
  
  let msg = `*INLOP - Reporte Operativo ${wkId}*
${rango}

`;
  
  // CARGA LIQUIDA
  if (liqWk) {
    const k = getKPIs(liqWk);
    const status = k.pct >= 95 ? 'META SUPERADA' : k.pct >= 70 ? 'ALERTA' : 'CRITICO';
    msg += `*CARGA LIQUIDA*
Cumplimiento: *${k.pct}%* (${status})
`;
    msg += `Solicitados: ${k.sol} | Cargados: ${k.carg}`;
    if (k.bal !== 0) msg += ` | Balance: ${k.bal > 0 ? '+' : ''}${k.bal}`;
    msg += `

`;
  }
  
  // CARGA SECA
  if (secWk) {
    const k = getKPIs(secWk);
    const status = k.pct >= 95 ? 'META SUPERADA' : k.pct >= 70 ? 'ALERTA' : 'CRITICO';
    msg += `*CARGA SECA*
Cumplimiento: *${k.pct}%* (${status})
`;
    msg += `Solicitados: ${k.sol} | Cargados: ${k.carg}`;
    if (k.bal !== 0) msg += ` | Balance: ${k.bal > 0 ? '+' : ''}${k.bal}`;
    msg += `

`;
  }
  
  msg += `Dashboard completo:
https://inlop-dash.netlify.app/

`;
  msg += `_Generado automaticamente - INLOP Operations_`;
  
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}


/* ══ SYNC desde Supabase — igual que financiero.html ══════════════
   window.opsLoadFromSupabase() es el puente para el botón Sincronizar
   ══════════════════════════════════════════════════════════════════ */
window.opsLoadFromSupabase = async function() {
  return await loadFromSupabase();
};

document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar pantalla vacía mientras carga (igual que fhEmpty en financiero)
  const emptyEl = document.getElementById('opsEmpty');
  const shellEl = document.getElementById('opsShell');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (shellEl) shellEl.style.display = 'none';

  // Cargar desde Supabase — única fuente de verdad, igual que financiero
  if (window.location.protocol !== 'file:') {
    await loadFromSupabase();
  }

  // Actualizar stats del portal
  setTimeout(function(){
    if(typeof window.updatePortalStats === 'function'){
      window.updatePortalStats();
    }
  }, 1500);

  const ov=document.getElementById('dragOv');let cnt=0;
  document.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){cnt++;ov.classList.add('show')}});
  document.addEventListener('dragleave',()=>{cnt--;if(cnt<=0){cnt=0;ov.classList.remove('show')}});
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',e=>{
    e.preventDefault();cnt=0;ov.classList.remove('show');
    const f=e.dataTransfer.files[0];
    if(!f||!f.name.match(/\.(xlsx|xls)$/i)){toast('Solo archivos .xlsx o .xls','err');return}
    const r=new FileReader();r.onload=ev=>{try{parseWB(XLSX.read(ev.target.result,{type:'binary'}),f.name)}catch(er){toast('Error: '+er.message,'err')}};r.readAsBinaryString(f);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeApiKeyModal();closePinModal()}});
  checkAdminSession();

  // PWA + AI init
  setupPWA();
  loadAiCache();
  aiKey=getApiKey();
  // Restore all-weeks AI causes from cache
  if(aiCache){
    Object.keys(aiCache).forEach(k=>{
      const m=k.match(/^inlop_allcauses_(liq|sec)_v12_(.+)$/);
      if(m&&aiCache[k]){
        const [,ct,wk]=m;
        if(aiCache[k].causas) aiCausesData[`${ct}_${wk}`]=aiCache[k].causas;
        if(aiCache[k].acciones){
          if(!actions[ct])actions[ct]={};
          if(!actions[ct][wk]||!actions[ct][wk].length) actions[ct][wk]=aiCache[k].acciones;
        }
      }
    });
  }
  updateAiStatus();

  // Auto-generate if key exists and no cache
  if(aiKey){
    const ck=getCacheKey();
    if(aiCache[ck]){
      applyAiResults(aiCache[ck]);
      toast('Análisis IA restaurado desde caché.','info');
    }
  }
});

/* ══ EXPORTS — exponer al scope global para app.js / portal ══════
   app.js accede a estas variables/funciones vía window.* o directamente
   cuando están en el mismo scope (mismo index.html).
   ══════════════════════════════════════════════════════════════════ */
// Exponer DATA_LIQ / DATA_SEC al portal stats
Object.defineProperty(window, 'DATA_LIQ', { get: ()=>DATA_LIQ, configurable:true });
Object.defineProperty(window, 'DATA_SEC', { get: ()=>DATA_SEC, configurable:true });
// Exponer ws() para cálculo de KPIs en el portal
window._opsWs = ws;

/* ══════════════════════════════════════════════════════════════════
   REDISEÑO v2.0 — Sidebar · Filtros · Mes · Presentation Mode
   ══════════════════════════════════════════════════════════════════ */

/* ── DATOS MENSUALES ─────────────────────────────────────────────
   MONTH_DATA[mes] = { liq: {rows, total}, sec: {rows, total} }
   Llenado en parseWB cuando el Excel tiene hojas CONSOLIDADO.
   ──────────────────────────────────────────────────────────────── */
let MONTH_DATA = {};
let activeMes = '';
let activeCliente = '';

/* ── SIDEBAR ─────────────────────────────────────────────────────── */
let _sbCollapsed = false;

function toggleSidebar() {
  const sb = document.getElementById('opsSidebar');
  const ov = document.getElementById('sbOverlay');
  if (!sb) return;
  if (window.innerWidth <= 900) {
    sb.classList.toggle('mobile-open');
    ov && ov.classList.toggle('active');
  } else {
    collapseToggle();
  }
}

function closeSidebar() {
  const sb = document.getElementById('opsSidebar');
  const ov = document.getElementById('sbOverlay');
  if (sb) sb.classList.remove('mobile-open');
  if (ov) ov.classList.remove('active');
}

function collapseToggle() {
  const sb = document.getElementById('opsSidebar');
  if (!sb) return;
  _sbCollapsed = !_sbCollapsed;
  sb.classList.toggle('collapsed', _sbCollapsed);
  try { localStorage.setItem('inlop_sb_collapsed', _sbCollapsed ? '1' : '0'); } catch(e) {}
}

/* ── showTabSb — versión sidebar (llama al showTab original) ─── */
function showTabSb(id) {
  // Update sidebar active state
  document.querySelectorAll('.sb-item[id^="sb-"]').forEach(el => el.classList.remove('active'));
  const sbEl = document.getElementById('sb-' + id);
  if (sbEl) sbEl.classList.add('active');

  // Show tab content — reutiliza lógica existente
  if (id === 'mes') {
    showMesView();
  } else {
    showTab(id);
  }

  // Close mobile sidebar
  if (window.innerWidth <= 900) closeSidebar();
}

/* ── CARGO TOGGLE v2 — sincroniza clases visuales ──────────────── */
// Patch applied after initial definition via wrapper at bottom of file

/* ── PRESENTATION MODE ───────────────────────────────────────────── */
let _presentMode = false;

function togglePresentMode() {
  _presentMode = !_presentMode;
  document.body.classList.toggle('present-mode', _presentMode);
  const btn = document.getElementById('presentBtn');
  if (btn) {
    btn.innerHTML = _presentMode
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l12 12M14 2L2 14"/></svg> Salir'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="14" height="9" rx="1.5"/><path d="M6 12l1 2M10 12l-1 2M5 14h6"/></svg> Presentar';
  }
  if (_presentMode && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!_presentMode && document.exitFullscreen && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

// Exit present mode on ESC (add to existing keydown handler)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _presentMode) togglePresentMode();
});

/* ── FILTRO CLIENTE ──────────────────────────────────────────────── */
function populateClientFilter() {
  const sel = document.getElementById('clientSelect');
  if (!sel) return;
  const current = activeCliente;
  sel.innerHTML = '<option value="">Todos los clientes</option>';
  const wks = WKS ? WKS() : [];
  const clients = new Set();
  wks.forEach(w => {
    (w.rows || []).forEach(r => {
      if (r.name) clients.add(r.name);
    });
  });
  Array.from(clients).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function selCliente(val) {
  activeCliente = val;
  // Re-render table with client filter
  if (typeof renderTable === 'function') {
    // Patch flt to include client
    window._clientFilter = val;
    renderTable();
  }
}

/* Patch renderTable to apply client filter */
const _origRenderTable = window.renderTable || function(){};
window.renderTable = function() {
  _origRenderTable();
  if (window._clientFilter) {
    // Hide rows that don't match
    const tbody = document.getElementById('tBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-cli]').forEach(tr => {
      const cli = tr.getAttribute('data-cli') || '';
      tr.style.display = (!window._clientFilter || cli.includes(window._clientFilter)) ? '' : 'none';
    });
  }
};

/* ── FILTRO MES ──────────────────────────────────────────────────── */
function populateMonthFilter() {
  const sel = document.getElementById('monthSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar mes —</option>';
  const meses = Object.keys(MONTH_DATA);
  if (!meses.length) return;
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    sel.appendChild(opt);
  });
}

function selMes(val) {
  activeMes = val;
  if (val) {
    showMesView();
    // Update sidebar active
    document.querySelectorAll('.sb-item[id^="sb-"]').forEach(el => el.classList.remove('active'));
    const sbMes = document.getElementById('sb-mes');
    if (sbMes) sbMes.classList.add('active');
  }
}

function showMesView() {
  // Hide all tab contents, show tc-mes
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('show'));
  const tcMes = document.getElementById('tc-mes');
  if (tcMes) tcMes.classList.add('show');
  if (activeMes) renderMesView(activeMes);
  else {
    // Show most recent month with data
    const meses = Object.keys(MONTH_DATA);
    if (meses.length) renderMesView(meses[meses.length - 1]);
  }
}

function renderMesView(mes) {
  activeMes = mes;
  const data = MONTH_DATA[mes];
  if (!data) {
    document.getElementById('mesLabel').textContent = 'Sin datos para ' + mes;
    return;
  }

  const modulo = cargo === 'liq' ? data.liq : data.sec;
  if (!modulo) return;

  const mesCapitalized = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
  document.getElementById('mesLabel').textContent = mesCapitalized + ' 2026';

  const total = modulo.total || {};
  const sol = total.sol || 0;
  const carg = total.carg || 0;
  const bal = carg - sol;
  const pct = sol > 0 ? Math.round(carg / sol * 100 * 10) / 10 : 0;

  const color = pct >= 95 ? 'var(--green)' : pct >= 80 ? 'var(--amber)' : 'var(--danger)';
  const balColor = bal >= 0 ? 'var(--green)' : 'var(--danger)';

  document.getElementById('mes-sol').textContent = sol;
  document.getElementById('mes-sol').style.color = 'var(--blue)';
  document.getElementById('mes-carg').textContent = carg;
  document.getElementById('mes-carg').style.color = 'var(--green)';
  document.getElementById('mes-pct').textContent = pct + '%';
  document.getElementById('mes-pct').style.color = color;
  document.getElementById('mes-bal').textContent = (bal >= 0 ? '+' : '') + bal;
  document.getElementById('mes-bal').style.color = balColor;

  // Table
  const tbody = document.getElementById('mesTableBody');
  if (!tbody) return;
  const rows = modulo.rows || [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--w4);padding:24px">Sin datos de clientes para este mes</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const p = r.sol > 0 ? Math.round(r.carg / r.sol * 100) : 0;
    const c = p >= 95 ? '#00d97e' : p >= 80 ? '#f59e0b' : '#ef4444';
    const b = r.carg - r.sol;
    const bStr = (b >= 0 ? '+' : '') + b;
    return `<tr>
      <td style="font-weight:500">${r.name}</td>
      <td style="text-align:right;color:var(--w3)">${r.sol}</td>
      <td style="text-align:right;color:var(--green)">${r.carg}</td>
      <td style="text-align:right;color:${b < 0 ? 'var(--danger)' : 'var(--w3)'}">${bStr}</td>
      <td>
        <div class="month-pct-bar">
          <div class="month-pct-track">
            <div class="month-pct-fill" style="width:${Math.min(p,100)}%;background:${c}"></div>
          </div>
          <span style="color:${c};font-weight:600;font-size:12px;min-width:38px">${p}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── PARSEAR HOJAS CONSOLIDADO desde parseWB ─────────────────────
   Se llama al final de parseWB() vía hook.
   ──────────────────────────────────────────────────────────────── */
function parseConsolidadoSheets(wb) {
  MONTH_DATA = {};
  const MES_MAP = {
    'ENERO': 'Enero', 'FEBRERO': 'Febrero', 'MARZO': 'Marzo',
    'ABRIL': 'Abril', 'MAYO': 'Mayo', 'JUNIO': 'Junio',
    'JULIO': 'Julio', 'AGOSTO': 'Agosto', 'SEPTIEMBRE': 'Septiembre',
    'OCTUBRE': 'Octubre', 'NOVIEMBRE': 'Noviembre', 'DICIEMBRE': 'Diciembre'
  };

  wb.SheetNames.forEach(sn => {
    const upper = sn.toUpperCase();
    const mesKey = Object.keys(MES_MAP).find(k => upper.includes(k));
    if (!mesKey || !upper.includes('CONSOLIDADO')) return;

    const mesName = MES_MAP[mesKey];
    const ws = wb.Sheets[sn];
    if (!ws) return;

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!data || data.length < 5) return;

    // Find module sections (LIQ starts at row 3/idx2, SECA starts when MÓDULO CARGA SECA found)
    let secStartIdx = -1;
    for (let i = 0; i < data.length; i++) {
      const cell = String(data[i][0] || '').toUpperCase();
      if (cell.includes('MÓDULO CARGA SECA') || cell.includes('MODULO CARGA SECA')) {
        secStartIdx = i;
        break;
      }
    }

    // Col indices (0-based): sol.mes=19, carg.mes=20, bal.mes=21, %mes=22
    // But ABRIL has different layout — check col headers row
    let solCol = 19, cargCol = 20, balCol = 21, pctCol = 22;

    // Find header row (row with 'Sol.' and 'Mes')
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      for (let c = 15; c < 25; c++) {
        const v = String(row[c] || '').toLowerCase();
        if (v.includes('sol') && v.includes('mes')) { solCol = c; }
        if (v.includes('carg') && v.includes('mes')) { cargCol = c; }
        if (v.includes('bal') && v.includes('mes')) { balCol = c; }
        if (v.includes('%') && v.includes('mes')) { pctCol = c; }
      }
    }

    function parseModule(startIdx, endIdx) {
      const rows = [];
      let total = { sol: 0, carg: 0 };
      // Data starts 2 rows after header (header + sub-header)
      for (let i = startIdx + 2; i < endIdx; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;
        const name = String(row[0]).trim();
        if (!name || name.toUpperCase().includes('TOTAL')) {
          if (name.toUpperCase().includes('TOTAL')) {
            total.sol = Number(row[solCol]) || 0;
            total.carg = Number(row[cargCol]) || 0;
          }
          continue;
        }
        const sol = Number(row[solCol]) || 0;
        const carg = Number(row[cargCol]) || 0;
        if (sol === 0 && carg === 0) continue;
        // Aggregate by client name
        const existing = rows.find(r => r.name === name);
        if (existing) { existing.sol += sol; existing.carg += carg; }
        else rows.push({ name, sol, carg });
      }
      // Recalculate total if not found in sheet
      if (!total.sol) {
        rows.forEach(r => { total.sol += r.sol; total.carg += r.carg; });
      }
      return { rows, total };
    }

    const liqEnd = secStartIdx > 0 ? secStartIdx : data.length;
    const liqData = parseModule(2, liqEnd);
    const secData = secStartIdx > 0 ? parseModule(secStartIdx + 2, data.length) : { rows: [], total: {} };

    if (!MONTH_DATA[mesName]) MONTH_DATA[mesName] = {};
    MONTH_DATA[mesName].liq = liqData;
    MONTH_DATA[mesName].sec = secData;
  });

  // Update month filter dropdown
  populateMonthFilter();
  console.log('[INLOP] Meses cargados:', Object.keys(MONTH_DATA));
}

/* ── HOOK: interceptar parseWB para llamar parseConsolidadoSheets ─ */
const _origParseWB = window.parseWB;
if (typeof parseWB !== 'undefined') {
  // Wrap via document event since parseWB is in same scope
  const _parseSave = parseWB;
}
// We hook via the DOMContentLoaded post-init, but parseWB is synchronous
// so we patch it here after it's defined — use a flag
window._wbRef = null;
document.addEventListener('inlop:wb-parsed', function(e) {
  if (e.detail && e.detail.wb) parseConsolidadoSheets(e.detail.wb);
});

/* ── INIT SIDEBAR STATE ──────────────────────────────────────────── */
(function initSidebarState() {
  try {
    const collapsed = localStorage.getItem('inlop_sb_collapsed') === '1';
    if (collapsed) {
      const sb = document.getElementById('opsSidebar');
      if (sb) { sb.classList.add('collapsed'); _sbCollapsed = true; }
    }
  } catch(e) {}

  // Set initial active sidebar item based on current tab
  const activeTab = document.querySelector('.tb.on');
  if (activeTab) {
    const tabId = activeTab.id.replace('tab-', '');
    const sbItem = document.getElementById('sb-' + tabId);
    if (sbItem) {
      document.querySelectorAll('.sb-item[id^="sb-"]').forEach(el => el.classList.remove('active'));
      sbItem.classList.add('active');
    }
  }

  // Populate client filter once data loads
  setTimeout(populateClientFilter, 2000);
})();

