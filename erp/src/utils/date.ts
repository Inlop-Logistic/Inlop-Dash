// Locale colombiano para todos los formatos de fecha del ERP.
const LOCALE = "es-CO";

/** Fecha de hoy como string ISO-8601 (YYYY-MM-DD). */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fecha de hace 7 días como string ISO-8601 (YYYY-MM-DD). */
export function hace7dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Fecha larga con hora: "12 jun. 2025, 10:35 a. m." — para detalles y timelines. */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Fecha corta sin hora: "12 jun. 2025" — para columnas de tabla. */
export function fmtFechaCort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "2-digit", month: "short", year: "numeric",
  });
}
