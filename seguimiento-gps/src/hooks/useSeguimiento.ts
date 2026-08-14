/**
 * src/hooks/useSeguimiento.ts — Máquina de estados del flujo completo
 * (Fase 10C): enlace → correo → OTP → sesión → vehículos.
 *
 * Única fuente de verdad de qué pantalla se muestra (App.tsx solo renderiza
 * según `fase.tipo`). Nunca decide autorización por su cuenta — cada
 * transición depende de lo que el backend (services/gps/*, Fase 10B)
 * responda; un 401 en cualquier momento borra la sesión local y vuelve a
 * pedir verificación, nunca se "confía" en que sigue siendo válida.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, validarEnlace, iniciarAcceso, solicitarOtp, validarOtp, obtenerVehiculos } from "../api";
import { guardarSesion, leerSesionParaEnlace, limpiarSesion } from "../session";
import { INTERVALO_POLL_MS } from "../constants";
import type { VehiculoPublico } from "../types";

export type Fase =
  | { tipo: "cargando" }
  | { tipo: "sin_conexion_inicial" }
  | { tipo: "enlace_no_disponible" }
  | { tipo: "verificar_correo"; totalVehiculos: number; enviando: boolean; error: string | null }
  | { tipo: "otp"; correo: string; totalVehiculos: number; validando: boolean; error: string | null; mensaje: string | null }
  | { tipo: "sesion"; correo: string; sesionToken: string }
  | { tipo: "sesion_expirada" };

interface Estado {
  fase: Fase;
  vehiculos: VehiculoPublico[];
  cargandoVehiculos: boolean;
  redVehiculos: "ok" | "error";
  ultimaActualizacionLocal: Date | null;
}

type Accion =
  | { t: "ENLACE_OK"; totalVehiculos: number }
  | { t: "ENLACE_SIN_CONEXION" }
  | { t: "ENLACE_NO_DISPONIBLE" }
  | { t: "SESION_RECUPERADA"; correo: string; sesionToken: string }
  | { t: "CORREO_ENVIANDO" }
  | { t: "CORREO_OK"; correo: string; totalVehiculos: number }
  | { t: "CORREO_ACCESO_DIRECTO"; correo: string; sesionToken: string }
  | { t: "CORREO_ERROR"; error: string }
  | { t: "CORREO_ENLACE_MURIO" }
  | { t: "OTP_VALIDANDO" }
  | { t: "OTP_OK"; correo: string; sesionToken: string }
  | { t: "OTP_ERROR"; error: string }
  | { t: "OTP_ENLACE_MURIO" }
  | { t: "OTP_REENVIAR_OK" }
  | { t: "VOLVER_A_CORREO" }
  | { t: "VEHICULOS_CARGANDO" }
  | { t: "VEHICULOS_OK"; vehiculos: VehiculoPublico[] }
  | { t: "VEHICULOS_ERROR_RED" }
  | { t: "SESION_EXPIRADA" };

function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.t) {
    case "ENLACE_OK":
      return { ...estado, fase: { tipo: "verificar_correo", totalVehiculos: accion.totalVehiculos, enviando: false, error: null } };
    case "ENLACE_SIN_CONEXION":
      return { ...estado, fase: { tipo: "sin_conexion_inicial" } };
    case "ENLACE_NO_DISPONIBLE":
      return { ...estado, fase: { tipo: "enlace_no_disponible" } };
    case "SESION_RECUPERADA":
      return { ...estado, fase: { tipo: "sesion", correo: accion.correo, sesionToken: accion.sesionToken } };

    case "CORREO_ENVIANDO":
      return estado.fase.tipo === "verificar_correo"
        ? { ...estado, fase: { ...estado.fase, enviando: true, error: null } }
        : estado;
    case "CORREO_OK":
      return { ...estado, fase: { tipo: "otp", correo: accion.correo, totalVehiculos: accion.totalVehiculos, validando: false, error: null, mensaje: null } };
    // Fase 11B — acceso interno: el backend concedió sesión directa, sin
    // pasar nunca por la pantalla de OTP (mismo estado final "sesion" que
    // OTP_OK, solo que se llega sin código).
    case "CORREO_ACCESO_DIRECTO":
      return { ...estado, fase: { tipo: "sesion", correo: accion.correo, sesionToken: accion.sesionToken } };
    case "CORREO_ERROR":
      return estado.fase.tipo === "verificar_correo"
        ? { ...estado, fase: { ...estado.fase, enviando: false, error: accion.error } }
        : estado;
    case "CORREO_ENLACE_MURIO":
      return { ...estado, fase: { tipo: "enlace_no_disponible" } };

    case "OTP_VALIDANDO":
      return estado.fase.tipo === "otp" ? { ...estado, fase: { ...estado.fase, validando: true, error: null } } : estado;
    case "OTP_OK":
      return { ...estado, fase: { tipo: "sesion", correo: accion.correo, sesionToken: accion.sesionToken } };
    case "OTP_ERROR":
      return estado.fase.tipo === "otp" ? { ...estado, fase: { ...estado.fase, validando: false, error: accion.error, mensaje: null } } : estado;
    case "OTP_ENLACE_MURIO":
      return { ...estado, fase: { tipo: "enlace_no_disponible" } };
    case "OTP_REENVIAR_OK":
      return estado.fase.tipo === "otp"
        ? { ...estado, fase: { ...estado.fase, error: null, mensaje: "Reenviamos el código a tu correo." } }
        : estado;
    case "VOLVER_A_CORREO":
      limpiarSesionSilenciosa();
      return { ...estado, vehiculos: [], fase: { tipo: "verificar_correo", totalVehiculos: 0, enviando: false, error: null } };

    case "VEHICULOS_CARGANDO":
      return { ...estado, cargandoVehiculos: estado.vehiculos.length === 0 };
    case "VEHICULOS_OK":
      return {
        ...estado, vehiculos: accion.vehiculos, cargandoVehiculos: false,
        redVehiculos: "ok", ultimaActualizacionLocal: new Date(),
      };
    case "VEHICULOS_ERROR_RED":
      return { ...estado, cargandoVehiculos: false, redVehiculos: "error" };
    case "SESION_EXPIRADA":
      limpiarSesionSilenciosa();
      return { ...estado, vehiculos: [], fase: { tipo: "sesion_expirada" } };

    default:
      return estado;
  }
}

function limpiarSesionSilenciosa() {
  try { limpiarSesion(sessionStorage); } catch { /* Storage no disponible (modo privado agresivo) — no romper el flujo. */ }
}

export function useSeguimiento(token: string) {
  const [estado, dispatch] = useReducer(reducir, {
    fase: { tipo: "cargando" },
    vehiculos: [],
    cargandoVehiculos: false,
    redVehiculos: "ok",
    ultimaActualizacionLocal: null,
  });

  // ── Validación inicial del enlace ──────────────────────────────────────────
  const validar = useCallback(async () => {
    try {
      const resp = await validarEnlace(token);
      const sesionCacheada = leerSesionParaEnlace(token, safeStorage());
      if (sesionCacheada) {
        dispatch({ t: "SESION_RECUPERADA", correo: sesionCacheada.correo, sesionToken: sesionCacheada.sesionToken });
        return;
      }
      dispatch({ t: "ENLACE_OK", totalVehiculos: resp.vehiculos });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        dispatch({ t: "ENLACE_SIN_CONEXION" });
      } else {
        dispatch({ t: "ENLACE_NO_DISPONIBLE" });
      }
    }
  }, [token]);

  useEffect(() => { validar(); }, [validar]);

  // ── Enviar correo — primer paso compartido de internos y externos (Fase
  // 11B). El backend decide el método de autenticación: interno → sesión
  // directa (sin código); externo → mismo flujo OTP de siempre. Este hook
  // nunca decide localmente cuál aplica, solo interpreta `modo`.
  const enviarCorreo = useCallback(async (correo: string) => {
    dispatch({ t: "CORREO_ENVIANDO" });
    try {
      const resp = await iniciarAcceso(token, correo);
      if (resp.modo === "interno") {
        guardarSesionSilenciosa({ enlaceToken: token, sesionToken: resp.sesion, expiraEn: resp.expiraEn, correo });
        dispatch({ t: "CORREO_ACCESO_DIRECTO", correo, sesionToken: resp.sesion });
        return;
      }
      const totalVehiculos = estado.fase.tipo === "verificar_correo" ? estado.fase.totalVehiculos : 0;
      dispatch({ t: "CORREO_OK", correo, totalVehiculos });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) { dispatch({ t: "CORREO_ENLACE_MURIO" }); return; }
      const msg = err instanceof ApiError ? err.message : "No se pudo continuar. Inténtalo de nuevo.";
      dispatch({ t: "CORREO_ERROR", error: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estado.fase]);

  // ── Reenviar OTP (mismo endpoint, se queda en la pantalla de OTP) ──────────
  const reenviarCodigo = useCallback(async () => {
    if (estado.fase.tipo !== "otp") return;
    try {
      await solicitarOtp(token, estado.fase.correo);
      dispatch({ t: "OTP_REENVIAR_OK" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) { dispatch({ t: "OTP_ENLACE_MURIO" }); return; }
      const msg = err instanceof ApiError ? err.message : "No se pudo reenviar el código. Inténtalo de nuevo.";
      dispatch({ t: "OTP_ERROR", error: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estado.fase]);

  // ── Validar OTP ───────────────────────────────────────────────────────────
  const validarCodigo = useCallback(async (codigo: string) => {
    if (estado.fase.tipo !== "otp") return;
    const correo = estado.fase.correo;
    dispatch({ t: "OTP_VALIDANDO" });
    try {
      const resp = await validarOtp(token, correo, codigo);
      guardarSesionSilenciosa({ enlaceToken: token, sesionToken: resp.sesion, expiraEn: resp.expiraEn, correo });
      dispatch({ t: "OTP_OK", correo, sesionToken: resp.sesion });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) { dispatch({ t: "OTP_ENLACE_MURIO" }); return; }
      const msg = err instanceof ApiError ? err.message : "No se pudo validar el código. Inténtalo de nuevo.";
      dispatch({ t: "OTP_ERROR", error: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estado.fase]);

  const volverAPedirCorreo = useCallback(() => dispatch({ t: "VOLVER_A_CORREO" }), []);

  // ── Poll de vehículos mientras hay sesión activa ───────────────────────────
  const sesionRef = useRef<{ correo: string; sesionToken: string } | null>(null);
  sesionRef.current = estado.fase.tipo === "sesion" ? { correo: estado.fase.correo, sesionToken: estado.fase.sesionToken } : null;

  const consultarVehiculos = useCallback(async () => {
    const sesion = sesionRef.current;
    if (!sesion) return;
    dispatch({ t: "VEHICULOS_CARGANDO" });
    try {
      const resp = await obtenerVehiculos(sesion.sesionToken);
      dispatch({ t: "VEHICULOS_OK", vehiculos: resp.vehiculos });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { dispatch({ t: "SESION_EXPIRADA" }); return; }
      dispatch({ t: "VEHICULOS_ERROR_RED" }); // 429/red — no derriba la sesión, solo marca el hiccup
    }
  }, []);

  useEffect(() => {
    if (estado.fase.tipo !== "sesion") return;
    consultarVehiculos();
    const id = setInterval(consultarVehiculos, INTERVALO_POLL_MS);
    // Refresca también al volver a foco/visibilidad — cubre "el celular
    // estuvo bloqueado 10 minutos" sin esperar al próximo tick del interval.
    const onVisible = () => { if (document.visibilityState === "visible") consultarVehiculos(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [estado.fase.tipo, consultarVehiculos]);

  return {
    fase: estado.fase,
    vehiculos: estado.vehiculos,
    cargandoVehiculos: estado.cargandoVehiculos,
    redVehiculos: estado.redVehiculos,
    ultimaActualizacionLocal: estado.ultimaActualizacionLocal,
    acciones: { reintentarValidacion: validar, enviarCorreo, reenviarCodigo, validarCodigo, volverAPedirCorreo, consultarVehiculos },
  };
}

function safeStorage(): Storage {
  try { return sessionStorage; } catch { return almacenEnMemoria; }
}
function guardarSesionSilenciosa(sesion: Parameters<typeof guardarSesion>[0]) {
  try { guardarSesion(sesion, sessionStorage); } catch { /* modo privado agresivo — la sesión sigue viva en memoria (React state) */ }
}

// Fallback in-memory por si sessionStorage no está disponible (algunos modos
// privados de Safari/iOS la bloquean por completo) — nunca debe tumbar la app.
const _memoria = new Map<string, string>();
const almacenEnMemoria: Storage = {
  getItem: (k) => _memoria.get(k) ?? null,
  setItem: (k, v) => { _memoria.set(k, v); },
  removeItem: (k) => { _memoria.delete(k); },
  clear: () => { _memoria.clear(); },
  key: (i) => Array.from(_memoria.keys())[i] ?? null,
  get length() { return _memoria.size; },
};
