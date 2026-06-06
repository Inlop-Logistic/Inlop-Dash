/**
 * ob-services.js — Capa de acceso a datos · Módulo Obligaciones Financieras
 * INLOP · Integral Logistics Operations SAS
 *
 * DEPENDENCIA: supabase.js debe cargarse antes (expone window.INLOP.sb)
 * USO: <script src="js/supabase.js"></script>
 *      <script src="js/ob-services.js"></script>
 *
 * CONTENIDO:
 *   1. Tipos y constantes
 *   2. Utilidades internas
 *   3. Servicios — Períodos
 *   4. Servicios — Obligaciones
 *   5. Servicios — Proveedores
 *   6. Servicios — Categorías
 *   7. Servicios — Pagos
 *   8. Servicios — Soportes
 *   9. Servicios — Auditoría
 *  10. Servicios — Vistas (lectura compuesta)
 *  11. Servicios — Auth / Rol del módulo
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════
   1. TIPOS Y CONSTANTES
   ══════════════════════════════════════════════════════════════════ */

/**
 * Roles disponibles en el módulo financiero.
 * Se leen desde profiles.ob_rol (columna agregada en Fase 1).
 * @typedef {'viewer'|'editor'|'admin'} ObRol
 */

/**
 * Estados posibles de un pago en un período.
 * @typedef {'pendiente'|'pagada'|'vencida'|'pagada_mora'} ObEstadoPago
 */

/**
 * Sedes INLOP.
 * @typedef {'cartagena'|'bogota'|'yopal'|'nacional'} ObSede
 */

/**
 * Frecuencias de pago.
 * @typedef {'mensual'|'semanal'|'quincenal'} ObFrecuencia
 */

/**
 * Resultado estándar de todos los servicios.
 * Nunca se lanza una excepción al consumidor — siempre se retorna este objeto.
 * @typedef {{ ok: boolean, data: any|null, error: string|null }} ObResult
 */

/**
 * Shape de un proveedor.
 * @typedef {{
 *   id?: string,
 *   nit?: string,
 *   razon_social: string,
 *   nombre_corto: string,
 *   contacto?: string,
 *   telefono?: string,
 *   email?: string,
 *   banco?: string,
 *   cuenta?: string,
 *   tipo_cuenta?: string,
 *   activo?: boolean,
 *   notas?: string
 * }} ObProveedor
 */

/**
 * Shape de una obligación.
 * @typedef {{
 *   id?: string,
 *   proveedor_id: string,
 *   categoria_id: string,
 *   detalle: string,
 *   sede?: ObSede,
 *   frecuencia?: ObFrecuencia,
 *   dia_pago?: number,
 *   dia_semana?: number,
 *   monto_estimado?: number,
 *   moneda?: string,
 *   activo?: boolean,
 *   notas?: string,
 *   contrato_ref?: string,
 *   grupo_padre_id?: string,
 *   es_grupo?: boolean
 * }} ObObligacion
 */

/**
 * Shape de un pago.
 * @typedef {{
 *   id?: string,
 *   obligacion_id: string,
 *   periodo_id: string,
 *   estado?: ObEstadoPago,
 *   fecha_limite?: string,
 *   fecha_pago?: string,
 *   monto_estimado?: number,
 *   monto_real?: number,
 *   referencia?: string,
 *   banco_pagador?: string,
 *   url_soporte?: string,
 *   nota?: string
 * }} ObPago
 */

/**
 * Shape de un soporte (campos del pago relacionados con el comprobante).
 * @typedef {{
 *   pago_id: string,
 *   referencia: string,
 *   banco_pagador?: string,
 *   url_soporte?: string,
 *   nota?: string
 * }} ObSoporte
 */

/** Prefijo de logging para identificar el módulo en consola */
const OB_LOG = '[OB-Services]';

/** Acciones válidas para auditoría */
const OB_ACCIONES = {
  REGISTRO_PAGO:          'registro_pago',
  EDICION_MONTO:          'edicion_monto',
  EDICION_OBLIGACION:     'edicion_obligacion',
  CARGA_EXCEL:            'carga_excel',
  CIERRE_PERIODO:         'cierre_periodo',
  APERTURA_PERIODO:       'apertura_periodo',
  CREAR_OBLIGACION:       'crear_obligacion',
  DESACTIVAR_OBLIGACION:  'desactivar_obligacion',
  ACTIVAR_OBLIGACION:     'activar_obligacion',
  ACCESO_MODULO:          'acceso_modulo',
};


/* ══════════════════════════════════════════════════════════════════
   2. UTILIDADES INTERNAS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Retorna el cliente Supabase inicializado por supabase.js.
 * Lanza Error si no está disponible (supabase.js no se cargó antes).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function _sb() {
  if (!window.INLOP || !window.INLOP.sb) {
    throw new Error('Supabase no inicializado. Verifica que supabase.js se cargue antes de ob-services.js.');
  }
  return window.INLOP.sb;
}

/**
 * Envuelve cualquier operación Supabase en un resultado estándar ObResult.
 * Nunca propaga excepciones al consumidor.
 * @param {Function} fn - Función async que retorna { data, error } de Supabase
 * @param {string} contexto - Nombre del servicio para logging
 * @returns {Promise<ObResult>}
 */
async function _exec(fn, contexto) {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`${OB_LOG} ${contexto}:`, error.message);
      return { ok: false, data: null, error: error.message };
    }
    return { ok: true, data: data ?? null, error: null };
  } catch (err) {
    console.error(`${OB_LOG} ${contexto} — excepción inesperada:`, err);
    return { ok: false, data: null, error: err.message || 'Error desconocido' };
  }
}

/**
 * Retorna el usuario autenticado desde window.INLOP.currentUser.
 * Disponible después de que auth.js complete la verificación.
 * @returns {{ id: string, email: string, nombre: string, rol: string, ob_rol: string }|null}
 */
function _usuario() {
  return window.INLOP?.currentUser || null;
}

/**
 * Valida que un string no sea vacío.
 * @param {string} val
 * @returns {boolean}
 */
function _noVacio(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Valida formato de fecha ISO (YYYY-MM-DD).
 * @param {string} fecha
 * @returns {boolean}
 */
function _esFechaValida(fecha) {
  return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

/**
 * Valida formato de período (YYYY-MM).
 * @param {string} anioMes
 * @returns {boolean}
 */
function _esPeriodoValido(anioMes) {
  return typeof anioMes === 'string' && /^\d{4}-\d{2}$/.test(anioMes);
}


/* ══════════════════════════════════════════════════════════════════
   3. SERVICIOS — PERÍODOS
   ══════════════════════════════════════════════════════════════════ */

const ObPeriodosService = {

  /**
   * Obtiene todos los períodos ordenados de más reciente a más antiguo.
   * @returns {Promise<ObResult>} data: Array de períodos
   */
  async listar() {
    return _exec(() =>
      _sb()
        .from('ob_periodos')
        .select('*')
        .order('anio_mes', { ascending: false }),
      'ObPeriodosService.listar'
    );
  },

  /**
   * Obtiene el período activo (no cerrado) más reciente.
   * Solo debe existir uno a la vez.
   * @returns {Promise<ObResult>} data: Objeto período o null
   */
  async obtenerActivo() {
    return _exec(() =>
      _sb()
        .from('ob_periodos')
        .select('*')
        .eq('cerrado', false)
        .order('anio_mes', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'ObPeriodosService.obtenerActivo'
    );
  },

  /**
   * Obtiene un período por su clave anio_mes.
   * @param {string} anioMes - Formato 'YYYY-MM'
   * @returns {Promise<ObResult>} data: Objeto período o null
   */
  async obtenerPorMes(anioMes) {
    if (!_esPeriodoValido(anioMes)) {
      return { ok: false, data: null, error: 'Formato de período inválido. Use YYYY-MM.' };
    }
    return _exec(() =>
      _sb()
        .from('ob_periodos')
        .select('*')
        .eq('anio_mes', anioMes)
        .maybeSingle(),
      'ObPeriodosService.obtenerPorMes'
    );
  },

  /**
   * Crea un nuevo período y genera los pagos automáticamente
   * llamando a la función SQL ob_crear_pagos_del_periodo().
   * Solo admin.
   * @param {string} anioMes - Formato 'YYYY-MM'
   * @returns {Promise<ObResult>} data: { periodo, pagos_creados }
   */
  async crear(anioMes) {
    if (!_esPeriodoValido(anioMes)) {
      return { ok: false, data: null, error: 'Formato de período inválido. Use YYYY-MM.' };
    }

    const [anio, mes] = anioMes.split('-').map(Number);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaInicio = `${anioMes}-01`;
    const fechaFin    = `${anioMes}-${String(ultimoDia).padStart(2, '0')}`;
    const usuario     = _usuario();

    // 1. Crear el período
    const resPeriodo = await _exec(() =>
      _sb()
        .from('ob_periodos')
        .insert({
          anio_mes:    anioMes,
          fecha_inicio: fechaInicio,
          fecha_fin:    fechaFin,
          created_by:   usuario?.id || null,
        })
        .select()
        .single(),
      'ObPeriodosService.crear — insert'
    );

    if (!resPeriodo.ok) return resPeriodo;

    // 2. Generar pagos automáticamente via función SQL
    const resPagos = await _exec(() =>
      _sb().rpc('ob_crear_pagos_del_periodo', {
        p_periodo_id: resPeriodo.data.id,
      }),
      'ObPeriodosService.crear — rpc pagos'
    );

    return {
      ok: resPagos.ok,
      data: {
        periodo:       resPeriodo.data,
        pagos_creados: resPagos.data ?? 0,
      },
      error: resPagos.error,
    };
  },

  /**
   * Cierra un período calculando sus KPIs finales.
   * Llama a la función SQL ob_cerrar_periodo() que es irreversible.
   * Solo admin.
   * @param {string} periodoId - UUID del período
   * @returns {Promise<ObResult>} data: Resumen JSON del cierre
   */
  async cerrar(periodoId) {
    if (!_noVacio(periodoId)) {
      return { ok: false, data: null, error: 'periodoId requerido.' };
    }
    const usuario = _usuario();
    return _exec(() =>
      _sb().rpc('ob_cerrar_periodo', {
        p_periodo_id:  periodoId,
        p_usuario_id:  usuario?.id || null,
      }),
      'ObPeriodosService.cerrar'
    );
  },
};


/* ══════════════════════════════════════════════════════════════════
   4. SERVICIOS — OBLIGACIONES
   ══════════════════════════════════════════════════════════════════ */

const ObObligacionesService = {

  /**
   * Lista todas las obligaciones activas con datos de proveedor y categoría.
   * @param {{ soloActivas?: boolean, sede?: ObSede }} opciones
   * @returns {Promise<ObResult>} data: Array de obligaciones
   */
  async listar({ soloActivas = true, sede = null } = {}) {
    return _exec(() => {
      let q = _sb()
        .from('ob_obligaciones')
        .select(`
          *,
          proveedor:ob_proveedores(id, nit, razon_social, nombre_corto, banco, cuenta),
          categoria:ob_categorias(id, codigo, nombre, color_hex, icono)
        `)
        .order('created_at', { ascending: true });

      if (soloActivas) q = q.eq('activo', true);
      if (sede)        q = q.eq('sede', sede);

      return q;
    }, 'ObObligacionesService.listar');
  },

  /**
   * Obtiene una obligación por ID.
   * @param {string} id
   * @returns {Promise<ObResult>} data: Obligación o null
   */
  async obtener(id) {
    if (!_noVacio(id)) {
      return { ok: false, data: null, error: 'id requerido.' };
    }
    return _exec(() =>
      _sb()
        .from('ob_obligaciones')
        .select(`
          *,
          proveedor:ob_proveedores(id, nit, razon_social, nombre_corto, banco, cuenta),
          categoria:ob_categorias(id, codigo, nombre, color_hex, icono)
        `)
        .eq('id', id)
        .single(),
      'ObObligacionesService.obtener'
    );
  },

  /**
   * Crea una nueva obligación recurrente.
   * Solo admin.
   * @param {ObObligacion} datos
   * @returns {Promise<ObResult>} data: Obligación creada
   */
  async crear(datos) {
    // Validaciones mínimas
    if (!_noVacio(datos?.proveedor_id)) return { ok: false, data: null, error: 'proveedor_id requerido.' };
    if (!_noVacio(datos?.categoria_id)) return { ok: false, data: null, error: 'categoria_id requerido.' };
    if (!_noVacio(datos?.detalle))      return { ok: false, data: null, error: 'detalle requerido.' };

    // Validar coherencia de recurrencia
    if (datos.frecuencia === 'mensual' || datos.frecuencia === 'quincenal') {
      if (!datos.dia_pago || datos.dia_pago < 1 || datos.dia_pago > 31) {
        return { ok: false, data: null, error: 'dia_pago debe estar entre 1 y 31 para frecuencia mensual/quincenal.' };
      }
    }
    if (datos.frecuencia === 'semanal') {
      if (datos.dia_semana === undefined || datos.dia_semana < 0 || datos.dia_semana > 6) {
        return { ok: false, data: null, error: 'dia_semana debe estar entre 0 (lunes) y 6 (domingo) para frecuencia semanal.' };
      }
    }

    const usuario = _usuario();
    const payload = {
      proveedor_id:   datos.proveedor_id,
      categoria_id:   datos.categoria_id,
      detalle:        datos.detalle.trim(),
      sede:           datos.sede        || 'nacional',
      frecuencia:     datos.frecuencia  || 'mensual',
      dia_pago:       datos.dia_pago    || null,
      dia_semana:     datos.dia_semana  || null,
      monto_estimado: datos.monto_estimado || 0,
      moneda:         datos.moneda      || 'COP',
      activo:         true,
      notas:          datos.notas       || null,
      contrato_ref:   datos.contrato_ref || null,
      grupo_padre_id: datos.grupo_padre_id || null,
      es_grupo:       datos.es_grupo    || false,
      created_by:     usuario?.id       || null,
    };

    const resultado = await _exec(() =>
      _sb()
        .from('ob_obligaciones')
        .insert(payload)
        .select()
        .single(),
      'ObObligacionesService.crear'
    );

    // Registrar en auditoría si fue exitoso
    if (resultado.ok) {
      await ObAuditoriaService.registrar({
        accion:         OB_ACCIONES.CREAR_OBLIGACION,
        tabla_afectada: 'ob_obligaciones',
        registro_id:    resultado.data.id,
        descripcion:    `Obligación creada: ${datos.detalle} — ${datos.sede || 'nacional'}`,
        valor_nuevo:    payload,
      });
    }

    return resultado;
  },

  /**
   * Actualiza campos editables de una obligación.
   * Solo admin.
   * @param {string} id
   * @param {Partial<ObObligacion>} cambios
   * @returns {Promise<ObResult>} data: Obligación actualizada
   */
  async actualizar(id, cambios) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };
    if (!cambios || Object.keys(cambios).length === 0) {
      return { ok: false, data: null, error: 'No hay cambios para aplicar.' };
    }

    // Campos no editables desde la UI — se eliminan silenciosamente
    const campos_bloqueados = ['id', 'created_at', 'created_by'];
    campos_bloqueados.forEach(c => delete cambios[c]);

    // Obtener estado anterior para auditoría
    const anterior = await ObObligacionesService.obtener(id);

    const resultado = await _exec(() =>
      _sb()
        .from('ob_obligaciones')
        .update(cambios)
        .eq('id', id)
        .select()
        .single(),
      'ObObligacionesService.actualizar'
    );

    if (resultado.ok) {
      await ObAuditoriaService.registrar({
        accion:         OB_ACCIONES.EDICION_OBLIGACION,
        tabla_afectada: 'ob_obligaciones',
        registro_id:    id,
        descripcion:    `Obligación actualizada: ${resultado.data.detalle}`,
        valor_anterior: anterior.data,
        valor_nuevo:    resultado.data,
      });
    }

    return resultado;
  },

  /**
   * Desactiva una obligación (soft delete).
   * No elimina registros históricos de pagos.
   * Solo admin.
   * @param {string} id
   * @returns {Promise<ObResult>}
   */
  async desactivar(id) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };

    const resultado = await _exec(() =>
      _sb()
        .from('ob_obligaciones')
        .update({ activo: false })
        .eq('id', id)
        .select('id, detalle')
        .single(),
      'ObObligacionesService.desactivar'
    );

    if (resultado.ok) {
      await ObAuditoriaService.registrar({
        accion:         OB_ACCIONES.DESACTIVAR_OBLIGACION,
        tabla_afectada: 'ob_obligaciones',
        registro_id:    id,
        descripcion:    `Obligación desactivada: ${resultado.data.detalle}`,
      });
    }

    return resultado;
  },

  /**
   * Reactiva una obligación previamente desactivada.
   * Solo admin.
   * @param {string} id
   * @returns {Promise<ObResult>}
   */
  async activar(id) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };

    const resultado = await _exec(() =>
      _sb()
        .from('ob_obligaciones')
        .update({ activo: true })
        .eq('id', id)
        .select('id, detalle')
        .single(),
      'ObObligacionesService.activar'
    );

    if (resultado.ok) {
      await ObAuditoriaService.registrar({
        accion:         OB_ACCIONES.ACTIVAR_OBLIGACION,
        tabla_afectada: 'ob_obligaciones',
        registro_id:    id,
        descripcion:    `Obligación reactivada: ${resultado.data.detalle}`,
      });
    }

    return resultado;
  },
};


/* ══════════════════════════════════════════════════════════════════
   5. SERVICIOS — PROVEEDORES
   ══════════════════════════════════════════════════════════════════ */

const ObProveedoresService = {

  /**
   * Lista todos los proveedores.
   * @param {{ soloActivos?: boolean }} opciones
   * @returns {Promise<ObResult>} data: Array de proveedores
   */
  async listar({ soloActivos = true } = {}) {
    return _exec(() => {
      let q = _sb()
        .from('ob_proveedores')
        .select('*')
        .order('razon_social', { ascending: true });

      if (soloActivos) q = q.eq('activo', true);
      return q;
    }, 'ObProveedoresService.listar');
  },

  /**
   * Obtiene un proveedor por ID.
   * @param {string} id
   * @returns {Promise<ObResult>} data: Proveedor o null
   */
  async obtener(id) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };
    return _exec(() =>
      _sb()
        .from('ob_proveedores')
        .select('*')
        .eq('id', id)
        .single(),
      'ObProveedoresService.obtener'
    );
  },

  /**
   * Busca proveedor por NIT.
   * @param {string} nit
   * @returns {Promise<ObResult>} data: Proveedor o null
   */
  async buscarPorNit(nit) {
    if (!_noVacio(nit)) return { ok: false, data: null, error: 'NIT requerido.' };
    return _exec(() =>
      _sb()
        .from('ob_proveedores')
        .select('*')
        .eq('nit', nit.trim())
        .maybeSingle(),
      'ObProveedoresService.buscarPorNit'
    );
  },

  /**
   * Crea un nuevo proveedor.
   * Solo admin.
   * @param {ObProveedor} datos
   * @returns {Promise<ObResult>} data: Proveedor creado
   */
  async crear(datos) {
    if (!_noVacio(datos?.razon_social)) return { ok: false, data: null, error: 'razon_social requerido.' };
    if (!_noVacio(datos?.nombre_corto)) return { ok: false, data: null, error: 'nombre_corto requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_proveedores')
        .insert({
          nit:          datos.nit?.trim()          || null,
          razon_social: datos.razon_social.trim(),
          nombre_corto: datos.nombre_corto.trim(),
          contacto:     datos.contacto?.trim()     || null,
          telefono:     datos.telefono?.trim()     || null,
          email:        datos.email?.trim()        || null,
          banco:        datos.banco?.trim()        || null,
          cuenta:       datos.cuenta?.trim()       || null,
          tipo_cuenta:  datos.tipo_cuenta?.trim()  || null,
          activo:       true,
          notas:        datos.notas?.trim()        || null,
        })
        .select()
        .single(),
      'ObProveedoresService.crear'
    );
  },

  /**
   * Actualiza datos de un proveedor.
   * Solo admin.
   * @param {string} id
   * @param {Partial<ObProveedor>} cambios
   * @returns {Promise<ObResult>} data: Proveedor actualizado
   */
  async actualizar(id, cambios) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };
    if (!cambios || Object.keys(cambios).length === 0) {
      return { ok: false, data: null, error: 'No hay cambios para aplicar.' };
    }

    const campos_bloqueados = ['id', 'created_at'];
    campos_bloqueados.forEach(c => delete cambios[c]);

    return _exec(() =>
      _sb()
        .from('ob_proveedores')
        .update(cambios)
        .eq('id', id)
        .select()
        .single(),
      'ObProveedoresService.actualizar'
    );
  },

  /**
   * Carga masiva de proveedores desde el parser del Excel.
   * Hace upsert por NIT: actualiza si existe, crea si no existe.
   * Solo admin.
   * @param {ObProveedor[]} proveedores
   * @returns {Promise<ObResult>} data: Array de proveedores procesados
   */
  async upsertDesdeExcel(proveedores) {
    if (!Array.isArray(proveedores) || proveedores.length === 0) {
      return { ok: false, data: null, error: 'Array de proveedores vacío.' };
    }

    const payload = proveedores.map(p => ({
      nit:          p.nit?.trim()          || null,
      razon_social: p.razon_social.trim(),
      nombre_corto: p.nombre_corto.trim(),
      contacto:     p.contacto?.trim()     || null,
      banco:        p.banco?.trim()        || null,
      cuenta:       p.cuenta?.trim()       || null,
      activo:       true,
    }));

    return _exec(() =>
      _sb()
        .from('ob_proveedores')
        .upsert(payload, {
          onConflict:        'nit',
          ignoreDuplicates:  false,
        })
        .select(),
      'ObProveedoresService.upsertDesdeExcel'
    );
  },
};


/* ══════════════════════════════════════════════════════════════════
   6. SERVICIOS — CATEGORÍAS
   ══════════════════════════════════════════════════════════════════ */

const ObCategoriasService = {

  /**
   * Lista todas las categorías activas ordenadas por orden de UI.
   * @returns {Promise<ObResult>} data: Array de categorías
   */
  async listar() {
    return _exec(() =>
      _sb()
        .from('ob_categorias')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true }),
      'ObCategoriasService.listar'
    );
  },

  /**
   * Obtiene una categoría por código.
   * @param {string} codigo - Ej: 'ARRIENDO', 'SOFTWARE'
   * @returns {Promise<ObResult>} data: Categoría o null
   */
  async obtenerPorCodigo(codigo) {
    if (!_noVacio(codigo)) return { ok: false, data: null, error: 'codigo requerido.' };
    return _exec(() =>
      _sb()
        .from('ob_categorias')
        .select('*')
        .eq('codigo', codigo.trim().toUpperCase())
        .maybeSingle(),
      'ObCategoriasService.obtenerPorCodigo'
    );
  },
};


/* ══════════════════════════════════════════════════════════════════
   7. SERVICIOS — PAGOS
   ══════════════════════════════════════════════════════════════════ */

const ObPagosService = {

  /**
   * Lista los pagos de un período con filtros opcionales.
   * @param {string} periodoId
   * @param {{ estado?: ObEstadoPago, sede?: ObSede, categoria?: string }} filtros
   * @returns {Promise<ObResult>} data: Array de pagos con joins
   */
  async listarPorPeriodo(periodoId, filtros = {}) {
    if (!_noVacio(periodoId)) return { ok: false, data: null, error: 'periodoId requerido.' };

    return _exec(() => {
      let q = _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .eq('periodo_id', periodoId)
        .order('fecha_limite', { ascending: true });

      if (filtros.estado)    q = q.eq('estado', filtros.estado);
      if (filtros.sede)      q = q.eq('sede', filtros.sede);
      if (filtros.categoria) q = q.eq('categoria_codigo', filtros.categoria);

      return q;
    }, 'ObPagosService.listarPorPeriodo');
  },

  /**
   * Obtiene un pago por su ID.
   * @param {string} id
   * @returns {Promise<ObResult>} data: Pago o null
   */
  async obtener(id) {
    if (!_noVacio(id)) return { ok: false, data: null, error: 'id requerido.' };
    return _exec(() =>
      _sb()
        .from('ob_pagos')
        .select('*')
        .eq('id', id)
        .single(),
      'ObPagosService.obtener'
    );
  },

  /**
   * Registra el pago de una obligación.
   * Cambia estado a 'pagada' o 'pagada_mora' según la fecha.
   * Disponible para editor y admin.
   * @param {string} pagoId - UUID del pago
   * @param {{
   *   monto_real: number,
   *   fecha_pago: string,
   *   referencia: string,
   *   banco_pagador?: string,
   *   url_soporte?: string,
   *   nota?: string
   * }} datos
   * @returns {Promise<ObResult>} data: Pago actualizado
   */
  async registrarPago(pagoId, datos) {
    if (!_noVacio(pagoId))              return { ok: false, data: null, error: 'pagoId requerido.' };
    if (!datos?.monto_real || datos.monto_real <= 0) return { ok: false, data: null, error: 'monto_real debe ser mayor a 0.' };
    if (!_esFechaValida(datos?.fecha_pago))          return { ok: false, data: null, error: 'fecha_pago inválida. Use YYYY-MM-DD.' };
    if (!_noVacio(datos?.referencia))                return { ok: false, data: null, error: 'referencia del comprobante requerida.' };

    // Obtener pago actual para calcular mora
    const actual = await ObPagosService.obtener(pagoId);
    if (!actual.ok || !actual.data) {
      return { ok: false, data: null, error: 'Pago no encontrado.' };
    }

    // Determinar estado: pagada vs pagada_mora
    const fechaLimite  = new Date(actual.data.fecha_limite);
    const fechaPago    = new Date(datos.fecha_pago);
    const estadoFinal  = fechaPago > fechaLimite ? 'pagada_mora' : 'pagada';

    const usuario = _usuario();
    const payload = {
      estado:        estadoFinal,
      fecha_pago:    datos.fecha_pago,
      monto_real:    datos.monto_real,
      referencia:    datos.referencia.trim(),
      banco_pagador: datos.banco_pagador?.trim() || null,
      url_soporte:   datos.url_soporte?.trim()   || null,
      nota:          datos.nota?.trim()           || null,
      registrado_por: usuario?.id                || null,
    };

    const resultado = await _exec(() =>
      _sb()
        .from('ob_pagos')
        .update(payload)
        .eq('id', pagoId)
        .select()
        .single(),
      'ObPagosService.registrarPago'
    );

    // El trigger trg_auditoria_pagos registra automáticamente en ob_auditoria.
    // No se necesita llamada manual aquí.

    return resultado;
  },

  /**
   * Actualiza únicamente el monto estimado de un pago (edición inline en la tabla).
   * Disponible para editor y admin.
   * @param {string} pagoId
   * @param {number} monto
   * @returns {Promise<ObResult>} data: Pago actualizado
   */
  async actualizarMonto(pagoId, monto) {
    if (!_noVacio(pagoId))      return { ok: false, data: null, error: 'pagoId requerido.' };
    if (typeof monto !== 'number' || monto < 0) {
      return { ok: false, data: null, error: 'monto debe ser un número positivo.' };
    }

    const resultado = await _exec(() =>
      _sb()
        .from('ob_pagos')
        .update({ monto_estimado: monto })
        .eq('id', pagoId)
        .select('id, monto_estimado, obligacion_id')
        .single(),
      'ObPagosService.actualizarMonto'
    );

    // El trigger registra en auditoría automáticamente.
    return resultado;
  },

  /**
   * Marca un pago como vencido.
   * Se llama desde el cliente cuando el cálculo de estados detecta mora.
   * Solo actualiza si el estado actual es 'pendiente' y la fecha ya pasó.
   * @param {string} pagoId
   * @returns {Promise<ObResult>}
   */
  async marcarVencido(pagoId) {
    if (!_noVacio(pagoId)) return { ok: false, data: null, error: 'pagoId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_pagos')
        .update({ estado: 'vencida' })
        .eq('id', pagoId)
        .eq('estado', 'pendiente')        // Solo si sigue pendiente
        .lt('fecha_limite', new Date().toISOString().split('T')[0]) // Solo si ya venció
        .select('id, estado')
        .single(),
      'ObPagosService.marcarVencido'
    );
  },

  /**
   * Obtiene todos los pagos de un día específico del calendario.
   * Usado por la cuadrícula del calendario.
   * @param {string} periodoId
   * @param {string} fecha - Formato YYYY-MM-DD
   * @returns {Promise<ObResult>} data: Array de pagos del día
   */
  async listarPorDia(periodoId, fecha) {
    if (!_noVacio(periodoId))      return { ok: false, data: null, error: 'periodoId requerido.' };
    if (!_esFechaValida(fecha))    return { ok: false, data: null, error: 'fecha inválida. Use YYYY-MM-DD.' };

    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .eq('periodo_id', periodoId)
        .eq('fecha_limite', fecha)
        .order('estado', { ascending: true }),
      'ObPagosService.listarPorDia'
    );
  },

  /**
   * Cuenta los pagos por estado del período activo.
   * Usado por los KPIs del Panel.
   * @param {string} periodoId
   * @returns {Promise<ObResult>} data: { pendiente, pagada, vencida, pagada_mora, total }
   */
  async contarPorEstado(periodoId) {
    if (!_noVacio(periodoId)) return { ok: false, data: null, error: 'periodoId requerido.' };

    const resultado = await _exec(() =>
      _sb()
        .from('ob_pagos')
        .select('estado, monto_estimado, monto_real')
        .eq('periodo_id', periodoId),
      'ObPagosService.contarPorEstado'
    );

    if (!resultado.ok) return resultado;

    const pagos = resultado.data || [];
    const resumen = {
      total:        pagos.length,
      pendiente:    pagos.filter(p => p.estado === 'pendiente').length,
      pagada:       pagos.filter(p => p.estado === 'pagada').length,
      vencida:      pagos.filter(p => p.estado === 'vencida').length,
      pagada_mora:  pagos.filter(p => p.estado === 'pagada_mora').length,
      monto_total:  pagos.reduce((s, p) => s + (p.monto_estimado || 0), 0),
      monto_pagado: pagos
        .filter(p => ['pagada', 'pagada_mora'].includes(p.estado))
        .reduce((s, p) => s + (p.monto_real || 0), 0),
    };

    // en_riesgo = pagos vencidos + pagados con mora
    resumen.en_riesgo    = resumen.vencida + resumen.pagada_mora;
    resumen.compliance   = resumen.total > 0
      ? Math.round(((resumen.pagada + resumen.pagada_mora) / resumen.total) * 100 * 10) / 10
      : 0;

    return { ok: true, data: resumen, error: null };
  },
};


/* ══════════════════════════════════════════════════════════════════
   8. SERVICIOS — SOPORTES
   Operan sobre los campos url_soporte, referencia, banco_pagador
   de la tabla ob_pagos. No son una tabla aparte.
   ══════════════════════════════════════════════════════════════════ */

const ObSoportesService = {

  /**
   * Obtiene los datos del soporte de un pago.
   * @param {string} pagoId
   * @returns {Promise<ObResult>} data: { referencia, banco_pagador, url_soporte, nota }
   */
  async obtener(pagoId) {
    if (!_noVacio(pagoId)) return { ok: false, data: null, error: 'pagoId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_pagos')
        .select('id, referencia, banco_pagador, url_soporte, nota, estado, fecha_pago, monto_real')
        .eq('id', pagoId)
        .single(),
      'ObSoportesService.obtener'
    );
  },

  /**
   * Guarda o actualiza el soporte de un pago ya registrado.
   * Permite corregir el link de Drive o agregar referencia después del pago.
   * Disponible para editor y admin.
   * @param {ObSoporte} datos
   * @returns {Promise<ObResult>} data: Campos actualizados
   */
  async guardar(datos) {
    if (!_noVacio(datos?.pago_id))   return { ok: false, data: null, error: 'pago_id requerido.' };
    if (!_noVacio(datos?.referencia)) return { ok: false, data: null, error: 'referencia requerida.' };

    // Validar URL si se proporciona
    if (datos.url_soporte && datos.url_soporte.trim().length > 0) {
      try {
        new URL(datos.url_soporte.trim());
      } catch {
        return { ok: false, data: null, error: 'url_soporte no es una URL válida.' };
      }
    }

    return _exec(() =>
      _sb()
        .from('ob_pagos')
        .update({
          referencia:    datos.referencia.trim(),
          banco_pagador: datos.banco_pagador?.trim() || null,
          url_soporte:   datos.url_soporte?.trim()   || null,
          nota:          datos.nota?.trim()           || null,
        })
        .eq('id', datos.pago_id)
        .select('id, referencia, banco_pagador, url_soporte, nota')
        .single(),
      'ObSoportesService.guardar'
    );
  },

  /**
   * Elimina el link de soporte de un pago (no elimina el pago).
   * Solo admin.
   * @param {string} pagoId
   * @returns {Promise<ObResult>}
   */
  async eliminarLink(pagoId) {
    if (!_noVacio(pagoId)) return { ok: false, data: null, error: 'pagoId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_pagos')
        .update({ url_soporte: null })
        .eq('id', pagoId)
        .select('id'),
      'ObSoportesService.eliminarLink'
    );
  },

  /**
   * Lista todos los pagos del período que tienen soporte adjunto.
   * Usado para el reporte de compliance con comprobantes.
   * @param {string} periodoId
   * @returns {Promise<ObResult>} data: Array de pagos con soporte
   */
  async listarConSoporte(periodoId) {
    if (!_noVacio(periodoId)) return { ok: false, data: null, error: 'periodoId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('pago_id, nombre_corto, estado, fecha_pago, monto_real, referencia, banco_pagador, url_soporte')
        .eq('periodo_id', periodoId)
        .not('url_soporte', 'is', null)
        .order('fecha_pago', { ascending: true }),
      'ObSoportesService.listarConSoporte'
    );
  },

  /**
   * Lista todos los pagos del período que NO tienen soporte adjunto
   * pero ya fueron marcados como pagados.
   * Útil para detectar pagos sin comprobante.
   * @param {string} periodoId
   * @returns {Promise<ObResult>} data: Array de pagos sin soporte
   */
  async listarSinSoporte(periodoId) {
    if (!_noVacio(periodoId)) return { ok: false, data: null, error: 'periodoId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('pago_id, nombre_corto, estado, fecha_pago, monto_real, referencia')
        .eq('periodo_id', periodoId)
        .in('estado', ['pagada', 'pagada_mora'])
        .is('url_soporte', null)
        .order('fecha_pago', { ascending: true }),
      'ObSoportesService.listarSinSoporte'
    );
  },
};


/* ══════════════════════════════════════════════════════════════════
   9. SERVICIOS — AUDITORÍA
   ══════════════════════════════════════════════════════════════════ */

const ObAuditoriaService = {

  /**
   * Registra una acción en el log de auditoría.
   * Los triggers de DB registran automáticamente cambios en ob_pagos.
   * Este método se usa para acciones de nivel de aplicación
   * (acceso al módulo, carga de Excel, crear obligación, etc.)
   * @param {{
   *   accion: string,
   *   tabla_afectada: string,
   *   registro_id?: string,
   *   descripcion?: string,
   *   valor_anterior?: object,
   *   valor_nuevo?: object
   * }} datos
   * @returns {Promise<ObResult>}
   */
  async registrar(datos) {
    if (!datos?.accion)          return { ok: false, data: null, error: 'accion requerida.' };
    if (!datos?.tabla_afectada)  return { ok: false, data: null, error: 'tabla_afectada requerida.' };

    const usuario = _usuario();

    return _exec(() =>
      _sb()
        .from('ob_auditoria')
        .insert({
          usuario_id:     usuario?.id    || null,
          usuario_email:  usuario?.email || null,
          accion:         datos.accion,
          tabla_afectada: datos.tabla_afectada,
          registro_id:    datos.registro_id    || null,
          descripcion:    datos.descripcion    || null,
          valor_anterior: datos.valor_anterior || null,
          valor_nuevo:    datos.valor_nuevo    || null,
        }),
      'ObAuditoriaService.registrar'
    );
  },

  /**
   * Lista el log de auditoría paginado.
   * Solo admin.
   * @param {{ pagina?: number, porPagina?: number, accion?: string }} opciones
   * @returns {Promise<ObResult>} data: Array de registros de auditoría
   */
  async listar({ pagina = 1, porPagina = 50, accion = null } = {}) {
    const desde = (pagina - 1) * porPagina;
    const hasta  = desde + porPagina - 1;

    return _exec(() => {
      let q = _sb()
        .from('ob_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .range(desde, hasta);

      if (accion) q = q.eq('accion', accion);
      return q;
    }, 'ObAuditoriaService.listar');
  },

  /**
   * Lista el log de auditoría de un registro específico.
   * Útil para ver el historial de cambios de un pago u obligación.
   * @param {string} registroId - UUID del row afectado
   * @returns {Promise<ObResult>} data: Array de acciones sobre ese registro
   */
  async listarPorRegistro(registroId) {
    if (!_noVacio(registroId)) return { ok: false, data: null, error: 'registroId requerido.' };

    return _exec(() =>
      _sb()
        .from('ob_auditoria')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: false }),
      'ObAuditoriaService.listarPorRegistro'
    );
  },
};


/* ══════════════════════════════════════════════════════════════════
   10. SERVICIOS — VISTAS (lectura compuesta)
   Consultan las vistas de Supabase que ya hacen los JOINs necesarios.
   Son los servicios de mayor uso en el frontend.
   ══════════════════════════════════════════════════════════════════ */

const ObVistasService = {

  /**
   * Carga todos los pagos del período activo con todos los datos necesarios
   * para renderizar el Panel, el Calendario y la tabla de Registro.
   * Consulta la vista ob_vista_pagos_activos.
   * @param {{ sede?: ObSede, categoria?: string, estado?: ObEstadoPago }} filtros
   * @returns {Promise<ObResult>} data: Array de pagos enriquecidos
   */
  async cargarPeriodoActivo(filtros = {}) {
    return _exec(() => {
      let q = _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .order('fecha_limite', { ascending: true });

      if (filtros.sede)      q = q.eq('sede', filtros.sede);
      if (filtros.categoria) q = q.eq('categoria_codigo', filtros.categoria);
      if (filtros.estado)    q = q.eq('estado', filtros.estado);

      return q;
    }, 'ObVistasService.cargarPeriodoActivo');
  },

  /**
   * Carga el resumen de gastos agrupado por categoría.
   * Usado por la gráfica de dona del Panel.
   * @returns {Promise<ObResult>} data: Array con totales por categoría
   */
  async resumenPorCategoria() {
    return _exec(() =>
      _sb()
        .from('ob_vista_resumen_categoria')
        .select('*')
        .order('monto_total', { ascending: false }),
      'ObVistasService.resumenPorCategoria'
    );
  },

  /**
   * Carga el historial de períodos cerrados.
   * Usado por la vista Historial.
   * @param {{ limite?: number }} opciones
   * @returns {Promise<ObResult>} data: Array de períodos históricos
   */
  async historial({ limite = 12 } = {}) {
    return _exec(() =>
      _sb()
        .from('ob_vista_historial')
        .select('*')
        .limit(limite),
      'ObVistasService.historial'
    );
  },

  /**
   * Carga los pagos de un día específico con todos sus datos.
   * Usado por el panel lateral del Calendario al hacer clic en un día.
   * @param {string} fecha - Formato YYYY-MM-DD
   * @returns {Promise<ObResult>} data: Array de pagos del día
   */
  async pagosPorDia(fecha) {
    if (!_esFechaValida(fecha)) {
      return { ok: false, data: null, error: 'fecha inválida. Use YYYY-MM-DD.' };
    }
    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .eq('fecha_limite', fecha)
        .order('monto_estimado', { ascending: false }),
      'ObVistasService.pagosPorDia'
    );
  },

  /**
   * Carga los pagos que vencen en los próximos N días.
   * Usado por el KPI "Próximas 7 días" y las alertas del banner.
   * @param {number} dias - Número de días a mirar hacia adelante
   * @returns {Promise<ObResult>} data: Array de pagos próximos
   */
  async proximosAVencer(dias = 7) {
    const hoy     = new Date();
    const limite  = new Date();
    limite.setDate(hoy.getDate() + dias);

    const hoyStr    = hoy.toISOString().split('T')[0];
    const limiteStr = limite.toISOString().split('T')[0];

    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .gte('fecha_limite', hoyStr)
        .lte('fecha_limite', limiteStr)
        .eq('estado', 'pendiente')
        .order('fecha_limite', { ascending: true }),
      'ObVistasService.proximosAVencer'
    );
  },

  /**
   * Carga los pagos vencidos sin registrar del período activo.
   * Usado por el KPI "En riesgo" y las alertas críticas del Panel.
   * @returns {Promise<ObResult>} data: Array de pagos vencidos
   */
  async vencidos() {
    const hoy = new Date().toISOString().split('T')[0];
    return _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('*')
        .in('estado', ['vencida', 'pendiente'])
        .lt('fecha_limite', hoy)
        .order('fecha_limite', { ascending: true }),
      'ObVistasService.vencidos'
    );
  },

  /**
   * Carga el semáforo de compliance por sede del período activo.
   * Usado por el semáforo del Panel.
   * @returns {Promise<ObResult>} data: Array { sede, total, pagadas, compliance }
   */
  async semaPorSede() {
    const resultado = await _exec(() =>
      _sb()
        .from('ob_vista_pagos_activos')
        .select('sede, estado'),
      'ObVistasService.semaPorSede'
    );

    if (!resultado.ok) return resultado;

    const sedes = ['cartagena', 'bogota', 'yopal', 'nacional'];
    const data  = sedes.map(sede => {
      const pagos    = resultado.data.filter(p => p.sede === sede);
      const total    = pagos.length;
      const pagadas  = pagos.filter(p => ['pagada', 'pagada_mora'].includes(p.estado)).length;
      return {
        sede,
        total,
        pagadas,
        compliance: total > 0 ? Math.round((pagadas / total) * 100) : 0,
      };
    }).filter(s => s.total > 0); // Ocultar sedes sin obligaciones

    return { ok: true, data, error: null };
  },
};


/* ══════════════════════════════════════════════════════════════════
   11. SERVICIOS — AUTH / ROL DEL MÓDULO
   ══════════════════════════════════════════════════════════════════ */

const ObAuthService = {

  /**
   * Verifica si el usuario actual tiene acceso al módulo financiero.
   * Lee ob_rol y ob_activo desde profiles via auth.js (currentUser).
   * @returns {{ tieneAcceso: boolean, rol: ObRol|null }}
   */
  verificarAcceso() {
    const usuario = _usuario();
    if (!usuario) return { tieneAcceso: false, rol: null };

    // currentUser viene de auth.js que lee profiles
    // ob_rol se agrega al currentUser en el shell del módulo tras el login
    const rol = usuario.ob_rol || null;
    return {
      tieneAcceso: !!rol,
      rol,
    };
  },

  /**
   * Retorna true si el usuario actual es admin del módulo financiero.
   * @returns {boolean}
   */
  esAdmin() {
    return _usuario()?.ob_rol === 'admin';
  },

  /**
   * Retorna true si el usuario puede registrar pagos (editor o admin).
   * @returns {boolean}
   */
  puedeEditar() {
    const rol = _usuario()?.ob_rol;
    return rol === 'editor' || rol === 'admin';
  },

  /**
   * Obtiene el perfil completo del usuario autenticado incluyendo ob_rol.
   * Se llama una vez al cargar el módulo para enriquecer currentUser.
   * @returns {Promise<ObResult>} data: { id, nombre, email, rol, ob_rol, ob_activo }
   */
  async obtenerPerfil() {
    const sb = _sb();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) return { ok: false, data: null, error: 'Sin sesión activa.' };

    return _exec(() =>
      sb
        .from('profiles')
        .select('id, nombre, email, rol, ob_rol, ob_activo')
        .eq('id', user.id)
        .single(),
      'ObAuthService.obtenerPerfil'
    );
  },

  /**
   * Registra el acceso al módulo en la auditoría.
   * Se llama una vez al inicializar el módulo.
   * @returns {Promise<void>}
   */
  async registrarAcceso() {
    await ObAuditoriaService.registrar({
      accion:         OB_ACCIONES.ACCESO_MODULO,
      tabla_afectada: 'ob_auditoria',
      descripcion:    'Usuario accedió al módulo Obligaciones Financieras',
    });
  },
};


/* ══════════════════════════════════════════════════════════════════
   EXPORTACIÓN — exponer en window.OB para acceso global desde
   el HTML del módulo (compatibilidad con Vanilla JS sin módulos ES)
   ══════════════════════════════════════════════════════════════════ */

window.OB = {
  // Constantes
  ACCIONES: OB_ACCIONES,

  // Servicios
  Periodos:     ObPeriodosService,
  Obligaciones: ObObligacionesService,
  Proveedores:  ObProveedoresService,
  Categorias:   ObCategoriasService,
  Pagos:        ObPagosService,
  Soportes:     ObSoportesService,
  Auditoria:    ObAuditoriaService,
  Vistas:       ObVistasService,
  Auth:         ObAuthService,
};

// Log de inicialización (solo en desarrollo — quitar en producción)
// console.info(`${OB_LOG} Servicios cargados. Usa window.OB para acceder.`);
