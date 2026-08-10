/**
 * Definición desacoplada del módulo Viajes.
 *
 * Preparada para ARC (Adaptive Rendering Core): cuando el View Engine esté
 * disponible consumirá esta definición directamente. Hasta entonces,
 * ViajesTableColumns.tsx la lee y construye Column<TmsViaje>[] con renderers concretos.
 *
 * Regla: ningún renderer ni lógica de presentación vive aquí — solo metadatos.
 *
 * Anchos calibrados para 100% de zoom (referencia): suma total ~1268 px.
 * Operación necesita 128 px para contener "Carga Líquida" sin wrapping.
 * Tipo necesita 88 px para contener "Nacional" centrado.
 */

export const VIAJES_ENTITY = "viaje" as const;

/** Metadatos de cada columna — sin renderers. */
export const VIAJES_COLUMNS_DEF = [
  { key: "activated_on",          header: "Fecha",      width: "80px",   align: "center" as const, sortable: true,  mono: true  },
  { key: "trip_number",           header: "Manifiesto", width: "100px",  align: "left"   as const, sortable: true,  mono: true  },
  { key: "company_customer_name", header: "Cliente",    width: "164px",  align: "left"   as const, sortable: true,  mono: false },
  { key: "type_operation",        header: "Operación",  width: "128px",  align: "left"   as const, sortable: false, mono: false },
  { key: "_tipo",                 header: "Tipo",       width: "88px",   align: "center" as const, sortable: false, mono: false },
  { key: "origin_city_name",      header: "Origen",     width: "104px",  align: "left"   as const, sortable: false, mono: true  },
  { key: "destiny_city_name",     header: "Destino",    width: "104px",  align: "left"   as const, sortable: false, mono: true  },
  { key: "license_plate",         header: "Placa",      width: "84px",   align: "center" as const, sortable: true,  mono: true  },
  { key: "driver_name",           header: "Conductor",  width: "140px",  align: "left"   as const, sortable: true,  mono: false },
  { key: "driver_phone",          header: "Teléfono",   width: "104px",  align: "left"   as const, sortable: false, mono: true  },
  { key: "state_travel",          header: "Estado",     width: "136px",  align: "left"   as const, sortable: true,  mono: false },
  { key: "_actions",              header: "",           width: "36px",   align: "center" as const, sortable: false, mono: false },
] as const;

/** Especificaciones de filtro — sin componentes UI. */
export const VIAJES_FILTERS_DEF = [
  { key: "busqueda",              type: "text",   label: "Buscar",  placeholder: "Viaje, placa, conductor, cliente…" },
  { key: "state_travel",          type: "select", label: "Estado"   },
  { key: "company_customer_name", type: "select", label: "Cliente"  },
] as const;

/** Acciones disponibles sobre cada registro. */
export const VIAJES_ACTIONS_DEF = [
  { key: "ver", label: "Ver detalle", primary: true },
] as const;

/** Ordenamiento por defecto. */
export const VIAJES_DEFAULT_SORT = {
  key: "activated_on",
  direction: "desc",
} as const;
