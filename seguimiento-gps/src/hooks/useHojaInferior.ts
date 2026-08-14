/**
 * src/hooks/useHojaInferior.ts — Envoltorio de eventos de puntero sobre la
 * lógica pura de src/hojaInferior.ts (Fase 10F, solo móvil). Pura UI: no
 * toca datos ni lógica GPS.
 *
 * El handle responde a dos gestos:
 *   - Arrastre real (pointerdown→move→up con desplazamiento > 4px): sigue
 *     el dedo en vivo y, al soltar, encaja en el estado más cercano.
 *   - Tap (sin desplazamiento): cicla peek → medio → lleno → peek.
 */
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  type AlturaHoja, alturaPxDe, siguienteEstado, estadoMasCercano, alMenosA, alturaCssDe, clampArrastrePx,
} from "../hojaInferior";

export type { AlturaHoja };

const UMBRAL_TAP_PX = 4;

export function useHojaInferior(inicial: AlturaHoja = "medio") {
  const [altura, setAltura] = useState<AlturaHoja>(inicial);
  const [arrastroPx, setArrastroPx] = useState<number | null>(null);
  const arrastre = useRef<{ y0: number; alturaPx0: number; movido: boolean } | null>(null);

  /** Sube la hoja al menos al estado dado — nunca la baja (ej. al elegir
   *  un vehículo desde "peek", que quede visible el detalle sin forzar
   *  "lleno" si el usuario ya la tenía más abierta que eso). */
  const expandirAlMenosA = useCallback((minimo: AlturaHoja) => {
    setAltura(actual => alMenosA(actual, minimo));
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { y0: e.clientY, alturaPx0: alturaPxDe(altura, window.innerHeight), movido: false };
  }, [altura]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const est = arrastre.current;
    if (!est) return;
    const delta = est.y0 - e.clientY; // arrastrar hacia arriba = positivo = la hoja crece
    if (Math.abs(delta) > UMBRAL_TAP_PX) est.movido = true;
    setArrastroPx(clampArrastrePx(est.alturaPx0 + delta, window.innerHeight));
  }, []);

  const onPointerUp = useCallback(() => {
    const est = arrastre.current;
    arrastre.current = null;
    if (!est) return;

    if (!est.movido) {
      // Tap sobre el handle, sin arrastre real — cicla al siguiente estado.
      setAltura(siguienteEstado);
      setArrastroPx(null);
      return;
    }

    // Arrastre real — encajar en el estado cuya altura objetivo quedó más cerca.
    setArrastroPx(actual => {
      const finalPx = actual ?? est.alturaPx0;
      setAltura(estadoMasCercano(finalPx, window.innerHeight));
      return null;
    });
  }, []);

  return {
    altura,
    setAltura,
    expandirAlMenosA,
    arrastrando: arrastroPx !== null,
    alturaCss: alturaCssDe(altura, arrastroPx),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
