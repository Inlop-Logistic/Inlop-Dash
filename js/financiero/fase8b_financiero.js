<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>INLOP · Dashboard Financiero v6</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>
(function(){var s=['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'];var i=0;function n(){if(i>=s.length){window._xlsxFailed=true;return;}var sc=document.createElement('script');sc.src=s[i++];sc.onload=function(){window._xlsxReady=true;};sc.onerror=n;document.head.appendChild(sc);}n();})();
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
:root{
  --red:#CF0613;--red2:#E8192C;
  --navy:#0A0E27;--navy2:#0f1535;--navy3:#141935;--navy4:#1a2040;
  --gold:#E8A020;--green:#00d97e;--amber:#f0a500;--blue:#3b82f6;--purple:#8b5cf6;
  --line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.05);
  --w2:rgba(255,255,255,.2);--w4:rgba(255,255,255,.4);--w6:rgba(255,255,255,.6);--w8:rgba(255,255,255,.8);
  --txt:#b8cce0;--txt2:#8099b8;
  --liq:#3b82f6;--seca:#E8A020;
  --sb:220px;--topbar:52px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'DM Sans',sans-serif;background:var(--navy);color:#e8eef8;font-size:14px}
body::before{content:'';position:fixed;top:0;left:0;right:0;height:2px;z-index:9999;background:linear-gradient(90deg,#012A6B 0%,var(--red) 35%,var(--gold) 65%,#012A6B 100%)}

.layout{display:grid;grid-template-columns:var(--sb) 1fr;grid-template-rows:auto var(--topbar) 1fr;height:100vh;padding-top:2px}
.layout.collapsed{--sb:60px}

/* TOPBAR */
.topbar{grid-column:1/-1;background:rgba(10,14,39,.98);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 20px 0 0;gap:12px;z-index:100}
.tb-brand{width:var(--sb);flex-shrink:0;display:flex;align-items:center;gap:10px;padding:0 16px;border-right:1px solid var(--line);height:100%;transition:width .25s}
.layout.collapsed .tb-brand{width:60px;justify-content:center;padding:0}
.tb-logo{width:30px;height:30px;border-radius:7px;background:linear-gradient(135deg,#012A6B,var(--red));display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:10px;font-weight:700;color:#fff;letter-spacing:.5px;flex-shrink:0;cursor:default}
.tb-names{overflow:hidden;transition:opacity .2s}
.layout.collapsed .tb-names{opacity:0;width:0;overflow:hidden}
.tb-name{font-family:'Oswald',sans-serif;font-size:13px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#fff;white-space:nowrap}
.tb-sub{font-size:9px;color:var(--txt2);letter-spacing:.5px;white-space:nowrap}
.tb-collapse{background:none;border:1px solid var(--line);border-radius:6px;color:var(--txt2);width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:4px;transition:all .15s;flex-shrink:0}
.tb-collapse:hover{border-color:var(--w4);color:#fff}
.tb-center{flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tb-right{display:flex;align-items:center;gap:8px;margin-left:auto}
.tb-badge{display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:3px 9px;border-radius:100px;font-family:'Oswald',sans-serif;letter-spacing:1.5px;text-transform:uppercase;border:1px solid}
.badge-live{background:rgba(0,217,126,.08);color:var(--green);border-color:rgba(0,217,126,.2)}
.badge-admin{background:rgba(207,6,19,.1);color:var(--red2);border-color:rgba(207,6,19,.25)}
.badge-warn{background:rgba(240,165,0,.1);color:var(--amber);border-color:rgba(240,165,0,.25);animation:warnPulse 2s infinite}
@keyframes warnPulse{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.tb-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
.badge-live::before{animation:pulse 2s infinite}
.btn-sm{display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;border:1px solid;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s}
.btn-gold{border-color:var(--gold);color:var(--gold);background:transparent}.btn-gold:hover{background:rgba(232,160,32,.1)}
.btn-blue{border-color:var(--blue);color:var(--blue);background:transparent}.btn-blue:hover{background:rgba(59,130,246,.1)}
.btn-present{border-color:var(--purple);color:var(--purple);background:transparent}.btn-present:hover{background:rgba(139,92,246,.1)}

/* GLOBAL FILTERS BAR */
.gfilters{grid-column:1/-1;background:rgba(15,21,53,.98);border-bottom:1px solid var(--line);padding:8px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;z-index:90}
.gfilter{display:flex;align-items:center;gap:6px}
.gflbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt2);font-family:'Oswald',sans-serif;font-weight:500}
.gfsel{background:#1a2040;border:1px solid var(--line);border-radius:6px;color:#fff;font-family:'DM Mono',monospace;font-size:11px;padding:5px 26px 5px 10px;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2710%27%20height%3D%276%27%20viewBox%3D%270%200%2010%206%27%3E%3Cpath%20fill%3D%27%23E8A020%27%20d%3D%27M0%200l5%206%205-6z%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;min-width:130px;transition:all .15s}
.gfsel:hover{border-color:var(--gold)}
.gfsel:focus{border-color:var(--gold);box-shadow:0 0 0 2px rgba(232,160,32,.15)}
.gfsel option{background:#1a2040;color:#fff;padding:6px}
.gflinea-liq{border-color:var(--liq);color:var(--liq)!important;font-weight:600}
.gflinea-seca{border-color:var(--seca);color:var(--seca)!important;font-weight:600}
.gfsep{width:1px;height:18px;background:var(--line);flex-shrink:0}
.gfreset{background:transparent;border:1px solid var(--line);color:var(--txt2);font-size:10px;font-family:'Oswald',sans-serif;letter-spacing:1px;padding:5px 10px;border-radius:5px;cursor:pointer;text-transform:uppercase}
.gfreset:hover{border-color:var(--red);color:var(--red2)}
.gfinfo{font-size:10px;color:var(--txt2);font-family:'DM Mono',monospace;margin-left:auto;padding:4px 10px;background:rgba(255,255,255,.03);border-radius:5px;border:1px solid var(--line)}

/* SIDEBAR */
.sidebar{background:var(--navy2);border-right:1px solid var(--line);padding:16px 0;overflow-y:auto;overflow-x:hidden;transition:width .25s}
.sidebar::-webkit-scrollbar{width:3px}.sidebar::-webkit-scrollbar-thumb{background:var(--line)}
.sb-section{margin-bottom:6px}
.sb-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);padding:0 16px 6px;font-family:'Oswald',sans-serif;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .2s}
.layout.collapsed .sb-label{opacity:0}
.sb-item{display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;transition:all .15s;border-left:2px solid transparent;white-space:nowrap;color:var(--txt2);font-size:12px;position:relative}
.layout.collapsed .sb-item{padding:9px;justify-content:center}
.sb-item:hover{color:#fff;background:rgba(255,255,255,.04)}
.sb-item.active{color:#fff;background:rgba(207,6,19,.1);border-left-color:var(--red)}
.layout.collapsed .sb-item.active{border-left-color:transparent;border-right:2px solid var(--red)}
.sb-ico{font-size:16px;flex-shrink:0;width:18px;text-align:center}
.sb-txt{flex:1;overflow:hidden;transition:opacity .2s,width .2s}
.layout.collapsed .sb-txt{opacity:0;width:0}
.sb-badge{font-size:9px;padding:2px 6px;border-radius:100px;font-family:'Oswald',sans-serif;font-weight:600;flex-shrink:0;background:rgba(207,6,19,.2);color:var(--red2)}
.layout.collapsed .sb-badge{display:none}
.sb-divider{height:1px;background:var(--line);margin:8px 12px}
.layout.collapsed .sb-item::after{content:attr(data-tip);position:absolute;left:56px;background:var(--navy3);color:#fff;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--line);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s;z-index:200}
.layout.collapsed .sb-item:hover::after{opacity:1}

/* CONTENT */
.content{overflow-y:auto;overflow-x:hidden;background:var(--navy);padding:20px 24px 60px}
.content::-webkit-scrollbar{width:4px}.content::-webkit-scrollbar-thumb{background:var(--line)}

.page-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.page-title{font-family:'Oswald',sans-serif;font-size:22px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#fff}
.page-sub{font-size:11px;color:var(--txt2);margin-top:3px}
.line-chips{display:flex;gap:8px;align-items:center}
.lchip{padding:4px 10px;border-radius:100px;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;border:1px solid;display:inline-flex;align-items:center;gap:5px}
.lchip-liq{background:rgba(59,130,246,.08);color:var(--liq);border-color:rgba(59,130,246,.25)}
.lchip-seca{background:rgba(232,160,32,.08);color:var(--seca);border-color:rgba(232,160,32,.25)}

/* ALERT BAR */
.alert-bar{display:none;background:rgba(207,6,19,.08);border:1px solid rgba(207,6,19,.25);border-radius:8px;padding:10px 16px;margin-bottom:16px;gap:10px;align-items:flex-start}
.alert-bar.vis{display:flex}
.alert-bar-ico{font-size:16px;flex-shrink:0;margin-top:1px}
.alert-bar-body{flex:1;font-size:12px;color:var(--txt);line-height:1.7}
.alert-bar-title{font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:1px;color:var(--red2);margin-bottom:2px}

/* KPI */
.kpi-row{display:grid;gap:12px;margin-bottom:16px}
.kpi-row-4{grid-template-columns:repeat(4,1fr)}
.kpi-row-3{grid-template-columns:repeat(3,1fr)}
.kpi-row-2{grid-template-columns:repeat(2,1fr)}
.kcard{background:var(--navy3);border:1px solid var(--line);border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;transition:border-color .2s}
.kcard:hover{border-color:var(--w2)}
.kcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--kc,var(--gold))}
.kcard-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:'Oswald',sans-serif;margin-bottom:6px}
.kcard-val{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;color:var(--kc,#fff);line-height:1;margin-bottom:4px}
.kcard-footer{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.kcard-sub{font-size:10px;color:var(--txt2)}
.kcard-delta{font-size:10px;font-weight:500;display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:100px}
.delta-up{color:var(--green);background:rgba(0,217,126,.1)}
.delta-down{color:#ff6070;background:rgba(207,6,19,.1)}
.delta-flat{color:var(--txt2);background:rgba(255,255,255,.06)}
.kcard-split{display:flex;gap:8px;font-size:10px;color:var(--txt2);margin-top:5px}
.kcard-splititem{display:flex;align-items:center;gap:3px}
.kcard-splititem.liq{color:var(--liq)}.kcard-splititem.seca{color:var(--seca)}

.kcard-ico{position:absolute;top:12px;right:12px;font-size:22px;opacity:.15}

/* PANEL */
.panel{background:var(--navy3);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:14px}
.panel-hdr{padding:12px 16px;border-bottom:1px solid var(--line2);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.02);gap:10px;flex-wrap:wrap}
.panel-title{font-family:'Oswald',sans-serif;font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--w8)}
.panel-meta{font-size:10px;color:var(--txt2);font-family:'DM Mono',monospace}
.chart-wrap{position:relative;padding:12px 16px 14px}
.chart-wrap canvas{max-height:220px}

/* ═══ FLUJO DE CAJA ═══ */
.flujo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.flujo-card{border-radius:12px;padding:16px;position:relative;overflow:hidden;border:1px solid}
.flujo-card-ent{background:linear-gradient(135deg,rgba(0,217,126,.12),rgba(0,179,104,.05));border-color:rgba(0,217,126,.25)}
.flujo-card-pag{background:linear-gradient(135deg,rgba(207,6,19,.12),rgba(180,5,17,.05));border-color:rgba(207,6,19,.25)}
.flujo-card-ban{background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(37,99,235,.05));border-color:rgba(59,130,246,.25)}
.flujo-card-net{background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(109,40,217,.05));border-color:rgba(139,92,246,.25)}
.flujo-card-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;font-family:'Oswald',sans-serif;margin-bottom:6px;color:var(--txt2)}
.flujo-card-val{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;line-height:1;margin-bottom:4px}
.flujo-card-full{font-size:10px;color:var(--txt2);font-family:'DM Mono',monospace;margin-bottom:6px}
.flujo-card-ico{position:absolute;top:12px;right:14px;font-size:24px;opacity:.15}
.flujo-tl-item{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line2);transition:background .15s}
.flujo-tl-item:hover{background:rgba(255,255,255,.025)}
.flujo-tl-item:last-child{border-bottom:none}
.flujo-tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.flujo-tl-body{flex:1}
.flujo-tl-title{font-size:12px;color:#fff;font-weight:500}
.flujo-tl-sub{font-size:10px;color:var(--txt2)}
.flujo-tl-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;text-align:right}
.flujo-tl-date{font-size:10px;color:var(--txt2);text-align:right}
.flujo-posicion{border-radius:10px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.flujo-pos-pos{background:linear-gradient(135deg,rgba(0,217,126,.1),rgba(0,217,126,.03));border:1px solid rgba(0,217,126,.3)}
.flujo-pos-neg{background:linear-gradient(135deg,rgba(207,6,19,.1),rgba(207,6,19,.03));border:1px solid rgba(207,6,19,.3)}

/* ═══ SEARCH INPUT ═══ */
.search-wrap{padding:10px 16px;border-bottom:1px solid var(--line2)}
.search-input{width:100%;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:7px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;padding:8px 14px;outline:none;transition:all .15s}
.search-input::placeholder{color:var(--txt2)}
.search-input:focus{border-color:var(--gold);background:rgba(255,255,255,.08)}

/* ═══ KPI FULL TOOLTIP ═══ */
.kcard-fullnum{font-family:'DM Mono',monospace;font-size:10px;color:var(--txt2);margin-top:2px;letter-spacing:.5px}

/* ═══ PARTICIPACION CARD ═══ */
.part-card{border-radius:10px;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(135deg,var(--navy4),var(--navy3));position:relative;overflow:hidden;grid-column:span 1}
.part-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--liq),var(--seca))}
.part-lbl-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:'Oswald',sans-serif;margin-bottom:10px}
.part-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.part-row:last-of-type{margin-bottom:0}
.part-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.part-lbl{font-size:10px;color:var(--txt);flex:1}
.part-pct{font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;line-height:1}
.part-sub{font-family:'DM Mono',monospace;font-size:9px;color:var(--txt2);margin-top:1px}
.part-bar-track{height:3px;background:rgba(255,255,255,.06);border-radius:2px;margin-top:3px;overflow:hidden}
.part-bar-fill{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.4,0,.2,1)}
/* Cart chips */
.cart-chip.active{background:rgba(255,255,255,.12)!important;border-color:rgba(255,255,255,.4)!important;color:#fff!important}
button.cart-chip:hover{opacity:.85;transform:translateY(-1px)}
/* Cart footer totals */
#tblCartFoot tr{background:#1a2040}
#tblCartFoot td{padding:10px 14px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;border-top:2px solid var(--gold);color:var(--gold)}
#tblCartFoot td.mono{font-family:'DM Mono',monospace;font-size:11px}

.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}

/* TABLES */
.tbl-wrap{overflow-x:auto;max-height:600px;overflow-y:auto}
.tbl-wrap::-webkit-scrollbar{width:6px;height:6px}.tbl-wrap::-webkit-scrollbar-thumb{background:var(--line)}
table{width:100%;border-collapse:collapse;font-size:12px}
thead{position:sticky;top:0;z-index:5}
thead tr{background:#1a2040}
th{padding:10px 14px;text-align:left;font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);border-bottom:1px solid var(--line);white-space:nowrap;background:#1a2040}
td{padding:10px 14px;border-bottom:1px solid var(--line2);color:var(--txt);vertical-align:middle}
tr.tr-main{cursor:pointer;transition:background .15s}
tr.tr-main:hover td{background:rgba(232,160,32,.06)}
tr.tr-main.expanded td{background:rgba(232,160,32,.1)}
tr.tr-main.expanded td:first-child{border-left:2px solid var(--gold)}
tr.tr-detail{background:rgba(255,255,255,.02);display:none}
tr.tr-detail.show{display:table-row}
tr.tr-detail td{padding:0;border-bottom:1px solid var(--line2)}
.detail-wrap{padding:10px 16px 14px 36px;background:rgba(0,0,0,.15);border-left:2px solid var(--gold)}
.detail-title{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.detail-tbl{width:100%;border-collapse:collapse;font-size:11px;background:transparent}
.detail-tbl thead tr{background:rgba(255,255,255,.04)}
.detail-tbl th{padding:6px 10px;font-size:8px;letter-spacing:1.5px;background:rgba(255,255,255,.04);color:var(--txt2);border-bottom:1px solid var(--line2)}
.detail-tbl td{padding:5px 10px;border-bottom:1px solid var(--line2);font-size:10px}
.detail-tbl tr:last-child td{border-bottom:none}
td.mono{font-family:'DM Mono',monospace;font-size:11px}
td.r{text-align:right}
td.c{text-align:center}
.expand-btn{background:transparent;border:none;color:var(--gold);cursor:pointer;font-size:14px;padding:0 4px;border-radius:4px;transition:all .15s;font-family:'DM Mono',monospace}
.expand-btn:hover{background:rgba(232,160,32,.15)}
.expand-btn.rotated{transform:rotate(90deg);color:var(--red2)}

/* PILLS */
.pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:100px;font-size:9px;font-family:'Oswald',sans-serif;letter-spacing:1px;text-transform:uppercase;border:1px solid;white-space:nowrap}
.pg{background:rgba(0,217,126,.08);color:var(--green);border-color:rgba(0,217,126,.2)}
.pr{background:rgba(207,6,19,.08);color:#ff4d5c;border-color:rgba(207,6,19,.2)}
.pa{background:rgba(240,165,0,.08);color:var(--amber);border-color:rgba(240,165,0,.2)}
.pb{background:rgba(59,130,246,.08);color:#60a5fa;border-color:rgba(59,130,246,.2)}
.pp{background:rgba(139,92,246,.08);color:#a78bfa;border-color:rgba(139,92,246,.2)}
.pn{background:rgba(255,255,255,.05);color:var(--txt2);border-color:var(--line)}
.pliq{background:rgba(59,130,246,.08);color:var(--liq);border-color:rgba(59,130,246,.25)}
.pseca{background:rgba(232,160,32,.08);color:var(--seca);border-color:rgba(232,160,32,.25)}
.db{padding:2px 7px;border-radius:4px;font-family:'DM Mono',monospace;font-size:9px;display:inline-block}
.db-r{background:rgba(207,6,19,.15);color:#ff6070}
.db-a{background:rgba(240,165,0,.15);color:var(--amber)}
.db-g{background:rgba(0,217,126,.1);color:var(--green)}

.prog-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.prog-lbl{font-size:11px;color:var(--txt);width:160px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prog-track{flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.prog-fill{height:100%;border-radius:3px;transition:width .6s cubic-bezier(.4,0,.2,1)}
.prog-val{font-family:'DM Mono',monospace;font-size:10px;color:var(--txt2);width:80px;text-align:right;flex-shrink:0}

/* MODALS */
.modal-bg{display:none;position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);align-items:center;justify-content:center}
.modal-bg.vis{display:flex}
.modal{background:var(--navy2);border:1px solid var(--line);border-radius:14px;padding:32px;width:min(560px,92vw);max-height:90vh;overflow-y:auto}
.modal-title{font-family:'Oswald',sans-serif;font-size:18px;color:#fff;margin-bottom:4px}
.modal-sub{font-size:12px;color:var(--txt2);margin-bottom:22px;line-height:1.6}
.mode-row{display:flex;gap:8px;margin-bottom:16px}
.mode-btn{flex:1;padding:8px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--txt2);font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s}
.mode-btn.active{background:var(--gold);color:#0d1520;border-color:var(--gold);font-weight:700}
.btn-row{display:flex;gap:10px;margin-top:18px}
.btn-primary{flex:1;padding:10px;border-radius:7px;border:none;background:var(--red);color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:background .15s}
.btn-primary:hover{background:var(--red2)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{padding:10px 18px;border-radius:7px;border:1px solid var(--line);background:transparent;color:var(--w4);font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s}
.btn-ghost:hover{border-color:var(--w2);color:var(--w6)}

.pin-modal{display:none;position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.8);backdrop-filter:blur(8px);align-items:center;justify-content:center}
.pin-modal.vis{display:flex}
.pin-box{background:var(--navy2);border:1px solid var(--line);border-radius:12px;padding:28px;width:280px;text-align:center}
.pin-title{font-family:'Oswald',sans-serif;font-size:17px;color:#fff;margin-bottom:4px}
.pin-sub{font-size:11px;color:var(--txt2);margin-bottom:18px}
.pin-dots{display:flex;justify-content:center;gap:10px;margin-bottom:18px}
.pin-dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--line);transition:all .15s}
.pin-dot.filled{background:var(--gold);border-color:var(--gold)}
.pin-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.pin-k{padding:11px;border-radius:7px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#fff;font-family:'Oswald',sans-serif;font-size:15px;cursor:pointer;transition:all .15s}
.pin-k:hover{background:rgba(255,255,255,.08);border-color:var(--gold)}
.pin-err{font-size:11px;color:#ff6070;margin-top:8px;min-height:16px}

.toast{position:fixed;bottom:20px;right:20px;z-index:9999;padding:11px 18px;border-radius:7px;background:rgba(10,14,39,.98);border:1px solid var(--line);font-size:12px;color:var(--w8);transform:translateY(60px);opacity:0;transition:all .3s cubic-bezier(.4,0,.2,1);pointer-events:none;max-width:320px}
.toast.show{transform:translateY(0);opacity:1}
.toast.ok{border-color:rgba(0,217,126,.3)}.toast.err{border-color:rgba(207,6,19,.3)}.toast.info{border-color:rgba(232,160,32,.3)}

.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;text-align:center}
.empty-ico{font-size:40px;opacity:.3}
.empty-title{font-family:'Oswald',sans-serif;font-size:16px;color:var(--w4)}
.empty-sub{font-size:11px;color:var(--txt2);max-width:300px;line-height:1.7}

body.present .sidebar{display:none}
body.present .layout{
  grid-template-columns:1fr;
  grid-template-rows:auto auto auto 1fr;
}
body.present .topbar{
  grid-column:1;
  background:rgba(5,8,22,.99);
  border-bottom:1px solid rgba(207,6,19,.3);
  padding:0 32px;
}
body.present .tb-brand{
  display:none;
}
body.present .gfilters{
  grid-column:1;
  display:flex;
  background:rgba(5,8,22,.97);
  padding:8px 32px;
  border-bottom:1px solid rgba(255,255,255,.06);
}
body.present .content{
  grid-column:1;
  padding:28px 48px 60px;
}
/* Navegación rápida de módulos en modo presentación */
.present-nav{display:none}
body.present .present-nav{
  display:flex;
  grid-column:1;
  background:rgba(5,8,22,.98);
  border-bottom:1px solid rgba(255,255,255,.06);
  padding:0 32px;
  gap:4px;
  overflow-x:auto;
}
.present-nav-item{
  padding:10px 20px;
  font-family:'Oswald',sans-serif;
  font-size:11px;
  letter-spacing:1.5px;
  text-transform:uppercase;
  color:var(--txt2);
  cursor:pointer;
  border-bottom:2px solid transparent;
  transition:all .15s;
  white-space:nowrap;
  background:transparent;
  border-left:none;border-right:none;border-top:none;
}
.present-nav-item:hover{color:#fff;border-bottom-color:rgba(255,255,255,.2)}
.present-nav-item.active{color:#fff;border-bottom-color:var(--red)}
/* Escalar KPIs en presentación */
body.present .kcard-val{font-size:28px}
body.present .page-title{font-size:26px}
body.present .kpi-row-4{grid-template-columns:repeat(4,1fr)}
body.present .kpi-row-3{grid-template-columns:repeat(3,1fr)}
/* Botón de salir visible */
body.present .btn-present{
  background:rgba(207,6,19,.15);
  border-color:var(--red);
  color:var(--red2);
  font-weight:600;
}
/* Ocultar botones de admin en presentación */
body.present #fhLoadBtn{display:none!important}
body.present #adminChip{display:none!important}

#fileWarn{display:none;background:#7c2d12;color:#fed7aa;padding:8px 20px;font-size:11px;text-align:center;line-height:1.5;position:relative;z-index:9000}

@media(max-width:1100px){.kpi-row-4{grid-template-columns:repeat(2,1fr)}.g2,.g3{grid-template-columns:1fr}}
@media(max-width:768px){.layout{grid-template-columns:0 1fr}.sidebar{display:none}}
</style>
</head>
<body>



<div class="layout" id="layout">

<!-- TOPBAR -->
<header class="topbar">
  <div class="tb-brand">
    <div class="tb-logo" onclick="fhBrandClick()" title="5 clics = Admin">IN</div>
    <div class="tb-names">
      <div class="tb-name">Financiero</div>
      <div class="tb-sub">INLOP · BI Dashboard v6</div>
    </div>
    <button class="tb-collapse" onclick="toggleSidebar()">☰</button>
  </div>
  <!-- Logo solo para modo presentación -->
  <div id="presentLogo" style="display:none;align-items:center;gap:14px">
    <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#012A6B,var(--red));display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;color:#fff;letter-spacing:.5px;border:1px solid rgba(255,255,255,.15)">IN</div>
    <div>
      <div style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#fff">Dashboard Financiero</div>
      <div style="font-size:9px;color:var(--txt2);letter-spacing:1px">INLOP · Integral Logistics Operations S.A.S.</div>
    </div>
  </div>
  <div class="tb-center">
    <span class="tb-badge badge-warn" id="alertChip" style="display:none">⚠ Alertas</span>
    <span class="tb-badge badge-live" id="liveChip" style="display:none">Nube activa</span>
    <span class="tb-badge badge-admin" id="adminChip" style="display:none">Admin</span>
    <!-- Título del módulo en presentación -->
    <span id="presentModulo" style="display:none;font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);padding:4px 14px;border:1px solid rgba(232,160,32,.2);border-radius:100px;background:rgba(232,160,32,.06)"></span>
  </div>
  <div class="tb-right">
    <button class="btn-sm" style="border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.75);background:rgba(255,255,255,.06)" onclick="if(window.parent&&window.parent.volverPortal)window.parent.volverPortal();else if(window.top&&window.top.volverPortal)window.top.volverPortal();" onmouseover="this.style.background='rgba(255,255,255,.14)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,.06)';this.style.color='rgba(255,255,255,.75)'">← Portada</button>
    <button class="btn-sm btn-present" id="btnPresent" onclick="togglePresent()">⛶ Presentación</button>
    <button class="btn-sm" style="border-color:#10b981;color:#10b981" onclick="fhDownloadMaestro()" title="Descargar Maestro">⬇ Maestro</button>
    <button class="btn-sm btn-blue" onclick="fhLoadFromSupabase()">↻ Sincronizar</button>
    <button class="btn-sm btn-gold" id="fhLoadBtn" style="display:none" onclick="fhOpenUpload()">↑ Cargar Maestro</button>
  </div>
</header>

<!-- BARRA DE NAVEGACIÓN MODO PRESENTACIÓN -->
<nav class="present-nav" id="presentNav">
  <button class="present-nav-item active" data-pview="resumen" onclick="fhPresentNav(this,'resumen')">◈ Resumen Ejecutivo</button>
  <button class="present-nav-item" data-pview="flujo" onclick="fhPresentNav(this,'flujo')">💧 Flujo de Caja</button>
  <button class="present-nav-item" data-pview="facturacion" onclick="fhPresentNav(this,'facturacion')">🧾 Facturación</button>
  <button class="present-nav-item" data-pview="cartera" onclick="fhPresentNav(this,'cartera')">📋 Cartera</button>
  <button class="present-nav-item" data-pview="bancos" onclick="fhPresentNav(this,'bancos')">🏦 Bancos</button>
  <button class="present-nav-item" data-pview="saldos" onclick="fhPresentNav(this,'saldos')">💸 Saldos</button>
  <button class="present-nav-item" data-pview="admin" onclick="fhPresentNav(this,'admin')">💼 Administrativos</button>
</nav>

<!-- GLOBAL FILTERS -->
<div class="gfilters">
  <div class="gfilter">
    <span class="gflbl">📊 Línea Negocio</span>
    <select class="gfsel" id="filGLinea" onchange="fApplyGlobal()">
      <option value="TODOS">Todas las líneas</option>
      <option value="CARGA LIQUIDA">🟦 Carga Líquida</option>
      <option value="CARGA SECA">🟧 Carga Seca</option>
    </select>
  </div>
  <div class="gfsep"></div>
  <div class="gfilter">
    <span class="gflbl">📅 Mes</span>
    <select class="gfsel" id="filGMes" onchange="fApplyGlobal()">
      <option value="TODOS">Todos los meses</option>
    </select>
  </div>
  <div class="gfsep"></div>
  <div class="gfilter">
    <span class="gflbl">📆 Semana</span>
    <select class="gfsel" id="filGSem" onchange="fApplyGlobal()">
      <option value="TODOS">Todas las semanas</option>
    </select>
  </div>
  <div class="gfsep"></div>
  <div class="gfilter">
    <span class="gflbl">👥 Cliente</span>
    <select class="gfsel" id="filGCli" onchange="fApplyGlobal()" style="min-width:180px">
      <option value="TODOS">Todos los clientes</option>
    </select>
  </div>
  <button class="gfreset" onclick="fResetFilters()">✕ Limpiar</button>
  <span class="gfinfo" id="gfInfo">—</span>
</div>

<!-- SIDEBAR -->
<nav class="sidebar" id="sidebar">
  <div class="sb-section">
    <div class="sb-label">Principal</div>
    <div class="sb-item active" data-view="resumen" data-tip="Resumen Ejecutivo" onclick="showView('resumen')">
      <span class="sb-ico">◈</span><span class="sb-txt">Resumen Ejecutivo</span>
    </div>
    <div class="sb-item" data-view="flujo" data-tip="Flujo de Caja" onclick="showView('flujo')">
      <span class="sb-ico">💧</span><span class="sb-txt">Flujo de Caja</span>
    </div>
  </div>
  <div class="sb-divider"></div>
  <div class="sb-section">
    <div class="sb-label">Módulos</div>
    <div class="sb-item" data-view="facturacion" data-tip="Facturación" onclick="showView('facturacion')">
      <span class="sb-ico">🧾</span><span class="sb-txt">Facturación</span>
    </div>
    <div class="sb-item" data-view="cartera" data-tip="Cartera" onclick="showView('cartera')">
      <span class="sb-ico">📋</span><span class="sb-txt">Cartera</span><span class="sb-badge" id="sbCartAlert" style="display:none">!</span>
    </div>
    <div class="sb-item" data-view="bancos" data-tip="Bancos" onclick="showView('bancos')">
      <span class="sb-ico">🏦</span><span class="sb-txt">Bancos</span>
    </div>
    <div class="sb-item" data-view="saldos" data-tip="Saldos / Pagos" onclick="showView('saldos')">
      <span class="sb-ico">💸</span><span class="sb-txt">Saldos / Pagos</span><span class="sb-badge" id="sbSaldAlert" style="display:none">!</span>
    </div>
    <div class="sb-item" data-view="admin" data-tip="Administrativos" onclick="showView('admin')">
      <span class="sb-ico">💼</span><span class="sb-txt">Administrativos</span>
    </div>
  </div>
</nav>

<!-- CONTENT -->
<main class="content" id="mainContent">

  <div class="empty" id="fhEmpty">
    <div class="empty-ico">💼</div>
    <div class="empty-title">Dashboard Financiero INLOP</div>
    <div class="empty-sub">Sincronizando datos desde Supabase. Si es la primera vez, el admin debe cargar el Maestro Excel.</div>
    <button class="btn-sm btn-blue" style="margin-top:14px" onclick="fhLoadFromSupabase()">↻ Sincronizar</button>
  </div>

  <!-- VIEW: RESUMEN -->
  <div id="view-resumen" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Resumen Ejecutivo</div><div class="page-sub">Vista gerencial consolidada · Filtros activos arriba</div></div>
      <div class="line-chips">
        <span class="lchip lchip-liq">🟦 LÍQUIDA <strong id="chipLiq">—</strong></span>
        <span class="lchip lchip-seca">🟧 SECA <strong id="chipSeca">—</strong></span>
      </div>
    </div>
    <div class="kpi-row kpi-row-4" id="kpiRow1"></div>
    <div class="kpi-row kpi-row-4" id="kpiRow2"></div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Cartera vs Recaudado</span></div>
        <div class="chart-wrap"><canvas id="chartTendencia"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Distribución por línea según facturación</span></div>
        <div class="chart-wrap"><canvas id="chartLinea"></canvas></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Participación de Facturación — Top clientes</span><span class="panel-meta" id="topCliMeta"></span></div>
      <div style="padding:14px 16px" id="topCliGrid"></div>
    </div>
  </div>

  <!-- VIEW: FACTURACIÓN -->
  <div id="view-facturacion" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Facturación</div><div class="page-sub">Consolidado por cliente · click para ver detalle de facturas</div></div>
    </div>
    <div class="kpi-row kpi-row-3" id="factKpis"></div>
    <div style="margin-bottom:14px" id="factPart"></div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Facturación por semana · línea de negocio</span></div>
        <div class="chart-wrap"><canvas id="chartFactSem"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Top clientes</span></div>
        <div class="chart-wrap"><canvas id="chartFactCli"></canvas></div>
      </div>
    </div>
    <!-- EVOLUCIÓN MENSUAL — ancho completo -->
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-hdr">
        <span class="panel-title">Evolución mensual de facturación</span>
        <span class="panel-meta" id="factMesMeta"></span>
      </div>
      <div class="chart-wrap" style="padding:16px 20px 18px"><canvas id="chartFactMes" style="max-height:260px"></canvas></div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Detalle por cliente · click para expandir</span><span class="panel-meta" id="factTblMeta"></span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:30px"></th><th>Cliente</th><th>Línea</th><th class="c">Cant. Servicios</th><th class="r">Total</th><th class="r">% del total</th><th class="r">Promedio</th></tr></thead>
          <tbody id="tblFact"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VIEW: CARTERA -->
  <div id="view-cartera" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Cartera por Cobrar</div><div class="page-sub">Consolidado por cliente y semana · click para ver detalle</div></div>
    </div>
    <div class="kpi-row kpi-row-4" id="cartKpis"></div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Vencimiento de cartera</span></div>
        <div class="chart-wrap"><canvas id="chartAging"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Distribución cartera por línea</span></div>
        <div class="chart-wrap"><canvas id="chartCartLinea"></canvas></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Cartera consolidada · click para ver facturas detalle</span><span class="panel-meta" id="cartTblMeta"></span></div>
      <!-- CHIPS filtro rápido por estado -->
      <div style="padding:10px 16px;border-bottom:1px solid var(--line2);display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt2);font-family:'Oswald',sans-serif;margin-right:4px">ESTADO:</span>
        <button class="cart-chip active" id="chipCartTodos" onclick="fhCartChip('TODOS')" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:100px;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;transition:all .15s">TODOS <span id="chipCartTodosN" style="font-size:9px;opacity:.7"></span></button>
        <button class="cart-chip" id="chipCartVig" onclick="fhCartChip('VIGENTE')" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:100px;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid rgba(0,217,126,.3);background:transparent;color:var(--green);transition:all .15s">🟢 VIGENTE <span id="chipCartVigN" style="font-size:9px;opacity:.7"></span></button>
        <button class="cart-chip" id="chipCartPronto" onclick="fhCartChip('PROXIMA')" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:100px;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid rgba(240,165,0,.3);background:transparent;color:var(--amber);transition:all .15s">🟡 PRÓXIMA <span id="chipCartProntoN" style="font-size:9px;opacity:.7"></span></button>
        <button class="cart-chip" id="chipCartVenc" onclick="fhCartChip('VENCIDA')" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:100px;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid rgba(207,6,19,.3);background:transparent;color:var(--red2);transition:all .15s">🔴 VENCIDA <span id="chipCartVencN" style="font-size:9px;opacity:.7"></span></button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:30px"></th><th>Cliente</th><th>Línea</th><th>Sem. Vcto.</th><th class="c">Días min.</th><th class="r">Total</th><th class="c">Estado</th></tr></thead>
          <tbody id="tblCart"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VIEW: BANCOS -->
  <div id="view-bancos" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Bancos</div><div class="page-sub">Consolidado por tercero · click para ver transacciones</div></div>
    </div>
    <div class="kpi-row kpi-row-3" id="banKpis"></div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Entradas vs Salidas por semana</span></div>
        <div class="chart-wrap"><canvas id="chartBanSem"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Top movimientos por tercero</span></div>
        <div class="chart-wrap"><canvas id="chartBanTer"></canvas></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Movimientos consolidados por tercero</span><span class="panel-meta" id="banTblMeta"></span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:30px"></th><th>Tercero / Beneficiario</th><th>Línea</th><th class="c"># Mov.</th><th class="r">Entradas</th><th class="r">Salidas</th><th class="r">Resultado</th></tr></thead>
          <tbody id="tblBan"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VIEW: SALDOS -->
  <div id="view-saldos" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Saldos · Manifiestos</div><div class="page-sub">Consolidado por poseedor · click para ver manifiestos</div></div>
    </div>
    <div class="kpi-row kpi-row-3" id="salKpis"></div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Saldos por línea de negocio</span></div>
        <div class="chart-wrap"><canvas id="chartSalLinea"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Top poseedores</span></div>
        <div class="chart-wrap"><canvas id="chartSalPose"></canvas></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Manifiestos consolidados por poseedor</span><span class="panel-meta" id="salTblMeta"></span></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th style="width:30px"></th><th>Poseedor</th><th class="c">CC</th><th class="c"># Manif.</th><th class="r">Total</th><th class="c">Vencidos</th><th class="c">Estado</th></tr></thead>
          <tbody id="tblSal"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VIEW: ADMINISTRATIVOS -->
  <div id="view-admin" style="display:none">
    <div class="page-hdr">
      <div><div class="page-title">Gastos Administrativos</div><div class="page-sub">Compromisos del período</div></div>
    </div>
    <div class="kpi-row kpi-row-3" id="admKpis"></div>
    <div class="panel">
      <div class="panel-hdr"><span class="panel-title">Detalle compromisos</span><span class="panel-meta" id="admTblMeta"></span></div>
      <div class="tbl-wrap">
        <table>
          <tbody id="tblAdm"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VIEW: FLUJO DE CAJA -->
  <div id="view-flujo" style="display:none">
    <div class="page-hdr">
      <div>
        <div class="page-title">Flujo de Caja</div>
        <div class="page-sub">Posición financiera real · Activos · Pasivos · KPIs CFO · Snapshot semanal</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span id="flujoSemLabel" style="font-family:'Oswald',sans-serif;font-size:11px;color:var(--gold);padding:4px 12px;border:1px solid rgba(232,160,32,.25);border-radius:100px;background:rgba(232,160,32,.07)">—</span>
      </div>
    </div>
    <!-- POSICIÓN NETA BANNER -->
    <div class="flujo-posicion" id="flujoPosicion" style="margin-bottom:14px"></div>
    <!-- 4 CARDS PRINCIPALES -->
    <div class="flujo-grid" id="flujoGrid" style="margin-bottom:14px"></div>
    <!-- KPIs CFO ROW 2 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px" id="flujoKpis2"></div>
    <!-- GRÁFICAS -->
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Composición de Activos</span><span class="panel-meta" id="flujoActMeta"></span></div>
        <div class="chart-wrap"><canvas id="chartFlujoActivos"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Composición de Pasivos</span><span class="panel-meta" id="flujoPasMeta"></span></div>
        <div class="chart-wrap"><canvas id="chartFlujoPasivos"></canvas></div>
      </div>
    </div>
    <div class="g2" style="margin-bottom:14px">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Activos vs Pasivos — Waterfall financiero</span></div>
        <div class="chart-wrap"><canvas id="chartFlujoWaterfall"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">Distribución de obligaciones</span></div>
        <div class="chart-wrap"><canvas id="chartFlujoComp"></canvas></div>
      </div>
    </div>
    <!-- TABLAS DETALLE -->
    <div class="g2">
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">📥 Detalle de Activos</span><span class="panel-meta" id="flujoActTblMeta"></span></div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Cuenta</th><th>Concepto</th><th>Descripción</th><th class="r">Valor</th></tr></thead>
            <tbody id="tblFlujoAct"></tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-hdr"><span class="panel-title">📤 Detalle de Pasivos</span><span class="panel-meta" id="flujoPasTblMeta"></span></div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Cuenta</th><th>Concepto</th><th>Descripción</th><th class="r">Valor</th></tr></thead>
            <tbody id="tblFlujoPas"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

</main>
</div>

<!-- PIN MODAL -->
<div class="pin-modal" id="fhPinModal">
  <div class="pin-box">
    <div class="pin-title">🔐 Administrador</div>
    <div class="pin-sub">PIN para cargar datos</div>
    <div class="pin-dots"><div class="pin-dot" id="fd0"></div><div class="pin-dot" id="fd1"></div><div class="pin-dot" id="fd2"></div><div class="pin-dot" id="fd3"></div></div>
    <div class="pin-kp">
      <button class="pin-k" onclick="fhPinKey('1')">1</button><button class="pin-k" onclick="fhPinKey('2')">2</button><button class="pin-k" onclick="fhPinKey('3')">3</button>
      <button class="pin-k" onclick="fhPinKey('4')">4</button><button class="pin-k" onclick="fhPinKey('5')">5</button><button class="pin-k" onclick="fhPinKey('6')">6</button>
      <button class="pin-k" onclick="fhPinKey('7')">7</button><button class="pin-k" onclick="fhPinKey('8')">8</button><button class="pin-k" onclick="fhPinKey('9')">9</button>
      <button class="pin-k" onclick="fhPinDel()">←</button><button class="pin-k" onclick="fhPinKey('0')">0</button><button class="pin-k" onclick="fhPClose()">✕</button>
    </div>
    <div class="pin-err" id="fhPinErr"></div>
  </div>
</div>

<!-- UPLOAD MODAL -->
<div class="modal-bg" id="fhUploadModal">
  <div class="modal">
    <div class="modal-title">Cargar Maestro Financiero</div>
    <div class="modal-sub">Al cargar, la <strong>facturación se reemplaza completa</strong> con el nuevo acumulado. Cartera, Bancos, Saldos y Administrativos se actualizan por semana.</div>
    <div style="border:2px dashed var(--gold);border-radius:10px;padding:20px;text-align:center;cursor:pointer" id="dropZone" onclick="document.getElementById('inp-maestro').click()" ondragover="event.preventDefault();this.style.background='rgba(232,160,32,.1)'" ondragleave="this.style.background='transparent'" ondrop="fhHandleDrop(event)">
      <div style="font-size:32px;margin-bottom:10px">📊</div>
      <div style="font-family:'Oswald',sans-serif;font-size:13px;color:#fff;margin-bottom:6px;letter-spacing:1px">INLOP_Maestro_Financiero_SXX.xlsx</div>
      <div style="font-size:11px;color:var(--txt2)">Click o arrastra el archivo aquí</div>
      <input type="file" id="inp-maestro" accept=".xlsx,.xls" style="display:none" onchange="fhSlotLoadMaestro(this)">
    </div>
    <div style="margin-top:16px;padding:12px;border-radius:8px;background:rgba(232,160,32,.08);border:1px solid rgba(232,160,32,.2)">
      <div style="font-size:10px;color:var(--txt2);margin-bottom:6px;font-family:'Oswald',sans-serif;letter-spacing:1px">ESTADO</div>
      <div style="font-size:11px;color:#fff" id="maestroStatus">Esperando archivo...</div>
    </div>
    <div id="fhUploadPreview" style="display:none;margin-top:12px;padding:10px 12px;border-radius:8px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);font-size:11px;color:#93c5fd;line-height:1.8"></div>
    <div class="btn-row">
      <button class="btn-ghost" onclick="fhCloseUpload()">Cancelar</button>
      <button class="btn-primary" id="fhBtnProcesar" onclick="fhProcesar()" disabled>Procesar y guardar</button>
    </div>
  </div>
</div>

<div class="toast" id="fhToast"></div>

<script>
/* ════════ CONFIG ════════ */
var SUPABASE_URL='https://gtyydandwcgoaratmnqh.supabase.co';
var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI';
var FIN_ID=4;
var FH_PIN='2604';

/* ════════ STATE ════════ */
var fData=null, fIsAdmin=false, fBrandClicks=0, fBrandTimer=null, fPinBuf='';
var fRawFiles={}, fCharts={}, fCurrentView='resumen';

/* ════════ LINEA NEGOCIO MAP ════════ */
var LINEA_MAP={
  'ATLANTIC MARINE FUELS SAS':'CARGA LIQUIDA',
  'C.I PRODEXPORT DE COLOMBIA SAS':'CARGA LIQUIDA',
  'C.I. PRODEXPORT DE COLOMBIA SAS':'CARGA LIQUIDA',
  'C.I. CONQUERS WORLD TRADE SAS':'CARGA LIQUIDA',
  'C.I. GARU INVERSIONES SAS':'CARGA LIQUIDA',
  'DEVELOPMENT OF ENERGY PROJECTS SAS':'CARGA LIQUIDA',
  'FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA':'CARGA LIQUIDA',
  'INDUSTRIA AMBIENTAL SAS':'CARGA LIQUIDA',
  'DISTRIBUIDORA DE PAPEL JURADO TORRES SAS':'CARGA SECA',
  'EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS SA':'CARGA SECA',
  'FRIGORIFICO DE LA COSTA SAS':'CARGA SECA',
  'KANGUPOR SAS':'CARGA SECA',
  'LA FABRICA DE LA FELICIDAD SAS':'CARGA SECA',
  'LHOIST COLOMBIA SAS':'CARGA SECA',
  'LORRY S.A.S.':'CARGA SECA',
  'PRODUCTOS RAMO S.A.S':'CARGA SECA',
  'PRODUCTOS RAMO S.A.S.':'CARGA SECA',
  'QMAX SOLUTIONS COLOMBIA':'CARGA SECA',
  'JEHS INGENIERIA S. A. S':'CARGA SECA',
  'EOM CONSULTING SAS':'CARGA SECA'
};

function getLineaCli(cli){
  var c=String(cli||'').trim().toUpperCase();
  for(var k in LINEA_MAP){if(k.toUpperCase()===c)return LINEA_MAP[k];}
  return 'SIN CLASIFICAR';
}

/* ════════ MES MAP ════════ */
var MES_NOMBRES={'01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio','07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre'};

// Mapa semana -> mes (basado en calendario ISO 2026)
// Ordenamiento numérico de semanas: S1, S2, S3 ... S10, S11 (no alfabético)
function sortSems(arr){return (arr||[]).slice().sort(function(a,b){var na=parseInt((a||'').replace(/\D/g,''))||0,nb=parseInt((b||'').replace(/\D/g,''))||0;return na-nb;});}

function semanaToMes(sem){
  if(!sem)return null;
  var m=String(sem).match(/S(\d{1,2})/);
  if(!m)return null;
  var n=parseInt(m[1]);
  // Aproximación calendario 2026
  if(n<=4)return '2026-01';
  if(n<=8)return '2026-02';
  if(n<=13)return '2026-03';
  if(n<=17)return '2026-04';
  if(n<=22)return '2026-05';
  if(n<=26)return '2026-06';
  if(n<=30)return '2026-07';
  if(n<=35)return '2026-08';
  if(n<=39)return '2026-09';
  if(n<=44)return '2026-10';
  if(n<=48)return '2026-11';
  return '2026-12';
}

function mesLabel(mes){
  if(!mes)return '—';
  var p=mes.split('-');
  return MES_NOMBRES[p[1]]+' '+p[0];
}

/* ════════ BRIDGE ════════ */
window.fSetDataFromCloud=function(d){
  if(!d||Object.keys(d).length===0)return false;
  fData=d;window.fData=d;
  fBuildAllFiltros();
  document.getElementById('fhEmpty').style.display='none';
  showView(fCurrentView);
  setSyncOk();
  fCheckAlerts();
  return true;
};

/* ════════ NAVIGATION ════════ */
var VIEWS=['resumen','flujo','facturacion','cartera','bancos','saldos','admin'];
function showView(v){
  fCurrentView=v;
  VIEWS.forEach(function(id){var el=document.getElementById('view-'+id);if(el)el.style.display=id===v?'block':'none';});
  document.querySelectorAll('.sb-item[data-view]').forEach(function(el){el.classList.toggle('active',el.dataset.view===v);});
  if(!fData)return;
  fApplyGlobal();
}
window.showView=showView;

function toggleSidebar(){document.getElementById('layout').classList.toggle('collapsed');}
var MODULO_NOMBRES={resumen:'Resumen Ejecutivo',flujo:'Flujo de Caja',facturacion:'Facturación',cartera:'Cartera',bancos:'Bancos',saldos:'Saldos / Pagos',admin:'Administrativos'};

function togglePresent(){
  var isPresent=document.body.classList.toggle('present');
  var btn=document.getElementById('btnPresent');
  var logo=document.getElementById('presentLogo');
  var modulo=document.getElementById('presentModulo');
  if(isPresent){
    // Activar modo presentación
    if(btn)btn.textContent='✕ Salir presentación';
    if(logo)logo.style.display='flex';
    if(modulo){modulo.style.display='inline-flex';modulo.textContent=MODULO_NOMBRES[fCurrentView]||'';}
    // Sync present nav active state
    document.querySelectorAll('.present-nav-item').forEach(function(el){
      el.classList.toggle('active',el.dataset.pview===fCurrentView);
    });
    // Asegurar que el grid del layout se recomponga correctamente
    var layout=document.getElementById('layout');
    if(layout){layout.style.gridTemplateColumns='1fr';}
  } else {
    // Desactivar
    if(btn)btn.textContent='⛶ Presentación';
    if(logo)logo.style.display='none';
    if(modulo)modulo.style.display='none';
    var layout=document.getElementById('layout');
    if(layout){layout.style.gridTemplateColumns='';}
  }
  // Re-render para ajustar gráficas al nuevo tamaño
  setTimeout(function(){
    Object.values(fCharts).forEach(function(ch){if(ch&&ch.resize)ch.resize();});
    fhRender();
  },200);
}
window.togglePresent=togglePresent;

function fhPresentNav(el,view){
  document.querySelectorAll('.present-nav-item').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
  var modulo=document.getElementById('presentModulo');
  if(modulo)modulo.textContent=MODULO_NOMBRES[view]||'';
  showView(view);
}
window.fhPresentNav=fhPresentNav;

/* ════════ CHART.JS DEFAULTS ════════ */
Chart.defaults.color='#8099b8';
Chart.defaults.borderColor='rgba(255,255,255,.06)';
Chart.defaults.font.family='DM Sans';
Chart.defaults.font.size=11;
function destroyChart(id){if(fCharts[id]){fCharts[id].destroy();delete fCharts[id];}}
function mkChart(id,cfg){destroyChart(id);var ctx=document.getElementById(id);if(!ctx)return null;fCharts[id]=new Chart(ctx,cfg);return fCharts[id];}

/* ════════ HELPERS ════════ */
function fmtCOP(v){
  if(v===null||v===undefined||isNaN(v))return '—';
  var a=Math.abs(v),s=v<0?'-':'';
  if(a>=1e12)return s+'$'+(a/1e12).toFixed(1)+' Bill.';
  if(a>=1e9)return s+'$'+(a/1e9).toFixed(2)+' MdM'; // Miles de millones
  if(a>=1e6)return s+'$'+(a/1e6).toFixed(1)+' M';   // Millones
  if(a>=1e3)return s+'$'+Math.round(a/1e3).toLocaleString('es-CO')+' mil';
  return s+'$'+Math.round(a).toLocaleString('es-CO');
}
function fmtFull(v){
  if(!v&&v!==0)return '$0';
  return '$'+Math.abs(Math.round(v)).toLocaleString('es-CO');
}
function shortN(s){
  if(!s)return '';
  return s.replace('FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA','FRONTERA ENERGY')
    .replace('EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS SA','ECPV')
    .replace('C.I PRODEXPORT DE COLOMBIA SAS','CI PRODEXPORT')
    .replace('C.I. CONQUERS WORLD TRADE SAS','CI CONQUERS')
    .replace('C.I. GARU INVERSIONES SAS','CI GARU')
    .replace('DISTRIBUIDORA DE PAPEL JURADO TORRES SAS','DIST. JURADO')
    .replace('DEVELOPMENT OF ENERGY PROJECTS SAS','DEV ENERGY')
    .replace('PRODUCTOS RAMO S.A.S','RAMO')
    .replace('PRODUCTOS RAMO S.A.S.','RAMO')
    .replace('QMAX SOLUTIONS COLOMBIA','QMAX')
    .replace('ATLANTIC MARINE FUELS SAS','AMF')
    .replace('INDUSTRIA AMBIENTAL SAS','IND. AMBIENTAL')
    .replace('LA FABRICA DE LA FELICIDAD SAS','FAB. FELICIDAD')
    .replace('FRIGORIFICO DE LA COSTA SAS','FRIGORIFICO COSTA')
    .replace('LHOIST COLOMBIA SAS','LHOIST')
    .replace('LORRY S.A.S.','LORRY')
    .replace('KANGUPOR SAS','KANGUPOR');
}
function setText(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
function deltaHtml(cur,prev){if(!prev||prev===0)return '';var pct=((cur-prev)/Math.abs(prev)*100);var cls=pct>0?'delta-up':pct<0?'delta-down':'delta-flat';var ico=pct>0?'▲':pct<0?'▼':'→';return '<span class="kcard-delta '+cls+'">'+ico+' '+Math.abs(pct).toFixed(1)+'%</span>';}
function lineaPill(l){if(l==='CARGA LIQUIDA')return '<span class="pill pliq">🟦 LÍQUIDA</span>';if(l==='CARGA SECA')return '<span class="pill pseca">🟧 SECA</span>';return '<span class="pill pn">—</span>';}
function lineaColor(l){return l==='CARGA LIQUIDA'?'var(--liq)':l==='CARGA SECA'?'var(--seca)':'var(--txt2)';}

/* Convierte cualquier valor de fecha a string dd/mm/yyyy limpio */
function fmtFecha(val){
  if(!val||val==='null'||val==='undefined')return '';
  var s=String(val).trim();
  if(!s||s==='NaN'||s==='Invalid Date')return '';
  // Ya es dd/mm/yyyy
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))return s;
  // Ya es yyyy-mm-dd (primeros 10 chars)
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){
    var p=s.substring(0,10).split('-');
    return p[2]+'/'+p[1]+'/'+p[0];
  }
  // Formato JS Date.toString(): "Tue May 12 2026 00:00:16 GMT-0500..."
  var MESES={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  var m=s.match(/\w+\s+(\w+)\s+(\d{1,2})\s+(\d{4})/);
  if(m&&MESES[m[1]]){return ('0'+m[2]).slice(-2)+'/'+MESES[m[1]]+'/'+m[3];}
  // Intentar Date nativo como último recurso
  try{var d=new Date(s);if(!isNaN(d.getTime()))return ('0'+d.getDate()).slice(-2)+'/'+ ('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();}catch(e){}
  return '';
}

/* Calcular días reales desde fecha de vencimiento vs hoy */
function calcDias(fechaStr){
  var s=fmtFecha(fechaStr);
  if(!s)return null;
  try{
    var p=s.split('/');
    var dt=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
    if(isNaN(dt.getTime()))return null;
    var hoy=new Date();hoy.setHours(0,0,0,0);
    return Math.round((dt-hoy)/86400000);
  }catch(e){return null;}
}

function estadoCartera(dias){
  if(dias===null)return {cls:'pn',txt:'—',dCls:''};
  if(dias<0)return {cls:'pr',txt:'VENCIDA '+Math.abs(dias)+'d',dCls:'db-r'};
  if(dias===0)return {cls:'pr',txt:'HOY',dCls:'db-r'};
  if(dias<=7)return {cls:'pa',txt:'PRÓXIMA '+dias+'d',dCls:'db-a'};
  return {cls:'pg',txt:'VIGENTE',dCls:'db-g'};
}

/* ════════ FILTROS ════════ */
function fBuildAllFiltros(){
  if(!fData)return;
  var sems=sortSems(Array.from(new Set([].concat(
    (fData.fact||[]).map(function(r){return r.sem;}),
    (fData.cartera||[]).map(function(r){return r.sem;}),
    (fData.bancos||[]).map(function(r){return r.sem;}),
    (fData.saldos||[]).map(function(r){return r.sem;}),
    (fData.adm||[]).map(function(r){return r.sem;})
  ))).filter(Boolean));
  
  // Meses: tomar de r.mes en fact (fuente directa del Excel) + fallback semanaToMes para otros módulos
  var mesesSet=new Set();
  (fData.fact||[]).forEach(function(r){if(r.mes)mesesSet.add(r.mes);else if(r.sem){var m=semanaToMes(r.sem);if(m)mesesSet.add(m);}});
  sems.forEach(function(s){var m=semanaToMes(s);if(m)mesesSet.add(m);});
  var meses=Array.from(mesesSet).filter(Boolean).sort();
  
  var cliSet=new Set();
  (fData.fact||[]).forEach(function(r){if(r.cliente)cliSet.add(r.cliente);});
  (fData.cartera||[]).forEach(function(r){if(r.cliente)cliSet.add(r.cliente);});
  var clis=Array.from(cliSet).sort();
  
  function fillSel(id,opts,defaultLabel){
    var sel=document.getElementById(id);if(!sel)return;
    var cur=sel.value;
    sel.innerHTML='<option value="TODOS">'+defaultLabel+'</option>'+opts.map(function(o){return '<option value="'+o.value+'">'+o.label+'</option>';}).join('');
    if([].concat(['TODOS'],opts.map(function(o){return o.value;})).indexOf(cur)>=0)sel.value=cur;
  }
  
  fillSel('filGSem', sems.map(function(s){return {value:s,label:s};}), 'Todas las semanas');
  fillSel('filGMes', meses.map(function(m){return {value:m,label:mesLabel(m)};}), 'Todos los meses');
  fillSel('filGCli', clis.map(function(c){return {value:c,label:shortN(c)};}), 'Todos los clientes');
}

function fGetGlobal(){
  return {
    linea:(document.getElementById('filGLinea')||{}).value||'TODOS',
    mes:(document.getElementById('filGMes')||{}).value||'TODOS',
    sem:(document.getElementById('filGSem')||{}).value||'TODOS',
    cli:(document.getElementById('filGCli')||{}).value||'TODOS'
  };
}

function fApplyToArray(arr,getLinea,getCliente){
  if(!arr)return [];
  var f=fGetGlobal();
  return arr.filter(function(r){
    if(f.sem!=='TODOS' && r.sem!==f.sem)return false;
    if(f.mes!=='TODOS' && (r.mes||semanaToMes(r.sem))!==f.mes)return false;
    if(f.linea!=='TODOS'){
      var l=getLinea?getLinea(r):(r.linea||getLineaCli(r.cliente));
      if(l!==f.linea)return false;
    }
    if(f.cli!=='TODOS'){
      // Para bancos no hay campo cliente, comparar con tercero
      var c=getCliente?getCliente(r):r.cliente;
      // Match exacto O parcial (para bancos donde tercero puede ser cliente conocido)
      if(c!==f.cli){
        // Si el getCliente retorna tercero, intentar match con cliente conocido
        if(r.tercero && r.tercero===f.cli)return true;
        return false;
      }
    }
    return true;
  });
}

function fApplyGlobal(){
  // Update visual indicator on linea select
  var lSel=document.getElementById('filGLinea');
  if(lSel){
    lSel.classList.remove('gflinea-liq','gflinea-seca');
    if(lSel.value==='CARGA LIQUIDA')lSel.classList.add('gflinea-liq');
    if(lSel.value==='CARGA SECA')lSel.classList.add('gflinea-seca');
  }
  fhRender();
}
window.fApplyGlobal=fApplyGlobal;

function fResetFilters(){
  ['filGLinea','filGMes','filGSem','filGCli'].forEach(function(id){
    var s=document.getElementById(id);if(s)s.value='TODOS';
  });
  fApplyGlobal();
}
window.fResetFilters=fResetFilters;

/* ════════ ALERTS ════════ */
function fCheckAlerts(){
  if(!fData)return;
  var alerts=[];
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var cartVenc=(fData.cartera||[]).filter(function(r){var d=calcDias(r.vencimiento);return d!==null&&d<0;});
  var valCV=cartVenc.reduce(function(a,r){return a+(r.total||0);},0);
  if(cartVenc.length>0)alerts.push('Cartera vencida: <strong>'+cartVenc.length+' facturas</strong> por '+fmtCOP(valCV)+'.');
  var salVenc=(fData.saldos||[]).filter(function(r){var v=r.vencimiento;if(!v)return false;return new Date(parseFecha(v))<hoy;});
  if(salVenc.length>0)alerts.push('<strong>'+salVenc.length+' manifiestos vencidos</strong> sin liquidar por '+fmtCOP(salVenc.reduce(function(a,r){return a+(r.valor||0);},0))+'.');
  document.getElementById('sbCartAlert').style.display=cartVenc.length?'inline':'none';
  document.getElementById('sbSaldAlert').style.display=salVenc.length?'inline':'none';
  var bar=document.getElementById('alertBar'),chip=document.getElementById('alertChip');
  if(alerts.length){document.getElementById('alertContent').innerHTML=alerts.join('<br>');bar.classList.add('vis');chip.style.display='inline-flex';}
  else{bar.classList.remove('vis');chip.style.display='none';}
}

function parseFecha(s){
  // Convierte cualquier formato a yyyy-mm-dd para uso en new Date()
  var limpio=fmtFecha(s); // da dd/mm/yyyy
  if(!limpio)return s;
  var p=limpio.split('/');
  if(p.length===3)return p[2]+'-'+p[1]+'-'+p[0];
  return s;
}

/* ════════ MAIN RENDER ════════ */
function fhRender(){
  if(!fData)return;
  var f=fGetGlobal();
  // Calcular contadores totales filtrados para info bar
  var fact=fApplyToArray(fData.fact,function(r){return r.linea||getLineaCli(r.cliente);});
  var cart=fApplyToArray(fData.cartera,function(r){return r.linea||getLineaCli(r.cliente);});
  var totFact=fact.reduce(function(a,r){return a+(r.valor||0);},0);
  var totCart=cart.reduce(function(a,r){return a+(r.total||0);},0);

  var partes=[];
  partes.push((f.linea==='TODOS'?'Todas líneas':(f.linea==='CARGA LIQUIDA'?'🟦 Líquida':'🟧 Seca')));
  partes.push(f.mes==='TODOS'?'todos meses':mesLabel(f.mes));
  partes.push(f.sem==='TODOS'?'todas sem':f.sem);
  if(f.cli!=='TODOS')partes.push(shortN(f.cli));
  setText('gfInfo','📊 '+partes.join(' · ')+' · Fact: '+fmtCOP(totFact)+' · Cart: '+fmtCOP(totCart)+' · '+fact.length+' fact');

  if(fCurrentView==='resumen')fhRenderResumen();
  else if(fCurrentView==='flujo')fhRenderFlujo();
  else if(fCurrentView==='facturacion')fhRenderFact();
  else if(fCurrentView==='cartera')fhRenderCart();
  else if(fCurrentView==='bancos')fhRenderBancos();
  else if(fCurrentView==='saldos')fhRenderSaldos();
  else if(fCurrentView==='admin')fhRenderAdm();
}

/* ════════ KCARD BUILDER helper ════════ */
function mkKcard(opts){
  // opts: {lbl, val (raw number), kc, ico, sub, split}
  var display=fmtCOP(opts.val);
  // Cifra completa solo para valores monetarios >= 1000 (no para conteos como 16 clientes)
  var showFull=opts.val!=null&&!isNaN(opts.val)&&Math.abs(opts.val)>=1000;
  var full=showFull?fmtFull(opts.val):'';
  var splitHtml=opts.split?'<div class="kcard-split"><span class="kcard-splititem liq">🟦 '+fmtCOP(opts.split[0])+'</span><span class="kcard-splititem seca">🟧 '+fmtCOP(opts.split[1])+'</span></div>':'';
  var fullHtml=full?'<div class="kcard-fullnum">'+full+'</div>':'';
  return '<div class="kcard" style="--kc:'+opts.kc+'"><div class="kcard-ico">'+(opts.ico||'')+'</div><div class="kcard-lbl">'+opts.lbl+'</div><div class="kcard-val">'+display+'</div>'+fullHtml+'<div class="kcard-footer"><span class="kcard-sub">'+(opts.sub||'')+'</span></div>'+splitHtml+'</div>';
}

/* ════════ RESUMEN ════════ */
function fhRenderResumen(){
  var fact=fApplyToArray(fData.fact,function(r){return r.linea||getLineaCli(r.cliente);});
  var cart=fApplyToArray(fData.cartera,function(r){return r.linea||getLineaCli(r.cliente);});
  var ban=fApplyToArray(fData.bancos,function(r){return r.linea;},function(r){return r.tercero;});
  var sal=fApplyToArray(fData.saldos,function(r){return r.linea||getLineaCli(r.cliente);});
  var adm=fApplyToArray(fData.adm,function(){return 'ADMINISTRATIVO';},function(r){return r.nombre;});

  var totFact=fact.reduce(function(a,r){return a+(r.valor||0);},0);
  var totCart=cart.reduce(function(a,r){return a+(r.total||0);},0);
  var totEnt=ban.filter(function(r){return r.valor>0;}).reduce(function(a,r){return a+r.valor;},0);
  var totSalB=ban.filter(function(r){return r.valor<0;}).reduce(function(a,r){return a+Math.abs(r.valor);},0);
  var neto=totEnt-totSalB;
  var totSaldo=sal.reduce(function(a,r){return a+(r.valor||0);},0);
  var totAdm=adm.reduce(function(a,r){return a+(r.valor||0);},0);
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var cartVenc=cart.filter(function(r){
    var d=calcDias(r.vencimiento);
    return d!==null&&d<0;
  }).reduce(function(a,r){return a+(r.total||0);},0);
  var cliSet=new Set(cart.map(function(r){return r.cliente;}));

  var factLiq=fact.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);
  var factSeca=fact.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);
  var cartLiq=cart.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.total;},0);
  var cartSeca=cart.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.total;},0);

  setText('chipLiq',fmtCOP(factLiq));
  setText('chipSeca',fmtCOP(factSeca));

  document.getElementById('kpiRow1').innerHTML=[
    mkKcard({lbl:'Facturación',val:totFact,sub:fact.length+' servicios facturados',kc:'var(--green)',ico:'🧾',split:[factLiq,factSeca]}),
    mkKcard({lbl:'Cartera vigente',val:totCart,sub:cliSet.size+' clientes con saldo',kc:'var(--gold)',ico:'📋',split:[cartLiq,cartSeca]}),
    mkKcard({lbl:'Saldo bancario',val:neto,sub:neto>=0?'▲ Positivo':'▼ Negativo',kc:neto>=0?'var(--green)':'var(--red)',ico:'🏦'}),
    mkKcard({lbl:'Saldos a pagar',val:totSaldo,sub:sal.length+' manifiestos',kc:'var(--red)',ico:'💸'})
  ].join('');

  document.getElementById('kpiRow2').innerHTML=[
    '<div class="kcard" style="--kc:#8b5cf6"><div class="kcard-lbl">Clientes activos</div><div class="kcard-val" style="color:#8b5cf6">'+cliSet.size+'</div><div class="kcard-footer"><span class="kcard-sub">con cartera vigente</span></div></div>',
    mkKcard({lbl:'Cartera vencida',val:cartVenc,sub:'fecha ya superada',kc:'var(--red)'}),
    mkKcard({lbl:'Entradas bancarias',val:totEnt,sub:'recaudos del período',kc:'var(--green)'}),
    mkKcard({lbl:'Gastos adm.',val:totAdm,sub:adm.length+' compromisos',kc:'var(--amber)'})
  ].join('');

  // Gráfica: Facturación vs Entradas Banco (lo facturado vs lo recaudado)
  var fG=fGetGlobal();
  var allSems=Array.from(new Set([].concat((fData.fact||[]).map(function(r){return r.sem;}),(fData.bancos||[]).map(function(r){return r.sem;})))).filter(Boolean);
  var sems=sortSems(allSems.filter(function(s){
    if(fG.sem!=='TODOS'&&s!==fG.sem)return false;
    if(fG.mes!=='TODOS'&&semanaToMes(s)!==fG.mes)return false;
    return true;
  }));
  function passesLineaCli(r){
    if(fG.linea!=='TODOS'&&(r.linea||getLineaCli(r.cliente))!==fG.linea)return false;
    if(fG.cli!=='TODOS'&&r.cliente!==fG.cli)return false;
    return true;
  }
  var factSem=sems.map(function(s){return (fData.fact||[]).filter(function(r){return r.sem===s&&passesLineaCli(r);}).reduce(function(a,r){return a+r.valor;},0);});
  var cartSem=sems.map(function(s){return (fData.cartera||[]).filter(function(r){return r.sem===s&&passesLineaCli(r);}).reduce(function(a,r){return a+(r.total||0);},0);});
  var entSem=sems.map(function(s){return (fData.bancos||[]).filter(function(r){
    if(r.sem!==s||r.valor<=0)return false;
    if(fG.linea!=='TODOS'&&r.linea!==fG.linea)return false;
    return true;
  }).reduce(function(a,r){return a+r.valor;},0);});

  mkChart('chartTendencia',{type:'line',data:{labels:sems,datasets:[
    {label:'Cartera',data:cartSem,borderColor:'#E8A020',backgroundColor:'rgba(232,160,32,.18)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:7,pointBackgroundColor:'#E8A020',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5},
    {label:'Recaudado (Entradas)',data:entSem,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.18)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:7,pointBackgroundColor:'#3b82f6',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5,borderDash:[6,4]}
  ]},options:{responsive:true,maintainAspectRatio:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#fff',usePointStyle:true,padding:14,font:{size:11,weight:'500'}}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',titleColor:'#fff',bodyColor:'#e8eef8',borderColor:'rgba(255,255,255,.1)',borderWidth:1,padding:12,cornerRadius:8,callbacks:{label:function(ctx){return ' '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y);}}}},scales:{y:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'}},x:{ticks:{color:'#8099b8'},grid:{display:false}}}}});

  // Gráfica: Distribución por línea de negocio según facturación
  mkChart('chartLinea',{type:'doughnut',data:{labels:['🟦 Carga Líquida','🟧 Carga Seca'],datasets:[{data:[factLiq,factSeca],backgroundColor:['rgba(59,130,246,.8)','rgba(232,160,32,.8)'],borderColor:['rgba(59,130,246,.3)','rgba(232,160,32,.3)'],borderWidth:2,hoverOffset:12,hoverBorderColor:['#3b82f6','#E8A020']}]},options:{responsive:true,maintainAspectRatio:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#fff',font:{size:11},usePointStyle:true,padding:14}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',titleColor:'#fff',bodyColor:'#e8eef8',callbacks:{label:function(ctx){var t=factLiq+factSeca;var p=t?(ctx.parsed/t*100).toFixed(1):0;return ' '+ctx.label+': '+fmtFull(ctx.parsed)+' ('+p+'%)';}}}}}});

  // Top clientes — Participación de Facturación
  // Top clientes — todos para calcular total real
  var byC={};
  fact.forEach(function(r){byC[r.cliente]=(byC[r.cliente]||0)+r.valor;});
  var allCli=Object.entries(byC).sort(function(a,b){return b[1]-a[1];});
  var sorted=allCli.slice(0,8);
  var totalFact=fact.reduce(function(a,r){return a+(r.valor||0);},0); // total REAL
  var totalTop=sorted.reduce(function(a,e){return a+e[1];},0);
  var totalOtros=totalFact-totalTop;
  var nOtros=allCli.length-sorted.length;
  var pctTop=totalFact?(totalTop/totalFact*100).toFixed(1):0;
  var maxC=sorted[0]?sorted[0][1]:1;

  // Meta header mejorado
  setText('topCliMeta','Top '+sorted.length+' de '+allCli.length+' clientes · representan '+pctTop+'% del total');

  document.getElementById('topCliGrid').innerHTML=
    // Cabecera de columnas
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line2)">'+
      '<div style="width:160px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif">Cliente</div>'+
      '<div style="flex:1;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif">Participación</div>'+
      '<div style="width:52px;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif;text-align:right">% total</div>'+
      '<div style="width:100px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif;text-align:right">Valor</div>'+
    '</div>'+
    // Filas clientes
    sorted.map(function(e,idx){
      var pctTotal=totalFact?(e[1]/totalFact*100).toFixed(1):0;
      var pctBarra=Math.round(e[1]/maxC*100);
      var l=getLineaCli(e[0]);
      var col=l==='CARGA LIQUIDA'?'var(--liq)':l==='CARGA SECA'?'var(--seca)':'var(--txt2)';
      var bgRow=idx%2===0?'rgba(255,255,255,.015)':'transparent';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:6px;background:'+bgRow+';margin-bottom:2px;cursor:default" title="'+e[0]+' · '+fmtFull(e[1])+'">'+
        // Nombre
        '<div style="width:160px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+shortN(e[0])+'</div>'+
        // Barra
        '<div style="flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">'+
          '<div style="height:100%;width:'+pctBarra+'%;background:'+col+';border-radius:4px;transition:width .6s ease"></div>'+
        '</div>'+
        // % bold grande
        '<div style="width:52px;text-align:right;font-family:\'Oswald\',sans-serif;font-size:14px;font-weight:700;color:'+col+'">'+pctTotal+'%</div>'+
        // Valor abreviado + completo debajo
        '<div style="width:100px;text-align:right">'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:600;color:#fff">'+fmtCOP(e[1])+'</div>'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--txt2);margin-top:1px">'+fmtFull(e[1])+'</div>'+
        '</div>'+
      '</div>';
    }).join('')+
    // Fila "Otros" si hay más clientes
    (nOtros>0?
      '<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-top:1px solid var(--line2);margin-top:6px;opacity:.65">'+
        '<div style="width:160px;font-size:11px;color:var(--txt2);font-style:italic">Otros ('+nOtros+' clientes)</div>'+
        '<div style="flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">'+
          '<div style="height:100%;width:'+Math.round(totalOtros/maxC*100)+'%;background:rgba(255,255,255,.15);border-radius:4px"></div>'+
        '</div>'+
        '<div style="width:52px;text-align:right;font-family:\'Oswald\',sans-serif;font-size:13px;color:var(--txt2)">'+(totalFact?(totalOtros/totalFact*100).toFixed(1):0)+'%</div>'+
        '<div style="width:100px;text-align:right">'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--txt2)">'+fmtCOP(totalOtros)+'</div>'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--txt2);margin-top:1px">'+fmtFull(totalOtros)+'</div>'+
        '</div>'+
      '</div>'
    :'')+
    // Fila TOTAL
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-top:2px solid rgba(232,160,32,.3);margin-top:6px;background:rgba(232,160,32,.05);border-radius:0 0 8px 8px">'+
      '<div style="width:160px;font-family:\'Oswald\',sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold)">Total general</div>'+
      '<div style="flex:1"></div>'+
      '<div style="width:52px;text-align:right;font-family:\'Oswald\',sans-serif;font-size:14px;font-weight:700;color:var(--gold)">100%</div>'+
      '<div style="width:100px;text-align:right">'+
        '<div style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;color:var(--gold)">'+fmtCOP(totalFact)+'</div>'+
        '<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--txt2);margin-top:1px">'+fmtFull(totalFact)+'</div>'+
      '</div>'+
    '</div>'||'<div class="empty"><div class="empty-ico">📊</div></div>';
}



/* ════════ RENDER FUNCTIONS ════════ */
function fhRenderCart(){
  var cart=fApplyToArray(fData.cartera,function(r){return r.linea||getLineaCli(r.cliente);});
  var tot=cart.reduce(function(a,r){return a+(r.total||0);},0);

  // Clasificar TODAS las filas por estado real
  var venc=[],hoyG=[],pronto=[],vigente=[];
  cart.forEach(function(r){
    var d=calcDias(r.vencimiento);
    if(d===null||d>7)vigente.push(r);
    else if(d>0&&d<=7)pronto.push(r);
    else if(d===0)hoyG.push(r);
    else venc.push(r);
  });
  var totVenc=venc.reduce(function(a,r){return a+(r.total||0);},0);

  // KPIs
  document.getElementById('cartKpis').innerHTML=[
    mkKcard({lbl:'Total cartera',val:tot,sub:cart.length+' facturas',kc:'var(--gold)',ico:'📋'}),
    mkKcard({lbl:'Vencida',val:totVenc,sub:venc.length+' fact. · fecha superada',kc:'var(--red)',ico:'⚠'}),
    mkKcard({lbl:'Próx. a vencer ≤7d',val:pronto.concat(hoyG).reduce(function(a,r){return a+r.total;},0),sub:(pronto.length+hoyG.length)+' facturas',kc:'var(--amber)',ico:'⏰'}),
    mkKcard({lbl:'Vigente',val:vigente.reduce(function(a,r){return a+r.total;},0),sub:vigente.length+' facturas al día',kc:'var(--green)',ico:'✓'})
  ].join('');

  // Charts aging y linea
  var a30=cart.reduce(function(a,r){return a+(r['0-30']||0);},0);
  var a60=cart.reduce(function(a,r){return a+(r['31-60']||0);},0);
  var a90=cart.reduce(function(a,r){return a+(r['61-90']||0);},0);
  mkChart('chartAging',{type:'doughnut',data:{labels:['0-30 días','31-60 días','61-90 días'],datasets:[{data:[a30,a60,a90],backgroundColor:['rgba(0,217,126,.8)','rgba(232,160,32,.8)','rgba(207,6,19,.8)'],borderColor:['rgba(0,217,126,.3)','rgba(232,160,32,.3)','rgba(207,6,19,.3)'],borderWidth:2,hoverOffset:12}]},options:{responsive:true,maintainAspectRatio:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{color:'#fff',usePointStyle:true,padding:12}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',callbacks:{label:function(ctx){return ' '+ctx.label+': $'+Math.round(ctx.parsed).toLocaleString('es-CO');}}}}}});
  var liqT=cart.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.total;},0);
  var secaT=cart.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.total;},0);
  mkChart('chartCartLinea',{type:'doughnut',data:{labels:['🟦 Carga Líquida','🟧 Carga Seca'],datasets:[{data:[liqT,secaT],backgroundColor:['rgba(59,130,246,.8)','rgba(232,160,32,.8)'],borderColor:['rgba(59,130,246,.3)','rgba(232,160,32,.3)'],borderWidth:2,hoverOffset:12}]},options:{responsive:true,maintainAspectRatio:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{color:'#fff',usePointStyle:true,padding:12}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',callbacks:{label:function(ctx){var t=liqT+secaT;return ' '+ctx.label+': '+fmtFull(ctx.parsed)+' ('+(t?(ctx.parsed/t*100).toFixed(1):0)+'%)';}}}}}});

  // Actualizar conteos de chips
  var nVig=vigente.length, nPronto=pronto.length+hoyG.length, nVenc=venc.length;
  setText('chipCartTodosN','('+cart.length+')');
  setText('chipCartVigN','('+nVig+')');
  setText('chipCartProntoN','('+nPronto+')');
  setText('chipCartVencN','('+nVenc+')');

  // Agrupar por cliente
  var byCS={};
  cart.forEach(function(r){
    var k=r.cliente;
    var d=calcDias(r.vencimiento);
    if(!byCS[k])byCS[k]={cliente:r.cliente,linea:r.linea||getLineaCli(r.cliente),total:0,facturas:[],diasMin:d===null?9999:d,'0-30':0,'31-60':0,'61-90':0,'mas90':0};
    byCS[k].total+=r.total||0;
    byCS[k]['0-30']+=(r['0-30']||0);
    byCS[k]['31-60']+=(r['31-60']||0);
    byCS[k]['61-90']+=(r['61-90']||0);
    byCS[k]['mas90']+=(r.mas90||0);
    byCS[k].facturas.push(r);
    if(d!==null&&d<byCS[k].diasMin)byCS[k].diasMin=d;
  });
  var allRows=Object.values(byCS).sort(function(a,b){return b.total-a.total;});

  // Aplicar filtro de chip activo
  var chipActivo=window.fCartChipActivo||'TODOS';
  var rows=allRows.filter(function(r){
    if(chipActivo==='TODOS')return true;
    var d=r.diasMin===9999?null:r.diasMin;
    if(chipActivo==='VENCIDA')return d!==null&&d<0;
    if(chipActivo==='PROXIMA')return d!==null&&d>=0&&d<=7;
    if(chipActivo==='VIGENTE')return d===null||d>7;
    return true;
  });

  setText('cartTblMeta',rows.length+' clientes · '+cart.length+' facturas');

  // Calcular totalizadores del footer (sobre filas filtradas)
  var fTot=rows.reduce(function(a,r){return a+r.total;},0);
  var f30=rows.reduce(function(a,r){return a+r['0-30'];},0);
  var f60=rows.reduce(function(a,r){return a+r['31-60'];},0);
  var f90=rows.reduce(function(a,r){return a+r['61-90'];},0);
  var f90p=rows.reduce(function(a,r){return a+(r['mas90']||0);},0);

  // Render tabla
  document.getElementById('tblCart').innerHTML=rows.map(function(r,i){
    var d=r.diasMin===9999?null:r.diasMin;
    var est_o=estadoCartera(d);

    // Totalizadores por cliente
    var cli30=r['0-30']||0, cli60=r['31-60']||0, cli90=r['61-90']||0, cli90p=r['mas90']||0;
    var totFilaColor=d!==null&&d<0?'var(--red)':d!==null&&d<=7?'var(--amber)':'var(--gold)';

    var detail=
      '<table class="detail-tbl">'+
      '<thead><tr><th>Factura</th><th>F. Vcto.</th><th class="c">Días</th><th class="r">Total</th><th class="r">0-30d</th><th class="r">31-60d</th><th class="r">61-90d</th><th>Estado</th></tr></thead>'+
      '<tbody>'+
      r.facturas.map(function(f){
        var fd=calcDias(f.vencimiento);
        var fe=estadoCartera(fd);
        return '<tr>'+
          '<td class="mono">'+(f.factura||'—')+'</td>'+
          '<td class="mono" style="font-size:10px">'+(f.vencimiento||'')+'</td>'+
          '<td class="c"><span class="db '+fe.dCls+'">'+(fd!==null?Math.abs(fd)+'d':'—')+'</span></td>'+
          '<td class="r mono"><strong>'+fmtFull(f.total||0)+'</strong></td>'+
          '<td class="r mono" style="color:var(--green)">'+(f['0-30']?fmtCOP(f['0-30']):'-')+'</td>'+
          '<td class="r mono" style="color:var(--amber)">'+(f['31-60']?fmtCOP(f['31-60']):'-')+'</td>'+
          '<td class="r mono" style="color:var(--red)">'+(f['61-90']?fmtCOP(f['61-90']):'-')+'</td>'+
          '<td><span class="pill '+fe.cls+'" style="font-size:8px">'+fe.txt+'</span></td>'+
          '</tr>';
      }).join('')+
      '</tbody>'+
      // ── TOTALIZADOR POR CLIENTE dentro del detalle ──
      '<tfoot>'+
        '<tr style="background:rgba(232,160,32,.08);border-top:1.5px solid rgba(232,160,32,.35)">'+
          '<td colspan="3" style="font-family:\'Oswald\',sans-serif;font-size:9px;letter-spacing:1.5px;color:var(--gold);padding:8px 10px;text-transform:uppercase">'+
            'Total '+shortN(r.cliente)+' · '+r.facturas.length+' facturas'+
          '</td>'+
          '<td class="r mono" style="color:'+totFilaColor+';font-size:12px;font-weight:700;padding:8px 10px">'+fmtFull(r.total)+'</td>'+
          '<td class="r mono" style="color:var(--green);font-size:11px;padding:8px 10px">'+(cli30?fmtCOP(cli30):'—')+'</td>'+
          '<td class="r mono" style="color:var(--amber);font-size:11px;padding:8px 10px">'+(cli60?fmtCOP(cli60):'—')+'</td>'+
          '<td class="r mono" style="color:var(--red);font-size:11px;padding:8px 10px">'+(cli90?fmtCOP(cli90):'—')+'</td>'+
          '<td style="padding:8px 10px">'+(cli90p>0?'<span style="font-size:10px;color:#ff3355;font-family:\'DM Mono\',monospace">+90d: '+fmtCOP(cli90p)+'</span>':'')+'</td>'+
        '</tr>'+
      '</tfoot>'+
      '</table>';

    return '<tr class="tr-main" onclick="toggleRow(\'cart-'+i+'\')">'+
      '<td class="c"><button class="expand-btn" id="btn-cart-'+i+'">▶</button></td>'+
      '<td title="'+r.cliente+'"><strong>'+shortN(r.cliente)+'</strong></td>'+
      '<td>'+lineaPill(r.linea)+'</td>'+
      '<td class="mono" style="color:var(--txt2);font-size:10px">'+(d!==null?(d<0?Math.abs(d)+'d vencida':d+'d restante'):'—')+'</td>'+
      '<td class="c"><span class="pill '+est_o.cls+'" style="font-size:8px">'+est_o.txt+'</span></td>'+
      '<td class="r mono"><strong>'+fmtFull(r.total)+'</strong></td>'+
      '<td></td>'+
      '</tr>'+
      '<tr class="tr-detail" id="row-cart-'+i+'">'+
        '<td colspan="7">'+
          '<div class="detail-wrap">'+
            '<div class="detail-title">📋 '+r.facturas.length+' facturas — vencimiento por fecha real</div>'+
            detail+
          '</div>'+
        '</td>'+
      '</tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--txt2);padding:20px">Sin datos para el filtro seleccionado</td></tr>';

  // Limpiar footer si existía antes
  var foot=document.getElementById('tblCartFoot');
  if(foot)foot.innerHTML='';
}

/* Chips de estado cartera */
window.fCartChipActivo='TODOS';
function fhCartChip(estado){
  window.fCartChipActivo=estado;
  // Actualizar estilos de chips
  var chips={
    'TODOS':'chipCartTodos',
    'VIGENTE':'chipCartVig',
    'PROXIMA':'chipCartPronto',
    'VENCIDA':'chipCartVenc'
  };
  Object.keys(chips).forEach(function(k){
    var el=document.getElementById(chips[k]);
    if(el)el.classList.toggle('active',k===estado);
  });
  fhRenderCart();
}
window.fhCartChip=fhCartChip;

// ── OVERRIDE fhRenderBancos (rename "Resultado") ──
function fhRenderBancos(){
  var ban=fApplyToArray(fData.bancos,function(r){return r.linea;},function(r){return r.tercero;});
  var totEnt=ban.filter(function(r){return r.valor>0;}).reduce(function(a,r){return a+r.valor;},0);
  var totSal=ban.filter(function(r){return r.valor<0;}).reduce(function(a,r){return a+Math.abs(r.valor);},0);
  var neto=totEnt-totSal;
  document.getElementById('banKpis').innerHTML=[
    mkKcard({lbl:'Total entradas',val:totEnt,sub:ban.filter(function(r){return r.valor>0;}).length+' transacciones',kc:'var(--green)',ico:'↑'}),
    mkKcard({lbl:'Total salidas',val:totSal,sub:ban.filter(function(r){return r.valor<0;}).length+' transacciones',kc:'var(--red)',ico:'↓'}),
    mkKcard({lbl:'Resultado período',val:neto,sub:neto>=0?'▲ Flujo positivo':'▼ Flujo negativo',kc:neto>=0?'var(--green)':'var(--red)',ico:'⚖'})
  ].join('');
  var fG=fGetGlobal();
  var allSems=Array.from(new Set((fData.bancos||[]).map(function(r){return r.sem;}))).filter(Boolean);
  var sems=allSems.filter(function(s){if(fG.sem!=='TODOS'&&s!==fG.sem)return false;if(fG.mes!=='TODOS'&&semanaToMes(s)!==fG.mes)return false;return true;});sems=sortSems(sems);
  var entSem=sems.map(function(s){return (fData.bancos||[]).filter(function(r){return r.sem===s&&r.valor>0&&(fG.linea==='TODOS'||r.linea===fG.linea);}).reduce(function(a,r){return a+r.valor;},0);});
  var salSem=sems.map(function(s){return (fData.bancos||[]).filter(function(r){return r.sem===s&&r.valor<0&&(fG.linea==='TODOS'||r.linea===fG.linea);}).reduce(function(a,r){return a+Math.abs(r.valor);},0);});
  // Agrupar por tercero — necesario para ambas gráficas
  var byT={};
  ban.forEach(function(r){var k=r.tercero||'BANCOLOMBIA';if(!byT[k])byT[k]={tercero:k,linea:r.linea||'BANCARIO/ADM',entradas:0,salidas:0,count:0,txns:[]};if(r.valor>0)byT[k].entradas+=r.valor;else byT[k].salidas+=Math.abs(r.valor);byT[k].count++;byT[k].txns.push(r);});
  var rows=Object.values(byT).sort(function(a,b){return (b.entradas+b.salidas)-(a.entradas+a.salidas);});
  // Chart A: Entradas vs Salidas — gradiente top→bottom como preview aprobado
  var netoSem=sems.map(function(s,i){return entSem[i]-salSem[i];});
  mkChart('chartBanSem',{
    type:'bar',
    data:{
      labels:sems,
      datasets:[
        {
          label:'Entradas',
          data:entSem,
          backgroundColor:function(ctx){
            var chart=ctx.chart;
            var _a=chart.chartArea;
            if(!_a)return 'rgba(34,197,94,.75)';
            var g=chart.ctx.createLinearGradient(0,_a.top,0,_a.bottom);
            g.addColorStop(0,'rgba(52,211,153,.92)');
            g.addColorStop(1,'rgba(5,150,105,.28)');
            return g;
          },
          borderColor:'rgba(52,211,153,.0)',
          borderWidth:0,
          borderRadius:4,
          borderSkipped:false,
          order:2
        },
        {
          label:'Salidas',
          data:salSem,
          backgroundColor:function(ctx){
            var chart=ctx.chart;
            var _a=chart.chartArea;
            if(!_a)return 'rgba(239,68,68,.75)';
            var g=chart.ctx.createLinearGradient(0,_a.top,0,_a.bottom);
            g.addColorStop(0,'rgba(248,113,113,.92)');
            g.addColorStop(1,'rgba(185,28,28,.28)');
            return g;
          },
          borderColor:'rgba(248,113,113,.0)',
          borderWidth:0,
          borderRadius:4,
          borderSkipped:false,
          order:2
        }
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:'#ffffff',usePointStyle:true,padding:14,font:{size:11},
          generateLabels:function(chart){
            return chart.data.datasets.map(function(ds,i){
              var clr=i===0?'rgba(52,211,153,.85)':'rgba(248,113,113,.85)';
              return {text:ds.label,fillStyle:clr,strokeStyle:'transparent',lineWidth:0,fontColor:'#ffffff',color:'#ffffff',datasetIndex:i};
            });
          }
        }},
        tooltip:{
          backgroundColor:'rgba(10,14,39,.97)',
          titleColor:'#fff',bodyColor:'#e8eef8',
          borderColor:'rgba(255,255,255,.1)',borderWidth:1,
          cornerRadius:8,padding:10,
          callbacks:{label:function(ctx){return '  '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y);}}
        }
      },
      scales:{
        y:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'},beginAtZero:true},
        x:{ticks:{color:'#8099b8'},grid:{display:false}}
      }
    }
  });

  // Chart B: Top Terceros — horizontal gradiente izq→der bicolor como preview aprobado
  var topRows=rows.slice(0,8);
  var netoVals=topRows.map(function(r){return r.entradas-r.salidas;});
  mkChart('chartBanTer',{
    type:'bar',
    data:{
      labels:topRows.map(function(r){return shortN(r.tercero);}),
      datasets:[{
        label:'Neto',
        data:netoVals,
        backgroundColor:function(ctx){
          var chart=ctx.chart;
          var _a=chart.chartArea;
          if(!_a)return 'rgba(52,211,153,.75)';
          var v=netoVals[ctx.dataIndex];
          var g;
          if(v>=0){
            g=chart.ctx.createLinearGradient(_a.left,0,_a.right,0);
            g.addColorStop(0,'rgba(52,211,153,.25)');
            g.addColorStop(1,'rgba(52,211,153,.88)');
          } else {
            g=chart.ctx.createLinearGradient(_a.right,0,_a.left,0);
            g.addColorStop(0,'rgba(248,113,113,.25)');
            g.addColorStop(1,'rgba(248,113,113,.88)');
          }
          return g;
        },
        borderWidth:0,
        borderRadius:3,
        borderSkipped:false
      }]
    },
    options:{
      indexAxis:'y',responsive:true,maintainAspectRatio:true,
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(10,14,39,.97)',
          titleColor:'#fff',bodyColor:'#e8eef8',
          borderColor:'rgba(255,255,255,.1)',borderWidth:1,
          cornerRadius:8,padding:10,
          callbacks:{label:function(ctx){
            var v=ctx.parsed.x;
            return '  Neto: '+(v>=0?'+ ':'')+fmtFull(Math.abs(v));
          }}
        }
      },
      scales:{
        x:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'}},
        y:{ticks:{color:'#8099b8'},grid:{display:false}}
      }
    }
  });
  setText('banTblMeta',rows.length+' terceros · '+ban.length+' transacciones');
  document.getElementById('tblBan').innerHTML=rows.map(function(r,i){
    var nt=r.entradas-r.salidas;
    var detail='<table class="detail-tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th class="c">Tipo</th><th class="r">Valor</th></tr></thead><tbody>'+
      r.txns.map(function(t){return '<tr><td class="mono" style="font-size:10px">'+fmtFecha(t.fecha)+'</td><td style="color:var(--txt2);max-width:380px;overflow:hidden;text-overflow:ellipsis;font-size:10px">'+(t.concepto||'').slice(0,80)+'</td><td class="c"><span class="pill '+(t.valor>=0?'pg':'pr')+'" style="font-size:8px">'+(t.valor>=0?'ENT':'SAL')+'</span></td><td class="r mono" style="color:'+(t.valor>=0?'var(--green)':'var(--red)')+'">'+fmtFull(Math.abs(t.valor))+'</td></tr>';}).join('')+
      '</tbody></table>';
    return '<tr class="tr-main" onclick="toggleRow(\'ban-'+i+'\')"><td class="c"><button class="expand-btn" id="btn-ban-'+i+'">▶</button></td><td title="'+r.tercero+'"><strong>'+shortN(r.tercero)+'</strong></td><td>'+lineaPill(r.linea)+'</td><td class="c mono">'+r.count+'</td><td class="r mono" style="color:var(--green)">'+(r.entradas?fmtCOP(r.entradas):'-')+'</td><td class="r mono" style="color:var(--red)">'+(r.salidas?fmtCOP(r.salidas):'-')+'</td><td class="r mono" style="color:'+(nt>=0?'var(--green)':'var(--red)')+'"><strong>'+fmtCOP(nt)+'</strong></td></tr>'+
      '<tr class="tr-detail" id="row-ban-'+i+'"><td colspan="7"><div class="detail-wrap"><div class="detail-title">🏦 '+r.count+' transacciones</div>'+detail+'</div></td></tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--txt2);padding:20px">Sin datos</td></tr>';
};

// ── OVERRIDE fhRenderFact (add % card, rename column) ──
function fhRenderFact(){
  var fact=fApplyToArray(fData.fact,function(r){return r.linea||getLineaCli(r.cliente);});
  var totFact=fact.reduce(function(a,r){return a+(r.valor||0);},0);
  var factLiq=fact.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);
  var factSeca=fact.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);
  var pctLiq=totFact?(factLiq/totFact*100).toFixed(1):0;
  var pctSeca=totFact?(factSeca/totFact*100).toFixed(1):0;
  var byC={};
  fact.forEach(function(r){var k=r.cliente;if(!byC[k])byC[k]={cliente:r.cliente,linea:r.linea||getLineaCli(r.cliente),total:0,facturas:[],count:0};byC[k].total+=r.valor;byC[k].count++;byC[k].facturas.push(r);});
  var rows=Object.values(byC).sort(function(a,b){return b.total-a.total;});
  setText('factTblMeta',rows.length+' clientes · '+fact.length+' servicios facturados');

  // KPIs row 1: 3 cards numéricas
  document.getElementById('factKpis').innerHTML=[
    mkKcard({lbl:'Total facturado',val:totFact,sub:fact.length+' servicios · '+rows.length+' clientes',kc:'var(--green)',ico:'🧾'}),
    ('<div class="kcard" style="--kc:var(--blue)"><div class="kcard-ico">#</div><div class="kcard-lbl">Servicios facturados</div><div class="kcard-val" style="color:var(--blue)">'+fact.length+'</div><div class="kcard-footer"><span class="kcard-sub">'+rows.length+' clientes distintos</span></div></div>'),
    mkKcard({lbl:'Promedio por servicio',val:fact.length?totFact/fact.length:0,sub:'ticket promedio período',kc:'var(--amber)',ico:'≈'})
  ].join('');

  // Participación card — separada, ancho completo
  document.getElementById('factPart').innerHTML=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    // Líquida
    '<div style="background:var(--navy4);border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:16px;position:relative;overflow:hidden">'+
      '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--liq)"></div>'+
      '<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif;margin-bottom:8px">🟦 Carga Líquida</div>'+
      '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">'+
        '<span style="font-family:\'Oswald\',sans-serif;font-size:36px;font-weight:700;color:var(--liq);line-height:1">'+pctLiq+'%</span>'+
        '<span style="font-size:11px;color:var(--txt2)">participación</span>'+
      '</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:#fff;margin-bottom:8px">'+fmtCOP(factLiq)+'</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--txt2);margin-bottom:8px">'+fmtFull(factLiq)+'</div>'+
      '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pctLiq+'%;background:var(--liq);border-radius:3px;transition:width .8s ease"></div>'+
      '</div>'+
    '</div>'+
    // Seca
    '<div style="background:var(--navy4);border:1px solid rgba(232,160,32,.25);border-radius:10px;padding:16px;position:relative;overflow:hidden">'+
      '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--seca)"></div>'+
      '<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif;margin-bottom:8px">🟧 Carga Seca</div>'+
      '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">'+
        '<span style="font-family:\'Oswald\',sans-serif;font-size:36px;font-weight:700;color:var(--seca);line-height:1">'+pctSeca+'%</span>'+
        '<span style="font-size:11px;color:var(--txt2)">participación</span>'+
      '</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:#fff;margin-bottom:8px">'+fmtCOP(factSeca)+'</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--txt2);margin-bottom:8px">'+fmtFull(factSeca)+'</div>'+
      '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pctSeca+'%;background:var(--seca);border-radius:3px;transition:width .8s ease"></div>'+
      '</div>'+
    '</div>'+
    '</div>';

  // Gráfica líneas
  var fG=fGetGlobal();
  var allSems=Array.from(new Set((fData.fact||[]).map(function(r){return r.sem;}))).filter(Boolean);
  var sems=allSems.filter(function(s){if(fG.sem!=='TODOS'&&s!==fG.sem)return false;if(fG.mes!=='TODOS'&&semanaToMes(s)!==fG.mes)return false;return true;});sems=sortSems(sems);
  var liqSem=sems.map(function(s){return (fData.fact||[]).filter(function(r){if(r.sem!==s)return false;if(fG.cli!=='TODOS'&&r.cliente!==fG.cli)return false;return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);});
  var secaSem=sems.map(function(s){return (fData.fact||[]).filter(function(r){if(r.sem!==s)return false;if(fG.cli!=='TODOS'&&r.cliente!==fG.cli)return false;return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);});
  var datasets=[];
  if(fG.linea==='TODOS'||fG.linea==='CARGA LIQUIDA')datasets.push({label:'🟦 Carga Líquida',data:liqSem,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.22)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:7,pointBackgroundColor:'#3b82f6',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5});
  if(fG.linea==='TODOS'||fG.linea==='CARGA SECA')datasets.push({label:'🟧 Carga Seca',data:secaSem,borderColor:'#E8A020',backgroundColor:'rgba(232,160,32,.22)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:7,pointBackgroundColor:'#E8A020',pointBorderColor:'#fff',pointBorderWidth:2,borderWidth:2.5,borderDash:[6,4]});
  mkChart('chartFactSem',{type:'line',data:{labels:sems,datasets:datasets},options:{responsive:true,maintainAspectRatio:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#fff',usePointStyle:true,padding:14,font:{size:11}}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',titleColor:'#fff',bodyColor:'#e8eef8',cornerRadius:8,callbacks:{label:function(ctx){return ' '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y);}}}},scales:{y:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'}},x:{ticks:{color:'#8099b8'},grid:{display:false}}}}});
  mkChart('chartFactCli',{type:'bar',data:{labels:rows.slice(0,8).map(function(r){return shortN(r.cliente);}),datasets:[{label:'Facturación',data:rows.slice(0,8).map(function(r){return r.total;}),backgroundColor:rows.slice(0,8).map(function(r){return r.linea==='CARGA LIQUIDA'?'rgba(59,130,246,.75)':'rgba(232,160,32,.75)';}),borderWidth:0,borderRadius:5}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(10,14,39,.97)',callbacks:{label:function(ctx){return ' '+fmtFull(ctx.parsed.x);}}}},scales:{x:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8099b8'}}}}});

  // ── EVOLUCIÓN MENSUAL — usa fact ya filtrado + r.mes del Excel ──
  var mesesMap={};
  fact.forEach(function(r){
    var mes=r.mes||semanaToMes(r.sem);
    if(!mes)return;
    if(!mesesMap[mes])mesesMap[mes]={mes:mes,liq:0,seca:0};
    var linea=r.linea||getLineaCli(r.cliente);
    if(linea==='CARGA LIQUIDA') mesesMap[mes].liq+=r.valor;
    else if(linea==='CARGA SECA') mesesMap[mes].seca+=r.valor;
  });
  var mesesArr=Object.values(mesesMap).sort(function(a,b){return a.mes.localeCompare(b.mes);});
  var mesLabels=mesesArr.map(function(m){return mesLabel(m.mes);});
  var mesLiq=mesesArr.map(function(m){return m.liq;});
  var mesSeca=mesesArr.map(function(m){return m.seca;});
  var mesTotal=mesesArr.map(function(m){return m.liq+m.seca;});
  setText('factMesMeta',mesesArr.length+' meses · '+fmtCOP(mesTotal.reduce(function(a,b){return a+b;},0)));

  var mesDatasetsActivos=[];
  if(fG.linea==='TODOS'||fG.linea==='CARGA LIQUIDA'){
    mesDatasetsActivos.push({label:'🟦 Carga Líquida',data:mesLiq,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.2)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:8,pointBackgroundColor:'#3b82f6',pointBorderColor:'#0f1535',pointBorderWidth:2,borderWidth:2.5});
  }
  if(fG.linea==='TODOS'||fG.linea==='CARGA SECA'){
    mesDatasetsActivos.push({label:'🟧 Carga Seca',data:mesSeca,borderColor:'#E8A020',backgroundColor:'rgba(232,160,32,.2)',fill:true,tension:.35,pointRadius:5,pointHoverRadius:8,pointBackgroundColor:'#E8A020',pointBorderColor:'#0f1535',pointBorderWidth:2,borderWidth:2.5,borderDash:[6,4]});
  }
  mkChart('chartFactMes',{type:'line',data:{labels:mesLabels,datasets:mesDatasetsActivos},options:{
    responsive:true,maintainAspectRatio:true,
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{labels:{color:'#fff',usePointStyle:true,padding:16,font:{size:11,weight:'500'}}},
      tooltip:{backgroundColor:'rgba(8,12,30,.97)',titleColor:'#fff',bodyColor:'#cbd5e1',borderColor:'rgba(255,255,255,.08)',borderWidth:1,cornerRadius:10,padding:12,
        callbacks:{
          title:function(items){return items[0]?items[0].label:'';},
          label:function(ctx){return '  '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y);},
          afterBody:function(items){
            var t=items.reduce(function(a,i){return a+i.parsed.y;},0);
            return items.length>1?['','  Total mes: '+fmtFull(t)]:[];
          }
        }}},
    scales:{
      y:{ticks:{callback:function(v){return fmtCOP(v);},color:'#94a3b8'},grid:{color:'rgba(255,255,255,.04)'},beginAtZero:true},
      x:{ticks:{color:'#94a3b8',font:{size:11}},grid:{display:false}}
    }
  }});

  // Tabla expandible — columna renombrada a "Servicios"
  document.getElementById('tblFact').innerHTML=rows.map(function(r,i){
    var pct=totFact?(r.total/totFact*100).toFixed(1):'0.0';
    var prom=r.count?r.total/r.count:0;
    var detail='<table class="detail-tbl"><thead><tr><th>Nro. Servicio</th><th>Semana</th><th>Fecha</th><th>Comprobante</th><th>Referencia / Remesa</th><th class="r">Valor</th></tr></thead><tbody>'+
      r.facturas.map(function(f){return '<tr><td><span class="pill pb" style="font-size:9px">'+(f.factura||'')+'</span></td><td class="mono">'+f.sem+'</td><td class="mono">'+fmtFecha(f.fecha)+'</td><td class="mono" style="color:var(--txt2)">'+(f.comprobante||'')+'</td><td style="color:var(--txt2);max-width:300px;overflow:hidden;text-overflow:ellipsis">'+(f.referencia||'').slice(0,60)+'</td><td class="r mono">'+fmtFull(f.valor)+'</td></tr>';}).join('')+
      '</tbody></table>';
    return '<tr class="tr-main" onclick="toggleRow(\'fact-'+i+'\')"><td class="c"><button class="expand-btn" id="btn-fact-'+i+'">▶</button></td><td title="'+r.cliente+'"><strong>'+shortN(r.cliente)+'</strong></td><td>'+lineaPill(r.linea)+'</td><td class="c mono">'+r.count+'</td><td class="r mono"><strong>'+fmtFull(r.total)+'</strong></td><td class="r mono" style="color:var(--txt2)">'+pct+'%</td><td class="r mono">'+fmtCOP(prom)+'</td></tr>'+
      '<tr class="tr-detail" id="row-fact-'+i+'"><td colspan="7"><div class="detail-wrap"><div class="detail-title">📄 '+r.count+' servicios facturados a '+shortN(r.cliente)+'</div>'+detail+'</div></td></tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--txt2);padding:20px">Sin datos para los filtros aplicados</td></tr>';
};

// ── OVERRIDE fhRenderAdm (replace Diferencia card with Mayor beneficiario, add expandible) ──
function fhRenderAdm(){
  var adm=fApplyToArray(fData.adm,function(){return 'ADMINISTRATIVO';},function(r){return r.nombre;});
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var tot=adm.reduce(function(a,r){return a+(r.valor||0);},0);
  var prov=adm.reduce(function(a,r){return a+(r.provision||0);},0);
  // Mayor beneficiario
  var byB={};
  adm.forEach(function(r){byB[r.nombre]=(byB[r.nombre]||0)+(r.valor||0);});
  var topB=Object.entries(byB).sort(function(a,b){return b[1]-a[1];})[0];
  var topBpct=tot&&topB?(topB[1]/tot*100).toFixed(1):0;

  document.getElementById('admKpis').innerHTML=[
    mkKcard({lbl:'Total compromisos',val:tot,sub:adm.length+' pagos',kc:'var(--purple)',ico:'💼'}),
    mkKcard({lbl:'Total provisión',val:prov,sub:'estimado acumulado',kc:'var(--amber)',ico:'📊'}),
    '<div class="kcard" style="--kc:var(--blue)"><div class="kcard-ico">🏆</div><div class="kcard-lbl">Mayor beneficiario</div><div style="font-family:\'Oswald\',sans-serif;font-size:15px;font-weight:600;color:var(--blue);line-height:1.2;margin-bottom:4px">'+(topB?shortN(topB[0]):'—')+'</div><div class="kcard-footer"><span class="kcard-sub">'+(topB?fmtFull(topB[1])+' · '+topBpct+'% del total':'sin datos')+'</span></div></div>'
  ].join('');
  setText('admTblMeta',adm.length+' compromisos');

  document.getElementById('tblAdm').innerHTML='<table class="detail-tbl" style="width:100%"><thead><tr><th style="width:28px"></th><th>Beneficiario</th><th>Tipo</th><th class="c">Vencimiento</th><th class="c">Días</th><th>Medio</th><th class="r">Valor</th><th class="r">Provisión</th><th class="c">Estado</th></tr></thead><tbody>'+
  adm.map(function(r,i){
    var d=r.vencimiento?Math.round((new Date(parseFecha(r.vencimiento))-hoy)/86400000):null;
    var dCls=d===null?'':d<0?'db-r':d<=3?'db-a':'db-g';
    var est=d===null?'—':d<0?'<span class="pill pr" style="font-size:8px">VENCIDO</span>':d<=2?'<span class="pill pa" style="font-size:8px">HOY</span>':'<span class="pill pg" style="font-size:8px">VIGENTE</span>';
    var detail='<div style="padding:10px 16px 12px 36px;background:rgba(0,0,0,.12)"><div style="font-family:\'Oswald\',sans-serif;font-size:9px;letter-spacing:2px;color:var(--purple);margin-bottom:8px">OBSERVACIONES Y DETALLES</div>'+
      '<div style="font-size:11px;color:var(--txt);line-height:1.7;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:6px;border-left:2px solid var(--purple)">'+(r.obs&&r.obs.trim()&&r.obs!=='None'&&r.obs!=='nan'?r.obs:'Sin observaciones registradas.')+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">'+
      '<div style="background:rgba(255,255,255,.03);border-radius:6px;padding:8px"><div style="font-size:9px;color:var(--txt2);margin-bottom:2px">Identificación</div><div style="font-size:11px;color:#fff;font-family:\'DM Mono\',monospace">'+(r.id||'—')+'</div></div>'+
      '<div style="background:rgba(255,255,255,.03);border-radius:6px;padding:8px"><div style="font-size:9px;color:var(--txt2);margin-bottom:2px">Tipo de pago</div><div style="font-size:11px;color:#fff">'+(r.tipo||'—')+'</div></div>'+
      '<div style="background:rgba(255,255,255,.03);border-radius:6px;padding:8px"><div style="font-size:9px;color:var(--txt2);margin-bottom:2px">Diferencia Real vs Prov.</div><div style="font-size:11px;color:'+(r.valor-r.provision>0?'var(--red)':'var(--green)')+'">'+fmtFull(r.valor-(r.provision||0))+'</div></div>'+
      '</div></div>';
    return '<tr class="tr-main" onclick="toggleRow(\'adm-'+i+'\')"><td class="c"><button class="expand-btn" id="btn-adm-'+i+'">▶</button></td><td><strong>'+r.nombre+'</strong></td><td><span class="pill pn" style="font-size:8px">'+(r.tipo||'').slice(0,15)+'</span></td><td class="c mono" style="font-size:10px">'+(r.vencimiento||'')+'</td><td class="c"><span class="db '+dCls+'">'+(d!==null?Math.abs(d)+'d':'—')+'</span></td><td class="c"><span class="pill pb" style="font-size:8px">'+(r.medio||'').toUpperCase()+'</span></td><td class="r mono"><strong>'+fmtFull(r.valor)+'</strong></td><td class="r mono" style="color:var(--txt2)">'+fmtFull(r.provision||0)+'</td><td class="c">'+est+'</td></tr>'+
      '<tr class="tr-detail" id="row-adm-'+i+'"><td colspan="9">'+detail+'</td></tr>';
  }).join('')+
  '</tbody></table>';
};

// ── SALDOS: render completo con buscador ──
function fhRenderSaldos(){
  var sal=fApplyToArray(fData.saldos,function(r){return r.linea||getLineaCli(r.cliente);});
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var tot=sal.reduce(function(a,r){return a+(r.valor||0);},0);
  var venc=sal.filter(function(r){var d=calcDias(r.vencimiento);return d!==null&&d<0;});

  document.getElementById('salKpis').innerHTML=[
    mkKcard({lbl:'Total por liquidar',val:tot,sub:sal.length+' manifiestos',kc:'var(--red)',ico:'💸'}),
    mkKcard({lbl:'Vencidos',val:venc.reduce(function(a,r){return a+(r.valor||0);},0),sub:venc.length+' manifiestos',kc:'var(--amber)',ico:'⚠'}),
    mkKcard({lbl:'Vigentes',val:sal.filter(function(r){var d=calcDias(r.vencimiento);return d===null||d>=0;}).reduce(function(a,r){return a+(r.valor||0);},0),sub:(sal.length-venc.length)+' manifiestos',kc:'var(--green)',ico:'✓'})
  ].join('');

  // Gráfica por línea
  var liqT=sal.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);
  var secaT=sal.filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);
  mkChart('chartSalLinea',{type:'doughnut',data:{labels:['🟦 Carga Líquida','🟧 Carga Seca'],datasets:[{data:[liqT,secaT],backgroundColor:['rgba(59,130,246,.8)','rgba(232,160,32,.8)'],borderColor:['rgba(59,130,246,.3)','rgba(232,160,32,.3)'],borderWidth:2,hoverOffset:12}]},options:{responsive:true,maintainAspectRatio:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{color:'#fff',usePointStyle:true,padding:12}},tooltip:{backgroundColor:'rgba(10,14,39,.97)',callbacks:{label:function(ctx){var t=liqT+secaT;return ' '+ctx.label+': '+fmtFull(ctx.parsed)+' ('+(t?(ctx.parsed/t*100).toFixed(1):0)+'%)';}}}}}});

  // Group by poseedor
  var byP={};
  sal.forEach(function(r){
    var k=r.poseedor||'(Sin poseedor)';
    if(!byP[k])byP[k]={poseedor:k,cc:r.cc||'',total:0,count:0,vencidos:0,manifiestos:[]};
    byP[k].total+=r.valor||0;
    byP[k].count++;
    var d=calcDias(r.vencimiento);
    if(d!==null&&d<0)byP[k].vencidos++;
    byP[k].manifiestos.push(r);
  });
  var rows=Object.values(byP).sort(function(a,b){return b.total-a.total;});

  // Gráfica top poseedores
  mkChart('chartSalPose',{type:'bar',data:{labels:rows.slice(0,8).map(function(r){return r.poseedor.split(' ').slice(0,2).join(' ');}),datasets:[{label:'Saldo',data:rows.slice(0,8).map(function(r){return r.total;}),backgroundColor:'rgba(207,6,19,.6)',borderColor:'var(--red)',borderWidth:1,borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(10,14,39,.97)',callbacks:{label:function(ctx){return ' '+fmtFull(ctx.parsed.x);}}}},scales:{x:{ticks:{callback:function(v){return fmtCOP(v);},color:'#8099b8'},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8099b8'}}}}});

  setText('salTblMeta',rows.length+' poseedores · '+sal.length+' manifiestos');

  // Tabla expandible con buscador
  var tblHtml=rows.map(function(r,i){
    var est=r.vencidos>0?'<span class="pill pr" style="font-size:8px">'+r.vencidos+' VENC.</span>':'<span class="pill pg" style="font-size:8px">VIGENTE</span>';
    var detail='<table class="detail-tbl"><thead><tr><th>Manifiesto</th><th>Cliente</th><th>Línea</th><th>Ruta</th><th class="c">F. Vcto.</th><th class="c">Días</th><th>Vehículo</th><th class="r">Valor</th></tr></thead><tbody>'+
      r.manifiestos.map(function(m){
        var d=calcDias(m.vencimiento);
        var dCls=d===null?'':d<0?'db-r':d<=3?'db-a':'db-g';
        var l=m.linea||getLineaCli(m.cliente);
        var ruta=(m.origen||'').split(' (')[0].slice(0,18)+' → '+(m.destino||'').split(' (')[0].slice(0,18);
        return '<tr><td class="mono" style="color:var(--blue);font-size:10px">'+m.manifiesto+'</td><td>'+shortN(m.cliente)+'</td><td>'+lineaPill(l)+'</td><td class="mono" style="color:var(--txt2);font-size:9px">'+ruta+'</td><td class="mono c" style="font-size:10px">'+(m.vencimiento||'')+'</td><td class="c"><span class="db '+dCls+'">'+(d!==null?Math.abs(d)+'d':'—')+'</span></td><td class="mono" style="font-size:9px">'+(m.vehiculo||'')+'</td><td class="r mono"><strong>'+fmtFull(m.valor||0)+'</strong></td></tr>';
      }).join('')+
      '</tbody></table>';
    return '<tr class="tr-main" id="salrow-'+i+'" onclick="toggleRow(\'sal-'+i+'\')"><td class="c"><button class="expand-btn" id="btn-sal-'+i+'">▶</button></td><td title="'+r.poseedor+'"><strong>'+r.poseedor+'</strong></td><td class="c mono" style="color:var(--txt2);font-size:10px">'+r.cc+'</td><td class="c mono">'+r.count+'</td><td class="r mono"><strong>'+fmtFull(r.total)+'</strong></td><td class="c">'+(r.vencidos>0?'<span class="pill pr" style="font-size:8px">'+r.vencidos+'</span>':'<span class="pill pg" style="font-size:8px">0</span>')+'</td><td class="c">'+est+'</td></tr>'+
      '<tr class="tr-detail" id="row-sal-'+i+'"><td colspan="7"><div class="detail-wrap"><div class="detail-title">💸 '+r.count+' manifiestos · '+r.poseedor+'</div>'+detail+'</div></td></tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--txt2);padding:20px">Sin datos</td></tr>';

  document.getElementById('tblSal').innerHTML=tblHtml;

  // Inyectar buscador si no existe
  var panel=document.querySelector('#tblSal')&&document.querySelector('#tblSal').closest('.panel');
  if(panel&&!panel.querySelector('.search-wrap')){
    var sw=document.createElement('div');
    sw.className='search-wrap';
    sw.innerHTML='<input class="search-input" id="salSearch" placeholder="🔍 Buscar por poseedor o CC..." oninput="fhFilterSalTable(this.value)">';
    panel.querySelector('.panel-hdr').insertAdjacentElement('afterend',sw);
  }
}

function fhFilterSalTable(q){
  var q2=q.toLowerCase().trim();
  var rows=document.querySelectorAll('#tblSal .tr-main');
  rows.forEach(function(row){
    var txt=row.textContent.toLowerCase();
    var show=!q2||txt.indexOf(q2)>=0;
    row.style.display=show?'table-row':'none';
    var next=row.nextElementSibling;
    if(next&&next.classList.contains('tr-detail')){
      // Al filtrar, colapsar el detalle y resetear botón
      next.classList.remove('show');
      next.style.display='none';
      var btn=row.querySelector('.expand-btn');
      if(btn)btn.classList.remove('rotated');
      row.classList.remove('expanded');
    }
  });
}

// ── FLUJO DE CAJA ──
/* ════════ PARSER FLUJO DE CAJA ════════ */
function parseMaestroFlujo(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('FLUJO')>=0||s.indexOf('07_')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=4;i<arr.length;i++){
    var r=arr[i];
    if(!r||!r[0])continue;
    var sem=String(r[0]||'').trim();
    if(!sem.match(/^S\d/))continue;
    var v=parseFloat(r[6])||0;
    rows.push({
      sem:sem,
      fecha:fmtFecha(r[1]),
      clasificacion:String(r[2]||'').trim(),
      cuentas:String(r[3]||'').trim(),
      concepto:String(r[4]||'').trim(),
      descripcion:String(r[5]||'').trim(),
      tiempo:String(r[5]||'').trim(), // kept for compat
      valor:v
    });
  }
  return rows;
}

/* ════════ FLUJO DE CAJA — Lógica CFO real ════════ */
function fhRenderFlujo(){
  if(!fData||!fData.flujo||!fData.flujo.length){
    // Fallback: mostrar empty state
    var posEl=document.getElementById('flujoPosicion');
    if(posEl)posEl.innerHTML='<div class="empty" style="padding:40px 20px"><div class="empty-ico">💧</div><div class="empty-title">Sin datos de Flujo de Caja</div><div class="empty-sub">Carga el archivo Maestro que incluye la hoja 07_FLUJO_CAJA</div></div>';
    ['flujoGrid','flujoKpis2','tblFlujoAct','tblFlujoPas'].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML='';});
    return;
  }

  // Filtrar por semana activa (filtro global)
  var fG=fGetGlobal();
  var data=fData.flujo.filter(function(r){
    if(fG.sem!=='TODOS'&&r.sem!==fG.sem)return false;
    if(fG.mes!=='TODOS'&&semanaToMes(r.sem)!==fG.mes)return false;
    return true;
  });

  // Semana más reciente del snapshot
  var sems=Array.from(new Set(data.map(function(r){return r.sem;}))).sort();
  var semActual=sems[sems.length-1]||'—';
  setText('flujoSemLabel',semActual);
  var snap=data.filter(function(r){return r.sem===semActual;});

  var activos=snap.filter(function(r){return r.clasificacion==='ACTIVOS';});
  var pasivos=snap.filter(function(r){return r.clasificacion==='PASIVOS';});

  // ── CÁLCULOS FINANCIEROS ──
  var totAct=activos.reduce(function(a,r){return a+r.valor;},0);
  var bancos=activos.filter(function(r){return r.cuentas==='BANCOS';}).reduce(function(a,r){return a+r.valor;},0);
  var cartCP=activos.filter(function(r){return r.cuentas==='CARTERA'&&r.concepto.indexOf('CORTO')>=0;}).reduce(function(a,r){return a+r.valor;},0);
  var cartLP=activos.filter(function(r){return r.cuentas==='CARTERA'&&r.concepto.indexOf('LARGO')>=0;}).reduce(function(a,r){return a+r.valor;},0);
  var totPas=pasivos.reduce(function(a,r){return a+r.valor;},0);
  var pasCP=pasivos.filter(function(r){return r.cuentas.indexOf('CORTO')>=0;}).reduce(function(a,r){return a+r.valor;},0);
  var pasLPOp=pasivos.filter(function(r){return r.cuentas.indexOf('LARGO')>=0&&r.concepto.indexOf('CUENTAS')>=0;}).reduce(function(a,r){return a+r.valor;},0);
  var prestamos=pasivos.filter(function(r){return r.cuentas.indexOf('LARGO')>=0&&r.concepto.indexOf('PRESTAMOS')>=0;}).reduce(function(a,r){return a+r.valor;},0);
  var pasOpTotal=pasCP+pasLPOp;
  var posOp=totAct-pasOpTotal;
  var posNeta=totAct-totPas;
  var liqInm=pasCP>0?bancos/pasCP:0;
  var cobCxC=pasCP>0?cartCP/pasCP:0;
  var presion=totAct>0?pasCP/totAct:0;

  // ── BANNER POSICIÓN NETA ──
  var posEl=document.getElementById('flujoPosicion');
  var posColor=posNeta>=0?'var(--green)':'var(--red)';
  posEl.className='flujo-posicion '+(posNeta>=0?'flujo-pos-pos':'flujo-pos-neg');
  posEl.innerHTML=
    '<div>'+
      '<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--txt2);font-family:\'Oswald\',sans-serif;margin-bottom:6px">POSICIÓN FINANCIERA NETA · '+semActual+'</div>'+
      '<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">'+
        '<div>'+
          '<div style="font-size:10px;color:var(--txt2);margin-bottom:2px">Operativa (sin deuda financiera)</div>'+
          '<div style="font-family:\'Oswald\',sans-serif;font-size:26px;font-weight:700;color:var(--green)">'+fmtCOP(posOp)+'</div>'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--txt2)">'+fmtFull(posOp)+'</div>'+
        '</div>'+
        '<div style="width:1px;height:48px;background:rgba(255,255,255,.1);align-self:center"></div>'+
        '<div>'+
          '<div style="font-size:10px;color:var(--txt2);margin-bottom:2px">Neta real (incluyendo préstamos)</div>'+
          '<div style="font-family:\'Oswald\',sans-serif;font-size:26px;font-weight:700;color:'+posColor+'">'+fmtCOP(posNeta)+'</div>'+
          '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--txt2)">'+fmtFull(posNeta)+'</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div style="text-align:right">'+
      '<div style="font-size:9px;letter-spacing:1px;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Deuda financiera</div>'+
      '<div style="font-family:\'Oswald\',sans-serif;font-size:30px;font-weight:700;color:var(--amber)">'+fmtCOP(prestamos)+'</div>'+
      '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--txt2);margin-bottom:4px">'+fmtFull(prestamos)+'</div>'+
      '<div style="font-size:10px;color:var(--txt2)">préstamos / obligaciones financieras</div>'+
    '</div>';

  // ── 4 CARDS ──
  document.getElementById('flujoGrid').innerHTML=
    '<div class="flujo-card flujo-card-ent"><div class="flujo-card-ico">📥</div><div class="flujo-card-lbl">Total Activos</div><div class="flujo-card-val" style="color:var(--green)">'+fmtCOP(totAct)+'</div><div class="flujo-card-full">'+fmtFull(totAct)+'</div><div style="font-size:10px;color:var(--txt2);margin-top:4px">Bancos: '+fmtCOP(bancos)+' · CxC: '+fmtCOP(cartCP+cartLP)+'</div></div>'+
    '<div class="flujo-card flujo-card-pag"><div class="flujo-card-ico">📤</div><div class="flujo-card-lbl">Total Pasivos</div><div class="flujo-card-val" style="color:var(--red)">'+fmtCOP(totPas)+'</div><div class="flujo-card-full">'+fmtFull(totPas)+'</div><div style="font-size:10px;color:var(--txt2);margin-top:4px">Operativos: '+fmtCOP(pasOpTotal)+' · Préstamos: '+fmtCOP(prestamos)+'</div></div>'+
    '<div class="flujo-card flujo-card-ban"><div class="flujo-card-ico">🏦</div><div class="flujo-card-lbl">Liquidez Inmediata</div><div class="flujo-card-val" style="color:'+(liqInm>=1?'var(--blue)':liqInm>=0.5?'var(--amber)':'var(--red)')+'">'+liqInm.toFixed(2)+'x</div><div class="flujo-card-full">Bancos / Pasivos C/P</div><div style="font-size:10px;color:var(--txt2);margin-top:4px">'+(liqInm>=1?'✓ Cobertura adecuada':liqInm>=0.5?'⚠ Cobertura parcial':'⛔ Riesgo liquidez')+'</div></div>'+
    '<div class="flujo-card flujo-card-net"><div class="flujo-card-ico">⚖</div><div class="flujo-card-lbl">Cobertura CxC / CxP</div><div class="flujo-card-val" style="color:var(--purple)">'+cobCxC.toFixed(2)+'x</div><div class="flujo-card-full">Cartera C/P vs Pasivos C/P</div><div style="font-size:10px;color:var(--txt2);margin-top:4px">'+(cobCxC>=2?'✓ Excelente':cobCxC>=1?'✓ Adecuada':'⚠ Revisar')+'</div></div>';

  // ── KPIs CFO ROW 2 ──
  var presionColor=presion<0.1?'var(--green)':presion<0.25?'var(--amber)':'var(--red)';
  document.getElementById('flujoKpis2').innerHTML=
    '<div class="kcard" style="--kc:var(--amber)"><div class="kcard-lbl">Exposición financiera C/P</div><div class="kcard-val" style="color:'+presionColor+'">'+(presion*100).toFixed(1)+'%</div><div class="kcard-fullnum">Pasivos C/P / Activos totales</div><div class="kcard-footer"><span class="kcard-sub">'+(presion<0.1?'✓ Exposición controlada':presion<0.25?'⚠ Exposición moderada':'⛔ Exposición elevada')+'</span></div></div>'+
    '<div class="kcard" style="--kc:var(--blue)"><div class="kcard-lbl">Bancos disponibles</div><div class="kcard-val" style="color:var(--blue)">'+fmtCOP(bancos)+'</div><div class="kcard-fullnum">'+fmtFull(bancos)+'</div><div class="kcard-footer"><span class="kcard-sub">Liquidez inmediata disponible</span></div></div>'+
    '<div class="kcard" style="--kc:var(--red)"><div class="kcard-lbl">Deuda financiera</div><div class="kcard-val" style="color:var(--red)">'+fmtCOP(prestamos)+'</div><div class="kcard-fullnum">'+fmtFull(prestamos)+'</div><div class="kcard-footer"><span class="kcard-sub">'+(totAct>0?(prestamos/totAct*100).toFixed(1)+'% de los activos':'—')+'</span></div></div>';

  // ── GRÁFICAS — paleta corporativa CFO premium ──
  setText('flujoActMeta',fmtFull(totAct));
  setText('flujoPasMeta',fmtFull(totPas));

  var donutCfg=function(labels,data,colors){
    return {type:'doughnut',data:{labels:labels,datasets:[{data:data,
      backgroundColor:colors,
      borderColor:'rgba(10,14,39,.7)',
      borderWidth:3,
      hoverBorderColor:'rgba(255,255,255,.25)',
      hoverBorderWidth:2,
      hoverOffset:14,
      spacing:2
    }]},options:{responsive:true,maintainAspectRatio:true,cutout:'64%',
      animation:{animateRotate:true,animateScale:false,duration:700,easing:'easeInOutQuart'},
      plugins:{
        legend:{position:'bottom',labels:{color:'#cbd5e1',usePointStyle:true,pointStyleWidth:10,padding:14,font:{size:11,family:'DM Sans'}}},
        tooltip:{backgroundColor:'rgba(8,12,30,.97)',titleColor:'#f1f5f9',bodyColor:'#cbd5e1',
          borderColor:'rgba(255,255,255,.08)',borderWidth:1,cornerRadius:10,padding:12,
          callbacks:{label:function(ctx){
            var t=ctx.dataset.data.reduce(function(a,b){return a+(b||0);},0);
            var p=t?(ctx.parsed/t*100).toFixed(1):0;
            return '  '+ctx.label+': $'+Math.round(ctx.parsed).toLocaleString('es-CO')+' ('+p+'%)';
          }}}}}};
  };

  mkChart('chartFlujoActivos',donutCfg(
    ['🏦 Bancos','📋 Cartera C/P','📋 Cartera L/P'],
    [bancos,cartCP,cartLP],
    ['rgba(59,130,246,.88)','rgba(16,185,129,.88)','rgba(245,158,11,.88)']
  ));

  mkChart('chartFlujoPasivos',donutCfg(
    ['⚡ Pasivos C/P','📦 CxP L/P','🏦 Préstamos'],
    [pasCP,pasLPOp,prestamos],
    ['rgba(239,68,68,.88)','rgba(245,158,11,.88)','rgba(139,92,246,.88)']
  ));

  // Waterfall con gradiente
  mkChart('chartFlujoWaterfall',{type:'bar',data:{
    labels:['Bancos','Cartera C/P','Cartera L/P','Pas. C/P','CxP L/P','Préstamos','Pos. Neta'],
    datasets:[
      {label:'Activos',data:[bancos,cartCP,cartLP,0,0,0,0],
        backgroundColor:function(ctx){var c=ctx.chart;var a=c.chartArea;if(!a)return 'rgba(16,185,129,.75)';var g=c.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,'rgba(52,211,153,.92)');g.addColorStop(1,'rgba(5,150,105,.28)');return g;},
        borderWidth:0,borderRadius:4,borderSkipped:false,order:2},
      {label:'Pasivos',data:[0,0,0,pasCP,pasLPOp,prestamos,0],
        backgroundColor:function(ctx){var c=ctx.chart;var a=c.chartArea;if(!a)return 'rgba(239,68,68,.72)';var g=c.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,'rgba(248,113,113,.92)');g.addColorStop(1,'rgba(185,28,28,.28)');return g;},
        borderWidth:0,borderRadius:4,borderSkipped:false,order:2},
      {label:'Pos. Neta',data:[0,0,0,0,0,0,posNeta],
        backgroundColor:posNeta>=0?'rgba(59,130,246,.85)':'rgba(239,68,68,.85)',
        borderWidth:0,borderRadius:4,borderSkipped:false,order:2}
    ]
  },options:{responsive:true,maintainAspectRatio:true,
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{labels:{color:'#cbd5e1',usePointStyle:true,padding:12,font:{size:11}}},
      tooltip:{backgroundColor:'rgba(8,12,30,.97)',titleColor:'#f1f5f9',bodyColor:'#cbd5e1',cornerRadius:10,padding:12,
        callbacks:{label:function(ctx){var v=ctx.parsed.y;return v?(' '+ctx.dataset.label+': $'+Math.round(Math.abs(v)).toLocaleString('es-CO')):'';}}}}    ,
    scales:{y:{ticks:{callback:function(v){return fmtCOP(v);},color:'#94a3b8'},grid:{color:'rgba(255,255,255,.04)'}},
      x:{ticks:{color:'#94a3b8'},grid:{display:false}}}}});

  mkChart('chartFlujoComp',donutCfg(
    ['⚡ Pas. C/P','📦 CxP L/P','🏦 Préstamos'],
    [pasCP,pasLPOp,prestamos],
    ['rgba(239,68,68,.88)','rgba(245,158,11,.88)','rgba(59,130,246,.88)']
  ));

  // ── TABLAS DETALLE ──
  var CUENTA_COLORS={'BANCOS':'var(--blue)','CARTERA':'var(--green)','PASIVOS A CORTO PLAZO':'var(--red)','PASIVOS A LARGO PLAZO':'var(--amber)'};
  function renderTblFlujo(tbId,metaId,rows){
    setText(metaId,rows.length+' ítems · '+fmtFull(rows.reduce(function(a,r){return a+r.valor;},0)));
    var byC={};
    rows.forEach(function(r){if(!byC[r.cuentas])byC[r.cuentas]={cuentas:r.cuentas,rows:[],total:0};byC[r.cuentas].rows.push(r);byC[r.cuentas].total+=r.valor;});
    var html='';
    Object.values(byC).forEach(function(g){
      var col=CUENTA_COLORS[g.cuentas]||'var(--txt2)';
      html+='<tr style="background:rgba(255,255,255,.04)"><td colspan="4" style="font-family:\'Oswald\',sans-serif;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:'+col+';padding:8px 14px">'+g.cuentas+' · '+fmtFull(g.total)+'</td></tr>';
      g.rows.forEach(function(r,i){
        var bg=i%2===0?'transparent':'rgba(255,255,255,.015)';
        html+='<tr style="background:'+bg+'">'+
          '<td style="padding-left:24px;font-size:10px;color:var(--txt2);white-space:nowrap">'+r.cuentas+'</td>'+
          '<td style="font-size:10px;color:var(--txt2)">'+r.concepto+'</td>'+
          '<td><strong style="font-size:11px">'+r.descripcion+'</strong></td>'+
          '<td class="r mono" style="font-size:12px;font-weight:700;color:'+(r.valor>0?col:'var(--txt2)')+'">'+
            (r.valor>0?fmtFull(r.valor):'—')+'</td></tr>';
      });
    });
    document.getElementById(tbId).innerHTML=html||'<tr><td colspan="5" style="text-align:center;color:var(--txt2);padding:20px">Sin datos</td></tr>';
  }
  renderTblFlujo('tblFlujoAct','flujoActTblMeta',activos);
  renderTblFlujo('tblFlujoPas','flujoPasTblMeta',pasivos);
}


/* ════════ TOGGLE ROW EXPANDIBLE ════════ */
function toggleRow(id){
  var row=document.getElementById('row-'+id);
  var btn=document.getElementById('btn-'+id);
  if(!row||!btn)return;
  var isOpen=row.classList.contains('show');
  if(isOpen){
    row.classList.remove('show');
    btn.classList.remove('rotated');
    var prev=row.previousElementSibling;
    if(prev)prev.classList.remove('expanded');
  } else {
    row.classList.add('show');
    btn.classList.add('rotated');
    var prev=row.previousElementSibling;
    if(prev)prev.classList.add('expanded');
  }
}
window.toggleRow=toggleRow;

/* ════════ SUPABASE SAVE/LOAD ════════ */
async function fhSaveToSupabase(payload){
  if(!payload||!fIsAdmin)return false;
  try{
    var body=JSON.stringify({data:{fin:payload,meta:{updated:new Date().toISOString()}},updated_at:new Date().toISOString()});
    fhNotif('⏳ Guardando...','info');
    var r=await fetch(SUPABASE_URL+'/rest/v1/dashboard_data?id=eq.'+FIN_ID,{method:'PATCH',headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:body});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var resp=await r.json();
    if(resp.length===0){
      var r2=await fetch(SUPABASE_URL+'/rest/v1/dashboard_data',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({id:FIN_ID,data:{fin:payload,meta:{updated:new Date().toISOString()}},updated_at:new Date().toISOString()})});
      if(!r2.ok)throw new Error('INSERT '+r2.status);
    }
    fhNotif('✅ Guardado en la nube','ok');
    return true;
  }catch(e){console.error(e);fhNotif('❌ '+e.message,'err');return false;}
}

async function fhLoadFromSupabase(){
  fhNotif('⏳ Sincronizando...','info');
  try{
    var r=await fetch(SUPABASE_URL+'/rest/v1/dashboard_data?id=eq.'+FIN_ID+'&select=*',{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var result=await r.json();
    if(!result||!result[0])throw new Error('Fila no existe');
    var d=result[0].data;
    if(!d||!d.fin){fhNotif('⚠ Sin datos. Carga el Maestro.','info');return false;}
    var keys=Object.keys(d.fin).filter(function(k){return !k.startsWith('_');});
    if(keys.length===0){fhNotif('⚠ Vacío. Carga el Maestro.','info');return false;}
    if(typeof window.fSetDataFromCloud==='function')window.fSetDataFromCloud(d.fin);
    fhNotif('✅ Datos sincronizados','ok');
    return true;
  }catch(e){console.error(e);fhNotif('❌ '+e.message,'err');return false;}
}
window.fhLoadFromSupabase=fhLoadFromSupabase;

/* ════════ PARSERS DESDE MAESTRO ════════ */
function detectSemana(wb){
  for(var i=0;i<wb.SheetNames.length;i++){
    var arr=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]],{header:1,defval:null});
    for(var j=3;j<Math.min(15,arr.length);j++){
      if(arr[j] && arr[j][0]){
        var m=String(arr[j][0]).match(/^S(\d{1,2})$/);
        if(m)return 'S'+m[1].padStart(2,'0');
      }
    }
  }
  var now=new Date(),onejan=new Date(now.getFullYear(),0,1);
  var wk=Math.ceil((((now-onejan)/86400000)+onejan.getDay()+1)/7);
  return 'S'+String(wk).padStart(2,'0');
}

function parseMaestroFact(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('FACTURACION')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=3;i<arr.length;i++){
    var r=arr[i];if(!r||!r[0])continue;
    var v=parseFloat(r[9]);if(isNaN(v)||v<=0)continue;
    rows.push({sem:String(r[0]),fecha:fmtFecha(r[1]),linea:String(r[2]||''),cliente:String(r[3]||''),nit:String(r[5]||''),comprobante:r[6],factura:r[7],referencia:String(r[8]||''),valor:v,mes:String(r[10]||'').trim()});
  }
  return rows;
}

function parseMaestroCart(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('CARTERA')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=3;i<arr.length;i++){
    var r=arr[i];if(!r||!r[0]||!r[3])continue;
    var t=parseFloat(r[9]);if(isNaN(t))continue;
    rows.push({sem:String(r[0]),linea:String(r[1]||''),cliente:String(r[3]||''),nit:String(r[4]||''),factura:r[5],vencimiento:fmtFecha(r[6]),semanaVcto:String(r[7]||''),dias:parseFloat(r[8])||0,total:t,'0-30':parseFloat(r[11])||0,'31-60':parseFloat(r[12])||0,'61-90':parseFloat(r[13])||0});
  }
  return rows;
}

function parseMaestroBan(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('BANCOS')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=3;i<arr.length;i++){
    var r=arr[i];if(!r||!r[0])continue;
    var v=parseFloat(r[7]);if(isNaN(v))continue;
    rows.push({sem:String(r[0]),fecha:fmtFecha(r[1]),tipo:String(r[2]||''),linea:String(r[3]||''),tercero:String(r[5]||''),concepto:String(r[6]||''),valor:v});
  }
  return rows;
}

function parseMaestroSal(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('SALDOS')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=3;i<arr.length;i++){
    var r=arr[i];if(!r||!r[0]||!r[2])continue;
    var v=parseFloat(r[13]);if(isNaN(v))continue;
    rows.push({sem:String(r[0]),linea:String(r[1]||''),manifiesto:String(r[2]),cliente:String(r[4]||''),poseedor:String(r[5]||''),cc:String(r[6]||''),vehiculo:String(r[7]||''),origen:String(r[8]||''),destino:String(r[9]||''),emision:fmtFecha(r[10]),vencimiento:fmtFecha(r[11]),dias:parseFloat(r[12])||0,valor:v});
  }
  return rows;
}

function parseMaestroAdm(wb){
  var rows=[];
  var sn=wb.SheetNames.find(function(s){return s.indexOf('ADMINISTRATIVO')>=0;});
  if(!sn)return rows;
  var arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
  for(var i=3;i<arr.length;i++){
    var r=arr[i];if(!r||!r[0]||!r[1])continue;
    rows.push({sem:String(r[0]),nombre:String(r[1]),id:String(r[2]||''),tipo:String(r[3]||''),vencimiento:fmtFecha(r[4]),valor:parseFloat(r[6])||0,provision:parseFloat(r[7])||0,medio:String(r[9]||''),obs:String(r[11]||'')});
  }
  return rows;
}

/* ════════ UPLOAD ════════ */
function fhSlotLoadMaestro(input){
  var file=input.files[0];if(!file)return;
  if(typeof XLSX==='undefined'){fhNotif('❌ XLSX no disponible','err');return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      fRawFiles.maestro=wb;
      var sem=detectSemana(wb);
      var newF=parseMaestroFact(wb),newC=parseMaestroCart(wb),newB=parseMaestroBan(wb),newS=parseMaestroSal(wb),newA=parseMaestroAdm(wb),newFl=parseMaestroFlujo(wb);
      var status=document.getElementById('maestroStatus');
      status.innerHTML='✓ <strong>'+file.name+'</strong> — Semana detectada: <strong>'+(sem||'N/A')+'</strong>';
      // Mostrar preview de qué pasará
      var prev=document.getElementById('fhUploadPreview');
      if(prev){
        prev.style.display='block';
        prev.innerHTML=
          '<strong style="color:#fff;display:block;margin-bottom:4px">¿Qué pasará al procesar?</strong>'+
          '· Facturación: reemplaza todo el acumulado ('+newF.length+' registros)<br>'+
          '· Cartera '+(sem||'')+': '+newC.length+' registros<br>'+
          '· Bancos '+(sem||'')+': '+newB.length+' registros<br>'+
          '· Saldos '+(sem||'')+': '+newS.length+' registros<br>'+
          '· Administrativos '+(sem||'')+': '+newA.length+' registros<br>'+
          '· Flujo de Caja '+(sem||'')+': '+newFl.length+' registros'+(newFl.length===0?' <span style="color:var(--amber)">(hoja 07_FLUJO_CAJA no encontrada)</span>':'');
      }
      document.getElementById('fhBtnProcesar').disabled=false;
      fhNotif('✓ Maestro cargado','ok');
    }catch(err){fhNotif('Error: '+err.message,'err');}
  };
  reader.readAsArrayBuffer(file);
}
window.fhSlotLoadMaestro=fhSlotLoadMaestro;

function fhHandleDrop(e){e.preventDefault();var f=e.dataTransfer.files;if(f.length){var i=document.getElementById('inp-maestro');i.files=f;fhSlotLoadMaestro(i);}}
window.fhHandleDrop=fhHandleDrop;

async function fhProcesar(){
  if(!fRawFiles.maestro){fhNotif('❌ Sin archivo','err');return;}
  fhNotif('⏳ Procesando...','info');
  try{
    var wb=fRawFiles.maestro;
    var sem=detectSemana(wb);
    var newF=parseMaestroFact(wb),newC=parseMaestroCart(wb),newB=parseMaestroBan(wb),newS=parseMaestroSal(wb),newA=parseMaestroAdm(wb),newFl=parseMaestroFlujo(wb);
    
    // TODOS los módulos: reemplaza TODO el histórico con el contenido del Maestro
    // El Maestro ya trae el acumulado completo — la acumulación histórica vive en el Excel
    var base={fact:[],cartera:[],bancos:[],saldos:[],adm:[],flujo:[]};
    base.fact    = newF;
    base.cartera = newC;
    base.bancos  = newB;
    base.saldos  = newS;
    base.adm     = newA;
    base.flujo   = newFl;
    
    base._meta={updated:new Date().toISOString(),sem_actual:sem};
    
    // Generar array de semanas únicas
    var semsSet=new Set([].concat(
      (base.fact||[]).map(function(r){return r.sem;}),
      (base.cartera||[]).map(function(r){return r.sem;}),
      (base.bancos||[]).map(function(r){return r.sem;}),
      (base.saldos||[]).map(function(r){return r.sem;}),
      (base.adm||[]).map(function(r){return r.sem;})
    ));
    base.semanas=sortSems(Array.from(semsSet).filter(Boolean));
    
    var saved=await fhSaveToSupabase(base);
    if(saved){
      fData=base;window.fData=base;
      fBuildAllFiltros();
      document.getElementById('fhEmpty').style.display='none';
      // Ocultar preview
      var prev=document.getElementById('fhUploadPreview');
      if(prev) prev.style.display='none';
      showView(fCurrentView);
      fhCloseUpload();
      setSyncOk();
      fCheckAlerts();
      fRawFiles={};
      document.getElementById('maestroStatus').textContent='Esperando archivo...';
      document.getElementById('fhBtnProcesar').disabled=true;
    }
  }catch(e){console.error(e);fhNotif('❌ '+e.message,'err');}
}
window.fhProcesar=fhProcesar;

/* ════════ PIN ════════ */
function fhBrandClick(){fBrandClicks++;clearTimeout(fBrandTimer);if(fIsAdmin&&fBrandClicks>=5){fBrandClicks=0;fhLogout();return;}fBrandTimer=setTimeout(function(){fBrandClicks=0;},2000);if(fBrandClicks>=5){fBrandClicks=0;fhP();}}
window.fhBrandClick=fhBrandClick;
function fhP(){document.getElementById('fhPinModal').classList.add('vis');fPinBuf='';fhUpdateDots();}
function fhPClose(){document.getElementById('fhPinModal').classList.remove('vis');fPinBuf='';document.getElementById('fhPinErr').textContent='';}
window.fhPClose=fhPClose;
function fhPinKey(d){if(fPinBuf.length<4){fPinBuf+=d;fhUpdateDots();if(fPinBuf.length===4)setTimeout(fhPinSubmit,200);}}
window.fhPinKey=fhPinKey;
function fhPinDel(){fPinBuf=fPinBuf.slice(0,-1);fhUpdateDots();}
window.fhPinDel=fhPinDel;
function fhUpdateDots(){for(var i=0;i<4;i++){var d=document.getElementById('fd'+i);if(d)d.className='pin-dot'+(i<fPinBuf.length?' filled':'');}}
function fhPinSubmit(){if(fPinBuf===FH_PIN){fIsAdmin=true;fhPClose();document.getElementById('adminChip').style.display='inline-flex';document.getElementById('fhLoadBtn').style.display='flex';fhNotif('✅ Admin activo','ok');}else{fPinBuf='';fhUpdateDots();document.getElementById('fhPinErr').textContent='PIN incorrecto';setTimeout(function(){document.getElementById('fhPinErr').textContent='';},2000);}}
function fhLogout(){fIsAdmin=false;document.getElementById('adminChip').style.display='none';document.getElementById('fhLoadBtn').style.display='none';fhNotif('Sesión cerrada','info');}

/* ════════ MODAL ════════ */
function fhOpenUpload(){document.getElementById('fhUploadModal').classList.add('vis');}
function fhCloseUpload(){document.getElementById('fhUploadModal').classList.remove('vis');}
window.fhOpenUpload=fhOpenUpload;window.fhCloseUpload=fhCloseUpload;

function fhNotif(msg,type){var t=document.getElementById('fhToast');t.textContent=msg;t.className='toast show '+(type||'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='toast';},3500);}
function setSyncOk(){document.getElementById('liveChip').style.display='inline-flex';}

window.addEventListener('load',function(){
  setTimeout(function(){if(window.location.protocol!=='file:')fhLoadFromSupabase();},700);
});

/* ════════ DOWNLOAD MAESTRO ════════ */
function fhDownloadMaestro(){
  if(!fData||!fData.fact){fhNotif('❌ No hay datos para exportar','err');return;}
  if(typeof XLSX==='undefined'){fhNotif('❌ XLSX no cargado','err');return;}
  fhNotif('⏳ Generando Maestro...','info');
  try{
    var wb=XLSX.utils.book_new();

    // 00_CONFIG
    var configData=[
      ['INLOP BI · MODELO DE DATOS MAESTRO','','','',''],
      ['',' ','','',''],
      ['Empresa','INTEGRAL LOGISTICS OPERATIONS S.A.S. — INLOP','','',''],
      ['Versión','v1.0 — Generado desde Dashboard','','',''],
      ['Líneas de negocio','CARGA LIQUIDA | CARGA SECA','','',''],
      ['Fecha generación',new Date().toLocaleString('es-CO'),'','',''],
      ['Total semanas',fData.semanas?fData.semanas.length:0,'','',''],
      ['Total facturas',(fData.fact||[]).length,'','',''],
      ['Total cartera',(fData.cartera||[]).length,'','',''],
      ['Total mov. bancarios',(fData.bancos||[]).length,'','',''],
      ['Total saldos',(fData.saldos||[]).length,'','',''],
      ['Total adm.',(fData.adm||[]).length,'','',''],
      ['','','','',''],
      ['MAPA CLIENTES','','','',''],
      ['CLIENTE LEGAL','LÍNEA NEGOCIO','','','']
    ];
    Object.keys(LINEA_MAP).forEach(function(k){configData.push([k,LINEA_MAP[k],'','','']);});
    var wsConfig=XLSX.utils.aoa_to_sheet(configData);
    XLSX.utils.book_append_sheet(wb,wsConfig,'00_CONFIG');

    // 01_FACTURACION
    var factData=[['INLOP · FACTURACIÓN','','','','','','','','',''],['','','','','','','','','',''],['SEMANA','FECHA','LÍNEA NEGOCIO','CLIENTE (LEGAL)','CLIENTE ALIAS','NIT','NRO. COMPROBANTE','NRO. FACTURA','REFERENCIA','VALOR (COP)']];
    (fData.fact||[]).forEach(function(r){factData.push([r.sem,r.fecha,r.linea||getLineaCli(r.cliente),r.cliente,shortN(r.cliente),r.nit,r.comprobante,r.factura,r.referencia,r.valor]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(factData),'01_FACTURACION');

    // 02_CARTERA
    var cartData=[['INLOP · CARTERA','','','','','','','','','','','','',''],['','','','','','','','','','','','','',''],['SEMANA','LÍNEA NEGOCIO','CLIENTE ALIAS','CLIENTE (LEGAL)','NIT','FACTURA','F. VENCIMIENTO','SEM. VCTO.','DÍAS','TOTAL CARTERA','POR VENCER','AGING 0-30','AGING 31-60','AGING 61-90']];
    (fData.cartera||[]).forEach(function(r){cartData.push([r.sem,r.linea||getLineaCli(r.cliente),shortN(r.cliente),r.cliente,r.nit,r.factura,r.vencimiento,r.semanaVcto,r.dias,r.total,r.total,r['0-30']||0,r['31-60']||0,r['61-90']||0]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(cartData),'02_CARTERA');

    // 03_BANCOS
    var banData=[['INLOP · BANCOS','','','','','','',''],['','','','','','','',''],['SEMANA','FECHA','TIPO','LÍNEA NEGOCIO','TERCERO ALIAS','TERCERO (COMPLETO)','CONCEPTO','VALOR (COP)']];
    (fData.bancos||[]).forEach(function(r){banData.push([r.sem,r.fecha,r.tipo||(r.valor>=0?'ENTRADA':'SALIDA'),r.linea,shortN(r.tercero),r.tercero,r.concepto,r.valor]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(banData),'03_BANCOS');

    // 04_SALDOS
    var salData=[['INLOP · SALDOS MANIFIESTOS','','','','','','','','','','','','','',''],['','','','','','','','','','','','','','',''],['SEMANA','LÍNEA NEGOCIO','MANIFIESTO','CLIENTE ALIAS','CLIENTE (LEGAL)','POSEEDOR','CC POSEEDOR','VEHÍCULO','ORIGEN','DESTINO','F. EMISIÓN','F. VENCIMIENTO','DÍAS','VALOR (COP)','ESTADO']];
    var hoy=new Date();hoy.setHours(0,0,0,0);
    (fData.saldos||[]).forEach(function(r){
      var d=r.vencimiento?Math.round((new Date(parseFecha(r.vencimiento))-hoy)/86400000):null;
      var est=d===null?'—':d<0?'VENCIDO':d<=3?'URGENTE':d<=7?'PRONTO':'VIGENTE';
      salData.push([r.sem,r.linea||getLineaCli(r.cliente),r.manifiesto,shortN(r.cliente),r.cliente,r.poseedor,r.cc,r.vehiculo,r.origen,r.destino,r.emision,r.vencimiento,d,r.valor,est]);
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(salData),'04_SALDOS');

    // 05_ADMINISTRATIVOS
    var admData=[['INLOP · ADMINISTRATIVOS','','','','','','','','','','',''],['','','','','','','','','','','',''],['SEMANA','BENEFICIARIO','IDENTIFICACIÓN','TIPO PAGO','F. VENCIMIENTO','DÍAS','VALOR (COP)','PROVISIÓN','DIFERENCIA','MEDIO PAGO','ESTADO','OBSERVACIONES']];
    (fData.adm||[]).forEach(function(r){
      var d=r.vencimiento?Math.round((new Date(parseFecha(r.vencimiento))-hoy)/86400000):null;
      var est=d===null?'—':d<0?'VENCIDO':d<=2?'HOY':'VIGENTE';
      admData.push([r.sem,r.nombre,r.id,r.tipo,r.vencimiento,d,r.valor,r.provision,r.valor-r.provision,r.medio,est,'']);
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(admData),'05_ADMINISTRATIVOS');

    // 06_BALANCE consolidado
    var balanceData=[['INLOP · BALANCE FINANCIERO CONSOLIDADO','','','','',''],['','','','','',''],['CONCEPTO','CARGA LIQUIDA','CARGA SECA','TOTAL','% LIQ','% SECA']];
    var fLiq=(fData.fact||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);
    var fSeca=(fData.fact||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);
    var cLiq=(fData.cartera||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.total;},0);
    var cSeca=(fData.cartera||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.total;},0);
    var sLiq=(fData.saldos||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA LIQUIDA';}).reduce(function(a,r){return a+r.valor;},0);
    var sSeca=(fData.saldos||[]).filter(function(r){return (r.linea||getLineaCli(r.cliente))==='CARGA SECA';}).reduce(function(a,r){return a+r.valor;},0);
    function pctLiq(l,s){return (l+s)?(l/(l+s)*100).toFixed(1)+'%':'0%';}
    function pctSeca(l,s){return (l+s)?(s/(l+s)*100).toFixed(1)+'%':'0%';}
    balanceData.push(['Facturación',fLiq,fSeca,fLiq+fSeca,pctLiq(fLiq,fSeca),pctSeca(fLiq,fSeca)]);
    balanceData.push(['Cartera por cobrar',cLiq,cSeca,cLiq+cSeca,pctLiq(cLiq,cSeca),pctSeca(cLiq,cSeca)]);
    balanceData.push(['Saldos a pagar',sLiq,sSeca,sLiq+sSeca,pctLiq(sLiq,sSeca),pctSeca(sLiq,sSeca)]);
    var ent=(fData.bancos||[]).filter(function(r){return r.valor>0;}).reduce(function(a,r){return a+r.valor;},0);
    var sal=(fData.bancos||[]).filter(function(r){return r.valor<0;}).reduce(function(a,r){return a+Math.abs(r.valor);},0);
    balanceData.push(['','','','','','']);
    balanceData.push(['BANCOS','','','','','']);
    balanceData.push(['Entradas','','',ent,'','']);
    balanceData.push(['Salidas','','',sal,'','']);
    balanceData.push(['Saldo neto','','',ent-sal,'','']);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(balanceData),'06_BALANCE');

    // Generar nombre de archivo con fecha y semanas
    var sems=sortSems((fData.semanas||[]).slice());
    var rangoSems=sems.length>1?sems[0]+'-'+sems[sems.length-1]:(sems[0]||'INLOP');
    var fname='INLOP_Maestro_Financiero_'+rangoSems+'_'+new Date().toISOString().slice(0,10)+'.xlsx';

    XLSX.writeFile(wb,fname);
    fhNotif('✅ Maestro descargado: '+fname,'ok');
  }catch(e){console.error(e);fhNotif('❌ Error: '+e.message,'err');}
}
window.fhDownloadMaestro=fhDownloadMaestro;
</script>
</body>
</html>
