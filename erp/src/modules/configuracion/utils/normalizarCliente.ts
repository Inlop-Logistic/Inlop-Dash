/**
 * erp/.../utils/normalizarCliente.ts — Normalización mínima de "cliente"
 * para el filtro multi-selección de la Preview del wizard (Fase 11A).
 *
 * Puerto frontend, MISMO algoritmo, sin cambios de semántica, de
 * services/reportes/clienteFiltro.js (backend) — que a su vez reutiliza
 * normalizeClient() de services/customerResolver.js. Misma duplicación
 * intencional que ya existe entre este módulo (api.ts) y filterEngine.js:
 * el backend es Node ESM plano y no puede importarse desde el árbol Vite
 * del frontend (ver comentario de cabecera de
 * erp/.../catalogos/datasetsReportes.ts y de
 * services/reportes/catalogoDatasets.js). Cualquier cambio en el algoritmo
 * de normalizarClienteFiltro() del backend debe reflejarse aquí.
 *
 * NO se reimplementa CLIENT_ALIASES ni isPlaceholderTmsCustomer — la
 * Preview del wizard es solo una muestra ilustrativa (no genera el archivo
 * real), así que basta con el mismo criterio mínimo de agrupación que usa
 * el Filter Engine real.
 */

/** Igual que normalizeClient() de services/customerResolver.js. */
function normalizeClient(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Igual que colapsarSufijoEspaciado() de services/reportes/clienteFiltro.js. */
function colapsarSufijoEspaciado(normalizado: string): string {
  return normalizado.replace(/\b((?:[A-Z]\s+){1,}[A-Z])$/, m => m.replace(/\s+/g, ""));
}

/** Igual que normalizarClienteFiltro() de services/reportes/clienteFiltro.js. */
export function normalizarClienteFiltro(raw: string | null | undefined): string {
  if (!raw || raw === "—") return "";
  const base = normalizeClient(raw);
  if (!base) return "";
  return colapsarSufijoEspaciado(base);
}
