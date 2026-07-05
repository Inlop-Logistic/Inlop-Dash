export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  programado: { label: "Programado", color: "#374151",           bg: "var(--gray-100)",   dot: "var(--gray-400)" },
  asignado:   { label: "Asignado",   color: "#1D4ED8",           bg: "#DBEAFE",           dot: "var(--info)"     },
  no_show:    { label: "No show",    color: "#9F1239",           bg: "var(--danger-bg)",  dot: "var(--danger)"   },
  cancelado:  { label: "Cancelado",  color: "var(--gray-600)",   bg: "var(--gray-100)",   dot: "var(--gray-400)" },
};

export const TABS = [
  { id: "todos",      label: "Todos"      },
  { id: "programado", label: "Programado" },
  { id: "asignado",   label: "Asignado"   },
  { id: "no_show",    label: "No show"    },
  { id: "cancelado",  label: "Cancelado"  },
];
