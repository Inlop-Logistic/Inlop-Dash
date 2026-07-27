import { StatusChip } from "@/components/ui";
import { ESTADO_CFG } from "../constants";

interface EstadoBadgeProps { estado: string }

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const cfg = ESTADO_CFG[estado] ?? {
    label: estado,
    color: "var(--gray-500)",
    bg:    "var(--gray-100)",
    dot:   "var(--gray-400)",
  };
  return <StatusChip label={cfg.label} color={cfg.color} bg={cfg.bg} dot={cfg.dot} />;
}
