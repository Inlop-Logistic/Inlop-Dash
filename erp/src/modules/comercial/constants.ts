import type { ClienteWorkspaceTab, EstadoCliente, ClasificacionABC, NivelEstrategico, EtiquetaCliente, TipoAlerta, TipoCliente, TipoEmpresa } from "./types";

// ── Estado del cliente ────────────────────────────────────────────────────────

export const ESTADO_CLIENTE_CFG: Record<EstadoCliente, { label: string; variant: "success" | "default" | "danger" | "info" | "warning" }> = {
  activo:     { label: "Activo",     variant: "success" },
  inactivo:   { label: "Inactivo",   variant: "default" },
  suspendido: { label: "Suspendido", variant: "warning" },
  prospecto:  { label: "Prospecto",  variant: "info"    },
  bloqueado:  { label: "Bloqueado",  variant: "danger"  },
};

// Transiciones de estado válidas: qué estados se pueden alcanzar desde cada estado
export const TRANSICIONES_ESTADO: Record<EstadoCliente, EstadoCliente[]> = {
  prospecto:  ["activo", "inactivo"],
  activo:     ["suspendido", "bloqueado", "inactivo"],
  suspendido: ["activo", "bloqueado", "inactivo"],
  bloqueado:  ["activo", "inactivo"],
  inactivo:   ["prospecto", "activo"],
};

// Motivos disponibles por estado destino
export const MOTIVOS_CAMBIO_ESTADO: Record<EstadoCliente, string[]> = {
  prospecto:  ["Reactivación como prospecto", "Error de registro", "Otro"],
  activo:     ["Aprobación comercial", "Reactivación tras suspensión", "Reactivación tras bloqueo", "Cumplimiento de condiciones", "Otro"],
  suspendido: ["Deuda vencida", "Incumplimiento contractual", "Solicitud del cliente", "Revisión interna", "Otro"],
  bloqueado:  ["Fraude confirmado", "Incumplimiento grave", "Orden judicial", "Riesgo de seguridad", "Otro"],
  inactivo:   ["Cierre de empresa", "Sin actividad prolongada", "Solicitud del cliente", "Decisión comercial", "Otro"],
};

// ── Tipos de cliente ──────────────────────────────────────────────────────────

export const TIPO_CLIENTE_CFG: Record<TipoCliente, string> = {
  cargador:           "Cargador",
  operador_logistico: "Operador Logístico",
  distribuidor:       "Distribuidor",
  industria:          "Industria",
  comercio:           "Comercio",
  servicios:          "Servicios",
  otro:               "Otro",
};

// ── Tamaño de empresa ─────────────────────────────────────────────────────────

export const TIPO_EMPRESA_CFG: Record<TipoEmpresa, string> = {
  micro:    "Microempresa",
  pequena:  "Pequeña",
  mediana:  "Mediana",
  grande:   "Grande",
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
  { id: "prospectos",  label: "Prospectos", estadoKey: "prospecto"  },
  { id: "suspendidos", label: "Suspendidos",estadoKey: "suspendido" },
  { id: "bloqueados",  label: "Bloqueados", estadoKey: "bloqueado"  },
  { id: "inactivos",   label: "Inactivos",  estadoKey: "inactivo"   },
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
