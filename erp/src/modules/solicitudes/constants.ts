export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pendiente:  { label: "Pendiente",  color: "#B45309",           bg: "#FEF3C7",              dot: "#D97706"          },
  aprobado:   { label: "Aprobado",   color: "#1D4ED8",           bg: "#DBEAFE",              dot: "var(--info)"      },
  en_ruta:    { label: "En ruta",    color: "#6D28D9",           bg: "#EDE9FE",              dot: "#7C3AED"          },
  completado: { label: "Completado", color: "#065F46",           bg: "var(--success-light)", dot: "var(--success)"   },
  cancelado:  { label: "Cancelado",  color: "#9F1239",           bg: "var(--danger-bg)",     dot: "var(--danger)"    },
};

export const ESTADO_FLOW = ["pendiente", "aprobado", "en_ruta", "completado"] as const;

export const TABS = [
  { id: "todos",      label: "Todos"       },
  { id: "pendiente",  label: "Pendientes"  },
  { id: "aprobado",   label: "Aprobados"   },
  { id: "en_ruta",    label: "En ruta"     },
  { id: "completado", label: "Finalizados" },
  { id: "cancelado",  label: "Cancelados"  },
];
