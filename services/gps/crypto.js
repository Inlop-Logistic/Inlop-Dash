/**
 * services/gps/crypto.js — Primitivas criptográficas del Seguimiento GPS externo (Fase 10B)
 *
 * Módulo puro (sin I/O, sin Supabase) — genera y verifica los tres secretos
 * del flujo (token de enlace, código OTP, token de sesión) y sus hashes.
 * Ninguno de estos secretos se persiste en texto plano — ver
 * supabase/migrations/20260812000001_reportes_gps_enlaces.sql: las tablas
 * solo guardan `token_hash`/`otp_hash`/`sesion_token_hash`.
 *
 * Node `crypto` (nativo, sin dependencia nueva) — mismo módulo que ya usa
 * index.js para `randomUUID()`.
 */
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/** Token de enlace / sesión: 256 bits de entropía, aleatorio no predecible. */
export function generarToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Código OTP: 6 dígitos numéricos (fácil de escribir en un celular), pero
 * generado con el CSPRNG del sistema (crypto.randomBytes), nunca Math.random.
 * Rechaza el sesgo de módulo re-muestreando si el uint32 cae fuera del rango
 * múltiplo exacto de 1_000_000 — la probabilidad de necesitar más de una
 * vuelta es ínfima (~0.047%) pero así el sesgo es exactamente cero, no solo
 * "despreciable".
 */
export function generarOtp() {
  const LIMITE = Math.floor(0x100000000 / 1_000_000) * 1_000_000; // mayor múltiplo de 1e6 <= 2^32
  let n;
  do {
    n = randomBytes(4).readUInt32BE(0);
  } while (n >= LIMITE);
  return String(n % 1_000_000).padStart(6, '0');
}

/** sha256 en hexadecimal — usado para token_hash / otp_hash / sesion_token_hash. */
export function hashSecreto(valorClaro) {
  return createHash('sha256').update(String(valorClaro)).digest('hex');
}

/**
 * Compara dos hashes hexadecimales en tiempo constante — evita que la
 * comparación de un código OTP filtre por temporización cuántos caracteres
 * coinciden. La búsqueda del registro en Supabase (token_hash/enlace_id+
 * correo) ya es una igualdad indexada, no un escaneo comparando contra cada
 * fila — el riesgo de timing real que esta función cierra es el de la
 * comparación final entre "hash calculado del valor recibido" y "hash
 * guardado", no el lookup en sí.
 */
export function compararHash(hashA, hashB) {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
