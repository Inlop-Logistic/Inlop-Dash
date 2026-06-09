var AUDIT_LABELS = {
  'A01':'login_financiero',
  'A02':'acceso_denegado',
  'A03':'pin_correcto',
  'A04':'pin_incorrecto',
  'A05':'logout_admin',
  'B01':'carga_maestro',
  'B02':'guardado_supabase',
  'B03':'sincronizacion',
  'B04':'borrado_cache',
  'B05':'exportacion',
  'C01':'analisis_generado',
  'C02':'analisis_error',
  'D01':'vista_activa',
  'D02':'filtro_aplicado'
};

/* ══ FIN.Audit — Registro de eventos ════════════════════════════════════════
   Fire-and-forget: NUNCA bloquea el flujo principal.
   Primario: INSERT en fin_audit_log vía Supabase REST.
   Fallback:  localStorage buffer de 50 entradas.
   ═══════════════════════════════════════════════════════════════════════════ */
var finAudit = {

  registrar: function(codigo, detalle) {
    /* Construir payload conforme al DDL de fin_audit_log (06_SQL_Architecture) */
    var payload = {
      modulo:          'financiero',
      version:         'v2.0',
      categoria:       codigo.charAt(0),                   /* 'A'|'B'|'C'|'D' */
      codigo:          codigo,
      accion:          AUDIT_LABELS[codigo] || codigo,
      usuario_id:      FIN_USER.id   || null,
      usuario_nombre:  FIN_USER.nombre || '',
      fin_rol:         FIN_USER.rol  || 'viewer',
      semana_contexto: FIN_DATA.semanaActual || null,
      detalle: Object.assign({}, detalle || {}, {
        filtros:         { linea: FIN_FILTERS.linea, mes: FIN_FILTERS.mes,
                           sem:   FIN_FILTERS.sem,   cli: FIN_FILTERS.cli },
        timestamp_local: new Date().toISOString()
      })
    };

    /* Fire-and-forget: no await, no bloqueo */
    sbQ('POST', 'fin_audit_log', payload)
      .then(function(){ /* éxito ignorado */ })
      .catch(function(){ finAudit._guardarLocal(payload); });
  },

  _guardarLocal: function(payload) {
    /* Fallback silencioso: rolling buffer de 50 entradas */
    try {
      var KEY = 'inlop_fin_audit_v2';
      var log = JSON.parse(localStorage.getItem(KEY) || '[]');
      log.unshift(Object.assign({}, payload,
                  { timestamp: new Date().toISOString() }));
      localStorage.setItem(KEY, JSON.stringify(log.slice(0, 50)));
    } catch(e) { /* silencioso — nunca relanzar */ }
  }
};

/* ══ sbQ() — Cliente Supabase REST sin SDK ══════════════════════════════════
   Referencia: 07_Backend_Services sección 16.1
   ═══════════════════════════════════════════════════════════════════════════ */
function sbQ(method, endpoint, body) {
  var url = window.SUPABASE_URL + '/rest/v1/' + endpoint;

  /* Header Prefer: diferente para lecturas vs escrituras */
  var prefer = (method === 'PATCH') ? 'return=minimal' : 'return=representation';

  var options = {
    method:  method,
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        prefer
    }
  };

  if (body) options.body = JSON.stringify(body);

  return fetch(url, options).then(function(r) {
    /* 401 → sesión expirada */
    if (r.status === 401) {
      sessionExpiredHandler();
      throw new Error('Supabase: sesión expirada (401)');
    }
    /* 403 → RLS bloqueó la operación */
    if (r.status === 403) {
      throw new Error('Supabase: sin permisos (403)');
    }
    /* 204 No Content (PATCH con return=minimal) → devolver array vacío */
    if (r.status === 204) return [];
    if (!r.ok) throw new Error('Supabase: ' + r.statusText + ' (' + r.status + ')');
    return r.json();
  });
}

/* Helper: timeout como Promise */
function sbTimeout(ms) {
  return new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('TIMEOUT')); }, ms);
  });
}

/* Handler de sesión expirada — muestra overlay y redirige al portal */
function sessionExpiredHandler() {
  var overlay = document.getElementById('finOverlayDenied');
  var msg     = document.getElementById('finDeniedMsg');
  if (msg)     msg.textContent = 'Tu sesión ha expirado. Inicia sesión nuevamente desde el portal.';
  if (overlay) overlay.classList.add('show');
}

/* ══ FIN.Data — Persistencia y sincronización ═══════════════════════════════
   Referencia: 07_Backend_Services secciones 5.2–5.6
   ═══════════════════════════════════════════════════════════════════════════ */
var finData = {

  /* ── loadCloud(): Cargar desde Supabase. Retorna {fin, meta} o null. ─────
     Nunca lanza excepción al exterior. Retry 1 vez con timeout reducido. */
  loadCloud: function() {
    var endpoint = 'dashboard_data?id=eq.' + MODULE_ID + '&select=*';

    /* Intento 1: 8 segundos */
    return Promise.race([
      sbQ('GET', endpoint),
      sbTimeout(8000)
    ]).then(function(result) {
      if (!result || !result[0]) return null;
      var row = result[0];
      if (!row.data || !row.data.fin) return null;
      return { fin: row.data.fin, meta: row.data.meta || {} };
    }).catch(function() {
      /* Intento 2 con 5 segundos */
      return Promise.race([
        sbQ('GET', endpoint),
        sbTimeout(5000)
      ]).then(function(result) {
        if (!result || !result[0]) return null;
        var row = result[0];
        if (!row.data || !row.data.fin) return null;
        return { fin: row.data.fin, meta: row.data.meta || {} };
      }).catch(function() {
        return null; /* Silencioso — el caller maneja el fallback */
      });
    });
  },

  /* ── saveCloud(): Persistir FIN_DATA en Supabase. Upsert manual. ─────────
     Precondición: FIN_CAN_EDIT === true.
     Patrón: intentar PATCH; si retorna [] (0 rows) → POST. */
  saveCloud: function(payloadOverride) {
    if (!FIN_CAN_EDIT) {
      toast('Sin permisos para guardar en la nube', 'warn');
      return Promise.resolve(false);
    }

    var t0      = Date.now();
    var payload = payloadOverride || { fin: FIN_DATA, meta: FIN_META };
    var body    = { data: payload, updated_at: new Date().toISOString() };

    toast('Guardando en la nube…', 'info');

    return sbQ('PATCH', 'dashboard_data?id=eq.' + MODULE_ID, body)
      .then(function(patchResult) {
        /* PATCH con return=minimal devuelve [] cuando 0 filas afectadas */
        if (Array.isArray(patchResult) && patchResult.length === 0) {
          /* La fila no existe — primer uso: crear con POST */
          var bodyPost = Object.assign({}, body, { id: MODULE_ID });
          return sbQ('POST', 'dashboard_data', bodyPost);
        }
        return patchResult;
      })
      .then(function() {
        var elapsed = Date.now() - t0;
        FIN_SRC = 'supabase';
        FIN_META.updatedAt = new Date().toISOString();
        updateHdrChip('supabase');
        toast('✓ Guardado en la nube', 'ok');
        finAudit.registrar('B02', {
          bytes:       JSON.stringify(payload).length,
          duracion_ms: elapsed,
          semana:      FIN_DATA.semanaActual || ''
        });
        return true;
      })
      .catch(function(e) {
        toast('❌ Error al guardar: ' + e.message, 'err');
        return false;
      });
  },

  /* ── saveMem(): Guardar copia en localStorage (fallback offline) ─────────
     Captura QuotaExceededError sin interrumpir el flujo. */
  saveMem: function() {
    try {
      localStorage.setItem(K_DATA, JSON.stringify(FIN_DATA));
      localStorage.setItem(K_META, JSON.stringify(FIN_META));
      return true;
    } catch(e) {
      toast('⚠ Sin espacio en caché local', 'warn');
      return false;
    }
  },

  /* ── loadLocal(): Leer desde localStorage ────────────────────────────────
     Retorna el objeto FIN_DATA guardado o null si no existe/corrupto. */
  loadLocal: function() {
    try {
      var raw = localStorage.getItem(K_DATA);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) {
      return null; /* JSON corrupto — silencioso */
    }
  },

  /* ── clearMem(): Limpiar caché local (solo admin) ────────────────────────*/
  clearMem: function() {
    if (!FIN_IS_ADMIN) { toast('Solo administradores pueden limpiar caché', 'warn'); return; }
    localStorage.removeItem(K_DATA);
    localStorage.removeItem(K_META);
    FIN_DATA = { semanaActual:'', semanas:[], fact:[], cartera:[], bancos:[],
                 saldos:[], adm:[], balance:{}, flujo:[], historico_balance:[], flags:{} };
    FIN_META = { updatedAt:null, src:'', version:'v2', totalFacturas:0 };
    FIN_SRC  = '';
    updateHdrChip('');
    finAudit.registrar('B04', {});
    toast('✓ Caché local eliminada', 'ok');
    if (typeof refresh === 'function') refresh();
  }
};

/* Alias de compatibilidad con INLOP_CORE_v2 */
function saveMem()    { return finData.saveMem(); }
function loadMem()    { return finData.loadLocal(); }
function clearMem()   { return finData.clearMem(); }

/* Sincronización manual (botón ↻ Sincronizar del header) */
function finDataSync() {
  toast('Sincronizando…', 'info');
  finData.loadCloud().then(function(cloud) {
    if (cloud) {
      FIN_DATA = cloud.fin;
      FIN_META = cloud.meta || {};
      FIN_SRC  = 'supabase';
      updateHdrChip('supabase');
      if (typeof finFilter !== 'undefined' && finFilter.rebuild) finFilter.rebuild();
      if (typeof refresh === 'function') refresh();
      finAudit.registrar('B03', { fuente: 'supabase', semana: FIN_DATA.semanaActual || '' });
      toast('✓ Sincronizado · S' + (FIN_DATA.semanaActual || '—'), 'ok');
    } else {
      if (FIN_SRC === 'local') {
        toast('⚠ Sin conexión · Usando datos locales', 'warn');
      } else {
        toast('⚠ Sin datos disponibles · Carga el Maestro Excel', 'warn');
      }
    }
  });
}

/* ══ FIN.Auth — Autenticación y resolución de roles ════════════════════════
   Referencia: 07_Backend_Services sección 4
   ═══════════════════════════════════════════════════════════════════════════ */
var finAuth = {

  /* ── init(): Verificar rol desde Supabase profiles ───────────────────────
     Async. Ejecutado una sola vez en DOMContentLoaded, antes de loadCloud.
     Configura FIN_USER, FIN_CAN_EDIT y los controles del header. */
  init: function() {
    /* PASO 1: Obtener identidad del usuario desde el portal */
    var sessionRaw = sessionStorage.getItem('inlop_user');
    var sessionUser = null;
    try { sessionUser = sessionRaw ? JSON.parse(sessionRaw) : null; } catch(e) {}

    /* Intentar también desde window.INLOP si el portal lo expone */
    if (!sessionUser && typeof window.INLOP !== 'undefined' && window.INLOP.currentUser) {
      sessionUser = window.INLOP.currentUser;
    }

    /* Sin identidad → sesión expirada */
    if (!sessionUser || !sessionUser.id) {
      finAuth._overlayAccesoDenegado('sesion_expirada');
      return Promise.resolve();
    }

    var userId = sessionUser.id;

    /* PASO 2: Consultar profiles en Supabase (timeout 5s) */
    var endpoint = 'profiles?id=eq.' + userId +
                   '&select=nombre,rol,activo,fin_rol,fin_activo';

    return Promise.race([
      sbQ('GET', endpoint),
      sbTimeout(5000)
    ]).then(function(result) {
      var profile = (result && result[0]) ? result[0] : null;
      return finAuth._resolverRol(sessionUser, profile);
    }).catch(function() {
      /* Timeout o error de red → fallback con rol del portal */
      return finAuth._resolverRol(sessionUser, null);
    });
  },

  /* ── _resolverRol(): Construir FIN_USER y FIN_CAN_EDIT ───────────────────
     Cascada de resolución documentada en 07_Backend_Services sección 4.2 */
  _resolverRol: function(sessionUser, profile) {
    /* fin_activo = false → bloquear acceso */
    if (profile && profile.fin_activo === false) {
      finAuth._overlayAccesoDenegado('sin_acceso');
      return;
    }

    var rolResuelto = 'viewer'; /* mínimo privilegio por defecto */

    if (profile && profile.fin_rol) {
      /* fin_rol explícito en profiles → fuente canónica */
      var r = profile.fin_rol.toLowerCase();
      if (r === 'admin' || r === 'editor' || r === 'viewer') rolResuelto = r;
    } else {
      /* fin_rol null → fallback por rol del portal */
      var rolPortal = (sessionUser.rol || '').toLowerCase();
      if (rolPortal === 'master'     || rolPortal === 'gerencia')    rolResuelto = 'admin';
      else if (rolPortal === 'financiero')                           rolResuelto = 'editor';
      else                                                           rolResuelto = 'viewer';
    }

    /* PASO 4: Poblar FIN_USER */
    FIN_USER = {
      id:          sessionUser.id,
      email:       sessionUser.email    || '',
      nombre:      (profile && profile.nombre) || sessionUser.nombre || 'Usuario INLOP',
      rol_portal:  sessionUser.rol      || '',
      rol:         rolResuelto,
      activo:      true,
      resolvedAt:  new Date().toISOString()
    };
    FIN_CAN_EDIT = (rolResuelto === 'editor' || rolResuelto === 'admin');

    /* PASO 5: Actualizar UI según rol */
    finAuth._actualizarUIRol();
  },

  /* ── _actualizarUIRol(): Mostrar u ocultar controles según FIN_CAN_EDIT ──*/
  _actualizarUIRol: function() {
    var btnMaestro  = document.getElementById('finBtnCargarMaestro');
    var admControls = document.getElementById('finAdminControls');
    var emptyCta    = document.getElementById('finEmptyCargaBtn');
    var flujoEmpty  = document.getElementById('finFlujoEmptyCta');

    if (FIN_CAN_EDIT) {
      if (btnMaestro)  btnMaestro.style.display  = 'inline-flex';
      if (admControls) admControls.style.display = 'flex';
      if (emptyCta)    emptyCta.style.display    = 'inline-flex';
      if (flujoEmpty)  flujoEmpty.style.display  = 'inline-flex';
    } else {
      if (btnMaestro)  btnMaestro.style.display  = 'none';
      if (admControls) admControls.style.display = 'none';
      if (emptyCta)    emptyCta.style.display    = 'none';
      if (flujoEmpty)  flujoEmpty.style.display  = 'none';
    }
    /* El chip admin siempre oculto hasta que se valide el PIN */
    var adminChip = document.getElementById('finAdminChip');
    if (adminChip) adminChip.style.display = 'none';
  },

  /* ── _overlayAccesoDenegado(): Bloquear el módulo ────────────────────────
     Muestra el overlay #finOverlayDenied ya presente en el HTML.
     El usuario SOLO puede salir volviendo al portal. */
  _overlayAccesoDenegado: function(razon) {
    var overlay = document.getElementById('finOverlayDenied');
    var msg     = document.getElementById('finDeniedMsg');
    var titulo  = document.getElementById('deniedTitle');

    var textos = {
      'sesion_expirada': 'Tu sesión ha expirado. Inicia sesión nuevamente desde el portal.',
      'sin_acceso':      'Tu usuario no tiene permisos para este módulo financiero. ' +
                         'Contacta al administrador para obtener acceso.'
    };

    if (titulo) titulo.textContent = 'Acceso denegado al módulo Financiero';
    if (msg)    msg.textContent    = textos[razon] || 'Contacta al administrador.';
    if (overlay) overlay.classList.add('show');

    /* Auditoría del acceso denegado (fire-and-forget; FIN_USER puede estar vacío) */
    finAudit.registrar('A02', { razon: razon, fin_activo: razon === 'sin_acceso' });
  }
};

/* ══ startClock() — Reloj en tiempo real ════════════════════════════════════
   Formato: HH:MM:SS en es-CO. Actualiza #finHeaderClock cada segundo.
   Usa FIN_CLOCK_T para permitir parada limpia si fuera necesario.
   ═══════════════════════════════════════════════════════════════════════════ */
function startClock() {
  var el = document.getElementById('finHeaderClock');
  if (!el) return;
  if (FIN_CLOCK_T) clearInterval(FIN_CLOCK_T); /* evitar duplicados */
  var tick = function() {
    el.textContent = new Date().toLocaleTimeString('es-CO', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  tick(); /* inmediato para evitar el '—' inicial */
  FIN_CLOCK_T = setInterval(tick, 1000);
}

/* ══ PIN Admin — Sistema de verificación ════════════════════════════════════
   Referencia: 07_Backend_Services sección 4.5
   ═══════════════════════════════════════════════════════════════════════════ */

/* Abrir modal PIN — reemplaza el stub de Fase 8A */
function abrirModalPin() {
  FIN_PIN_INPUT = '';
  FIN_PIN_FAILS = 0;

  /* Limpiar error y puntos */
  var errEl = document.getElementById('finPinError');
  if (errEl) errEl.textContent = '';
  _actualizarPuntosPIN();

  /* Mostrar modal usando la infraestructura HTML de Fase 8A */
  var bg  = document.getElementById('finModalBg');
  var mod = document.getElementById('finModalPin');
  if (bg && mod) {
    /* Ocultar cualquier otro modal visible primero */
    bg.querySelectorAll('.fin-modal').forEach(function(m) {
      m.style.display = 'none';
    });
    mod.style.display = '';
    bg.classList.add('show');
  }
}

/* addPinDigit(): reemplaza el stub visual de Fase 8A con lógica real */
function addPinDigit(d) {
  if (d === 'X') {
    /* Cancelar: limpiar y cerrar */
    FIN_PIN_INPUT = '';
    _actualizarPuntosPIN();
    var bg  = document.getElementById('finModalBg');
    var mod = document.getElementById('finModalPin');
    if (bg)  bg.classList.remove('show');
    if (mod) mod.style.display = 'none';
    return;
  }
  if (d === 'DEL') {
    FIN_PIN_INPUT = FIN_PIN_INPUT.slice(0, -1);
    _actualizarPuntosPIN();
    return;
  }
  /* Dígito normal */
  if (FIN_PIN_INPUT.length < 4) {
    FIN_PIN_INPUT += d;
    _actualizarPuntosPIN();
    if (FIN_PIN_INPUT.length === 4) {
      /* Pequeña pausa visual antes de validar */
      setTimeout(validarPin, 120);
    }
  }
}

/* Actualizar indicadores visuales de los 4 puntos */
function _actualizarPuntosPIN() {
  for (var i = 1; i <= 4; i++) {
    var dot = document.getElementById('finPinD' + i);
    if (!dot) continue;
    dot.classList.remove('filled', 'error');
    if (i <= FIN_PIN_INPUT.length) dot.classList.add('filled');
  }
}

/* validarPin() — lógica real del PIN con auditoría */
function validarPin() {
  if (FIN_PIN_INPUT === FIN_PIN) {
    /* PIN CORRECTO */
    sessionStorage.setItem(PIN_KEY, 'ok');
    FIN_IS_ADMIN = true;

    /* Cerrar modal */
    var bg  = document.getElementById('finModalBg');
    var mod = document.getElementById('finModalPin');
    if (bg)  bg.classList.remove('show');
    if (mod) mod.style.display = 'none';

    activarModoAdmin();
    finAudit.registrar('A03', {});
    toast('✓ Modo administrador activo', 'ok');

    FIN_PIN_INPUT = '';
    FIN_PIN_FAILS = 0;
  } else {
    /* PIN INCORRECTO */
    FIN_PIN_INPUT = '';
    FIN_PIN_FAILS++;

    /* Animación de error: puntos en rojo */
    for (var i = 1; i <= 4; i++) {
      var dot = document.getElementById('finPinD' + i);
      if (dot) { dot.classList.remove('filled'); dot.classList.add('error'); }
    }
    var errEl = document.getElementById('finPinError');
    if (errEl) {
      errEl.textContent = FIN_PIN_FAILS === 1
        ? 'PIN incorrecto'
        : 'PIN incorrecto · ' + FIN_PIN_FAILS + ' intentos';
    }

    /* Resetear puntos tras 1 segundo */
    setTimeout(function() {
      _actualizarPuntosPIN();
      var e = document.getElementById('finPinError');
      if (e) e.textContent = '';
    }, 1000);

    finAudit.registrar('A04', { intentos: FIN_PIN_FAILS });
  }
}

/* checkAdminSession() — restaurar sesión admin del PIN al recargar */
function checkAdminSession() {
  if (sessionStorage.getItem(PIN_KEY) === 'ok') {
    FIN_IS_ADMIN = true;
    activarModoAdmin(true); /* silencioso: sin toast */
  }
}

/* activarModoAdmin() — mostrar chip, controles y sección sidebar */
function activarModoAdmin(silencioso) {
  FIN_IS_ADMIN = true;

  /* Header: chip admin y botón maestro */
  var adminChip   = document.getElementById('finAdminChip');
  var btnMaestro  = document.getElementById('finBtnCargarMaestro');
  var admControls = document.getElementById('finAdminControls');
  if (adminChip)   adminChip.style.display   = 'inline-flex';
  if (btnMaestro)  btnMaestro.style.display  = 'inline-flex';
  if (admControls) admControls.style.display = 'flex';

  /* Empty states: mostrar CTA de carga */
  var emptyCta   = document.getElementById('finEmptyCargaBtn');
  var flujoEmpty = document.getElementById('finFlujoEmptyCta');
  if (emptyCta)   emptyCta.style.display   = 'inline-flex';
  if (flujoEmpty) flujoEmpty.style.display = 'inline-flex';

  /* Sidebar: mostrar sección ADMINISTRACIÓN y tab Auditoría */
  var sbAdminSec  = document.getElementById('finSbSectionAdmin');
  var tabAudit    = document.getElementById('finTabAuditoria');
  if (sbAdminSec) sbAdminSec.style.display = '';
  if (tabAudit)   tabAudit.style.display   = '';

  /* Sub-tab auditoría dentro de Administrativos */
  var tabAdminAudit = document.getElementById('finAdminTabBtnAuditoria');
  if (tabAdminAudit) tabAdminAudit.style.display = '';

  if (!silencioso) {
    /* toast ya fue emitido por validarPin() */
  }
}

/* cerrarSesionAdmin() — desactivar modo admin y limpiar sesión */
function cerrarSesionAdmin() {
  if (!confirm('¿Cerrar sesión de administrador?')) return;

  FIN_IS_ADMIN = false;
  sessionStorage.removeItem(PIN_KEY);

  /* Header: ocultar chip admin */
  var adminChip = document.getElementById('finAdminChip');
  if (adminChip) adminChip.style.display = 'none';

  /* Si no es editor tampoco, ocultar controles de escritura */
  if (!FIN_CAN_EDIT) {
    var btnMaestro  = document.getElementById('finBtnCargarMaestro');
    var admControls = document.getElementById('finAdminControls');
    var emptyCta    = document.getElementById('finEmptyCargaBtn');
    var flujoEmpty  = document.getElementById('finFlujoEmptyCta');
    if (btnMaestro)  btnMaestro.style.display  = 'none';
    if (admControls) admControls.style.display = 'none';
    if (emptyCta)    emptyCta.style.display    = 'none';
    if (flujoEmpty)  flujoEmpty.style.display  = 'none';
  }

  /* Sidebar: ocultar sección ADMINISTRACIÓN */
  var sbAdminSec    = document.getElementById('finSbSectionAdmin');
  var tabAudit      = document.getElementById('finTabAuditoria');
  var tabAdminAudit = document.getElementById('finAdminTabBtnAuditoria');
  if (sbAdminSec)    sbAdminSec.style.display    = 'none';
  if (tabAudit)      tabAudit.style.display      = 'none';
  if (tabAdminAudit) tabAdminAudit.style.display = 'none';

  /* Si el usuario está en la vista auditoría, redirigir a resumen */
  if (FIN_CURRENT_VIEW === 'auditoria') showView('resumen');

  finAudit.registrar('A05', {});
  toast('Sesión admin cerrada', 'info');
}

/* ══ DOMContentLoaded — Fase 8B ═════════════════════════════════════════════
   Reemplaza la inicialización stub de Fase 8A.
   Cascada: startClock → checkAdminSession → finAuth.init →
            loadCloud → loadLocal → vacío → auditoría → finSync.start
   ═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {

  /* ── 1. Reloj en tiempo real (antes que todo lo visual) */
  startClock();

  /* ── 2. Verificar sesión admin preexistente en sessionStorage */
  checkAdminSession();

  /* ── 3. Auth + cascada de datos */
  finAuth.init().then(function() {

    /* Si el overlay de acceso denegado está visible, detener aquí */
    var denied = document.getElementById('finOverlayDenied');
    if (denied && denied.classList.contains('show')) return;

    /* ── 4. Cascada nube → local → vacío */
    finData.loadCloud().then(function(cloud) {

      if (cloud && cloud.fin) {
        /* Fuente: Supabase */
        FIN_DATA = cloud.fin;
        FIN_META = cloud.meta || {};
        FIN_SRC  = 'supabase';
        updateHdrChip('supabase');

        /* Semana en el subtítulo del header */
        var sub = document.getElementById('finHdrSub');
        if (sub && FIN_DATA.semanaActual) {
          sub.textContent = 'Módulo financiero · ' + FIN_DATA.semanaActual;
        }

        /* Footer: semana y timestamp */
        _actualizarFooterMeta();

      } else {
        /* Intentar desde localStorage */
        var local = finData.loadLocal();
        var metaRaw = null;
        try { metaRaw = JSON.parse(localStorage.getItem(K_META)); } catch(e) {}

        if (local) {
          FIN_DATA = local;
          FIN_META = metaRaw || {};
          FIN_SRC  = 'local';
          updateHdrChip('local');

          var sub2 = document.getElementById('finHdrSub');
          if (sub2 && FIN_DATA.semanaActual) {
            sub2.textContent = 'Módulo financiero · ' + FIN_DATA.semanaActual;
          }
          _actualizarFooterMeta();
          toast('⚠ Datos locales · Sin conexión a la nube', 'warn');

        } else {
          /* Sin datos en ninguna fuente → EmptyState */
          FIN_SRC = '';
          updateHdrChip('');

          var emptyEl = document.getElementById('finEmpty');
          if (emptyEl) emptyEl.style.display = 'flex';
        }
      }

      /* ── 5. Auditoría de acceso (fire-and-forget) */
      finAudit.registrar('A01', {
        fuente:  FIN_SRC,
        fin_rol: FIN_USER.rol || 'viewer'
      });

      /* ── 6. Renderizar si ya hay datos y refresh() está disponible */
      if (typeof refresh === 'function') refresh();

      /* ── 7. Auto-sync cada 30 minutos */
      if (FIN_SYNC_TIMER) clearInterval(FIN_SYNC_TIMER);
      FIN_SYNC_TIMER = setInterval(function() {
        if (document.hidden) return; /* no sincronizar si el tab está oculto */
        finData.loadCloud().then(function(cloud) {
          if (!cloud) return;
          /* Solo actualizar si hay cambios (comparar updatedAt) */
          if (cloud.meta && cloud.meta.updatedAt &&
              cloud.meta.updatedAt === FIN_META.updatedAt) return;
          FIN_DATA = cloud.fin;
          FIN_META = cloud.meta || {};
          FIN_SRC  = 'supabase';
          updateHdrChip('supabase');
          _actualizarFooterMeta();
          if (typeof finFilter !== 'undefined' && finFilter.rebuild) finFilter.rebuild();
          if (typeof refresh === 'function') refresh();
          toast('↻ Datos actualizados automáticamente', 'info');
        });
      }, 1800000); /* 30 minutos */

    }); /* /loadCloud */

  }); /* /finAuth.init */

}); /* /DOMContentLoaded Fase 8B */

/* ── Helper: actualizar semana y timestamp en el footer ──────────────────── */
function _actualizarFooterMeta() {
  var semLabel = document.getElementById('finFootSemLabel');
  var semSpan  = document.getElementById('finFootSem');
  var sepSem   = document.getElementById('finFootSepSem');
  var tsSpan   = document.getElementById('finFootTs');
  var tsWrap   = document.getElementById('finFootTimestamp');
  var tsSep    = document.getElementById('finFootSepTs');

  if (FIN_DATA.semanaActual && semLabel && semSpan) {
    semSpan.textContent  = FIN_DATA.semanaActual;
    semLabel.style.display = '';
    if (sepSem) sepSem.style.display = '';
  }
  if (FIN_META.updatedAt && tsSpan && tsWrap) {
    var diffMs  = Date.now() - new Date(FIN_META.updatedAt).getTime();
    var diffMin = Math.round(diffMs / 60000);
    tsSpan.textContent    = diffMin < 1 ? 'hace menos de 1 min' : 'hace ' + diffMin + ' min';
    tsWrap.style.display  = '';
    if (tsSep) tsSep.style.display = '';
  }
}
/* ════════════════════════════════════════════════════════════════════════════
   FIN JAVASCRIPT FASE 8B
   ════════════════════════════════════════════════════════════════════════════ */
