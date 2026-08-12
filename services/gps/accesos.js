/**
 * services/gps/accesos.js — Auditoría de accesos al Seguimiento GPS externo (Fase 10B)
 *
 * Log de solo inserción (append-only) — cada intento de validar un enlace,
 * solicitar/validar OTP o consultar vehículos queda registrado, exitoso o
 * no. Nunca bloquea ni interrumpe el flujo principal: un fallo al escribir
 * el log de auditoría no debe impedir (ni reventar) la operación real.
 */

/**
 * @param {{
 *   enlaceId?: string|null, correo?: string|null, evento: string,
 *   exitoso?: boolean, detalle?: object|null, ip?: string|null, userAgent?: string|null,
 * }} datos
 * @param {{sbFetch: Function}} deps
 */
export async function registrarAcceso(datos, deps = {}) {
  const { sbFetch } = deps;
  if (!sbFetch || !datos?.evento) return;
  try {
    await sbFetch('/reportes_gps_enlaces_accesos', 'POST', {
      enlace_id:  datos.enlaceId ?? null,
      correo:     datos.correo ?? null,
      evento:     datos.evento,
      exitoso:    datos.exitoso ?? true,
      detalle:    datos.detalle ?? null,
      ip:         datos.ip ?? null,
      user_agent: datos.userAgent ?? null,
    });
  } catch (err) {
    // La auditoría nunca debe romper el flujo real — mismo criterio que el
    // resto de sbFetch() en este proyecto (no lanza, solo registra).
    console.error('[gps/accesos] no se pudo registrar acceso:', err.message);
  }
}
