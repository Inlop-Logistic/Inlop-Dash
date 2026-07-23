/**
 * Definición ARC del módulo Cumplidos.
 * Contiene el contrato de columnas, filtros, acciones, KPIs y permisos.
 * El View Engine consumirá este archivo cuando esté disponible.
 * No modificar la tabla directamente: agregar aquí y actualizar CumplidosTableColumns.tsx.
 */

export const CUMPLIDOS_ENTITY = "cumplido" as const;

export const CUMPLIDOS_COLUMNS_DEF = [
  { key: "trip_number",          header: "Viaje",       width: "110px", sortable: true,  mono: true  },
  { key: "number_order",         header: "Remisión",    width: "110px", sortable: false, mono: true  },
  { key: "company_customer_name",header: "Cliente",     width: undefined, sortable: true, mono: false },
  { key: "license_plate",        header: "Vehículo",    width: "100px", sortable: false, mono: true  },
  { key: "driver_name",          header: "Conductor",   width: undefined, sortable: false, mono: false },
  { key: "fecha_cumplido",       header: "Fecha",       width: "130px", sortable: true,  mono: true  },
  { key: "estado_documental",    header: "Estado",      width: "160px", sortable: true,  mono: false },
  { key: "observaciones",        header: "Observaciones", width: undefined, sortable: false, mono: false },
  { key: "responsable",          header: "Responsable", width: "130px", sortable: false, mono: false },
  { key: "_actions",             header: "",            width: "36px",  sortable: false, mono: false },
] as const;

export const CUMPLIDOS_FILTERS_DEF = [
  { key: "busqueda",         type: "text",   label: "Buscar viaje, conductor, cliente…" },
  { key: "estado_documental",type: "select", label: "Estado documental" },
  { key: "clienteFiltro",    type: "select", label: "Cliente" },
] as const;

export const CUMPLIDOS_ACTIONS_DEF = [
  { key: "ver",      label: "Ver detalle",        primary: true  },
  { key: "aprobar",  label: "Aprobar expediente",  primary: false },
  { key: "rechazar", label: "Rechazar expediente", primary: false },
] as const;

export const CUMPLIDOS_DEFAULT_SORT = { key: "fecha_cumplido", direction: "desc" } as const;

export const CUMPLIDOS_DEFAULT_COLUMNS = [
  "trip_number", "company_customer_name", "license_plate",
  "estado_documental", "fecha_cumplido", "_actions",
] as const;

export const CUMPLIDOS_KPIS_DEF = [
  { key: "total",             label: "Total",              color: "var(--navy)",  bg: "#DBEAFE" },
  { key: "pendientes",        label: "Pendientes",         color: "#92400E",      bg: "#FEF3C7" },
  { key: "conObservaciones",  label: "Con observaciones",  color: "#7C3AED",      bg: "#EDE9FE" },
  { key: "validados",         label: "Validados",          color: "#065F46",      bg: "#D1FAE5" },
  { key: "listosFacturacion", label: "Listos p/facturar",  color: "#0F4C75",      bg: "#DBEAFE" },
  { key: "rechazados",        label: "Rechazados",         color: "#9F1239",      bg: "#FFE4E6" },
] as const;

export const CUMPLIDOS_PERMISSIONS_DEF = {
  read:   ["operador", "supervisor", "admin"],
  write:  ["supervisor", "admin"],
  delete: ["admin"],
} as const;
