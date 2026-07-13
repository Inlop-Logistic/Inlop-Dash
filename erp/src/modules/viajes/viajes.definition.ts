/**
 * Definición desacoplada del módulo Viajes.
 *
 * Preparada para ARC (Adaptive Rendering Core): cuando el View Engine esté
 * disponible consumirá esta definición directamente. Hasta entonces,
 * ViajesTableColumns.tsx la lee y construye Column<TmsViaje>[] con renderers concretos.
 *
 * Regla: ningún renderer ni lógica de presentación vive aquí — solo metadatos.
 */

export const VIAJES_ENTITY = "viaje" as const;

/** Metadatos de cada columna — sin renderers. */
export const VIAJES_COLUMNS_DEF = [
  { key: "trip_number",           header: "Viaje",                 width: "110px", sortable: true,  mono: true  },
  { key: "number_order",          header: "Remisión",              width: "110px", sortable: false, mono: true  },
  { key: "company_customer_name", header: "Cliente",               width: undefined, sortable: true,  mono: false },
  { key: "license_plate",         header: "Vehículo",              width: "100px", sortable: true,  mono: true  },
  { key: "driver_name",           header: "Conductor",             width: undefined, sortable: true,  mono: false },
  { key: "origin_city_name",      header: "Origen",                width: undefined, sortable: true,  mono: false },
  { key: "destiny_city_name",     header: "Destino",               width: undefined, sortable: true,  mono: false },
  { key: "state_travel",          header: "Estado",                width: "130px", sortable: true,  mono: false },
  { key: "percentage_travel",     header: "Avance",                width: "90px",  sortable: false, mono: false },
  { key: "latest_gps_report",     header: "GPS",                   width: "110px", sortable: false, mono: false },
  { key: "activated_on",          header: "Última actualización",  width: "140px", sortable: true,  mono: false },
  { key: "_actions",              header: "",                      width: "36px",  sortable: false, mono: false },
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
