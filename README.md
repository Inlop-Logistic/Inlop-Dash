# INLOP · Business Intelligence Dashboard

**Plataforma BI ejecutiva** para Integral Logistics Operations S.A.S.  
Desplegada en GitHub Pages — [https://inlop-logistic.github.io/Inlop-Dash/](https://inlop-logistic.github.io/Inlop-Dash/)

---

## Estructura del proyecto

```
/BI-INLOP
│
├── index.html              ← Entrada única (todos los módulos)
│
├── css/
│   └── styles.css          ← Estilos globales (variables, componentes, portal, OTIF)
│
├── js/
│   ├── supabase.js         ← Config Supabase + funciones save/load + MSAL/Azure
│   ├── utils.js            ← Utilidades compartidas: toast, fmtShort, etc.
│   ├── charts.js           ← Config Chart.js + constantes de paleta compartidas
│   ├── operaciones.js      ← Módulo Centro de Control Operativo (Carga Liq + Seca)
│   ├── otif.js             ← Módulo OTIF — On Time In Full (IIFE encapsulado)
│   └── app.js              ← Navegación global + portal stats + exportaciones Word/PDF
│
├── components/
│   ├── navbar.html         ← Referencia: header del módulo Operaciones
│   └── sidebar.html        ← Referencia: week-row del módulo Operaciones
│
└── assets/                 ← (vacío — logos embebidos como base64 en index.html)
```

---

## Orden de carga de scripts

```
Chart.js CDN → XLSX CDN → docx (inline) → supabase.js → utils.js
→ charts.js → MSAL CDN → operaciones.js → otif.js → app.js
```

---

## Módulos y dependencias

| Archivo | Depende de | Expone |
|---------|-----------|--------|
| `supabase.js` | ninguno | `supabaseQuery`, `saveToSupabase`, `loadFromSupabase`, `saveOtifToSupabase`, `loadOtifFromSupabase`, `initMsal` |
| `utils.js` | ninguno | `toast()`, `fmtShort()`, `semToMes()`, `destroyChart()` |
| `charts.js` | Chart.js CDN | `AX`, `AX_GRID`, `TB_BG`, `TB_BD`, `tip`, `chartScales()` |
| `operaciones.js` | supabase.js, utils.js, charts.js | `window.DATA_LIQ`, `window.DATA_SEC`, `window._opsWs` |
| `otif.js` | supabase.js, utils.js | `window.ohSetDataFromCloud()`, `window._oOTIF`, `window.otifInit()` |
| `app.js` | todos los anteriores | `abrirVista()`, `volverPortal()`, `ohExportPDF()`, `ohExportWord()` |

---

## Supabase

- **URL**: `https://gtyydandwcgoaratmnqh.supabase.co`
- **Tabla**: `dashboard_data` (`id`, `data jsonb`, `updated_at`)
- **id=1** → Operaciones (Carga Líquida + Seca)
- **id=2** → OTIF

---

## Componentes reutilizables identificados para futuras expansiones

Los siguientes componentes están listos para ser extraídos cuando se agreguen nuevos módulos (Comercial, Cartera, Talento Humano):

1. **`supabase.js`** — ya es completamente genérico. Agregar nuevo módulo = agregar `saveXToSupabase(id=3)` y `loadXFromSupabase(id=3)`.
2. **`utils.js`** — `toast()` ya es global. Agregar más helpers aquí.
3. **`charts.js`** — `chartScales()` y constantes de paleta compartidas.
4. **Patrón bridge** (`window.ohSetDataFromCloud`) — replicable para cada nuevo módulo.
5. **`abrirVista()`** en app.js — agregar nuevo módulo = agregar su ID al array `['portal','ops','otif','financiero','comercial']`.

---

*Generado automáticamente — INLOP BI Modularización v1.0*
