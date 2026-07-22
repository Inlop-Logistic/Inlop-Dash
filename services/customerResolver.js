// ─── CUSTOMER RESOLVER ──────────────────────────────────────────────────────
// Servicio compartido del ERP para resolución de clientes.
// Responsabilidades únicas:
//   1. Normalizar nombres crudos del TMS
//   2. Buscar coincidencias contra empresas_cliente
//   3. Retornar empresa_cliente_id + razon_social
//   4. Fallback gracioso cuando no hay coincidencia (nunca lanza)
//
// Uso: importar en cualquier módulo del backend que reciba company_customer_name
// del TMS. La UI nunca resuelve clientes — toda la lógica vive aquí.
// ────────────────────────────────────────────────────────────────────────────

// ─── SENTINELA DEL TMS ──────────────────────────────────────────────────────
// Cuando el TMS planilla un viaje pero aún NO ha realizado el Match comercial,
// asigna temporalmente el cliente "Integral Logistics Operations S.A.S." (con
// variantes de puntuación / SAS). El ERP debe reconocer este placeholder y
// abstenerse por completo: no resolver, no crear, no asociar. Espera hasta que
// el TMS realice el Match y comience a devolver el cliente real.
const TMS_PLACEHOLDER_PREFIX = 'INTEGRAL LOGISTICS OPERATIONS';

function isPlaceholderTmsCustomer(rawName) {
  if (!rawName) return false;
  return normalizeClient(rawName).startsWith(TMS_PLACEHOLDER_PREFIX);
}

// Mapa de variantes confirmadas → nombre canónico.
// Migrado de operaciones.html (normalización OTIF).
// Clave: variante normalizada (MAYÚS, sin acentos, sin puntos, espacios simples).
// Valor: nombre canónico a usar como clave de búsqueda secundaria.
const CLIENT_ALIASES = {
  // ── Carga Líquida ──
  'CONQERS':                                        'CONQUERS',
  'CONQUERS':                                       'CONQUERS',
  'CI PRODEXPORT':                                  'C.I PRODEXPORT',
  'CI PRODEXPORT DE COLOMBIA SAS':                  'C.I PRODEXPORT',
  'CI PRODEXPORT DE COLOMBIA':                      'C.I PRODEXPORT',
  'IND AMBIENTAL':                                  'INDUSTRIA AMBIENTAL',
  'INDUSTRIA AMBIENTAL':                            'INDUSTRIA AMBIENTAL',
  'WASTE SERVICES':                                 'WASTE SERVICES',
  'WASTE AND ENVIRONMENTAL SERVICES SAS':           'WASTE SERVICES',
  'WASTE AND ENVIRONMENTAL SERVICES':               'WASTE SERVICES',
  'AMF':                                            'ATLANTIC MARINE FUELS',
  'ATLANTIC MARINE FUELS':                          'ATLANTIC MARINE FUELS',
  // ── Carga Seca ──
  'DEVELOPMENT OF ENERGY PROJ':                     'ENERGY PROJECTS',
  'DEVELOPMENT OF ENERGY PROJECTS SAS':             'ENERGY PROJECTS',
  'DEVELOPMENT OF ENERGY PROJECTS':                 'ENERGY PROJECTS',
  'JEHS INGENIERIA S A S':                          'JEHS INGENIERIA',
  'JEHS INGENIERIA SAS':                            'JEHS INGENIERIA',
  'JUANCAMOLE- LA FABRICA DE LA FELICIDAD SAS':     'JUANCAMOLE',
  'JUANCAMOLE LA FABRICA DE LA FELICIDAD SAS':      'JUANCAMOLE',
  'JUANCAMOLE- LA FABRICA FEL':                     'JUANCAMOLE',
  'JUANCAMOLE LA FABRICA FEL':                      'JUANCAMOLE',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA L&D SAS': 'L&D SAS',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA LYD SAS': 'L&D SAS',
  'FRIGORIFICO DE LA COSTA SAS':                    'ALFRESCO SAS',
  'FRIGORIFICO DE LA COSTA':                        'ALFRESCO SAS',
};

/**
 * Normaliza un nombre crudo para búsqueda: mayúsculas, sin acentos,
 * sin puntos, espacios simples. Igual al algoritmo de operaciones.html.
 */
function normalizeClient(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Construye el mapa de búsqueda a partir de los registros de empresas_cliente.
 * Indexa por nombre_controlt (fuente oficial de coincidencia con TMS)
 * y también por razon_social como respaldo.
 * @param {Array} empresas — array de { id, razon_social, nombre_controlt }
 * @returns {Map<string, { id: string, razon_social: string }>}
 */
function buildLookupMap(empresas) {
  const map = new Map();
  for (const e of (empresas || [])) {
    for (const fuente of [e.nombre_controlt, e.razon_social].filter(Boolean)) {
      const key = normalizeClient(fuente);
      if (key && !map.has(key)) {
        map.set(key, { id: e.id, razon_social: e.razon_social });
      }
    }
  }
  return map;
}

/**
 * Resuelve un nombre crudo del TMS contra el mapa de empresas.
 * Estrategia:
 *   1. Normaliza el nombre crudo.
 *   2. Aplica CLIENT_ALIASES para unificar variantes conocidas.
 *   3. Busca en el mapa (clave normalizada).
 *   4. Si no hay coincidencia, retorna resolved: false con empresa_cliente_id null.
 *
 * Nunca lanza. El flujo de sync nunca debe romperse por una resolución fallida.
 *
 * @param {string|null} rawName — company_customer_name del TMS
 * @param {Map} lookupMap — mapa construido por buildLookupMap()
 * @returns {{ empresa_cliente_id: string|null, razon_social: string|null, resolved: boolean }}
 */
function resolveCustomer(rawName, lookupMap) {
  if (!rawName || !lookupMap || !lookupMap.size) {
    return { empresa_cliente_id: null, razon_social: null, resolved: false };
  }
  try {
    const normalized = normalizeClient(rawName);
    // Intentar alias primero, luego el nombre normalizado directamente
    const aliasCanon  = CLIENT_ALIASES[normalized];
    const searchKey   = aliasCanon ? normalizeClient(aliasCanon) : normalized;
    const match = lookupMap.get(searchKey) || (aliasCanon ? null : undefined);
    // Si el alias apuntó a una clave diferente, buscar esa también
    const result = match ?? (aliasCanon && searchKey !== normalized ? lookupMap.get(normalized) : null);
    if (result) {
      return { empresa_cliente_id: result.id, razon_social: result.razon_social, resolved: true };
    }
    return { empresa_cliente_id: null, razon_social: null, resolved: false };
  } catch {
    return { empresa_cliente_id: null, razon_social: null, resolved: false };
  }
}

/**
 * Resuelve o crea automáticamente un cliente en el Maestro.
 *
 * Cuando el TMS envía un viaje cuyo `company_customer_name` no coincide con
 * ninguna empresa registrada, esta función lo crea al vuelo con estado
 * `pendiente` para que el flujo de Programación nunca se rompa. El equipo
 * comercial debe curar posteriormente estos registros desde el Workspace.
 *
 * Prevención de duplicados en 3 capas:
 *   1. Lookup in-memory (protege dentro del mismo ciclo de sync).
 *   2. SELECT previo por nombre_controlt normalizado (contra races entre syncs).
 *   3. Actualización in-place del lookupMap tras crear.
 *
 * Nunca lanza. Ante cualquier error retorna el resultado de resolveCustomer.
 *
 * @param {string|null} rawName — company_customer_name del TMS
 * @param {object} ctx
 * @param {Map} ctx.lookupMap — el mismo mapa usado por resolveCustomer; se muta
 * @param {Function} ctx.sbFetch — cliente Supabase inyectado desde index.js
 * @param {Function} [ctx.generarCodigo] — función async que retorna 'CLI-XXXXXX'
 * @param {string} [ctx.actor='sistema:tms'] — identificador del actor para auditoría
 * @returns {Promise<{ empresa_cliente_id: string|null, razon_social: string|null, resolved: boolean, created: boolean }>}
 */
async function resolveOrCreateCustomer(rawName, ctx) {
  // Placeholder del TMS: viaje sin Match. No resolver, no crear, no asociar.
  if (isPlaceholderTmsCustomer(rawName)) {
    return {
      empresa_cliente_id: null,
      razon_social:       null,
      resolved:           false,
      created:            false,
      placeholder:        true,
    };
  }

  const base = resolveCustomer(rawName, ctx?.lookupMap);
  if (base.resolved) return { ...base, created: false, placeholder: false };

  if (!rawName || !ctx?.sbFetch || !ctx?.lookupMap) {
    return { ...base, created: false, placeholder: false };
  }

  const nombre = String(rawName).trim();
  if (!nombre) return { ...base, created: false, placeholder: false };

  const normalized = normalizeClient(nombre);
  const actor = ctx.actor || 'sistema:tms';

  try {
    // Capa 2: SELECT previo por nombre_controlt / razon_social (red anti-race).
    // Dos GET separados en lugar de or=() para evitar PGRST100: el parser del
    // or-filter falla cuando el valor contiene comas (separador de condiciones)
    // o paréntesis, frecuentes en nombres del TMS.
    const filtroNombre = encodeURIComponent(nombre);
    let existentes = await ctx.sbFetch(
      `/empresas_cliente?nombre_controlt=eq.${filtroNombre}&select=id,razon_social,nombre_controlt&limit=1`
    );
    if (!existentes || !existentes[0]) {
      existentes = await ctx.sbFetch(
        `/empresas_cliente?razon_social=eq.${filtroNombre}&select=id,razon_social,nombre_controlt&limit=1`
      );
    }
    if (existentes && existentes[0]) {
      const found = existentes[0];
      // Refrescar lookup para futuras iteraciones
      ctx.lookupMap.set(normalized, { id: found.id, razon_social: found.razon_social });
      return {
        empresa_cliente_id: found.id,
        razon_social:       found.razon_social,
        resolved:           true,
        created:            false,
        placeholder:        false,
      };
    }

    // Capa 3: crear cliente con estado pendiente
    const codigo = ctx.generarCodigo ? await ctx.generarCodigo() : null;
    const ahora = new Date().toISOString();

    const inserted = await ctx.sbFetch('/empresas_cliente', 'POST', {
      razon_social:    nombre,
      nombre_controlt: nombre,
      activa:          false,
      estado:          'pendiente',
      codigo_cliente:  codigo,
      created_by:      actor,
      updated_at:      ahora,
      updated_by:      actor,
    });
    if (!inserted || !inserted[0]) {
      return { ...base, created: false, placeholder: false };
    }
    const nuevo = inserted[0];

    // Satélites mínimos + trazabilidad — todo en paralelo, sin bloquear el flujo
    await Promise.all([
      ctx.sbFetch('/clientes_info_general', 'POST', {
        empresa_id:       nuevo.id,
        nombre_comercial: nombre,
        pais:             'Colombia',
        updated_by:       actor,
      }),
      ctx.sbFetch('/clientes_relaciones_comerciales', 'POST', {
        empresa_id:       nuevo.id,
        estado_comercial: 'pendiente',
        updated_by:       actor,
      }),
      ctx.sbFetch('/clientes_info_tributaria', 'POST', {
        empresa_id:       nuevo.id,
        updated_by:       actor,
      }),
      ctx.sbFetch('/clientes_historial', 'POST', {
        empresa_id:    nuevo.id,
        tipo:          'creacion_automatica',
        descripcion:   `Cliente creado automáticamente desde TMS con nombre "${nombre}". Estado inicial: pendiente.`,
        usuario:       actor,
        usuario_email: actor,
        metadata:      { origen: 'tms', nombre_crudo: nombre, codigo_cliente: codigo },
      }),
    ]).catch(err => {
      // Los satélites no deben romper la resolución; el cliente ya existe.
      console.error('⚠️  resolveOrCreateCustomer satélites:', err.message);
    });

    // Refrescar lookup in-place para las siguientes iteraciones del ciclo
    ctx.lookupMap.set(normalized, { id: nuevo.id, razon_social: nuevo.razon_social });

    return {
      empresa_cliente_id: nuevo.id,
      razon_social:       nuevo.razon_social,
      resolved:           true,
      created:            true,
      placeholder:        false,
    };
  } catch (e) {
    console.error('❌ resolveOrCreateCustomer:', e.message);
    return { ...base, created: false, placeholder: false };
  }
}

/**
 * Único punto de resolución de identidad para las funciones de sync.
 *
 * Prioridad:
 *   1. existingEmpresaId ya en BD → autoritativo, no re-resolver ni tocar BD.
 *   2. Nombre crudo del TMS → resolveOrCreateCustomer().
 *
 * Garantiza que ningún ciclo de sync sobreescriba una identidad ya confirmada.
 * Toda lógica de resolución sale de syncPlaneados/syncCumplidos hacia aquí.
 *
 * @param {{ rawName: string|null, existingEmpresaId: string|null }} params
 * @param {object} ctx — { lookupMap, empresaById?, sbFetch, generarCodigo, actor }
 *   ctx.empresaById: Map<id, razon_social> para lookup inverso sin BD extra
 * @returns {Promise<{ empresa_cliente_id, razon_social, resolved, created, placeholder, source }>}
 */
async function resolveTrip({ rawName, existingEmpresaId }, ctx) {
  if (existingEmpresaId) {
    const razon_social = ctx?.empresaById?.get(existingEmpresaId) ?? null;
    return {
      empresa_cliente_id: existingEmpresaId,
      razon_social,
      resolved:           true,
      created:            false,
      placeholder:        false,
      source:             'existente',
    };
  }
  const result = await resolveOrCreateCustomer(rawName, ctx);
  const source = result.placeholder ? 'placeholder' : result.created ? 'creado' : 'tms';
  return { ...result, source };
}

export {
  normalizeClient,
  buildLookupMap,
  resolveCustomer,
  resolveOrCreateCustomer,
  resolveTrip,
  isPlaceholderTmsCustomer,
};
