interface ProgressBarProps {
  /** Valor de 0 a 100. Strings o null se convierten a 0. */
  value: string | number | null;
  /** Ancho máximo del contenedor. Por defecto 80px. */
  maxWidth?: string;
}

function resolveValue(raw: string | number | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : (raw ?? 0);
  return isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
}

function barColor(pct: number): string {
  if (pct >= 100) return "#059669";
  if (pct > 50)   return "#2563EB";
  if (pct > 0)    return "#D97706";
  return "var(--gray-300)";
}

export function ProgressBar({ value, maxWidth = "80px" }: ProgressBarProps) {
  const pct = resolveValue(value);
  const color = barColor(pct);
  return (
    <div className="flex items-center gap-1.5" style={{ maxWidth }}>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 5, background: "var(--gray-100)" }}
      >
        <div
          style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s ease" }}
        />
      </div>
      <span
        className="text-[10px] font-bold tabular-nums shrink-0"
        style={{ color, minWidth: "28px", textAlign: "right" }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
