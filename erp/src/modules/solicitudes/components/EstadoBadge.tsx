import { ESTADO_CFG } from "../constants";

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
