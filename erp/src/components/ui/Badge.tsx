import type { ReactNode } from "react";

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
