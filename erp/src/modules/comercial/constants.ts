import type { ClienteWorkspaceTab, EstadoCliente, ClasificacionABC, NivelEstrategico, EtiquetaCliente, TipoAlerta } from "./types";

// ── Estado del cliente ────────────────────────────────────────────────────────

export const ESTADO_CLIENTE_CFG: Record<EstadoCliente, { label: string; variant: "success" | "default" | "danger" | "info" }> = {
  activo:     { label: "Activo",     variant: "success" },
  inactivo:   { label: "Inactivo",   variant: "default" },
  suspendido: { label: "Suspendido", variant: "danger"  },
  prospecto:  { label: "Prospecto",  variant: "info"    },
};

// ── Clasificación ABC ─────────────────────────────────────────────────────────

export const CLASIFICACION_ABC_CFG: Record<ClasificacionABC, { color: string; bg: string }> = {
  A: { color: "#065F46", bg: "#D1FAE5" },
  B: { color: "#1E40AF", bg: "#DBEAFE" },
  C: { color: "#374151", bg: "#F3F4F6" },
};

// ── Nivel estratégico ─────────────────────────────────────────────────────────

export const NIVEL_ESTRATEGICO_CFG: Record<NivelEstrategico, { label: string; color: string; bg: string }> = {
  estrategico:   { label: "Estratégico",  color: "#5B21B6", bg: "#EDE9FE" },
  clave:         { label: "Clave",        color: "#1D4ED8", bg: "#DBEAFE" },
  estandar:      { label: "Estándar",     color: "#374151", bg: "#F3F4F6" },
  transaccional: { label: "Transaccional",color: "#6B7280", bg: "#F9FAFB" },
};

// ── Etiquetas ─────────────────────────────────────────────────────────────────

export const ETIQUETA_CFG: Record<EtiquetaCliente, { label: string; color: string; bg: string }> = {
  estrategico:      { label: "Estratégico",     color: "#5B21B6", bg: "#EDE9FE" },
  cuenta_clave:     { label: "Cuenta Clave",    color: "#1D4ED8", bg: "#DBEAFE" },
  vip:              { label: "VIP",             color: "#B45309", bg: "#FEF3C7" },
  proyecto_especial:{ label: "Proyecto Esp.",   color: "#065F46", bg: "#D1FAE5" },
  alto_riesgo:      { label: "Alto Riesgo",     color: "#9F1239", bg: "#FFE4E6" },
  exclusivo:        { label: "Exclusivo",       color: "#6D28D9", bg: "#EDE9FE" },
  prospecto:        { label: "Prospecto",       color: "#374151", bg: "#F3F4F6" },
};

// ── Alertas ───────────────────────────────────────────────────────────────────

export const ALERTA_CFG: Record<TipoAlerta, { label: string; severidad: "info" | "warning" | "danger" }> = {
  documento_por_vencer:   { label: "Documento próximo a vencer", severidad: "warning" },
  documento_vencido:      { label: "Documento vencido",          severidad: "danger"  },
  cartera_vencida:        { label: "Cartera vencida",            severidad: "danger"  },
  sin_tarifas:            { label: "Sin tarifas vigentes",       severidad: "warning" },
  sin_contacto_principal: { label: "Sin contacto principal",     severidad: "info"    },
  sin_correo_facturacion: { label: "Sin correo de facturación",  severidad: "info"    },
  cliente_suspendido:     { label: "Cliente suspendido",         severidad: "danger"  },
};

// ── Tabs del listado ──────────────────────────────────────────────────────────

export const TABS_LISTADO = [
  { id: "todos",       label: "Todos",      estadoKey: ""           },
  { id: "activos",     label: "Activos",    estadoKey: "activo"     },
  { id: "inactivos",   label: "Inactivos",  estadoKey: "inactivo"   },
  { id: "suspendidos", label: "Suspendidos",estadoKey: "suspendido" },
  { id: "prospectos",  label: "Prospectos", estadoKey: "prospecto"  },
] as const;

// ── Tabs del Workspace ────────────────────────────────────────────────────────

export const WORKSPACE_TABS: Array<{ id: ClienteWorkspaceTab; label: string }> = [
  { id: "perfil",                  label: "Perfil"                 },
  { id: "relaciones",              label: "Relaciones Comerciales" },
  { id: "contactos",               label: "Contactos"              },
  { id: "sedes",                   label: "Sedes"                  },
  { id: "documentos",              label: "Documentos"             },
  { id: "condiciones_comerciales", label: "Condiciones Comerciales"},
  { id: "condiciones_operativas",  label: "Condiciones Operativas" },
  { id: "tarifas",                 label: "Tarifas"                },
  { id: "solicitudes",             label: "Solicitudes"            },
  { id: "viajes",                  label: "Viajes"                 },
  { id: "facturacion",             label: "Facturación"            },
  { id: "cartera",                 label: "Cartera"                },
  { id: "analitica",               label: "Analítica"              },
  { id: "historial",               label: "Historial"              },
];
