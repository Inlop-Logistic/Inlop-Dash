/* ================================================================
   app.js — INLOP Business Intelligence
   Script global: navegación, portal stats, exportaciones OTIF

   DEPENDENCIAS (todas cargadas antes):
     · utils.js        → toast
     · supabase.js     → loadFromSupabase, loadOtifFromSupabase
     · operaciones.js  → refresh, ws (via window._opsWs)
     · otif.js         → otifInit, window._oOTIF, ohSetDataFromCloud

   DEFINE FUNCIONES GLOBALES:
     · abrirVista(v)        — navegación entre vistas
     · volverPortal()       — regresa al portal
     · updatePortalStats()  — actualiza KPIs del portal
     · ohBuildReportData()  — estructura datos para reporte OTIF
     · ohExportPDF()        — exportar PDF/print reporte OTIF
     · ohExportWord()       — exportar Word reporte OTIF
     · ohGenerarBodyHTML()  — genera HTML del cuerpo del reporte
   ================================================================ */


// ── TEST DE CARGA ──
console.log('[INLOP BI] Script portal cargado OK');
console.log('[INLOP BI] ohExportPDF:', typeof ohExportPDF);
console.log('[INLOP BI] ohExportWord:', typeof ohExportWord);
console.log('[INLOP BI] ohBuildReportData:', typeof ohBuildReportData);
console.log('[INLOP BI] ohGenerarHTMLPDF:', typeof ohGenerarHTMLPDF);

function abrirVista(v){
  ['portal','ops','otif','financiero'].forEach(function(id){
    var el=document.getElementById('view-'+id);
    if(el) el.style.display = id===v?'block':'none';
  });
  // Hide ops fixed overlays when leaving ops view
  if(v !== 'ops') {
    var opsEmpty = document.getElementById('opsEmpty');
    if(opsEmpty) opsEmpty.style.display = 'none';
  }
  document.getElementById('backBtn').classList.add('visible');
  window.scrollTo(0,0);
  
  // Guardar vista activa en localStorage
  try { localStorage.setItem('inlop_last_view', v); } catch(e){}
  
  if(v==='ops'){
    // Show opsShell if data is loaded, otherwise show opsEmpty
    var opsShell = document.getElementById('opsShell');
    var opsEmpty = document.getElementById('opsEmpty');
    var hasOpsData = (typeof WKS === 'function' && WKS() && WKS().length > 0) ||
                     (typeof DATA_LIQ !== 'undefined' && window.DATA_LIQ && window.DATA_LIQ.length > 0);
    if (opsShell && hasOpsData) {
      opsShell.style.display = '';
      if (opsEmpty) opsEmpty.style.display = 'none';
    } else if (opsEmpty && !hasOpsData) {
      opsEmpty.style.display = 'flex';
      if (opsShell) opsShell.style.display = 'none';
      // Trigger Supabase load
      if (typeof window.opsLoadFromSupabase === 'function') {
        window.opsLoadFromSupabase();
      }
    }
    setTimeout(function(){
      if(typeof refresh==='function') refresh();
      window.dispatchEvent(new Event('resize'));
    },200);
  }
  if(v==='otif'){
    var hasData = (typeof window.oData !== 'undefined' && window.oData && Object.keys(window.oData||{}).length > 0);
    
    if(hasData){
      // Show content elements explicitly
      var elFilt = document.getElementById('ohFilters');
      var elNoData = document.getElementById('ohNoData');
      var elContent = document.getElementById('ohContent');
      if(elFilt) elFilt.classList.add('visible');
      if(elNoData) elNoData.style.display = 'none';
      if(elContent) elContent.style.display = 'block';
      
      // Re-render after view is visible (gives Chart.js real canvas dimensions)
      setTimeout(function(){
        if(typeof ohRender === 'function') ohRender();
        setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 100);
      }, 100);
    } else {
      // No data — trigger Supabase load
      if(typeof loadOtifFromSupabase === 'function'){
        loadOtifFromSupabase().catch(function(e){
          console.error('[OTIF] Error cargando:', e);
        });
      }
    }
    
    // Always init admin state
    setTimeout(function(){ if(typeof otifInit==='function') otifInit(); }, 50);
  }
  if(v==='financiero'){
    var frame = document.getElementById('financieroFrame');
    var loading = document.getElementById('financieroLoading');
    if(frame){
      if(!frame.getAttribute('data-loaded')){
        // Primera vez: mostrar loading y cargar
        if(loading) loading.style.display = 'flex';
        console.log('💰 [FINANCIERO] Cargando iframe por primera vez...');
        frame.src = 'financiero.html';
        frame.setAttribute('data-loaded', '1');
      } else {
        // Ya cargado: ocultar loading inmediatamente
        if(loading) loading.style.display = 'none';
        console.log('💰 [FINANCIERO] iframe ya cargado');
      }
    }
  }
}
// Override the early stub with real functions
window.abrirVista = abrirVista;
window.volverPortal = volverPortal;

// Handle any click that happened before app.js loaded
if(window._pendingVista && window._pendingVista !== 'portal'){
  var _pv = window._pendingVista;
  window._pendingVista = null;
  setTimeout(function(){ abrirVista(_pv); }, 100);
}
function volverPortal(){
  ['ops','otif','financiero'].forEach(function(id){
    var el=document.getElementById('view-'+id);
    if(el) el.style.display='none';
  });
  document.getElementById('view-portal').style.display='block';
  document.getElementById('backBtn').classList.remove('visible');
  window.scrollTo(0,0);
  
  // Limpiar vista guardada al volver al portal
  try { localStorage.removeItem('inlop_last_view'); } catch(e){}
  
  // Actualizar stats del portal con los datos cargados
  if(typeof window.updatePortalStats === 'function'){
    window.updatePortalStats();
  }
}

// ═══════════════════════════════════════════════════════
// PORTAL STATS — Actualiza los 4 indicadores con datos reales
// Lee de window.oData (OTIF) y window.DATA_LIQ/DATA_SEC (Operaciones)
// ═══════════════════════════════════════════════════════
window.updatePortalStats = function(){
  try {
    // 1) OTIF Global
    var otifEl = document.getElementById('portal-otif-val');
    if(otifEl){
      try {
        var oD = window.oData;
        if(oD && typeof ohTotales === 'function'){
          var keys = Object.keys(oD).filter(function(k){return k !== '_causasGlobal';});
          if(keys.length > 0){
            // Construir objeto solo con clientes válidos
            var validData = {};
            keys.forEach(function(k){ validData[k] = oD[k]; });
            var tot = ohTotales(validData);
            var entregados = tot.v - (tot.transito || 0);
            if(entregados > 0){
              var otifPct = (tot.otif / entregados * 100);
              var pctTxt = otifPct.toFixed(1) + '%';
              otifEl.textContent = pctTxt;
              // Color dinámico
              if(otifPct >= 90){
                otifEl.style.color = '#00d97e';
              } else if(otifPct >= 70){
                otifEl.style.color = '#E8A020';
              } else {
                otifEl.style.color = '#ef4444';
              }
            }
          }
        }
      } catch(e){ console.error('Portal OTIF stat:', e); }
    }
    
    // 2) Viajes registrados (cargados de la última semana en operaciones)
    var viajesEl = document.getElementById('portal-viajes-val');
    if(viajesEl){
      try {
        var liqArr = (window.DATA_LIQ || []);
        var secArr = (window.DATA_SEC || []);
        var liqCur = liqArr.length > 0 ? liqArr[liqArr.length - 1] : null;
        var secCur = secArr.length > 0 ? secArr[secArr.length - 1] : null;
        if(liqCur || secCur){
          var liqCarg = 0, secCarg = 0;
          if(liqCur && typeof ws === 'function'){ liqCarg = ws(liqCur).carg || 0; }
          if(secCur && typeof ws === 'function'){ secCarg = ws(secCur).carg || 0; }
          var totalCarg = liqCarg + secCarg;
          if(totalCarg > 0){
            viajesEl.textContent = totalCarg;
          }
        }
      } catch(e){ console.error('Portal viajes stat:', e); }
    }
    
    // 3) Clientes activos (todos los de la base OTIF)
    var clientesEl = document.getElementById('portal-clientes-val');
    if(clientesEl){
      try {
        var oD2 = window.oData;
        if(oD2){
          var nClientes = Object.keys(oD2).filter(function(k){return k !== '_causasGlobal';}).length;
          if(nClientes > 0){
            clientesEl.textContent = nClientes;
          }
        }
      } catch(e){ console.error('Portal clientes stat:', e); }
    }
    
    // 4) Semana en curso
    var semanaEl = document.getElementById('portal-semana-val');
    if(semanaEl){
      try {
        var liqArr2 = (window.DATA_LIQ || []);
        var secArr2 = (window.DATA_SEC || []);
        var lastWk = null;
        if(liqArr2.length > 0) lastWk = liqArr2[liqArr2.length - 1];
        if(!lastWk && secArr2.length > 0) lastWk = secArr2[secArr2.length - 1];
        if(lastWk && lastWk.label){
          semanaEl.textContent = lastWk.label;
        }
      } catch(e){ console.error('Portal semana stat:', e); }
    }
    
    // 5) Facturación del mes (consulta Supabase id=4 directamente)
    var factEl = document.getElementById('portal-factmes-val');
    if(factEl){
      try {
        // Solo consultar si SUPABASE_URL existe
        if(typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL && typeof SUPABASE_KEY !== 'undefined' && SUPABASE_KEY){
          fetch(SUPABASE_URL + '/rest/v1/dashboard_data?id=eq.4&select=data', {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            }
          })
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(result){
            if(!result || !result[0] || !result[0].data) return;
            var fd = result[0].data;
            if(!fd.fact || !Array.isArray(fd.fact) || fd.fact.length === 0) return;
            
            // Calcular mes actual del sistema (YYYY-MM)
            var hoy = new Date();
            var anioMes = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth()+1)).slice(-2);
            
            // Función helper local para convertir semana → mes (replica de financiero)
            function semToMes(sem){
              if(!sem) return null;
              var m = String(sem).match(/S(\d{1,2})/);
              if(!m) return null;
              var n = parseInt(m[1]);
              if(n<=4) return '2026-01';
              if(n<=8) return '2026-02';
              if(n<=13) return '2026-03';
              if(n<=17) return '2026-04';
              if(n<=22) return '2026-05';
              if(n<=26) return '2026-06';
              if(n<=30) return '2026-07';
              if(n<=35) return '2026-08';
              if(n<=39) return '2026-09';
              if(n<=44) return '2026-10';
              if(n<=48) return '2026-11';
              return '2026-12';
            }
            
            // Filtrar facturas del mes actual
            var totalMes = 0;
            fd.fact.forEach(function(f){
              var mesFact = semToMes(f.sem);
              if(mesFact === anioMes){
                totalMes += (parseFloat(f.valor) || 0);
              }
            });
            
            // Si no hay facturas del mes actual, mostrar el último mes con datos
            if(totalMes === 0 && fd.fact.length > 0){
              // Buscar el mes más reciente con datos
              var mesesConDatos = {};
              fd.fact.forEach(function(f){
                var mf = semToMes(f.sem);
                if(mf){
                  if(!mesesConDatos[mf]) mesesConDatos[mf] = 0;
                  mesesConDatos[mf] += (parseFloat(f.valor) || 0);
                }
              });
              var mesesOrd = Object.keys(mesesConDatos).sort();
              if(mesesOrd.length > 0){
                var ultMes = mesesOrd[mesesOrd.length - 1];
                totalMes = mesesConDatos[ultMes];
              }
            }
            
            // Formatear como moneda corta
            function fmtShort(n){
              if(!n) return '—';
              if(n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
              if(n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
              if(n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
              return '$' + Math.round(n);
            }
            
            if(totalMes > 0){
              factEl.textContent = fmtShort(totalMes);
              console.log('💰 [Portal Facturación] Mes: ' + anioMes + ' → ' + fmtShort(totalMes));
            }
          })
          .catch(function(e){ console.error('Portal facturación stat:', e); });
        }
      } catch(e){ console.error('Portal facturación stat:', e); }
    }
    
    console.log('✓ Portal stats actualizados');
  } catch(err) {
    console.error('Error actualizando portal stats:', err);
  }
};

// ═══════════════════════════════════════════════════════
// RESTAURAR VISTA AL CARGAR LA PÁGINA
// ═══════════════════════════════════════════════════════
window.addEventListener('load', function(){
  // Only restore ops — OTIF/Financiero need chart re-init which requires user navigation
  try { localStorage.removeItem('inlop_last_view'); } catch(e){}
});
var pDateEl=document.getElementById('pDate');
if(pDateEl) pDateEl.textContent=new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

/* ══ EXPORTACIÓN OTIF — Word y PDF ══ */
var INLOP_LOGO_B64='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';
var INLOP_LOGO_BUF=null;
try{INLOP_LOGO_BUF=Uint8Array.from(atob(INLOP_LOGO_B64),function(x){return x.charCodeAt(0);});}catch(e){}

function ohBuildReportData(){
  if(typeof window._oOTIF==='undefined'||!window._oOTIF.data){return null;}
  var ohDataFilt  = window._oOTIF.filt;
  var ohTotales   = window._oOTIF.tots;
  var ohSemTots   = window._oOTIF.semTots;
  var ohCausasTot = window._oOTIF.causas;
  var sortSems    = window._oOTIF.sems;
  var data=ohDataFilt(),tot=ohTotales(data);
  var semTots=ohSemTots(data),causas=ohCausasTot(data);
  var sems=typeof sortSems==='function'?sortSems(Object.keys(semTots)):Object.keys(semTots).sort();
  var _oFC=window._oOTIF.oFC?window._oOTIF.oFC():'TODOS';
  var cliLabel=_oFC!=='TODOS'?_oFC:'Todos los clientes — INLOP';
  var hoy=new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
  var vEnt=tot.v-(tot.transito||0);
  var pG=vEnt>0?Math.round(tot.otif/vEnt*100):0;
  var pOT=vEnt>0?Math.round(tot.ot/vEnt*100):0;
  var pIF=vEnt>0?Math.round(tot.inf/vEnt*100):0;
  var totalC=Object.values(causas).reduce(function(a,b){return a+b;},0);
  var ckeys=Object.keys(causas).sort(function(a,b){return causas[b]-causas[a];}).slice(0,6);
  var causasArr=ckeys.map(function(k){
    var ac=k.toLowerCase().includes('tráf')||k.toLowerCase().includes('traf')?'Monitoreo preventivo de rutas con alertas en tiempo real':
           k.toLowerCase().includes('cargue')?'Confirmación de disponibilidad 2h antes del despacho':
           k.toLowerCase().includes('mecán')||k.toLowerCase().includes('mecan')?'Refuerzo plan de mantenimiento preventivo en Avansat TMS':
           k.toLowerCase().includes('rechazo')?'Lista de chequeo pre-despacho con conductor y cliente':
           'Revisión y seguimiento por Coordinación Operativa INLOP';
    return{causa:k,casos:causas[k],pct:totalC>0?Math.round(causas[k]/totalC*100):0,accion:ac};
  });
  if(!causasArr.length)causasArr=[{causa:'Sin causas registradas',casos:0,pct:0,accion:'—'}];
  var PERIODOS_R={S14:'30 mar–05 abr',S15:'06–12 abr',S16:'13–19 abr',S17:'20–26 abr'};
  var analisis='';
  if(pG>=90)analisis='El indicador OTIF se encuentra en nivel óptimo con un '+pG+'%, superando la meta acordada del 90%. ';
  else if(pG>=70)analisis='El indicador OTIF se encuentra En Seguimiento con un '+pG+'%, por debajo de la meta acordada del 90%. ';
  else analisis='El indicador OTIF Requiere Atención con un '+pG+'%. Es necesario implementar acciones correctivas inmediatas para alcanzar la meta del 90%. ';
  if(ckeys.length)analisis+='Principal causa de incumplimiento: "'+ckeys[0]+'" ('+causas[ckeys[0]]+' caso(s)). ';
  if(pIF===100)analisis+='El componente In Full registra desempeño perfecto del 100%, sin incidencias de volumen, merma, averías, devoluciones ni rechazos en destino.';
  else if(pIF<100)analisis+='El componente In Full registra un '+pIF+'%, con oportunidades de mejora en: volumen, merma, averías, devoluciones o rechazos en destino.';
  if(tot.transito>0)analisis+=' '+tot.transito+' viaje(s) en tránsito excluidos del cálculo hasta confirmar entrega.';
  return{
    cliente:cliLabel,
    periodoDetalle:sems.length?sems.join(', ')+(sems.map(function(s){return PERIODOS_R[s]||''}).filter(Boolean).length?' ('+sems.map(function(s){return PERIODOS_R[s]||''}).filter(Boolean).join(' / ')+')':''):'Período actual',
    meta:90,nReporte:'RPT-OTIF-'+new Date().getFullYear()+'-'+(typeof oFC!=='undefined'&&oFC!=='TODOS'?oFC.split(' ')[0].toUpperCase():'GLOBAL')+'-'+sems.join(''),
    hoy:hoy,
    semanas:sems.map(function(s){var sd=semTots[s]||{v:0,ot:0,inf:0,otif:0,transito:0};var ve=sd.v-(sd.transito||0);return{sem:s,periodo:PERIODOS_R[s]||'',viajes:sd.v,ot:sd.ot,inf:sd.inf,otif:sd.otif,transito:sd.transito||0,pct:ve>0?Math.round(sd.otif/ve*100):0}}),
    totViajes:tot.v,totOT:tot.ot,totIF:tot.inf,totOTIF:tot.otif,totTransito:tot.transito||0,
    pctOTIF:pG,pctOT:pOT,pctIF:pIF,
    causas:causasArr,
    compromisos:[
      {n:'1',accion:'Revisión de ANS para rutas de larga distancia',resp:'Gerencia Comercial',fecha:'Por definir'},
      {n:'2',accion:'Protocolo de confirmación de llegada en tiempo real vía TMS',resp:'Coordinación Tráfico',fecha:'Por definir'},
      {n:'3',accion:'Envío semanal de reporte OTIF a clientes estratégicos',resp:'Virna Craig Sarruf · Lider Comercial',fecha:'Cada lunes'},
      {n:'4',accion:'Revisión de causas de incumplimiento con conductores responsables',resp:'Coordinación Operativa INLOP',fecha:'Por definir'},
    ],
    analisis:analisis,
    dir:'Sector Bellavista Vía Mamonal #7C – 39, Centro Logístico Bloc Port, Oficina 41, Cartagena',
  };
}

function ohGenerarHTMLPDF(D){
  var logo='<img src="data:image/jpeg;base64,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" style="height:38px;display:block;margin:0 auto">';
  function kC(p){return p>=90?'#1E7E34':p>=70?'#856404':'#7B0000';}
  function kB(p){return p>=90?'#D1E7DD':p>=70?'#FFF3CD':'#F8D7DA';}
  function sT(p){return p>=90?'\u2705 Cumple':p>=70?'\u26a0 En Seguimiento':'\ud83d\udd34 Requiere Atenci\u00f3n';}

  var semRows=D.semanas.map(function(s,i){
    var bg=i%2===0?'#ffffff':'#f8fafc';
    var pC=kC(s.pct), pB=kB(s.pct);
    return '<tr style="background:'+bg+'">'
      +'<td style="font-weight:700;color:#012A6B;text-align:center">'+s.sem+'</td>'
      +'<td style="text-align:center;color:#595959">'+( s.periodo||'&mdash;')+'</td>'
      +'<td style="text-align:center">'+s.viajes+(s.transito?'<br><small style="color:#3b82f6">'+s.transito+' \ud83d\ude9b</small>':'')+'</td>'
      +'<td style="text-align:center">'+s.ot+'</td>'
      +'<td style="text-align:center">'+s.inf+'</td>'
      +'<td style="text-align:center">'+s.otif+'</td>'
      +'<td style="text-align:center;font-weight:700;color:'+pC+';background:'+pB+'">'+s.pct+'%</td>'
      +'<td style="text-align:center;font-weight:700;color:'+pC+';background:'+pB+'">'+sT(s.pct)+'</td>'
      +'</tr>';
  }).join('');

  var cRows=D.causas.map(function(ca,i){
    return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
      +'<td>'+ca.causa+'</td>'
      +'<td style="text-align:center">'+ca.casos+'</td>'
      +'<td style="text-align:center">'+ca.pct+'%</td>'
      +'<td>'+ca.accion+'</td>'
      +'</tr>';
  }).join('');

  var coRows=D.compromisos.map(function(co,i){
    return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
      +'<td style="text-align:center;font-weight:700;color:#012A6B">'+co.n+'</td>'
      +'<td>'+co.accion+'</td>'
      +'<td>'+co.resp+'</td>'
      +'<td style="text-align:center">'+co.fecha+'</td>'
      +'</tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    +'<title>Reporte OTIF &mdash; '+D.cliente+'</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'@page{size:letter;margin:1.8cm 2cm 2cm 2cm}'
    +'body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#1a1a1a;background:#fff}'
    /* Membrete */
    +'.hdr{width:100%;border-collapse:collapse;margin-bottom:10pt;border:1px solid #AAAAAA}'
    +'.hdr td{vertical-align:middle;padding:6pt 10pt;border:1px solid #AAAAAA}'
    +'.hdr-meta{width:100%;border-collapse:collapse}'
    +'.hdr-meta tr td{padding:4pt 8pt;font-size:8pt;border-bottom:1px solid #ddd}'
    +'.hdr-meta tr:last-child td{border-bottom:none}'
    +'.hdr-meta td:first-child{font-weight:700;color:#012A6B;background:#F0F4F8;border-right:1px solid #ddd;white-space:nowrap}'
    /* Datos */
    +'.datos{width:100%;border-collapse:collapse;margin-bottom:10pt}'
    +'.datos td{padding:6pt 10pt;font-size:10pt;border:1px solid #AAAAAA;vertical-align:top}'
    /* Títulos */
    +'h2{font-size:10.5pt;font-weight:700;color:#012A6B;border-bottom:2px solid #CF0613;padding-bottom:3pt;margin:12pt 0 6pt;text-transform:uppercase;letter-spacing:.5pt;page-break-after:avoid}'
    /* KPIs */
    +'.kpis{display:table;width:100%;border-collapse:collapse;margin-bottom:10pt}'
    +'.kpi{display:table-cell;width:33.3%;border-top:3pt solid;text-align:center;padding:10pt 6pt;vertical-align:middle}'
    +'.kpi-l{font-size:7.5pt;text-transform:uppercase;letter-spacing:1pt;font-weight:700;margin-bottom:4pt}'
    +'.kpi-v{font-size:24pt;font-weight:300;line-height:1;margin-bottom:4pt}'
    +'.kpi-s{font-size:8pt;color:#595959}'
    /* Análisis */
    +'.anal{background:#EFF6FF;border-left:4pt solid #CF0613;padding:9pt 12pt;font-size:10pt;color:#1E3A5F;line-height:1.7;margin-bottom:10pt;page-break-inside:avoid}'
    +'.anal-t{font-size:8pt;font-weight:700;text-transform:uppercase;color:#CF0613;margin-bottom:5pt}'
    /* Tablas de datos */
    +'table.d{width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt;page-break-inside:avoid}'
    +'table.d th{background:#012A6B;color:#fff;padding:5pt 7pt;font-size:8.5pt;font-weight:700}'
    +'table.d th.l{text-align:left}'
    +'table.d td{padding:4pt 7pt;border-bottom:1px solid #EDF1F5;vertical-align:top}'
    +'table.d tfoot tr{background:#012A6B!important}'
    +'table.d tfoot td{color:#fff;font-weight:700;border:none;text-align:center;padding:5pt 7pt}'
    /* Firmas */
    +'.firmas{display:table;width:100%;border-collapse:collapse;margin-top:14pt;page-break-inside:avoid}'
    +'.firma{display:table-cell;width:49%;border:1px solid #D0D5DD;padding:12pt;vertical-align:top}'
    +'.firma-sep{display:table-cell;width:2%}'
    +'.firma-line{border-bottom:1px solid #BBBBBB;margin:30pt 0 5pt}'
    /* Pie */
    +'.conf{font-size:7.5pt;color:#888;text-align:center;margin-top:10pt;border-top:1px solid #ddd;padding-top:5pt;font-style:italic}'
    +'.pie{font-size:8pt;color:#012A6B;text-align:center;font-weight:700;margin-top:4pt}'
    /* Print */
    +'@media print{'
    +'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'a{display:none!important}'  /* Ocultar links */
    +'.no-print{display:none!important}'
    +'h2{page-break-after:avoid}'
    +'table.d{page-break-inside:auto}'
    +'table.d tr{page-break-inside:avoid}'
    +'}'
    +'</style></head><body>'

    /* MEMBRETE */
    +'<table class="hdr"><tr>'
    +'<td style="width:18%;text-align:center">'+logo+'</td>'
    +'<td style="text-align:center"><div style="font-size:13pt;font-weight:700;color:#012A6B">INFORME DE DESEMPE&Ntilde;O LOG&Iacute;STICO</div><div style="font-size:9pt;color:#595959;font-style:italic;margin-top:3pt">Indicador OTIF &mdash; On Time In Full</div></td>'
    +'<td style="width:22%;padding:0"><table class="hdr-meta">'
    +'<tr><td>C&oacute;digo:</td><td>DIR-FR-[S/A]</td></tr>'
    +'<tr><td>Versi&oacute;n:</td><td>1</td></tr>'
    +'<tr><td>Fecha:</td><td>'+D.hoy+'</td></tr>'
    +'</table></td>'
    +'</tr></table>'

    /* DATOS DEL REPORTE */
    +'<table class="datos"><tr>'
    +'<td style="width:55%"><strong>Cliente:</strong> '+D.cliente+'<br><span style="color:#595959;font-size:9.5pt"><strong>Per&iacute;odo:</strong> '+D.periodoDetalle+'</span></td>'
    +'<td style="text-align:right"><strong>Meta OTIF:</strong> <span style="color:#012A6B;font-weight:700">'+D.meta+'%</span><br><span style="font-size:9pt;color:#595959"><strong>N&deg; Reporte:</strong> <span style="font-family:Courier New,monospace;color:#CF0613;font-weight:700">'+D.nReporte+'</span></span></td>'
    +'</tr></table>'

    /* 1. PRESENTACIÓN */
    +'<h2>1. Presentaci&oacute;n del Indicador</h2>'
    +'<p style="text-align:justify;margin-bottom:8pt;line-height:1.6">El indicador <strong>OTIF (On Time In Full)</strong> mide el porcentaje de despachos entregados dentro de la ventana de tiempo acordada (<em>On Time</em>) y con la cantidad completa sin novedad (<em>In Full</em>): sin merma, aver&iacute;as, devoluciones ni rechazos en destino. Solo se considera OTIF exitoso cuando ambas condiciones se cumplen simult&aacute;neamente.'+(D.totTransito>0?' <strong>'+D.totTransito+' viaje(s) en tr&aacute;nsito</strong> han sido excluidos del c&aacute;lculo hasta confirmar su entrega.':'')+'</p>'

    /* 2. RESULTADOS */
    +'<h2>2. Resultados del Per&iacute;odo</h2>'
    +'<div class="kpis">'
    +'<div class="kpi" style="background:'+kB(D.pctOTIF)+';border-color:'+kC(D.pctOTIF)+'">'
    +'<div class="kpi-l" style="color:'+kC(D.pctOTIF)+'">OTIF Total</div>'
    +'<div class="kpi-v" style="color:'+kC(D.pctOTIF)+'">'+D.pctOTIF+'%</div>'
    +'<div class="kpi-s">'+D.totOTIF+' de '+(D.totViajes-D.totTransito)+' viajes</div></div>'
    +'<div class="kpi" style="background:'+kB(D.pctOT)+';border-color:'+kC(D.pctOT)+'">'
    +'<div class="kpi-l" style="color:'+kC(D.pctOT)+'">On Time</div>'
    +'<div class="kpi-v" style="color:'+kC(D.pctOT)+'">'+D.pctOT+'%</div>'
    +'<div class="kpi-s">'+D.totOT+' en ventana ANS</div></div>'
    +'<div class="kpi" style="background:'+kB(D.pctIF)+';border-color:'+kC(D.pctIF)+'">'
    +'<div class="kpi-l" style="color:'+kC(D.pctIF)+'">In Full</div>'
    +'<div class="kpi-v" style="color:'+kC(D.pctIF)+'">'+D.pctIF+'%</div>'
    +'<div class="kpi-s">'+D.totIF+' sin novedad de volumen</div></div>'
    +'</div>'

    /* 3. ANÁLISIS */
    +'<h2>3. An&aacute;lisis Ejecutivo del Per&iacute;odo</h2>'
    +'<div class="anal"><div class="anal-t">&#128203; AN&Aacute;LISIS del per&iacute;odo</div>'+D.analisis+'</div>'

    /* 4. TENDENCIA */
    +'<h2>4. Tendencia Semanal &mdash; OTIF vs Meta '+D.meta+'%</h2>'
    +'<table class="d"><thead><tr>'
    +'<th class="l" style="text-align:center;width:7%">SEM.</th>'
    +'<th class="l" style="width:18%">PER&Iacute;ODO</th>'
    +'<th style="width:9%">VIAJES</th>'
    +'<th style="width:9%">ON TIME</th>'
    +'<th style="width:9%">IN FULL</th>'
    +'<th style="width:9%">OTIF &#10003;</th>'
    +'<th style="width:10%">% OTIF</th>'
    +'<th style="width:29%">ESTADO</th>'
    +'</tr></thead><tbody>'+semRows+'</tbody>'
    +'<tfoot><tr>'
    +'<td colspan="2" style="text-align:center">TOTAL PER&Iacute;ODO</td>'
    +'<td>'+D.totViajes+'</td>'
    +'<td>'+D.totOT+'</td>'
    +'<td>'+D.totIF+'</td>'
    +'<td>'+D.totOTIF+'</td>'
    +'<td>'+D.pctOTIF+'%</td>'
    +'<td>'+sT(D.pctOTIF)+'</td>'
    +'</tr></tfoot></table>'

    /* 5. CAUSAS */
    +'<h2>5. An&aacute;lisis de Causas de Incumplimiento</h2>'
    +'<table class="d"><thead><tr>'
    +'<th class="l" style="width:38%">CAUSA IDENTIFICADA</th>'
    +'<th style="width:8%">CASOS</th>'
    +'<th style="width:9%">% FALLOS</th>'
    +'<th class="l" style="width:45%">ACCI&Oacute;N CORRECTIVA INLOP</th>'
    +'</tr></thead><tbody>'+cRows+'</tbody></table>'

    /* 6. COMPROMISOS */
    +'<h2>6. Compromisos INLOP &mdash; Pr&oacute;ximo Per&iacute;odo</h2>'
    +'<table class="d"><thead><tr>'
    +'<th style="width:4%">#</th>'
    +'<th class="l" style="width:40%">ACCI&Oacute;N</th>'
    +'<th class="l" style="width:34%">RESPONSABLE</th>'
    +'<th style="width:12%">FECHA L&Iacute;MITE</th>'
    +'</tr></thead><tbody>'+coRows+'</tbody></table>'

    /* 7. NOTAS */
    +'<h2>7. Notas Finales</h2>'
    +'<div style="background:#FFFBF0;border-left:4pt solid #D4A017;padding:9pt 12pt;font-size:9.5pt;color:#5C4000;font-style:italic;line-height:1.7;margin-bottom:12pt;page-break-inside:avoid">Este informe es elaborado por INLOP como parte de su modelo de valor agregado para clientes estrat&eacute;gicos, en cumplimiento de sus sistemas de gesti&oacute;n ISO 9001:2015, ISO 14001:2015 e ISO 45001:2018. Los datos provienen del sistema TMS Avansat y del registro operativo OTIF. Para comentarios o reuni&oacute;n de seguimiento, comun&iacute;quese con el &aacute;rea Comercial de INLOP.</div>'

    /* FIRMAS */
    +'<div class="firmas">'
    +'<div class="firma"><div style="font-size:8pt;color:#595959;font-style:italic">Elaborado y aprobado por:</div><div style="font-size:12pt;font-weight:700;color:#012A6B;margin-top:6pt">Virna Craig Sarruf</div><div style="font-size:9pt;color:#595959">Lider Comercial &middot; Integral Logistics Operations S.A.S.</div><div class="firma-line"></div><div style="font-size:7.5pt;color:#888">Firma &nbsp; / &nbsp; Fecha</div></div>'
    +'<div class="firma-sep"></div>'
    +'<div class="firma"><div style="font-size:8pt;color:#595959;font-style:italic">Recibido por:</div><div style="font-size:11pt;font-weight:700;color:#012A6B;margin-top:6pt">'+D.cliente+'</div><div class="firma-line"></div><div style="font-size:7.5pt;color:#888">Firma &nbsp; / &nbsp; Sello &nbsp; / &nbsp; Fecha</div></div>'
    +'</div>'

    /* CONFIDENCIALIDAD */
    +'<p class="conf">CL&Aacute;USULA DE CONFIDENCIALIDAD: La informaci&oacute;n contenida en este informe es de car&aacute;cter confidencial y de uso exclusivo del cliente al cual est&aacute; dirigido. Cualquier retenci&oacute;n, difusi&oacute;n o distribuci&oacute;n no autorizada est&aacute; prohibida.</p>'
    +'<p class="pie">INLOP &ndash; Integral Logistics Operations S.A.S. &nbsp;&middot;&nbsp; '+D.dir+'</p>'
    +'</body></html>';
}

function ohExportPDF(){
  try {
    if(typeof window._oOTIF==='undefined'||!window._oOTIF.data){ alert('⚠ No hay datos cargados. Carga el Excel OTIF primero (accede como Admin y carga el Excel).'); return; }
    if(typeof ohBuildReportData==='undefined'){ alert('⚠ Error interno: ohBuildReportData no encontrada.'); return; }
    if(typeof ohGenerarHTMLPDF==='undefined'){ alert('⚠ Error interno: ohGenerarHTMLPDF no encontrada.'); return; }
    var D=ohBuildReportData();
    if(!D){ alert('⚠ No se pudo construir el reporte. Verifica los datos.'); return; }
    var html=ohGenerarHTMLPDF(D);
    var blob=new Blob([html],{type:'text/html;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download='INLOP_Reporte_OTIF_'+D.cliente.split(' ')[0]+'_'+new Date().toISOString().slice(0,10)+'.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if(typeof toast==='function') toast('✓ Reporte descargado — ábrelo y usa Ctrl+P para PDF','ok');
  } catch(err) {
    alert('❌ Error en PDF: ' + err.message);
    console.error('ohExportPDF error:', err);
  }
}

function ohExportWord(){
  try{
    if(typeof window._oOTIF==='undefined'||!window._oOTIF.data){alert('\u26a0 Carga el Excel OTIF primero (Admin → Cargar Excel).');return;}
    var D=ohBuildReportData();
    if(!D){alert('\u26a0 Error al construir el reporte.');return;}

    function doGenerar(){
      var d=docx, CW=9360;
      var NAVY='012A6B',RED='CF0613',GRAY='595959',GRAY_L='F0F4F8',WHITE='FFFFFF';
      var GREEN='1E7E34',AMBER='7B5E00',DANGER='7B0000';
      var GB='D1E7DD',AB='FFF3CD',DB='F8D7DA';
      function pt(n){return n*2;}
      function brd(col,sz){return{style:d.BorderStyle.SINGLE,size:sz||4,color:col};}
      function nob(){return{style:d.BorderStyle.NONE,size:0,color:'FFFFFF'};}
      function sc(p){if(p===null||isNaN(p))return{bg:'F8F9FA',tx:GRAY};if(p>=90)return{bg:GB,tx:GREEN};if(p>=70)return{bg:AB,tx:AMBER};return{bg:DB,tx:DANGER};}
      function st(p){return p>=90?'Cumple':p>=70?'En Seguimiento':'Requiere Atencion';}

      // Logo base64
      var logoBuf=null;
      try{logoBuf=Uint8Array.from(atob('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'),function(x){return x.charCodeAt(0);});}catch(e){}

      function C(txt,o){
        o=o||{};
        var fill=o.fill,bold=o.bold||false,italic=o.italic||false,color=o.color||'1a1a1a',
            size=o.size||10,font=o.font||'Calibri',align=o.align||d.AlignmentType.LEFT,
            valign=o.valign||d.VerticalAlign.CENTER,width=o.width,colspan=o.colspan||1,
            borders=o.borders||{top:brd('D0D5DD'),bottom:brd('D0D5DD'),left:brd('D0D5DD'),right:brd('D0D5DD')},
            pad=o.pad||{top:80,bottom:80,left:120,right:120};
        var runs=Array.isArray(txt)?txt:[new d.TextRun({text:String(txt||''),bold:bold,italic:italic,color:color,size:pt(size),font:font})];
        return new d.TableCell({columnSpan:colspan,verticalAlign:valign,
          shading:fill?{fill:fill,type:d.ShadingType.CLEAR}:undefined,
          width:width?{size:width,type:d.WidthType.DXA}:undefined,
          margins:pad,borders:borders,
          children:[new d.Paragraph({alignment:align,spacing:{before:0,after:0},children:runs})]});
      }
      function CH(txt,w){return C(txt,{fill:NAVY,color:WHITE,size:9,bold:true,width:w,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,4),right:brd(NAVY,4)}});}
      function CHL(txt,w){return C(txt,{fill:NAVY,color:WHITE,size:9,bold:true,width:w,align:d.AlignmentType.LEFT,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,4),right:brd(NAVY,4)}});}
      function SP(b){return new d.Paragraph({spacing:{before:b||160,after:0},children:[new d.TextRun('')]});}
      function SEC(txt){return new d.Paragraph({spacing:{before:260,after:100},
        border:{bottom:{style:d.BorderStyle.SINGLE,size:12,color:RED,space:3}},
        children:[new d.TextRun({text:txt,bold:true,size:pt(11.5),color:NAVY,font:'Calibri'})]});}

      // Membrete
      var logoCell=new d.TableCell({width:{size:2000,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,
        margins:{top:100,bottom:100,left:140,right:140},shading:{fill:WHITE,type:d.ShadingType.CLEAR},
        borders:{top:brd('999999',6),bottom:brd('999999',6),left:brd('999999',6),right:brd('999999',6)},
        children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:logoBuf?[new d.ImageRun({data:logoBuf,type:'jpeg',transformation:{width:100,height:36}})]:[new d.TextRun({text:'INLOP',bold:true,size:pt(18),color:NAVY,font:'Arial Black'})]})]});
      var tituloCell=new d.TableCell({width:{size:4960,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,
        margins:{top:120,bottom:120,left:200,right:200},shading:{fill:WHITE,type:d.ShadingType.CLEAR},
        borders:{top:brd('999999',6),bottom:brd('999999',6),left:brd('999999',6),right:brd('999999',6)},
        children:[
          new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'INFORME DE DESEMPE\u00d1O LOG\u00cdSTICO',bold:true,size:pt(13),color:NAVY,font:'Calibri'})]}),
          new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{before:60},children:[new d.TextRun({text:'Indicador OTIF \u2014 On Time In Full',size:pt(9.5),color:GRAY,font:'Calibri',italic:true})]})
        ]});
      var metaRows=[['C\u00f3digo:','DIR-FR-[S/A]'],['Versi\u00f3n:','1'],['Fecha:',D.hoy]].map(function(r,i){
        return new d.TableRow({children:[
          new d.TableCell({width:{size:900,type:d.WidthType.DXA},shading:{fill:GRAY_L,type:d.ShadingType.CLEAR},margins:{top:50,bottom:50,left:80,right:60},borders:{top:nob(),left:nob(),right:brd('CCCCCC',4),bottom:i<2?brd('CCCCCC',4):nob()},children:[new d.Paragraph({children:[new d.TextRun({text:r[0],bold:true,size:pt(7.5),color:NAVY,font:'Calibri'})]})]}),
          new d.TableCell({width:{size:1400,type:d.WidthType.DXA},shading:{fill:WHITE,type:d.ShadingType.CLEAR},margins:{top:50,bottom:50,left:80,right:60},borders:{top:nob(),left:nob(),right:nob(),bottom:i<2?brd('CCCCCC',4):nob()},children:[new d.Paragraph({children:[new d.TextRun({text:r[1],size:pt(7.5),color:'333333',font:'Calibri'})]})]})
        ]});
      });
      var metaCell=new d.TableCell({width:{size:2400,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,margins:{top:0,bottom:0,left:0,right:0},shading:{fill:WHITE,type:d.ShadingType.CLEAR},borders:{top:brd('999999',6),bottom:brd('999999',6),left:brd('999999',6),right:brd('999999',6)},children:[new d.Table({width:{size:2300,type:d.WidthType.DXA},columnWidths:[900,1400],rows:metaRows})]});
      var tblMem=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[2000,4960,2400],rows:[new d.TableRow({children:[logoCell,tituloCell,metaCell]})]});

      // Datos del reporte
      var half=Math.floor(CW/2);
      var tblDatos=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[half,CW-half],rows:[new d.TableRow({children:[
        new d.TableCell({width:{size:half,type:d.WidthType.DXA},shading:{fill:WHITE,type:d.ShadingType.CLEAR},margins:{top:100,bottom:100,left:140,right:100},borders:{top:brd('AAAAAA',6),bottom:brd('AAAAAA',6),left:brd('AAAAAA',6),right:brd('AAAAAA',6)},children:[
          new d.Paragraph({children:[new d.TextRun({text:'Cliente:  ',bold:true,size:pt(10),color:GRAY,font:'Calibri'}),new d.TextRun({text:D.cliente,bold:true,size:pt(10),color:NAVY,font:'Calibri'})]}),
          new d.Paragraph({spacing:{before:60},children:[new d.TextRun({text:'Per\u00edodo:  ',bold:true,size:pt(10),color:GRAY,font:'Calibri'}),new d.TextRun({text:D.periodoDetalle,size:pt(10),color:'333333',font:'Calibri'})]})
        ]}),
        new d.TableCell({width:{size:CW-half,type:d.WidthType.DXA},shading:{fill:WHITE,type:d.ShadingType.CLEAR},margins:{top:100,bottom:100,left:100,right:140},borders:{top:brd('AAAAAA',6),bottom:brd('AAAAAA',6),left:brd('AAAAAA',6),right:brd('AAAAAA',6)},children:[
          new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[new d.TextRun({text:'Meta OTIF:  ',bold:true,size:pt(10),color:GRAY,font:'Calibri'}),new d.TextRun({text:D.meta+'%',bold:true,size:pt(10),color:NAVY,font:'Calibri'})]}),
          new d.Paragraph({alignment:d.AlignmentType.RIGHT,spacing:{before:60},children:[new d.TextRun({text:'N\u00b0 Reporte:  ',bold:true,size:pt(10),color:GRAY,font:'Calibri'}),new d.TextRun({text:D.nReporte,bold:true,size:pt(10),color:RED,font:'Courier New'})]})
        ]})
      ]})]});

      // KPIs
      var kpis=[{lbl:'OTIF TOTAL',val:D.pctOTIF+'%',sub:D.totOTIF+' de '+(D.totViajes-D.totTransito)+' viajes',sc:sc(D.pctOTIF)},{lbl:'ON TIME',val:D.pctOT+'%',sub:D.totOT+' en ventana ANS',sc:sc(D.pctOT)},{lbl:'IN FULL',val:D.pctIF+'%',sub:D.totIF+' sin novedad',sc:sc(D.pctIF)}];
      var kW=Math.floor(CW/3);
      var tblKPI=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[kW,kW,CW-kW*2],rows:[new d.TableRow({children:kpis.map(function(k,i){
        return new d.TableCell({width:{size:i===2?CW-kW*2:kW,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,
          shading:{fill:k.sc.bg,type:d.ShadingType.CLEAR},margins:{top:200,bottom:200,left:160,right:160},
          borders:{top:brd(k.sc.tx,18),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)},
          children:[
            new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:k.lbl,bold:true,size:pt(7.5),color:k.sc.tx,font:'Calibri'})]}),
            new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{before:60},children:[new d.TextRun({text:k.val,bold:true,size:pt(28),color:k.sc.tx,font:'Calibri'})]}),
            new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{before:40},children:[new d.TextRun({text:k.sub,size:pt(8.5),color:GRAY,font:'Calibri'})]}),
          ]});
      })})]});

      // Análisis
      var tblAnal=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[CW],rows:[new d.TableRow({children:[new d.TableCell({width:{size:CW,type:d.WidthType.DXA},shading:{fill:'EFF6FF',type:d.ShadingType.CLEAR},margins:{top:180,bottom:180,left:220,right:220},borders:{top:nob(),bottom:nob(),left:brd(RED,20),right:nob()},children:[
        new d.Paragraph({children:[new d.TextRun({text:'AN\u00c1LISIS DEL PER\u00cdODO',bold:true,size:pt(8.5),color:RED,font:'Calibri'})]}),
        SP(80),
        new d.Paragraph({alignment:d.AlignmentType.JUSTIFIED,children:[new d.TextRun({text:D.analisis,size:pt(10),font:'Calibri',color:'1E3A5F'})]}),
      ]})]})]});

      // Tendencia
      var tCols=[620,1980,780,780,780,780,980,1660];
      var semRows=D.semanas.map(function(s,i){
        var sco=sc(s.pct), bg=i%2===0?WHITE:'F8FAFC';
        function mkC2(txt,bold,align,fill){
          return new d.TableCell({shading:{fill:fill||bg,type:d.ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)},
            children:[new d.Paragraph({alignment:align||d.AlignmentType.CENTER,children:[new d.TextRun({text:String(txt||'\u2014'),bold:bold||false,size:pt(9.5),color:bold?NAVY:'333333',font:'Calibri'})]})]}); }
        return new d.TableRow({children:[
          mkC2(s.sem,true),
          new d.TableCell({shading:{fill:bg,type:d.ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)},children:[new d.Paragraph({children:[new d.TextRun({text:s.periodo||'\u2014',size:pt(9.5),color:GRAY,font:'Calibri'})]})]}),
          mkC2(String(s.viajes+(s.transito?' ('+s.transito+')':''))),mkC2(String(s.ot)),mkC2(String(s.inf)),mkC2(String(s.otif)),
          new d.TableCell({shading:{fill:sco.bg,type:d.ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)},children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:s.pct+'%',bold:true,size:pt(10),color:sco.tx,font:'Calibri'})]})]}),
          new d.TableCell({shading:{fill:sco.bg,type:d.ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)},children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:st(s.pct),bold:true,size:pt(9),color:sco.tx,font:'Calibri'})]})]})
        ]});
      });
      var totalRow=new d.TableRow({children:[
        C('TOTAL',{colspan:2,fill:NAVY,color:WHITE,bold:true,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(String(D.totViajes),{fill:NAVY,color:WHITE,bold:true,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(String(D.totOT),{fill:NAVY,color:WHITE,bold:true,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(String(D.totIF),{fill:NAVY,color:WHITE,bold:true,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(String(D.totOTIF),{fill:NAVY,color:WHITE,bold:true,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(D.pctOTIF+'%',{fill:NAVY,color:WHITE,bold:true,size:11,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
        C(st(D.pctOTIF),{fill:NAVY,color:WHITE,bold:true,size:9,align:d.AlignmentType.CENTER,borders:{top:brd(NAVY,8),bottom:brd(NAVY,8),left:brd(NAVY,6),right:brd(NAVY,6)}}),
      ]});
      var tblTend=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:tCols,rows:[
        new d.TableRow({children:[CH('SEM.',tCols[0]),CHL('PER\u00cdODO',tCols[1]),CH('VIAJES',tCols[2]),CH('ON TIME',tCols[3]),CH('IN FULL',tCols[4]),CH('OTIF \u2713',tCols[5]),CH('% OTIF',tCols[6]),CH('ESTADO',tCols[7])]}),
        ...semRows,totalRow
      ]});

      // Causas
      var cC=[3300,860,860,4340];
      var tblCausas=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:cC,rows:[
        new d.TableRow({children:[CHL('CAUSA IDENTIFICADA',cC[0]),CH('CASOS',cC[1]),CH('% FALLOS',cC[2]),CHL('ACCI\u00d3N CORRECTIVA INLOP',cC[3])]}),
        ...D.causas.map(function(ca,i){var bg=i%2===0?WHITE:'F8FAFC';return new d.TableRow({children:[
          C(ca.causa,{fill:bg,size:9.5,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(String(ca.casos),{fill:bg,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(ca.pct+'%',{fill:bg,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(ca.accion,{fill:bg,size:9.5,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
        ]});})
      ]});

      // Compromisos
      var coC=[360,4000,2840,2160];
      var tblComp=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:coC,rows:[
        new d.TableRow({children:[CH('#',coC[0]),CHL('ACCI\u00d3N',coC[1]),CHL('RESPONSABLE',coC[2]),CH('FECHA L\u00cdMITE',coC[3])]}),
        ...D.compromisos.map(function(co,i){var bg=i%2===0?WHITE:'F8FAFC';return new d.TableRow({children:[
          C(co.n,{fill:bg,bold:true,color:NAVY,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(co.accion,{fill:bg,size:9.5,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(co.resp,{fill:bg,size:9.5,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
          C(co.fecha,{fill:bg,size:9.5,align:d.AlignmentType.CENTER,borders:{top:brd('D0D5DD',4),bottom:brd('D0D5DD',4),left:brd('D0D5DD',4),right:brd('D0D5DD',4)}}),
        ]});})
      ]});

      // Firmas
      var fw=Math.floor(CW/2)-200;
      function mkFirma(titulo,nombre,cargo,empresa,linea){
        return new d.TableCell({width:{size:fw,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.TOP,
          shading:{fill:WHITE,type:d.ShadingType.CLEAR},margins:{top:180,bottom:180,left:200,right:200},
          borders:{top:brd('D0D5DD',6),bottom:brd('D0D5DD',6),left:brd('D0D5DD',6),right:brd('D0D5DD',6)},
          children:[
            new d.Paragraph({children:[new d.TextRun({text:titulo,size:pt(8.5),color:GRAY,font:'Calibri',italic:true})]}),
            SP(80),
            new d.Paragraph({children:[new d.TextRun({text:nombre,bold:true,size:pt(12),color:NAVY,font:'Calibri'})]}),
            cargo?new d.Paragraph({children:[new d.TextRun({text:cargo,size:pt(9.5),color:GRAY,font:'Calibri'})]}):SP(0),
            empresa?new d.Paragraph({children:[new d.TextRun({text:empresa,size:pt(9),color:GRAY,font:'Calibri'})]}):SP(0),
            SP(340),
            new d.Paragraph({border:{bottom:{style:d.BorderStyle.SINGLE,size:4,color:'BBBBBB'}},children:[new d.TextRun('')]}),
            SP(60),
            new d.Paragraph({children:[new d.TextRun({text:linea,size:pt(8),color:GRAY,font:'Calibri'})]}),
          ]});
      }
      var tblFirmas=new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[fw,CW-fw],rows:[new d.TableRow({children:[
        mkFirma('Elaborado y aprobado por:','Virna Craig Sarruf','Lider Comercial','Integral Logistics Operations S.A.S.','Firma  /  Fecha'),
        mkFirma('Recibido por:',D.cliente,'','','Firma  /  Sello  /  Fecha'),
      ]})]});

      // Header
      var logoH=logoBuf?[new d.ImageRun({data:logoBuf,type:'jpeg',transformation:{width:80,height:29}})]:[new d.TextRun({text:'INLOP',bold:true,size:pt(13),color:NAVY,font:'Arial Black'})];
      var hdr=new d.Header({children:[
        new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[1700,5560,2100],rows:[new d.TableRow({children:[
          new d.TableCell({width:{size:1700,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,margins:{top:50,bottom:50,left:0,right:100},shading:{fill:WHITE,type:d.ShadingType.CLEAR},borders:{top:nob(),bottom:brd(NAVY,10),left:nob(),right:nob()},children:[new d.Paragraph({children:logoH})]}),
          new d.TableCell({width:{size:5560,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,margins:{top:50,bottom:50,left:100,right:100},shading:{fill:WHITE,type:d.ShadingType.CLEAR},borders:{top:nob(),bottom:brd(NAVY,10),left:nob(),right:nob()},children:[
            new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'INFORME DE DESEMPE\u00d1O LOG\u00cdSTICO \u2014 OTIF',bold:true,size:pt(9.5),color:NAVY,font:'Calibri'})]}),
            new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:D.cliente,size:pt(8),color:GRAY,font:'Calibri',italic:true})]})
          ]}),
          new d.TableCell({width:{size:2100,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,margins:{top:50,bottom:50,left:100,right:0},shading:{fill:WHITE,type:d.ShadingType.CLEAR},borders:{top:nob(),bottom:brd(NAVY,10),left:nob(),right:nob()},children:[
            new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[new d.TextRun({text:'DIR-FR-[S/A]  |  V.1',size:pt(7.5),color:GRAY,font:'Calibri'})]}),
            new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[new d.TextRun({text:D.hoy,size:pt(7.5),color:GRAY,font:'Calibri'})]})
          ]}),
        ]})]})
      ]});

      // Footer
      var ftr=new d.Footer({children:[
        new d.Paragraph({border:{top:{style:d.BorderStyle.SINGLE,size:4,color:'CCCCCC',space:4}},spacing:{before:60},alignment:d.AlignmentType.CENTER,children:[new d.TextRun({text:'INLOP \u2013 Integral Logistics Operations S.A.S.',bold:true,size:pt(8),color:NAVY,font:'Calibri'})]}),
        new d.Paragraph({alignment:d.AlignmentType.CENTER,spacing:{before:30},children:[new d.TextRun({text:D.dir+'   |   P\u00e1g. ',size:pt(7.5),color:GRAY,font:'Calibri'}),new d.SimpleField('PAGE')]})
      ]});

      // Documento
      var doc=new d.Document({sections:[{
        properties:{page:{size:{width:12240,height:15840},margin:{top:1728,bottom:1440,left:1440,right:1440}}},
        headers:{default:hdr},footers:{default:ftr},
        children:[
          tblMem,SP(180),tblDatos,SP(180),
          SEC('1.  Presentaci\u00f3n del Indicador'),
          new d.Paragraph({spacing:{before:100,after:100},alignment:d.AlignmentType.JUSTIFIED,children:[new d.TextRun({text:'El indicador OTIF (On Time In Full) mide el porcentaje de despachos entregados dentro de la ventana de tiempo acordada (On Time) y con la cantidad completa sin novedad (In Full): sin merma, aver\u00edas, devoluciones ni rechazos en destino. Solo se considera OTIF exitoso cuando ambas condiciones se cumplen simult\u00e1neamente.'+(D.totTransito>0?' '+D.totTransito+' viaje(s) en tr\u00e1nsito han sido excluidos del c\u00e1lculo hasta confirmar su entrega.':''),size:pt(10),font:'Calibri',color:'222222'})]}),
          SP(160),
          SEC('2.  Resultados del Per\u00edodo'),SP(100),tblKPI,SP(200),
          SEC('3.  An\u00e1lisis Ejecutivo del Per\u00edodo'),SP(80),tblAnal,SP(200),
          SEC('4.  Tendencia Semanal \u2014 OTIF vs Meta '+D.meta+'%'),SP(100),tblTend,SP(200),
          SEC('5.  An\u00e1lisis de Causas de Incumplimiento'),SP(100),tblCausas,SP(200),
          SEC('6.  Compromisos INLOP \u2014 Pr\u00f3ximo Per\u00edodo'),SP(100),tblComp,SP(280),
          SEC('7.  Notas Finales'),
          new d.Table({width:{size:CW,type:d.WidthType.DXA},columnWidths:[CW],rows:[new d.TableRow({children:[new d.TableCell({width:{size:CW,type:d.WidthType.DXA},shading:{fill:'FFFBF0',type:d.ShadingType.CLEAR},margins:{top:160,bottom:160,left:200,right:200},borders:{top:brd('D4A017',6),bottom:brd('D4A017',6),left:brd('D4A017',20),right:brd('D4A017',6)},children:[new d.Paragraph({alignment:d.AlignmentType.JUSTIFIED,children:[new d.TextRun({text:'Este informe es elaborado por INLOP como parte de su modelo de valor agregado para clientes estrat\u00e9gicos, en cumplimiento de sus sistemas de gesti\u00f3n ISO 9001:2015, ISO 14001:2015 e ISO 45001:2018. Los datos provienen del sistema TMS Avansat y del registro operativo OTIF. Para comentarios o reuni\u00f3n de seguimiento, comun\u00edquese con el \u00e1rea Comercial de INLOP.',size:pt(9.5),font:'Calibri',color:'5C4000',italic:true})]})]})]})]}),
          SP(320),
          SEC('Firmas y Aceptaci\u00f3n'),SP(100),tblFirmas,SP(280),
          new d.Paragraph({alignment:d.AlignmentType.CENTER,border:{top:{style:d.BorderStyle.SINGLE,size:4,color:'D0D5DD',space:6}},spacing:{before:100},children:[new d.TextRun({text:'CL\u00c1USULA DE CONFIDENCIALIDAD: La informaci\u00f3n contenida en este informe es de car\u00e1cter confidencial y de uso exclusivo del cliente al cual est\u00e1 dirigido.',size:pt(8),color:GRAY,font:'Calibri',italic:true})]})
        ]
      }]});

      d.Packer.toBlob(doc).then(function(blob){
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');
        a.href=url;
        a.download='INLOP_Reporte_OTIF_'+D.cliente.split(' ')[0]+'_'+new Date().toISOString().slice(0,10)+'.docx';
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if(typeof toast==='function')toast('\u2713 Reporte Word (.docx) descargado','ok');
      }).catch(function(err){alert('\u274c Error generando Word: '+err.message);console.error(err);});
    }

    doGenerar();
  }catch(err){alert('\u274c Error: '+err.message);console.error(err);}
}


function ohGenerarBodyHTML(D){
  var logo='<img src="data:image/jpeg;base64,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" style="height:36px;display:block">';
  function kC(p){return p>=90?'#1E7E34':p>=70?'#856404':'#7B0000';}
  function kB(p){return p>=90?'#D1E7DD':p>=70?'#FFF3CD':'#F8D7DA';}
  function sT(p){return p>=90?'Cumple':p>=70?'En Seguimiento':'Requiere Atenci\u00f3n';}

  var semRows=D.semanas.map(function(s,i){
    var bg=i%2===0?'#ffffff':'#f8fafc';
    return '<tr style="background:'+bg+'">'
      +'<td style="text-align:center;font-weight:700;color:#012A6B;border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.sem+'</td>'
      +'<td style="text-align:center;color:#595959;border:1pt solid #D0D5DD;padding:4pt 6pt">'+(s.periodo||'&mdash;')+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.viajes+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.ot+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.inf+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.otif+'</td>'
      +'<td style="text-align:center;font-weight:700;color:'+kC(s.pct)+';background:'+kB(s.pct)+';border:1pt solid #D0D5DD;padding:4pt 6pt">'+s.pct+'%</td>'
      +'<td style="text-align:center;font-weight:700;color:'+kC(s.pct)+';background:'+kB(s.pct)+';border:1pt solid #D0D5DD;padding:4pt 6pt">'+sT(s.pct)+'</td>'
      +'</tr>';
  }).join('');

  var cRows=D.causas.map(function(ca,i){
    var bg=i%2===0?'#ffffff':'#f8fafc';
    return '<tr style="background:'+bg+'">'
      +'<td style="border:1pt solid #D0D5DD;padding:4pt 6pt">'+ca.causa+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+ca.casos+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+ca.pct+'%</td>'
      +'<td style="border:1pt solid #D0D5DD;padding:4pt 6pt">'+ca.accion+'</td>'
      +'</tr>';
  }).join('');

  var coRows=D.compromisos.map(function(co,i){
    var bg=i%2===0?'#ffffff':'#f8fafc';
    return '<tr style="background:'+bg+'">'
      +'<td style="text-align:center;font-weight:700;color:#012A6B;border:1pt solid #D0D5DD;padding:4pt 6pt">'+co.n+'</td>'
      +'<td style="border:1pt solid #D0D5DD;padding:4pt 6pt">'+co.accion+'</td>'
      +'<td style="border:1pt solid #D0D5DD;padding:4pt 6pt">'+co.resp+'</td>'
      +'<td style="text-align:center;border:1pt solid #D0D5DD;padding:4pt 6pt">'+co.fecha+'</td>'
      +'</tr>';
  }).join('');

  // Membrete
  var html='<table style="width:100%;border-collapse:collapse;border:1pt solid #AAAAAA;margin-bottom:10pt"><tr>'
    +'<td style="width:18%;text-align:center;border:1pt solid #AAAAAA;padding:8pt">'+logo+'</td>'
    +'<td style="text-align:center;border:1pt solid #AAAAAA;padding:8pt">'
    +'<div style="font-size:14pt;font-weight:bold;color:#012A6B">INFORME DE DESEMPE&Ntilde;O LOG&Iacute;STICO</div>'
    +'<div style="font-size:9pt;color:#595959;font-style:italic;margin-top:3pt">Indicador OTIF &mdash; On Time In Full</div>'
    +'</td>'
    +'<td style="width:22%;border:1pt solid #AAAAAA;padding:0">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<tr><td style="font-weight:bold;color:#012A6B;background:#F0F4F8;border-bottom:1pt solid #ddd;border-right:1pt solid #ddd;padding:4pt 8pt;font-size:8pt;white-space:nowrap">C&oacute;digo:</td><td style="padding:4pt 8pt;font-size:8pt;border-bottom:1pt solid #ddd">DIR-FR-[S/A]</td></tr>'
    +'<tr><td style="font-weight:bold;color:#012A6B;background:#F0F4F8;border-bottom:1pt solid #ddd;border-right:1pt solid #ddd;padding:4pt 8pt;font-size:8pt">Versi&oacute;n:</td><td style="padding:4pt 8pt;font-size:8pt;border-bottom:1pt solid #ddd">1</td></tr>'
    +'<tr><td style="font-weight:bold;color:#012A6B;background:#F0F4F8;border-right:1pt solid #ddd;padding:4pt 8pt;font-size:8pt">Fecha:</td><td style="padding:4pt 8pt;font-size:8pt">'+D.hoy+'</td></tr>'
    +'</table></td>'
    +'</tr></table>'

  // Datos reporte — tabla limpia 2 columnas
    +'<table style="width:100%;border-collapse:collapse;border:1pt solid #AAAAAA;margin-bottom:10pt"><tr>'
    +'<td style="border:1pt solid #AAAAAA;padding:7pt 10pt;width:55%;font-size:10pt">'
    +'<strong>Cliente:</strong> '+D.cliente+'<br>'
    +'<strong>Per&iacute;odo:</strong> '+D.periodoDetalle
    +'</td>'
    +'<td style="border:1pt solid #AAAAAA;padding:7pt 10pt;text-align:right;font-size:10pt">'
    +'<strong>Meta OTIF:</strong> <span style="color:#012A6B;font-weight:bold">'+D.meta+'%</span><br>'
    +'<strong>N&deg; Reporte:</strong> <span style="font-family:Courier New,monospace;color:#CF0613;font-weight:bold">'+D.nReporte+'</span>'
    +'</td>'
    +'</tr></table>'

  // 1. Presentación
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">1. Presentaci&oacute;n del Indicador</h2>'
    +'<p style="font-size:10pt;line-height:1.6;text-align:justify;margin-bottom:8pt">El indicador <strong>OTIF (On Time In Full)</strong> mide el porcentaje de despachos entregados dentro de la ventana de tiempo acordada (<em>On Time</em>) y con la cantidad completa sin novedad (<em>In Full</em>): sin merma, aver&iacute;as, devoluciones ni rechazos en destino. Solo se considera OTIF exitoso cuando ambas condiciones se cumplen simult&aacute;neamente.</p>'

  // 2. Resultados — tabla en lugar de grid (Word no soporta CSS grid)
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">2. Resultados del Per&iacute;odo</h2>'
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:10pt"><tr>'
    +'<td style="width:33%;border-top:3pt solid '+kC(D.pctOTIF)+';background:'+kB(D.pctOTIF)+';text-align:center;padding:10pt 6pt;border:1pt solid #D0D5DD">'
    +'<div style="font-size:8pt;font-weight:bold;color:'+kC(D.pctOTIF)+';text-transform:uppercase;margin-bottom:4pt">OTIF Total</div>'
    +'<div style="font-size:26pt;font-weight:300;color:'+kC(D.pctOTIF)+'">'+D.pctOTIF+'%</div>'
    +'<div style="font-size:8pt;color:#595959">'+D.totOTIF+' de '+(D.totViajes-D.totTransito)+' viajes</div></td>'
    +'<td style="width:33%;border-top:3pt solid '+kC(D.pctOT)+';background:'+kB(D.pctOT)+';text-align:center;padding:10pt 6pt;border:1pt solid #D0D5DD">'
    +'<div style="font-size:8pt;font-weight:bold;color:'+kC(D.pctOT)+';text-transform:uppercase;margin-bottom:4pt">On Time</div>'
    +'<div style="font-size:26pt;font-weight:300;color:'+kC(D.pctOT)+'">'+D.pctOT+'%</div>'
    +'<div style="font-size:8pt;color:#595959">'+D.totOT+' en ventana ANS</div></td>'
    +'<td style="width:33%;border-top:3pt solid '+kC(D.pctIF)+';background:'+kB(D.pctIF)+';text-align:center;padding:10pt 6pt;border:1pt solid #D0D5DD">'
    +'<div style="font-size:8pt;font-weight:bold;color:'+kC(D.pctIF)+';text-transform:uppercase;margin-bottom:4pt">In Full</div>'
    +'<div style="font-size:26pt;font-weight:300;color:'+kC(D.pctIF)+'">'+D.pctIF+'%</div>'
    +'<div style="font-size:8pt;color:#595959">'+D.totIF+' sin novedad</div></td>'
    +'</tr></table>'

  // 3. Análisis
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">3. An&aacute;lisis Ejecutivo del Per&iacute;odo</h2>'
    +'<div style="background:#EFF6FF;border-left:4pt solid #CF0613;padding:9pt 12pt;font-size:10pt;color:#1E3A5F;line-height:1.7;margin-bottom:10pt">'
    +'<div style="font-size:8pt;font-weight:bold;color:#CF0613;text-transform:uppercase;margin-bottom:5pt">AN&Aacute;LISIS del per&iacute;odo</div>'
    +D.analisis+'</div>'

  // 4. Tendencia
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">4. Tendencia Semanal &mdash; OTIF vs Meta '+D.meta+'%</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt">'
    +'<thead><tr style="background:#012A6B">'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:7%">SEM.</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:16%">PER&Iacute;ODO</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:9%">VIAJES</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:9%">ON TIME</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:9%">IN FULL</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:9%">OTIF</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:10%">% OTIF</th>'
    +'<th style="color:#fff;padding:5pt 6pt;text-align:center;border:1pt solid #012A6B;width:31%">ESTADO</th>'
    +'</tr></thead>'
    +'<tbody>'+semRows+'</tbody>'
    +'<tfoot><tr style="background:#012A6B">'
    +'<td colspan="2" style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">TOTAL</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+D.totViajes+'</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+D.totOT+'</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+D.totIF+'</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+D.totOTIF+'</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+D.pctOTIF+'%</td>'
    +'<td style="color:#fff;font-weight:bold;text-align:center;border:1pt solid #012A6B;padding:5pt 6pt">'+sT(D.pctOTIF)+'</td>'
    +'</tr></tfoot></table>'

  // 5. Causas
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">5. An&aacute;lisis de Causas de Incumplimiento</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt">'
    +'<thead><tr style="background:#012A6B">'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:left;border:1pt solid #012A6B;width:40%">CAUSA IDENTIFICADA</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:center;border:1pt solid #012A6B;width:8%">CASOS</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:center;border:1pt solid #012A6B;width:9%">% FALLOS</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:left;border:1pt solid #012A6B;width:43%">ACCI&Oacute;N CORRECTIVA INLOP</th>'
    +'</tr></thead><tbody>'+cRows+'</tbody></table>'

  // 6. Compromisos
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">6. Compromisos INLOP &mdash; Pr&oacute;ximo Per&iacute;odo</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt">'
    +'<thead><tr style="background:#012A6B">'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:center;border:1pt solid #012A6B;width:4%">#</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:left;border:1pt solid #012A6B;width:42%">ACCI&Oacute;N</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:left;border:1pt solid #012A6B;width:36%">RESPONSABLE</th>'
    +'<th style="color:#fff;padding:5pt 7pt;text-align:center;border:1pt solid #012A6B;width:18%">FECHA L&Iacute;MITE</th>'
    +'</tr></thead><tbody>'+coRows+'</tbody></table>'

  // 7. Notas
    +'<h2 style="font-size:11pt;font-weight:bold;color:#012A6B;border-bottom:2pt solid #CF0613;padding-bottom:3pt;margin:12pt 0 7pt;text-transform:uppercase">7. Notas Finales</h2>'
    +'<div style="background:#FFFBF0;border-left:4pt solid #D4A017;padding:9pt 12pt;font-size:9.5pt;color:#5C4000;font-style:italic;line-height:1.7;margin-bottom:12pt">Este informe es elaborado por INLOP como parte de su modelo de valor agregado para clientes estrat&eacute;gicos, en cumplimiento de sus sistemas de gesti&oacute;n ISO 9001:2015, ISO 14001:2015 e ISO 45001:2018.</div>'

  // Firmas — tabla simple de 2 columnas que Word respeta
    +'<table style="width:100%;border-collapse:collapse;margin-top:14pt">'
    +'<tr>'
    +'<td style="width:48%;border:1pt solid #D0D5DD;padding:12pt;vertical-align:top">'
    +'<div style="font-size:8.5pt;color:#595959;font-style:italic">Elaborado y aprobado por:</div>'
    +'<div style="font-size:12pt;font-weight:bold;color:#012A6B;margin-top:6pt">Virna Craig Sarruf</div>'
    +'<div style="font-size:9pt;color:#595959">Lider Comercial &middot; Integral Logistics Operations S.A.S.</div>'
    +'<div style="border-bottom:1pt solid #BBBBBB;margin:30pt 0 5pt"></div>'
    +'<div style="font-size:7.5pt;color:#888">Firma &nbsp; / &nbsp; Fecha</div>'
    +'</td>'
    +'<td style="width:4%"></td>'
    +'<td style="width:48%;border:1pt solid #D0D5DD;padding:12pt;vertical-align:top">'
    +'<div style="font-size:8.5pt;color:#595959;font-style:italic">Recibido por:</div>'
    +'<div style="font-size:11pt;font-weight:bold;color:#012A6B;margin-top:6pt">'+D.cliente+'</div>'
    +'<div style="border-bottom:1pt solid #BBBBBB;margin:30pt 0 5pt"></div>'
    +'<div style="font-size:7.5pt;color:#888">Firma &nbsp; / &nbsp; Sello &nbsp; / &nbsp; Fecha</div>'
    +'</td>'
    +'</tr></table>'

    +'<p style="font-size:7.5pt;color:#888;text-align:center;margin-top:10pt;border-top:1pt solid #ddd;padding-top:5pt;font-style:italic">CL&Aacute;USULA DE CONFIDENCIALIDAD: La informaci&oacute;n contenida en este informe es de car&aacute;cter confidencial y de uso exclusivo del cliente al cual est&aacute; dirigido.</p>'
    +'<p style="font-size:8pt;color:#012A6B;text-align:center;font-weight:bold;margin-top:4pt">INLOP &ndash; Integral Logistics Operations S.A.S. &nbsp;&middot;&nbsp; '+D.dir+'</p>';

  return html;
}

