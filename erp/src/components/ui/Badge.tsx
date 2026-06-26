import type { ReactNode } from "react";

// ── Estado ────────────────────────────────────────────────────────────────────

export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pendiente:  { label: "Pendiente",  color: "#B45309",           bg: "#FEF3C7",              dot: "#D97706"          },
  aprobado:   { label: "Aprobado",   color: "#1D4ED8",           bg: "#DBEAFE",              dot: "var(--info)"      },
  en_ruta:    { label: "En ruta",    color: "#6D28D9",           bg: "#EDE9FE",              dot: "#7C3AED"          },
  completado: { label: "Completado", color: "#065F46",           bg: "var(--success-light)", dot: "var(--success)"   },
  cancelado:  { label: "Cancelado",  color: "#9F1239",           bg: "var(--danger-bg)",     dot: "var(--danger)"    },
};

interface EstadoBadgeProps { estado: string }

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const cfg = ESTADO_CFG[estado] ?? {
    label: estado,
    color: "var(--gray-500)",
    bg:    "var(--gray-100)",
    dot:   "var(--gray-400)",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-sm)] px-2.5 py-1 rounded-[var(--radius-full)]"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Canal ─────────────────────────────────────────────────────────────────────

interface CanalBadgeProps { canal: string }

export function CanalBadge({ canal }: CanalBadgeProps) {
  const isApp = canal === "APP";
  return (
    <span
      className="inline-flex items-center font-semibold text-[var(--text-xs)] px-2 py-0.5 rounded-[var(--radius-md)] tracking-wide"
      style={{
        background: isApp ? "var(--navy)" : "var(--gray-100)",
        color:      isApp ? "#fff"        : "var(--gray-500)",
      }}
    >
      {canal}
    </span>
  );
}

// ── Generic ───────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger" | "purple";

const VARIANT_CFG: Record<BadgeVariant, { color: string; bg: string }> = {
  default: { color: "var(--gray-600)",   bg: "var(--gray-100)"        },
  info:    { color: "#1D4ED8",           bg: "#DBEAFE"                },
  success: { color: "#065F46",           bg: "var(--success-light)"   },
  warning: { color: "#B45309",           bg: "#FEF3C7"                },
  danger:  { color: "#9F1239",           bg: "var(--danger-bg)"       },
  purple:  { color: "#6D28D9",           bg: "#EDE9FE"                },
};

interface BadgeProps { children: ReactNode; variant?: BadgeVariant }

export function Badge({ children, variant = "default" }: BadgeProps) {
  const cfg = VARIANT_CFG[variant];
  return (
    <span
      className="inline-flex items-center font-semibold text-[var(--text-sm)] px-2.5 py-1 rounded-[var(--radius-full)]"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {children}
    </span>
  );
}
