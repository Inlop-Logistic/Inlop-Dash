import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

// ─── Detección temprana de PASSWORD_RECOVERY (Sprint 3D-7.8F) ───────────────
// Corrige el race condition confirmado en la auditoría 3D-7.8E: al crear el
// cliente (arriba), Supabase dispara su propia inicialización interna
// (detección del fragmento #access_token=...&type=recovery de la URL), que
// puede emitir el evento PASSWORD_RECOVERY antes de que React monte
// AuthProvider y este registre su propio onAuthStateChange dentro de un
// useEffect — perdiendo el evento y dejando pasar al usuario invitado/en
// recuperación directo al dashboard.
//
// La corrección es registrar el listener aquí, en el mismo tick síncrono en
// que se crea el cliente arriba — antes de que corra cualquier código de
// React — y guardar el resultado en una variable de módulo. AuthContext
// consulta esa variable (vía onRecoveryDetectada) en vez de depender
// exclusivamente de su propio listener tardío.
let recoveryDetectada = false;
type RecoveryListener = () => void;
const recoveryListeners: RecoveryListener[] = [];

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryDetectada = true;
    recoveryListeners.forEach((fn) => fn());
  }
});

/**
 * Suscribe `fn` a la detección de PASSWORD_RECOVERY. Si el evento ya ocurrió
 * antes de suscribirse (el caso que motivó este fix), invoca `fn`
 * inmediatamente — nunca se pierde por orden de registro.
 * Devuelve una función para cancelar la suscripción.
 */
export function onRecoveryDetectada(fn: RecoveryListener): () => void {
  if (recoveryDetectada) fn();
  recoveryListeners.push(fn);
  return () => {
    const i = recoveryListeners.indexOf(fn);
    if (i !== -1) recoveryListeners.splice(i, 1);
  };
}

/** Llamar tras salir del modo recovery (AuthContext#completarRecovery) —
 *  para que una futura sesión de recuperación en la misma pestaña (SPA, sin
 *  recarga de página) vuelva a detectarse desde cero. */
export function resetRecoveryDetectada(): void {
  recoveryDetectada = false;
}
