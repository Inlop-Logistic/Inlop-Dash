/* ================================================================
   otif.js — INLOP Business Intelligence
   Módulo OTIF — On Time In Full

   DEPENDENCIAS (cargadas antes en index.html):
     · supabase.js → loadOtifFromSupabase, saveOtifToSupabase
     · utils.js    → toast (vía typeof toast === 'function')

   EXPONE (vía window) para app.js y supabase.js:
     · window.ohSetDataFromCloud() — bridge para carga desde Supabase
     · window._oOTIF              — objeto con funciones de datos OTIF
     · window.otifInit()          — inicialización del módulo
     · window.ohExportPDF()       → definida en app.js (exportación)
     · window.ohExportWord()      → definida en app.js
   ================================================================ */

(function(){
'use strict';

/* ── CONSTANTES ── */
var PIN='1926', PIN_KEY='inlop_otif_v4';
var PERIODOS={S1:'30 dic–05 ene',S2:'06–12 ene',S3:'13–19 ene',S4:'20–26 ene',
  S5:'27 ene–02 feb',S6:'03–09 feb',S7:'10–16 feb',S8:'17–23 feb',
  S9:'24 feb–02 mar',S10:'03–09 mar',S11:'10–16 mar',S12:'17–23 mar',
  S13:'24–30 mar',S14:'31 mar–05 abr',S15:'06–12 abr',S16:'13–19 abr',
  S17:'20–26 abr',S18:'27 abr–03 may',S19:'04–10 may',S20:'11–17 may'};
var COLORES={
  'PRODUCTOS RAMO S.A.S':'#6366F1',
  'FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA':'#0891B2',
  'ATLANTIC MARINE FUELS SAS':'#16A34A',
  'C.I PRODEXPORT DE COLOMBIA SAS':'#9333EA',
  'EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS SA':'#E8A020',
  'LHOIST COLOMBIA SAS':'#DC2626',
  'INDUSTRIA AMBIENTAL SAS':'#0D9488',
  'KANGUPOR SAS':'#F59E0B',
  'DISTRIBUIDORA DE PAPEL JURADO TORRES SAS':'#8B5CF6',
  'LA FABRICA DE LA FELICIDAD SAS':'#EC4899',
  'JEHS INGENIERIA S. A. S':'#10B981',
  'DEVELOPMENT OF ENERGY PROJECTS SAS':'#64748B',
  'C.I. CONQUERS WORLD TRADE SAS':'#F97316',
  'LORRY S.A.S.':'#06B6D4',
};

/* ── ESTADO ── */
var oData=null, oLastFile=null;
var oPinBuf='', oIsAdmin=false, oBrandClicks=0, oBrandTimer=null;
var oFS='TODAS', oFL='TODAS', oFC='TODOS';
var oChTrend=null, oChLinea=null, oChCausas=null;
var oFallosPage=0; // página actual de incumplimientos

// ═══════════════════════════════════════════════════════
// BRIDGE: Función puente para asignar oData desde otros scopes
// (usada por loadOtifFromSupabase que está en otro <script>)
// ═══════════════════════════════════════════════════════
window.ohSetDataFromCloud = function(cloudData) {
  console.log('🌉 [BRIDGE] ohSetDataFromCloud llamado con keys:', Object.keys(cloudData||{}).length);
  if (!cloudData || Object.keys(cloudData).length === 0) {
    console.warn('🌉 [BRIDGE] No hay datos para asignar');
    return false;
  }
  
  // Asignar a la variable local oData (en este scope)
  oData = cloudData;
  
  // También exponer en window
  window.oData = oData;
  
  console.log('🌉 [BRIDGE] oData local asignado. Keys:', Object.keys(oData).length);
  
  // Actualizar referencia para exportación
  window._oOTIF = {
    data: oData,
    filt: ohDataFilt,
    tots: ohTotales,
    semTots: ohSemTots,
    causas: ohCausasTot,
    sems: sortSems,
    oFC: function(){return oFC;},
    oFS: function(){return oFS;}
  };
  
  // Construir filtros y mostrar contenido
  if (typeof ohBuildFiltros === 'function') ohBuildFiltros();
  
  var elFilt = document.getElementById('ohFilters');
  var elNoData = document.getElementById('ohNoData');
  var elContent = document.getElementById('ohContent');
  var elRef = document.getElementById('ohRef');
  
  if (elFilt) elFilt.classList.add('visible');
  if (elNoData) elNoData.style.display = 'none';
  if (elContent) elContent.style.display = 'block';
  if (elRef) elRef.style.display = 'block';
  
  // Renderizar
  if (typeof ohRender === 'function') {
    console.log('🌉 [BRIDGE] Llamando ohRender()...');
    ohRender();
    console.log('🌉 [BRIDGE] ohRender completado ✓');
  }
  
  // Actualizar stats del portal
  if(typeof window.updatePortalStats === 'function'){
    setTimeout(function(){ window.updatePortalStats(); }, 100);
  }
  
  return true;
};

/* ── UTILS ── */
function pct(a,b){return b>0?Math.round(a/b*100):null;}
function fmt(p){return p===null?'—':p+'%';}

// Colores exactos del operativo
function col(p){
  if(p===null)return'var(--w4)';
  if(p>=90)return'var(--green)';
  if(p>=70)return'var(--amber)';
  return'var(--danger)';
}
// Semáforo — "Requiere Atención" en lugar de "Crítico"
function badge(p,transit){
  if(transit)return'<span class="ob2 ob-transit">🚛 En tránsito</span>';
  if(p===null)return'<span class="ob2 ob-na">Sin viajes</span>';
  if(p>=90)return'<span class="ob2 ob-ok">✅ Cumple</span>';
  if(p>=70)return'<span class="ob2 ob-warn">⚠ En Seguimiento</span>';
  return'<span class="ob2 ob-req">🔴 Requiere Atención</span>';
}
function el(id){return document.getElementById(id);}
function notif(msg,t){if(typeof toast==='function')toast(msg,t||'ok');}
function countUp(elId,target,duration){
  var e=el(elId);if(!e||target===null){if(e)e.textContent='—';return;}
  var start=0,step=Math.ceil(target/(duration/16));
  var iv=setInterval(function(){
    start=Math.min(start+step,target);
    e.textContent=start+'%';
    if(start>=target)clearInterval(iv);
  },16);
}

// Ordenar semanas correctamente S1, S2 ... S9, S10, S11...
function sortSems(sems){
  return sems.slice().sort(function(a,b){
    var na=parseInt(a.replace(/\D/g,''))||0;
    var nb=parseInt(b.replace(/\D/g,''))||0;
    return na-nb;
  });
}

/* ── PIN ADMIN ── */
function ohBrandClick(){
  oBrandClicks++;clearTimeout(oBrandTimer);
  if(oIsAdmin&&oBrandClicks>=5){oBrandClicks=0;ohLogout();return;}
  if(!oIsAdmin&&oBrandClicks>=5){oBrandClicks=0;ohPinOpen();return;}
  oBrandTimer=setTimeout(function(){oBrandClicks=0;},1500);
}
window.ohBrandClick=ohBrandClick;

function ohPinOpen(){oPinBuf='';ohPinUpd();el('ohPinErr').textContent='';el('ohPin').style.display='flex';}
function ohPClose(){el('ohPin').style.display='none';oPinBuf='';}
window.ohPClose=ohPClose;

function ohP(n){
  if(oPinBuf.length>=4)return;
  oPinBuf+=String(n);ohPinUpd();
  if(oPinBuf.length===4){
    setTimeout(function(){
      if(oPinBuf===PIN){
        oIsAdmin=true;
        try{sessionStorage.setItem(PIN_KEY,'ok');}catch(e){}
        ohPClose();
        el('ohAdmin').style.display='flex';
        el('ohAdminTrigger').classList.add('admin-active');
        notif('✓ Modo admin OTIF activado','ok');
      } else {
        el('ohPinErr').textContent='PIN incorrecto';
        oPinBuf='';ohPinUpd();
      }
    },200);
  }
}
window.ohP=ohP;

function ohPDel(){oPinBuf=oPinBuf.slice(0,-1);ohPinUpd();}
window.ohPDel=ohPDel;

function ohPinUpd(){
  var dots=el('ohPinDots').querySelectorAll('.opm-dot');
  dots.forEach(function(d,i){
    d.style.background=i<oPinBuf.length?'var(--amber)':'rgba(255,255,255,.15)';
    d.style.transform=i<oPinBuf.length?'scale(1.25)':'scale(1)';
  });
}

function ohLogout(){
  oIsAdmin=false;
  try{sessionStorage.removeItem(PIN_KEY);}catch(e){}
  el('ohAdmin').style.display='none';
  el('ohAdminTrigger').classList.remove('admin-active');
  notif('Modo admin OTIF desactivado','info');
}

function ohCheckAdmin(){
  try{if(sessionStorage.getItem(PIN_KEY)==='ok'){oIsAdmin=true;el('ohAdmin').style.display='flex';el('ohAdminTrigger').classList.add('admin-active');}}catch(e){}
}

/* ── CARGA EXCEL ── */
function ohLoadExcel(input){
  var f=input.files[0];if(!f)return;
  input.value='';oLastFile=f;ohParse(f);
}
window.ohLoadExcel=ohLoadExcel;

function ohRefresh(){
  // Si hay archivo local, re-procesarlo
  if(oLastFile){
    ohParse(oLastFile);
    return;
  }
  // Si no hay archivo local, recargar desde Supabase
  if(typeof loadOtifFromSupabase === 'function'){
    notif('Recargando desde la nube...','info');
    loadOtifFromSupabase().then(function(success){
      if(!success){
        notif('No hay datos en la nube. Carga el Excel primero.','err');
      }
    }).catch(function(e){
      notif('Error al recargar: '+e.message,'err');
    });
  } else {
    notif('Carga primero el Excel OTIF','err');
  }
}
window.ohRefresh=ohRefresh;

function ohParse(file){
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(e.target.result,{type:'binary',cellDates:true});
      var shName=wb.SheetNames.find(function(n){
        return n.toUpperCase().includes('OTIF')||n.includes('2026');
      })||wb.SheetNames[0];
      var ws=wb.Sheets[shName];
      var rawArr=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',cellDates:true});
      if(!rawArr||rawArr.length<3){notif('Sin datos en hoja '+shName,'err');return;}

      // Detectar fila de headers reales
      var hdrIdx=0;
      for(var ri=0;ri<Math.min(5,rawArr.length);ri++){
        var rs=rawArr[ri].join('|').toLowerCase();
        if(rs.includes('cliente')&&rs.includes('semana')){hdrIdx=ri;break;}
      }
      var hdrs=rawArr[hdrIdx];
      var rows=[];
      for(var ri2=hdrIdx+1;ri2<rawArr.length;ri2++){
        var ra=rawArr[ri2];
        if(!ra||!ra.some(function(v){return v!=='';}))continue;
        var obj={};
        hdrs.forEach(function(h,i){if(h)obj[String(h)]=ra[i]!==undefined?ra[i]:'';});
        rows.push(obj);
      }
      if(!rows.length){notif('Sin datos en hoja '+shName,'err');return;}

      var sample=rows[0];var cols2=Object.keys(sample);
      var find=function(terms){
        return cols2.find(function(c){
          return terms.some(function(t){return c.toLowerCase().includes(t.toLowerCase());});
        })||null;
      };

      var cm={
        man:  find(['Manifiesto']),
        sem:  find(['Semana']),
        per:  find(['Periodo Semanal','Periodo','Período']),
        cli:  find(['Cliente']),
        linea:find(['Linea de Negocio','Línea','Linea']),
        tipo: find(['Tipo de Operación','Tipo de Op']),
        fem:  find(['Fecha Emisión','Fecha Emis']),
        fll:  find(['Fecha LLegada','Fecha Llegada','llegada','Descargue']),
        hmax: find(['Horas','oras M']),
        hrs:  find(['Hrs Transcurridas','Hrs Trans']),
        orig: find(['Origen']),
        dest: find(['Destino']),
        ot:   find(['¿On Time?','On Time']),
        inf:  find(['¿In Full?','In Full']),
        otif: find(['OTIF\n(S/N)','OTIF']),
        causa:find(['Causa\nIncumplimiento','Causa']),
        resp: find(['Responsable\nFallo','Responsable']),
      };

      if(!cm.cli||!cm.sem){notif('No se encontraron columnas Cliente/Semana','err');return;}

      var parsed={};
      var causasGlobal={};
      rows.forEach(function(r){
        var cli=String(r[cm.cli]||'').trim();if(!cli)return;
        var sem=String(r[cm.sem]||'S?').trim().replace(/^S0*(\d+)$/,'S$1');
        var otTxt =String(r[cm.ot]||'');
        var ifTxt =String(r[cm.inf]||'');
        var oTxt  =String(r[cm.otif]||'');
        var fllVal=cm.fll?r[cm.fll]:'';
        var fllStr=fllVal instanceof Date?fllVal.toISOString():String(fllVal||'').trim();
        // ── EN TRÁNSITO: fecha llegada vacía O valor de OTIF = 0/vacío sin fecha ──
        var enTransito = !fllStr || fllStr==='' || fllStr==='0';
        var ot    = !enTransito&&(otTxt.includes('✓')||/^si/i.test(otTxt.trim()));
        var inf   = !enTransito&&(ifTxt.includes('✓')||/^si/i.test(ifTxt.trim()));
        // OTIF: solo se calcula si ya llegó
        var otifOk = !enTransito&&(oTxt.includes('✓')||(ot&&inf));
        var linea =cm.linea?String(r[cm.linea]||'').replace('Liquida','Liquida'):'—';
        var linea2=linea.toLowerCase().includes('liq')?'Carga Liquida':linea.toLowerCase().includes('comex')?'Comex':'Carga Seca';
        var hrs   =cm.hrs?parseFloat(r[cm.hrs])||null:null;
        var hmax  =cm.hmax?parseFloat(r[cm.hmax])||48:48;
        var causa =cm.causa?String(r[cm.causa]||''):'';
        var resp  =cm.resp?String(r[cm.resp]||''):'';
        var orig  =cm.orig?String(r[cm.orig]||''):'—';
        var dest  =cm.dest?String(r[cm.dest]||''):'—';

        if(!parsed[cli])parsed[cli]={
          corto:cli,linea:linea2,
          v:0,ot:0,inf:0,otif:0,transito:0,
          semanas:{},viajes:[],transitos:[],causas:{}
        };

        // SIEMPRE suma al total de viajes
        parsed[cli].v++;
        if(!parsed[cli].semanas[sem])parsed[cli].semanas[sem]={v:0,ot:0,inf:0,otif:0,transito:0};
        parsed[cli].semanas[sem].v++;

        if(enTransito){
          // En tránsito: cuenta en total, excluido del OTIF
          parsed[cli].transito++;
          parsed[cli].semanas[sem].transito++;
          parsed[cli].transitos.push({
            man:cm.man?String(r[cm.man]||''):'—',
            sem:sem,fecha:cm.fem?String(r[cm.fem]||''):'',
            orig:orig,dest:dest,tipo:cm.tipo?String(r[cm.tipo]||''):'—'
          });
        } else {
          // Ya entregado: cuenta en OTIF
          if(ot)    {parsed[cli].ot++;parsed[cli].semanas[sem].ot++;}
          if(inf)   {parsed[cli].inf++;parsed[cli].semanas[sem].inf++;}
          if(otifOk){parsed[cli].otif++;parsed[cli].semanas[sem].otif++;}
          if(causa&&causa.trim()){
            parsed[cli].causas[causa]=(parsed[cli].causas[causa]||0)+1;
            causasGlobal[causa]=(causasGlobal[causa]||0)+1;
          }
          if(!otifOk){
            parsed[cli].viajes.push({
              man:cm.man?String(r[cm.man]||''):'—',
              sem:sem,fecha:cm.fem?String(r[cm.fem]||''):'',
              orig:orig,dest:dest,
              ot:ot?'✓ Sí':'✗ No',inf:inf?'✓ Sí':'✗ No',
              hrs:hrs,hmax:hmax,causa:causa,resp:resp,
              tipo:cm.tipo?String(r[cm.tipo]||''):'—'
            });
          }
        }
      });

      oData=parsed;
      oData._causasGlobal=causasGlobal;
      
      // CRÍTICO: También exponer en window para que otras funciones lo accedan
      window.oData = oData;
      window.oIsAdmin = oIsAdmin;
      
      console.log('🟡 [OTIF PARSE] parsed clientes count:', Object.keys(parsed).length);
      console.log('🟡 [OTIF PARSE] parsed keys:', Object.keys(parsed));
      console.log('🟡 [OTIF PARSE] oData asignado. Keys:', Object.keys(oData).length);
      console.log('🟡 [OTIF PARSE] window.oData asignado:', !!window.oData);
      window._oOTIF={data:oData,filt:ohDataFilt,tots:ohTotales,semTots:ohSemTots,causas:ohCausasTot,sems:sortSems,oFC:function(){return oFC;},oFS:function(){return oFS;}};

      var tv=Object.values(parsed).reduce(function(a,d){return a+d.v;},0);
      var sems=ohSemanas();

      el('ohSrcDot').style.background='var(--green)';
      el('ohSrcTxt').style.color='var(--green)';
      el('ohSrcTxt').textContent=file.name+' · '+tv+' viajes · '+sems.join(', ');
      el('ohXlDot').style.background='var(--green)';
      el('ohXlTxt').textContent='Excel cargado ✓';
      el('ohRef').style.display='block';

      ohBuildFiltros();
      el('ohFilters').classList.add('visible');
      el('ohNoData').style.display='none';
      el('ohContent').style.display='block';
      ohRender();
      notif('✓ OTIF cargado — '+Object.keys(parsed).length+' clientes · '+sems.join(', '),'ok');
      
      // Guardar en Supabase automáticamente (solo admin)
      console.log('🟡 [OTIF PARSE] Excel procesado. oIsAdmin?', oIsAdmin);
      console.log('🟡 [OTIF PARSE] saveOtifToSupabase existe?', typeof saveOtifToSupabase === 'function');
      
      if(oIsAdmin && typeof saveOtifToSupabase === 'function'){
        console.log('🟡 [OTIF PARSE] Llamando a saveOtifToSupabase(parsed)... clientes:', Object.keys(parsed).length);
        // CRÍTICO: Pasar 'parsed' directamente como parámetro
        saveOtifToSupabase(parsed).then(function(result){
          console.log('🟡 [OTIF PARSE] Resultado de guardado:', result);
        }).catch(function(e){
          console.error('❌ [OTIF PARSE] Error guardando OTIF en nube:', e);
        });
      } else {
        console.warn('⚠ [OTIF PARSE] No se guardará. oIsAdmin:', oIsAdmin);
      }
    }catch(err){
      notif('Error al leer Excel: '+err.message,'err');
      console.error(err);
    }
  };
  reader.readAsBinaryString(file);
}

/* ── FILTROS ── */
function ohSemanas(){
  if(!oData)return[];
  var s={};
  Object.values(oData).forEach(function(d){
    if(d.semanas)Object.keys(d.semanas).forEach(function(sem){s[sem]=1;});
  });
  return sortSems(Object.keys(s));
}

function ohBuildFiltros(){
  var sems=ohSemanas();
  // Poblar select de semanas
  var semSel=el('ohFSemSelect');
  semSel.innerHTML='<option value="">— Selecciona —</option>';
  sems.forEach(function(s){
    var opt=document.createElement('option');
    opt.value=s;opt.textContent=s+(PERIODOS[s]?' · '+PERIODOS[s]:'');
    semSel.appendChild(opt);
  });

  // Poblar select de clientes
  var cliSel=el('ohFCliSelect');
  cliSel.innerHTML='<option value="">— Selecciona —</option>';
  Object.keys(oData).filter(function(k){return k!=='_causasGlobal';}).sort().forEach(function(k){
    var opt=document.createElement('option');
    opt.value=k;opt.textContent=k;
    cliSel.appendChild(opt);
  });
}

function ohFiltroSem(val){
  oFS=val;
  // Actualizar estado visual
  var todas=el('ohSemTodas');
  var sel=el('ohFSemSelect');
  if(val==='TODAS'){
    todas.classList.add('active');
    sel.value='';
  } else {
    todas.classList.remove('active');
    sel.value=val;
  }
  ohRender();
}
window.ohFiltroSem=ohFiltroSem;

function ohFiltrosCli(val){
  oFC=val;
  var todos=el('ohCliTodos');
  var sel=el('ohFCliSelect');
  if(val==='TODOS'){
    todos.classList.add('active');
    sel.value='';
  } else {
    todos.classList.remove('active');
    sel.value=val;
  }
  ohRender();
}
window.ohFiltrosCli=ohFiltrosCli;

function ohFiltro(tipo,val){
  if(tipo==='linea'){
    oFL=val;
    el('ohFLinea').querySelectorAll('.op').forEach(function(b){
      b.classList.toggle('active',b.dataset.val===val);
    });
  }
  ohRender();
}
window.ohFiltro=ohFiltro;

function ohResetFiltros(){
  oFS='TODAS';oFL='TODAS';oFC='TODOS';
  el('ohSemTodas').classList.add('active');
  el('ohFSemSelect').value='';
  el('ohCliTodos').classList.add('active');
  el('ohFCliSelect').value='';
  el('ohFLinea').querySelectorAll('.op').forEach(function(b){
    b.classList.toggle('active',b.dataset.val==='TODAS');
  });
  ohRender();
}
window.ohResetFiltros=ohResetFiltros;

/* ── DATOS FILTRADOS ── */
function ohDataFilt(){
  if(!oData)return{};
  var out={};
  Object.entries(oData).forEach(function(entry){
    var k=entry[0];var d=entry[1];
    if(k==='_causasGlobal')return;
    if(oFC!=='TODOS'&&k!==oFC)return;
    if(oFL!=='TODAS'&&d.linea!==oFL)return;
    var semanas={};
    Object.entries(d.semanas).forEach(function(se){
      if(oFS==='TODAS'||se[0]===oFS)semanas[se[0]]=se[1];
    });
    var v=0,ot=0,inf=0,otif=0,transito=0;
    Object.values(semanas).forEach(function(sd){
      v+=sd.v;ot+=sd.ot;inf+=sd.inf;otif+=sd.otif;transito+=(sd.transito||0);
    });
    if(v===0&&oFS!=='TODAS')return;
    var viajes=d.viajes.filter(function(vj){return oFS==='TODAS'||vj.sem===oFS;});
    var transitos=d.transitos?d.transitos.filter(function(vj){return oFS==='TODAS'||vj.sem===oFS;}):[]; 
    out[k]={corto:d.corto,linea:d.linea,v:v,ot:ot,inf:inf,otif:otif,
      transito:transito,semanas:semanas,viajes:viajes,transitos:transitos,causas:d.causas};
  });
  return out;
}

function ohTotales(data){
  var v=0,ot=0,inf=0,otif=0,transito=0;
  Object.values(data).forEach(function(d){
    v+=d.v;ot+=d.ot;inf+=d.inf;otif+=d.otif;transito+=(d.transito||0);
  });
  return{v:v,ot:ot,inf:inf,otif:otif,transito:transito};
}

function ohSemTots(data){
  var sems={};
  Object.values(data).forEach(function(d){
    Object.entries(d.semanas).forEach(function(se){
      var s=se[0];var sd=se[1];
      if(!sems[s])sems[s]={v:0,ot:0,inf:0,otif:0,transito:0};
      sems[s].v+=sd.v;sems[s].ot+=sd.ot;sems[s].inf+=sd.inf;sems[s].otif+=sd.otif;
      sems[s].transito+=(sd.transito||0);
    });
  });
  return sems;
}

function ohCausasTot(data){
  var causas={};
  Object.values(data).forEach(function(d){
    if(d.causas)Object.entries(d.causas).forEach(function(ce){
      causas[ce[0]]=(causas[ce[0]]||0)+ce[1];
    });
  });
  return causas;
}

/* ── RENDER ── */
function ohRender(){
  if(!oData)return;
  var data=ohDataFilt();
  var tot=ohTotales(data);
  // Para OTIF: solo viajes que ya entregaron (v - transito)
  var vEntregados=tot.v-tot.transito;
  var pG=pct(tot.otif,vEntregados);
  var pOT=pct(tot.ot,vEntregados);
  var pIF=pct(tot.inf,vEntregados);
  var semTots=ohSemTots(data);

  var titulo='Indicadores generales';
  if(oFC!=='TODOS')titulo=oData[oFC]?oData[oFC].corto:oFC;
  else if(oFL!=='TODAS')titulo=oFL;
  if(oFS!=='TODAS')titulo+=' — '+oFS+(PERIODOS[oFS]?' ('+PERIODOS[oFS]+')':'');
  el('ohKpiTitle').textContent=titulo;
  el('ohTablaTitle').textContent='Detalle por semana'+(oFC!=='TODOS'?' — '+oFC:'');
  el('ohRptCli').textContent=oFC!=='TODOS'?oFC:'todos los clientes';

  ohRenderKPIs(tot,vEntregados,semTots,pG,pOT,pIF);
  ohRenderAnalisis(tot,vEntregados,semTots,pG,pOT,pIF,data);
  ohRenderTrend(semTots);
  ohRenderCausas(ohCausasTot(data));
  ohRenderLineas(data);
  ohRenderSemaforo(pG,pOT,pIF);
  ohRenderRanking(data,semTots);
  ohRenderTabla(semTots,data,vEntregados);
  ohRenderFallos(data);
  ohRenderTransito(data);
}

/* ── KPIs ── */
function ohRenderKPIs(tot,vEnt,semTots,pG,pOT,pIF){
  var sems=sortSems(Object.keys(semTots));
  var lastSem=sems[sems.length-1]||'—';
  var prevSem=sems.length>1?sems[sems.length-2]:null;
  var pLast=lastSem!=='—'?pct(semTots[lastSem].otif,semTots[lastSem].v-(semTots[lastSem].transito||0)):null;
  var pPrev=prevSem?pct(semTots[prevSem].otif,semTots[prevSem].v-(semTots[prevSem].transito||0)):null;
  var trend='';
  if(pLast!==null&&pPrev!==null){
    var diff=pLast-pPrev;
    trend=diff>0?'<span style="color:var(--green)">↑ +'+diff+' pp vs '+prevSem+'</span>':
          diff<0?'<span style="color:var(--danger)">↓ '+diff+' pp vs '+prevSem+'</span>':
          '<span style="color:var(--w4)">= Sin cambio vs '+prevSem+'</span>';
  }

  var kpis=[
    {lbl:'OTIF Global',val:pG,sub:tot.otif+' de '+vEnt+' viajes evaluados',extra:trend,c:col(pG)},
    {lbl:'On Time',val:pOT,sub:tot.ot+' cumplieron ventana ANS',extra:'',c:col(pOT)},
    {lbl:'In Full',val:pIF,sub:tot.inf+' sin novedad de volumen',extra:'',c:col(pIF)},
    {lbl:'Total viajes',valS:String(tot.v),sub:(tot.transito>0?tot.transito+' en tránsito · ':'')+Object.keys(ohDataFilt()).length+' clientes',extra:'',c:'var(--blue)'},
    {lbl:lastSem+' (activa)',val:pLast,sub:PERIODOS[lastSem]||'En curso',extra:trend,c:col(pLast)},
  ];

  el('ohKpis').innerHTML=kpis.map(function(k,i){
    var vTxt=k.valS||(k.val!==null?'—%':'—');
    return'<div class="ok" style="border-top-color:'+k.c+'">'
      +'<div class="ok-lbl">'+k.lbl+'</div>'
      +'<div class="ok-val" id="ohKV'+i+'" style="color:'+k.c+'">'+vTxt+'</div>'
      +'<div class="ok-sub">'+k.sub+'</div>'
      +(k.extra?'<div class="ok-trend">'+k.extra+'</div>':'')
      +'<div class="ok-bar"><div class="ok-bar-f" style="width:'+(k.val||0)+'%;background:'+k.c+'"></div></div>'
      +'</div>';
  }).join('');

  // Animación contadores
  [0,1,2,4].forEach(function(i){
    var vals=[pG,pOT,pIF,pLast];
    var v=[pG,pOT,pIF,null,pLast][i];
    if(v!==null)countUp('ohKV'+i,v,800);
  });
  var v3=el('ohKV3');if(v3)v3.textContent=tot.v;
}

/* ── ANÁLISIS ── */
function ohRenderAnalisis(tot,vEnt,semTots,pG,pOT,pIF,data){
  var sems=sortSems(Object.keys(semTots));
  if(!sems.length){el('ohAnalisisText').textContent='Sin datos suficientes para análisis.';return;}
  var lastSem=sems[sems.length-1];
  var prevSem=sems.length>1?sems[sems.length-2]:null;
  var pLast=pct(semTots[lastSem].otif,semTots[lastSem].v-(semTots[lastSem].transito||0));
  var pPrev=prevSem?pct(semTots[prevSem].otif,semTots[prevSem].v-(semTots[prevSem].transito||0)):null;
  var causas=ohCausasTot(data);
  var causaMax=Object.keys(causas).sort(function(a,b){return causas[b]-causas[a];})[0];

  var txt='';
  if(pG===null){txt='Sin datos suficientes para análisis.';}
  else if(pG>=90){
    txt='El indicador OTIF se encuentra en <strong style="color:var(--green)">nivel óptimo</strong> con un '+pG+'%, superando la meta del 90%. ';
  } else if(pG>=70){
    txt='El indicador OTIF se encuentra en <strong style="color:var(--amber)">En Seguimiento</strong> con un '+pG+'%, por debajo de la meta del 90%. ';
  } else {
    txt='El indicador OTIF <strong style="color:var(--danger)">Requiere Atención</strong> con un '+pG+'%. Es necesario implementar acciones correctivas inmediatas para alcanzar la meta del 90%. ';
  }
  if(pLast!==null&&pPrev!==null){
    var diff=pLast-pPrev;
    if(diff>0)txt+='Se evidencia una <strong style="color:var(--green)">mejora de '+diff+' pp</strong> de '+prevSem+' a '+lastSem+'. ';
    else if(diff<0)txt+='Se evidencia un <strong style="color:var(--danger)">deterioro de '+Math.abs(diff)+' pp</strong> de '+prevSem+' a '+lastSem+'. ';
    else txt+='El resultado se mantiene estable respecto a '+prevSem+'. ';
  }
  if(pIF===100)txt+='El componente <strong>In Full</strong> registra un desempeño perfecto del 100%, sin incidencias de volumen, merma, averías, devoluciones ni rechazos. ';
  else if(pIF!==null&&pIF<100)txt+='El componente <strong>In Full</strong> registra un '+pIF+'%, con oportunidades de mejora relacionadas con: volumen, merma, averías, devoluciones o rechazos en destino. ';
  if(tot.transito>0)txt+='<strong>'+tot.transito+' viaje(s)</strong> se encuentran actualmente en tránsito y han sido excluidos del cálculo del OTIF hasta confirmar su entrega. ';
  if(causaMax)txt+='La principal causa de incumplimiento identificada es <strong>"'+causaMax+'"</strong> con '+causas[causaMax]+' caso(s) registrado(s).';

  el('ohAnalisisText').innerHTML=txt;
}

/* ── TENDENCIA ── */
function ohRenderTrend(semTots){
  var sems=sortSems(Object.keys(semTots)); // ordenadas S1, S2...S10, S11...
  var vals=sems.map(function(s){
    var sd=semTots[s];
    var vEnt=sd.v-(sd.transito||0);
    return pct(sd.otif,vEnt);
  });
  var bgs=vals.map(function(v){
    return v===null?'rgba(255,255,255,.08)':
           v>=90?'rgba(0,217,126,.7)':
           v>=70?'rgba(245,158,11,.7)':'rgba(239,68,68,.7)';
  });
  if(oChTrend)oChTrend.destroy();
  var ctx=el('ohChTrend');
  if(!ctx||!sems.length)return;
  var TB_BG='#131b2a', TB_BD='rgba(255,255,255,.18)', AX='#a0b4cc';
  oChTrend=new Chart(ctx,{
    type:'bar',
    data:{
      labels:sems,
      datasets:[
        {label:'% OTIF',data:vals,backgroundColor:bgs,borderRadius:5,borderSkipped:false,order:2},
        {label:'Meta 90%',data:sems.map(function(){return 90;}),type:'line',
          borderColor:'rgba(239,68,68,.6)',borderDash:[6,3],borderWidth:2,
          pointRadius:0,backgroundColor:'transparent',order:1},
        {label:'Tendencia',data:vals,type:'line',
          borderColor:'rgba(245,158,11,.5)',borderWidth:1.5,
          pointRadius:3,pointBackgroundColor:bgs,
          backgroundColor:'transparent',tension:.3,order:0}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'top',labels:{color:AX,font:{size:10},boxWidth:10,padding:12}},
        tooltip:{backgroundColor:TB_BG,borderColor:TB_BD,borderWidth:1,
          titleColor:'#fff',bodyColor:'#c0cfe8',padding:11,
          callbacks:{label:function(c){return c.dataset.label+': '+(c.parsed.y!==null?c.parsed.y+'%':'En tránsito');}}}
      },
      scales:{
        y:{min:0,max:115,grid:{color:'rgba(160,180,210,.1)'},
          ticks:{color:AX,font:{size:10},callback:function(v){return v+'%';},stepSize:25}},
        x:{grid:{display:false},ticks:{color:AX,font:{size:11},maxRotation:0}}
      }
    }
  });
}

/* ── CAUSAS ── */
function ohRenderCausas(causas){
  var keys=Object.keys(causas).sort(function(a,b){return causas[b]-causas[a];}).slice(0,6);
  var total=Object.values(causas).reduce(function(a,b){return a+b;},0);
  if(oChCausas)oChCausas.destroy();
  var ctx=el('ohChCausas');
  var cols2=['#ef4444','#f59e0b','#E8A020','#8B5CF6','#0891B2','#10B981'];
  var TB_BG='#131b2a', TB_BD='rgba(255,255,255,.18)', AX='#a0b4cc';
  if(ctx&&keys.length){
    oChCausas=new Chart(ctx,{
      type:'doughnut',
      data:{
        labels:keys.map(function(k){return k.length>25?k.slice(0,25)+'...':k;}),
        datasets:[{data:keys.map(function(k){return causas[k];}),
          backgroundColor:cols2.slice(0,keys.length),borderWidth:0,hoverOffset:5}]
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{display:false},
          tooltip:{backgroundColor:TB_BG,borderColor:TB_BD,borderWidth:1,
            titleColor:'#fff',bodyColor:'#c0cfe8',padding:11,
            callbacks:{label:function(c){return c.label+': '+c.parsed+' casos';}}}}}
    });
  }
  if(el('ohCausasLista'))el('ohCausasLista').innerHTML=keys.length?keys.map(function(k,i){
    var pp=total>0?Math.round(causas[k]/total*100):0;
    return'<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:10px">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+cols2[i]+';flex-shrink:0"></span>'
      +'<span style="flex:1;color:var(--w3)">'+(k.length>30?k.slice(0,30)+'...':k)+'</span>'
      +'<span style="color:'+cols2[i]+';font-weight:700;font-family:\'Oswald\',sans-serif">'+pp+'%</span>'
      +'</div>';
  }).join(''):'<div style="font-size:11px;color:var(--w4);text-align:center;padding:1rem">Sin causas registradas</div>';
}

/* ── LÍNEAS ── */
function ohRenderLineas(data){
  var lineas={};
  Object.values(data).forEach(function(d){
    var l=d.linea||'Otra';
    if(!lineas[l])lineas[l]={v:0,ot:0,inf:0,otif:0,transito:0};
    lineas[l].v+=d.v;lineas[l].ot+=d.ot;lineas[l].inf+=d.inf;lineas[l].otif+=d.otif;
    lineas[l].transito+=(d.transito||0);
  });
  var lkeys=Object.keys(lineas);
  var lColors={'Carga Seca':'#d97706','Carga Liquida':'#0891B2','Comex':'#7C3AED'};
  var TB_BG='#131b2a', TB_BD='rgba(255,255,255,.18)', AX='#a0b4cc';
  if(oChLinea)oChLinea.destroy();
  var ctx=el('ohChLinea');
  if(ctx&&lkeys.length){
    oChLinea=new Chart(ctx,{
      type:'doughnut',
      data:{labels:lkeys,datasets:[{
        data:lkeys.map(function(l){return lineas[l].v;}),
        backgroundColor:lkeys.map(function(l){return lColors[l]||'#64748B';}),
        borderWidth:0,hoverOffset:5}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'65%',
        plugins:{legend:{position:'right',labels:{color:AX,font:{size:10},boxWidth:10,padding:8}},
          tooltip:{backgroundColor:TB_BG,borderColor:TB_BD,borderWidth:1,
            titleColor:'#fff',bodyColor:'#c0cfe8',padding:11,
            callbacks:{label:function(c){return c.label+': '+c.parsed+' viajes';}}}}}
    });
  }
  if(el('ohLineaBars'))el('ohLineaBars').innerHTML=lkeys.map(function(l){
    var vEnt=lineas[l].v-(lineas[l].transito||0);
    var lp=pct(lineas[l].otif,vEnt);
    var lc=lColors[l]||'#64748B';
    return'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)">'
      +'<span style="font-size:11px;color:var(--w3)">'+l+'</span>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:80px;height:4px;background:rgba(255,255,255,.08);border-radius:2px">'
      +'<div style="height:4px;border-radius:2px;width:'+(lp||0)+'%;background:'+lc+'"></div></div>'
      +'<span style="font-family:\'Oswald\',sans-serif;font-size:13px;font-weight:600;color:'+lc+';min-width:36px;text-align:right">'+fmt(lp)+'</span>'
      +'</div></div>';
  }).join('');
}

/* ── SEMÁFORO ── */
function ohRenderSemaforo(pG,pOT,pIF){
  el('ohSemaforo').innerHTML=[
    {name:'OTIF Total',detail:'On Time AND In Full',p:pG},
    {name:'On Time',detail:'Ventana ANS por ruta',p:pOT},
    {name:'In Full',detail:'Volumen / merma / averías / rechazos',p:pIF},
  ].map(function(r){
    return'<div class="osbar">'
      +'<div><div class="osbar-name">'+r.name+'</div><div class="osbar-detail">'+r.detail+'</div></div>'
      +'<div class="osbar-track"><div class="osbar-fill" style="width:'+(r.p||0)+'%;background:'+col(r.p)+'"></div></div>'
      +'<div class="osbar-pct" style="color:'+col(r.p)+'">'+fmt(r.p)+'</div>'
      +badge(r.p)+'</div>';
  }).join('');
  var b=pG!==null?(90-pG>0?'–'+(90-pG)+' pp vs meta 90%':'✅ Cumple la meta'):'—';
  el('ohBrecha').textContent=b;
  el('ohBrecha').style.color=pG!==null&&pG>=90?'var(--green)':'var(--danger)';
}

/* ── RANKING ── */
function ohRenderRanking(data,semTots){
  var ranked=Object.entries(data).sort(function(a,b){
    var pA=pct(a[1].otif,a[1].v-(a[1].transito||0));
    var pB=pct(b[1].otif,b[1].v-(b[1].transito||0));
    return(pB??-1)-(pA??-1);
  });
  el('ohRankSem').textContent=oFS!=='TODAS'?'· '+oFS:'';
  el('ohRanking').innerHTML=ranked.length?ranked.map(function(entry,i){
    var k=entry[0];var d=entry[1];
    var vEnt=d.v-(d.transito||0);
    var p=pct(d.otif,vEnt);
    var c2=COLORES[k]||'var(--w4)';
    return'<div class="ork" onclick="ohFiltrosCli(\''+k.replace(/'/g,"\\'")+'\')">'
      +'<div class="ork-n">'+(i+1)+'</div>'
      +'<div class="ork-name">'
      +'<div class="ork-cli"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+c2+';margin-right:6px;vertical-align:middle"></span>'+k+'</div>'
      +'<div class="ork-sub">'+d.v+' viajes'+(d.transito?' · '+d.transito+' en tránsito':'')+' · '+d.linea+'</div></div>'
      +'<div class="ork-bar"><div class="ork-bar-bg"><div class="ork-bar-f" style="width:'+(p||0)+'%;background:'+c2+'"></div></div></div>'
      +'<div class="ork-pct" style="color:'+c2+'">'+fmt(p)+'</div>'
      +badge(p)+'</div>';
  }).join(''):'<div class="ond"><div class="ond-txt">Sin clientes para los filtros</div></div>';
}

/* ── TABLA SEMANAS ── */
function ohRenderTabla(semTots,data,vEnt){
  var sems=sortSems(Object.keys(semTots));
  if(!sems.length){el('ohTablaSem').innerHTML='<div class="ond"><div class="ond-txt">Sin datos</div></div>';return;}
  var rows=sems.map(function(s){
    var sd=semTots[s];
    var sinV=sd.v===0;
    var vEntS=sd.v-(sd.transito||0);
    var sp=sinV?null:pct(sd.otif,vEntS);
    var isA=oFS===s;
    var transit=sd.transito||0;
    return'<tr style="'+(isA?'background:rgba(245,158,11,.06)':'')+'">'
      +'<td><span style="font-family:\'Oswald\',sans-serif;font-size:11px;color:'+(isA?'var(--amber)':'var(--w4)')+'">'+s+(isA?' ◀':'')+' <span style="font-size:9px;color:var(--w4)">'+(PERIODOS[s]||'')+'</span></span></td>'
      +'<td>'+(sinV?'—':sd.v)+(transit>0?' <span style="font-size:9px;color:var(--blue)">('+transit+' 🚛)</span>':'')+'</td>'
      +'<td>'+(sinV?'—':sd.ot)+'</td>'
      +'<td>'+(sinV?'—':sd.inf)+'</td>'
      +'<td>'+(sinV?'—':sd.otif)+'</td>'
      +'<td style="font-weight:700;color:'+col(sp)+'">'+fmt(sp)+'</td>'
      +'<td>'+badge(sp)+'</td></tr>';
  }).join('');
  var tot=ohTotales(data);
  var pT=pct(tot.otif,tot.v-tot.transito);
  el('ohTablaSem').innerHTML='<table class="otbl">'
    +'<thead><tr><th style="text-align:left">Semana</th>'
    +'<th>Viajes</th><th>OT</th><th>IF</th><th>OTIF✓</th><th>%</th><th>Estado</th>'
    +'</tr></thead><tbody>'+rows+'</tbody>'
    +'<tfoot><tr><td>TOTAL</td><td>'+tot.v+(tot.transito>0?' <span style="font-size:9px;color:var(--blue)">('+tot.transito+' 🚛)</span>':'')+'</td><td>'+tot.ot+'</td><td>'+tot.inf+'</td><td>'+tot.otif+'</td>'
    +'<td style="color:'+col(pT)+';font-size:14px">'+fmt(pT)+'</td><td>'+badge(pT)+'</td></tr></tfoot></table>';
}

/* ── FALLOS con paginación "Ver más" ── */
var oFallosAll=[];
var oFallosVisible=5;

function ohRenderFallos(data){
  oFallosAll=[];
  Object.values(data).forEach(function(d){d.viajes.forEach(function(v){oFallosAll.push(v);});});
  oFallosVisible=5;
  ohRenderFallosUI();
}

function ohRenderFallosUI(){
  var el2=el('ohFallos');
  if(!oFallosAll.length){
    el2.innerHTML='<div class="ond" style="padding:1.5rem"><div style="color:var(--green);font-size:28px;margin-bottom:8px">✅</div><div class="ond-txt">Sin incumplimientos</div></div>';
    return;
  }
  var visibles=oFallosAll.slice(0,oFallosVisible);
  var html=visibles.map(function(vj){
    return'<div class="ofr">'
      +'<div class="ofr-dot" style="background:var(--danger)"></div>'
      +'<div style="flex:1">'
      +'<div class="ofr-ruta">'+vj.orig+' → '+vj.dest+'</div>'
      +'<div class="ofr-sub">'+vj.man+' · '+vj.sem+(vj.fecha?' · '+vj.fecha:'')+' · OT:'+vj.ot+' · IF:'+vj.inf+(vj.hrs?' · '+vj.hrs+'h vs '+vj.hmax+'h':'')+'</div>'
      +(vj.causa?'<div class="ofr-causa">⚠ '+vj.causa+(vj.resp?' — '+vj.resp:'')+'</div>':'')
      +'</div></div>';
  }).join('');

  if(oFallosAll.length>oFallosVisible){
    var restantes=oFallosAll.length-oFallosVisible;
    html+='<button class="ver-mas-btn" onclick="ohVerMasFallos()">Ver '+restantes+' incumplimiento(s) más ↓</button>';
  }
  el2.innerHTML=html;
}

function ohVerMasFallos(){
  oFallosVisible+=5;
  ohRenderFallosUI();
}
window.ohVerMasFallos=ohVerMasFallos;

/* ── EN TRÁNSITO ── */
function ohRenderTransito(data){
  var todos=[];
  Object.values(data).forEach(function(d){if(d.transitos)d.transitos.forEach(function(v){todos.push(v);});});
  var el2=el('ohTransito');
  if(!todos.length){
    el2.innerHTML='<div style="font-size:12px;color:var(--w4);padding:1rem 0">Sin vehículos en tránsito para los filtros actuales.</div>';
    return;
  }
  el2.innerHTML='<div style="font-size:11px;color:var(--blue);margin-bottom:8px">'+todos.length+' viaje(s) excluidos del OTIF — pendientes de entrega</div>'
    +todos.slice(0,5).map(function(vj){
      return'<div class="otr">'
        +'<div class="otr-dot"></div>'
        +'<div style="flex:1">'
        +'<div style="font-size:12px;font-weight:500;color:var(--w2)">'+vj.orig+' → '+vj.dest+'</div>'
        +'<div style="font-size:10px;color:var(--w4);margin-top:2px">'+vj.man+' · '+vj.sem+(vj.fecha?' · '+vj.fecha:'')+'</div>'
        +'</div>'
        +'<span class="ob2 ob-transit" style="flex-shrink:0">🚛 En tránsito</span>'
        +'</div>';
    }).join('')+(todos.length>5?'<div style="font-size:10px;color:var(--w4);margin-top:8px;text-align:center">+'+( todos.length-5)+' más</div>':'');
}

/* ── INIT ── */
window.otifInit=function(){
  ohCheckAdmin();
  if(oData)ohRender();
};

})();
