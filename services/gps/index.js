/**
 * services/gps/index.js — Barrel del Seguimiento GPS externo (Fase 10B)
 *
 * Punto de entrada único para 10D (integración con envío de reportes) y
 * para routes/gpsSeguimiento.js (API pública). Mismo patrón que
 * services/reportes/index.js.
 */
export { crearEnlace, validarEnlace, revocarEnlace, MODULO_PERMITIDO, TTL_HORAS_DEFECTO } from './enlaces.js';
export { solicitarOtp, validarOtp, OTP_TTL_MINUTOS, OTP_MAX_INTENTOS } from './otp.js';
export { resolverAccesoInterno } from './accesoInterno.js';
export { crearSesion, validarSesion, TTL_HORAS_SESION_DEFECTO } from './sesiones.js';
export { obtenerVehiculosAutorizados } from './gpsSeguimiento.js';
export { extraerPlacas, CAMPO_PLACA_POR_REPORTE } from './vehiculos.js';
export { registrarAcceso } from './accesos.js';
export { verificarLimite } from './rateLimiter.js';
