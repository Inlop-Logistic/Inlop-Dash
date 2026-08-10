/**
 * erp/src/utils/text.ts — Utilidades de presentación de texto · ERP INLOP
 *
 * REGLA: solo lógica de formato visual. No modifica valores de BD.
 * Para parseo de fechas, usar parseFecha.ts.
 */

/**
 * Formas canónicas de siglas jurídicas colombianas.
 * Clave: forma en minúsculas (con o sin puntos).
 */
const SIGLAS_JURIDICAS: Record<string, string> = {
  "sas":   "S.A.S.",
  "s.a.s": "S.A.S.",
  "s.a.s.":"S.A.S.",
  "sa":    "S.A.",
  "s.a":   "S.A.",
  "s.a.":  "S.A.",
  "ltda":  "Ltda.",
  "ltda.": "Ltda.",
  "eu":    "E.U.",
  "e.u":   "E.U.",
  "e.u.":  "E.U.",
  "sca":   "S.C.A.",
  "s.c.a.":"S.C.A.",
  "scs":   "S.C.S.",
  "snc":   "S.N.C.",
  "spa":   "S.P.A.",
  "cia":   "Cía.",
  "cía":   "Cía.",
};

/** Preposiciones y artículos que no se capitalizan en posición media. */
const STOP_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en"]);

/**
 * Convierte un string a Título Inicial para presentación visual.
 * - Preserva siglas jurídicas colombianas en su forma canónica.
 * - Mantiene en minúsculas preposiciones/artículos en posición media.
 * - Retorna "—" para valores vacíos o nulos.
 *
 * Ejemplos:
 *   "PRODUCTOS RAMO SAS"   → "Productos Ramo S.A.S."
 *   "PRODUCTOS RAMO S.A.S."→ "Productos Ramo S.A.S."
 *   "YOPAL"               → "Yopal"
 *   "yopal"               → "Yopal"
 *   "BOGOTA DC"           → "Bogota Dc"   (sin acentos — se preserva lo que llega)
 */
export function toTitleCase(raw: string | null | undefined): string {
  if (!raw) return "—";
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return "—";
  return clean
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      const sigla = SIGLAS_JURIDICAS[word];
      if (sigla) return sigla;
      if (i > 0 && STOP_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
