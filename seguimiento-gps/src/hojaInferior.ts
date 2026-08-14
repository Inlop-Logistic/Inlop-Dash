/**
 * src/hojaInferior.ts — Lógica pura de los 3 estados de la hoja inferior
 * (Fase 10F, solo móvil). Sin DOM, sin React — testable con `node --test`
 * igual que src/vehiculos.ts/session.ts. El hook de React
 * (src/hooks/useHojaInferior.ts) es solo el envoltorio de eventos de
 * puntero sobre estas funciones; toda la aritmética/decisión vive aquí.
 */
import { ALTURA_HOJA_PEEK_PX, ALTURA_HOJA_MEDIO_VH, ALTURA_HOJA_LLENO_VH } from "./constants.ts";

export type AlturaHoja = "peek" | "medio" | "lleno";

export const ORDEN_ALTURAS: readonly AlturaHoja[] = ["peek", "medio", "lleno"];

/** Alto objetivo, en px, de cada estado para un viewport de `viewportH` px. */
export function alturaPxDe(estado: AlturaHoja, viewportH: number): number {
  if (estado === "peek") return ALTURA_HOJA_PEEK_PX;
  if (estado === "lleno") return viewportH * ALTURA_HOJA_LLENO_VH;
  return viewportH * ALTURA_HOJA_MEDIO_VH;
}

/** Ciclo del tap sobre el handle: peek → medio → lleno → peek. */
export function siguienteEstado(actual: AlturaHoja): AlturaHoja {
  const i = ORDEN_ALTURAS.indexOf(actual);
  return ORDEN_ALTURAS[(i + 1) % ORDEN_ALTURAS.length];
}

/** Estado cuyo alto objetivo queda más cerca de `px` (encaje al soltar un arrastre). */
export function estadoMasCercano(px: number, viewportH: number): AlturaHoja {
  let masCercano: AlturaHoja = "medio";
  let distanciaMin = Infinity;
  for (const candidato of ORDEN_ALTURAS) {
    const d = Math.abs(alturaPxDe(candidato, viewportH) - px);
    if (d < distanciaMin) { distanciaMin = d; masCercano = candidato; }
  }
  return masCercano;
}

/** Sube `actual` al menos a `minimo` en la escala peek<medio<lleno — nunca la baja. */
export function alMenosA(actual: AlturaHoja, minimo: AlturaHoja): AlturaHoja {
  return ORDEN_ALTURAS.indexOf(actual) < ORDEN_ALTURAS.indexOf(minimo) ? minimo : actual;
}

/**
 * Valor CSS de altura a aplicar: en vivo durante un arrastre (`arrastroPx`
 * no nulo) sigue exactamente esa posición en px; en reposo, "peek" usa un
 * px fijo (contenido siempre igual de chico) y "medio"/"lleno" usan vh
 * (se reajustan solos si cambia el viewport — rotación, teclado, etc.).
 */
export function alturaCssDe(altura: AlturaHoja, arrastroPx: number | null): string {
  if (arrastroPx !== null) return `${arrastroPx}px`;
  if (altura === "peek") return `${ALTURA_HOJA_PEEK_PX}px`;
  // Redondeado a 2 decimales — 0.58 * 100 da 57.99999999999999 en punto
  // flotante; visualmente idéntico para CSS, pero un valor así de feo en un
  // style attribute inspeccionado es ruido innecesario.
  const vh = Math.round((altura === "lleno" ? ALTURA_HOJA_LLENO_VH : ALTURA_HOJA_MEDIO_VH) * 10000) / 100;
  return `${vh}vh`;
}

/** Clampa la posición en vivo del arrastre entre "peek" y un techo de 94vh. */
export function clampArrastrePx(px: number, viewportH: number): number {
  return Math.min(viewportH * 0.94, Math.max(ALTURA_HOJA_PEEK_PX, px));
}
