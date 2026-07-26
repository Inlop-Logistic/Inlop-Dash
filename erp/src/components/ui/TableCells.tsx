import { splitISO } from "@/utils/date";

/**
 * Enterprise DataTable — Celdas reutilizables para todo el ERP.
 *
 * Uso: importar desde @/components/ui
 *   import { DateTimeCell, CodeCell, RouteCell, StatusChip } from "@/components/ui";
 */

/** Fecha + hora en doble línea (DD/MM/YYYY sobre HH:mm en navy). */
export function DateTimeCell({ iso }: { iso: string | null | undefined }) {
  const { fecha, hora } = splitISO(iso);
  return (
    <div className="tabular-nums leading-none">
      <div className="text-[11px]" style={{ color: "var(--gray-500)" }}>{fecha}</div>
      {hora && hora !== "00:00" && (
        <div className="text-[14px] font-bold mt-0.5" style={{ color: "var(--navy)" }}>{hora}</div>
      )}
    </div>
  );
}

/**
 * Código en DM Mono (var(--font-mono)) — elimina los ceros tachados del stack
 * system-mono de Tailwind. Estándar oficial para SOL-XXXXX, trip numbers,
 * remisiones, facturas, órdenes de compra y cualquier ID técnico del ERP.
 */
export function CodeCell({
  value,
  size = "md",
}: {
  value: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  if (!value) return <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>;
  const fontSize = size === "sm" ? "11px" : size === "lg" ? "15px" : "13px";
  return (
    <span
      className="font-bold"
      style={{ fontSize, color: "var(--navy)", fontFamily: "var(--font-mono)" }}
    >
      {value}
    </span>
  );
}

/**
 * Ruta Origen → Destino en una sola línea.
 * Origen en gris oscuro, flecha en gris claro, Destino en gris medio.
 * Sin aumentar la altura de fila — ambos textos truncan dentro del contenedor.
 */
export function RouteCell({
  origin,
  destination,
}: {
  origin: string | null | undefined;
  destination: string | null | undefined;
}) {
  const o = origin       || "—";
  const d = destination  || "—";
  return (
    <div
      className="flex items-center gap-1 min-w-0"
      title={o !== "—" && d !== "—" ? `${o} → ${d}` : undefined}
    >
      <span className="text-[12px] truncate" style={{ color: "var(--gray-700)" }}>{o}</span>
      <span className="text-[10px] shrink-0 select-none" style={{ color: "var(--gray-300)" }}>→</span>
      <span className="text-[12px] truncate" style={{ color: "var(--gray-500)" }}>{d}</span>
    </div>
  );
}

/**
 * Chip de estado — base visual compartida para todos los EstadoBadge del ERP.
 * Recibe los tokens de color directamente; la lógica de mapeo estado→tokens
 * queda en cada módulo (solicitudes, viajes, cumplidos, programacion).
 */
export function StatusChip({
  label,
  color,
  bg,
  dot,
}: {
  label: string;
  color: string;
  bg: string;
  dot: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 whitespace-nowrap"
      style={{
        fontSize:     "var(--text-sm, 11px)",
        borderRadius: "var(--radius-full, 9999px)",
        background:   bg,
        color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dot }}
      />
      {label}
    </span>
  );
}
