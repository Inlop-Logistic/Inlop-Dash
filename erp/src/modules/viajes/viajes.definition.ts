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
  { key: "trip_number",           header: "Manifiesto",     width: "110px",  sortable: true,  mono: true  },
  { key: "company_customer_name", header: "Cliente",        width: "180px",  sortable: true,  mono: false },
  { key: "type_operation",        header: "Línea Negocio",  width: "120px",  sortable: false, mono: false },
  { key: "_tipo",                 header: "Tipo",           width: "80px",   sortable: false, mono: false },
  { key: "_ruta",                 header: "Origen - Destino", width: "200px", sortable: false, mono: false },
  { key: "license_plate",         header: "Placa",          width: "100px",  sortable: true,  mono: true  },
  { key: "driver_name",           header: "Conductor",      width: "150px",  sortable: true,  mono: false },
  { key: "driver_phone",          header: "Teléfono",       width: "130px",  sortable: false, mono: true  },
  { key: "state_travel",          header: "Estado",         width: "150px",  sortable: true,  mono: false },
  { key: "_actions",              header: "",               width: "36px",   sortable: false, mono: false },
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
