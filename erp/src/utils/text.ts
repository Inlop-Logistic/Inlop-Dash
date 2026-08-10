/**
 * Utilidades de transformación de texto para presentación visual.
 *
 * Los strings del TMS llegan en MAYÚSCULAS; estas funciones los normalizan
 * para mostrar en la UI sin modificar la fuente de datos.
 */

// ── Abreviaciones jurídicas colombianas ─────────────────────────────────────
// Mapa de normalización: clave = forma minúscula tal como viene del TMS,
// valor = forma canónica para mostrar al usuario.
const SIGLAS_JURIDICAS: Record<string, string> = {
  "sas":   "S.A.S.", "s.a.s": "S.A.S.", "s.a.s.": "S.A.S.",
  "sa":    "S.A.",   "s.a":   "S.A.",   "s.a.":   "S.A.",
  "ltda":  "Ltda.",  "ltda.": "Ltda.",
  "eu":    "E.U.",   "e.u":   "E.U.",   "e.u.":   "E.U.",
  "sca":   "S.C.A.", "s.c.a.": "S.C.A.",
  "scs":   "S.C.S.",
  "snc":   "S.N.C.",
  "spa":   "S.P.A.",
  "cia":   "Cía.",   "cía":   "Cía.",
};

// Palabras que permanecen en minúscula cuando aparecen en posición no inicial
const STOP_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en"]);

/**
 * Convierte un string en MAYÚSCULAS a Mayúscula Inicial, respetando:
 * - Abreviaciones jurídicas colombianas (SAS → S.A.S., LTDA → Ltda., etc.)
 * - Palabras funcionales en posición media (de, del, la, …)
 *
 * Devuelve "—" para null/undefined/vacío.
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
