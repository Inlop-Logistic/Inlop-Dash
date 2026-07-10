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

export { normalizeClient, buildLookupMap, resolveCustomer };
