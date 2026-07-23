/**
 * Definición ARC del módulo Centro de Monitoreo (GPS).
 * El View Engine consumirá este archivo cuando esté disponible.
 */

export const GPS_ENTITY = "vehiculo_gps" as const;

export const GPS_COLUMNS_DEF = [
  { key: "license_plate",         header: "Placa",       width: "100px",  sortable: false, mono: true  },
  { key: "driver_name",           header: "Conductor",   width: undefined, sortable: false, mono: false },
  { key: "company_customer_name", header: "Cliente",     width: undefined, sortable: false, mono: false },
  { key: "estadoGps",             header: "Estado",      width: "140px",  sortable: true,  mono: false },
  { key: "latest_gps_report",     header: "Último GPS",  width: "120px",  sortable: true,  mono: true  },
  { key: "trip_number",           header: "Viaje",       width: "100px",  sortable: false, mono: true  },
  { key: "_actions",              header: "",            width: "36px",   sortable: false, mono: false },
] as const;

export const GPS_FILTERS_DEF = [
  { key: "busqueda",  type: "text",   label: "Buscar placa, conductor, cliente…" },
  { key: "estadoGps", type: "select", label: "Estado" },
] as const;

export const GPS_ACTIONS_DEF = [
  { key: "ver_detalle",  label: "Ver detalle",      primary: true  },
  { key: "ver_en_mapa",  label: "Centrar en mapa",  primary: false },
  { key: "abrir_viaje",  label: "Abrir viaje",      primary: false },
] as const;

export const GPS_DEFAULT_SORT  = { key: "latest_gps_report", direction: "desc" } as const;

export const GPS_DEFAULT_COLUMNS = [
  "license_plate", "driver_name", "estadoGps", "latest_gps_report", "trip_number", "_actions",
] as const;

export const GPS_KPIS_DEF = [
  { key: "total",        label: "Total",         color: "var(--navy)",  bg: "#DBEAFE" },
  { key: "activos",      label: "Activos",        color: "#065F46",      bg: "#D1FAE5" },
  { key: "detenidos",    label: "Detenidos",      color: "#92400E",      bg: "#FEF3C7" },
  { key: "sinReporte",   label: "Sin reporte",    color: "#7C3AED",      bg: "#EDE9FE" },
  { key: "conAlarmas",   label: "Con alarmas",    color: "#9F1239",      bg: "#FFE4E6" },
  { key: "panico",       label: "Pánico",         color: "#5B21B6",      bg: "#EDE9FE" },
  { key: "desconectados",label: "Desconectados",  color: "var(--gray-500)", bg: "var(--gray-100)" },
] as const;

export const GPS_PERMISSIONS_DEF = {
  read:   ["operador", "supervisor", "admin"],
  write:  ["supervisor", "admin"],
} as const;
