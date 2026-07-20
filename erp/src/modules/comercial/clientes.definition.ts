/**
 * Definición ARC del módulo Maestro de Clientes.
 * Metadata declarativa — sin renderers ni lógica de negocio.
 */

export const CLIENTES_ENTITY = "empresa_cliente" as const;

export const CLIENTES_COLUMNS_DEF = [
  { key: "razon_social",        header: "Razón Social", width: undefined, sortable: true,  mono: false },
  { key: "nit",                 header: "NIT",          width: "130px",   sortable: true,  mono: true  },
  { key: "ciudad_principal",    header: "Ciudad",       width: "140px",   sortable: true,  mono: false },
  { key: "ejecutivo_comercial", header: "Ejecutivo",    width: "160px",   sortable: true,  mono: false },
  { key: "clasificacion_abc",   header: "ABC",          width: "70px",    sortable: true,  mono: false },
  { key: "estado",              header: "Estado",       width: "110px",   sortable: true,  mono: false },
  { key: "alertas_count",       header: "Alertas",      width: "80px",    sortable: true,  mono: false },
  { key: "_actions",            header: "",             width: "36px",    sortable: false, mono: false },
] as const;

export const CLIENTES_FILTERS_DEF = [
  { key: "busqueda",          type: "text",   label: "Buscar razón social, NIT, ciudad…" },
  { key: "estado",            type: "select", label: "Estado"        },
  { key: "clasificacion_abc", type: "select", label: "Clasificación" },
  { key: "sector_economico",  type: "select", label: "Sector"        },
] as const;

export const CLIENTES_ACTIONS_DEF = [
  { key: "abrir_workspace", label: "Abrir Workspace", primary: true  },
  { key: "ver_rapido",      label: "Vista rápida",    primary: false },
] as const;

export const CLIENTES_DEFAULT_SORT = { key: "razon_social", direction: "asc" } as const;

export const CLIENTES_DEFAULT_COLUMNS = [
  "razon_social", "nit", "ciudad_principal", "ejecutivo_comercial",
  "clasificacion_abc", "estado", "alertas_count", "_actions",
] as const;

export const CLIENTES_KPIS_DEF = [
  { key: "total",       label: "Total",       color: "var(--navy)", bg: "#DBEAFE"  },
  { key: "activos",     label: "Activos",     color: "#065F46",     bg: "#D1FAE5"  },
  { key: "inactivos",   label: "Inactivos",   color: "#374151",     bg: "#F3F4F6"  },
  { key: "suspendidos", label: "Suspendidos", color: "#991B1B",     bg: "#FEE2E2"  },
  { key: "con_alertas", label: "Con alertas", color: "#92400E",     bg: "#FEF3C7"  },
] as const;

export const CLIENTES_PERMISSIONS_DEF = {
  read:  ["operador", "supervisor", "admin", "comercial"],
  write: ["supervisor", "admin", "comercial"],
  admin: ["admin"],
} as const;
