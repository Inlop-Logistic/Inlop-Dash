/**
 * services/reportes/clienteFiltro.js — Normalización mínima de "cliente"
 * para el filtro multi-selección de Reportes Automáticos (Fase 11A).
 *
 * Reutiliza normalizeClient() de services/customerResolver.js — el mismo
 * criterio que ya usa la sincronización TMS en vivo (mayúsculas, trim, sin
 * tildes, sin puntos, espacios colapsados) — y agrega UNA sola regla extra,
 * acotada al final de la cadena: colapsar sufijos societarios escritos con
 * letras sueltas separadas por espacio ("S A S", "S A", "E U"…) al mismo
 * formato que su variante junta ("SAS", "SA", "EU"…).
 *
 * Sin esa regla adicional, normalizeClient() por sí solo NO reconoce como
 * el mismo cliente a:
 *   "Productos Ramo SAS"    → "PRODUCTOS RAMO SAS"
 *   "Productos Ramo S.A.S." → "PRODUCTOS RAMO SAS" (los puntos ya se quitan)
 *   "PRODUCTOS RAMO SAS"    → "PRODUCTOS RAMO SAS"
 *   "Productos Ramo S A S"  → "PRODUCTOS RAMO S A S" ← sin colapsar, distinto
 * Con la regla adicional, las 4 variantes convergen en la misma clave.
 *
 * Deliberadamente NO se modifica customerResolver.js: ese módulo alimenta la
 * sincronización TMS en vivo (dedup real de clientes, creación de registros
 * en empresas_cliente) — su radio de impacto es mucho mayor que el de este
 * filtro de solo lectura sobre datos ya generados para un reporte. Este
 * archivo es intencionalmente independiente y de alcance mínimo: normaliza
 * para AGRUPAR/COMPARAR dentro del filtro, nunca escribe ni decide nada
 * sobre el maestro de clientes.
 *
 * Evolución futura (documentada, no implementada aquí): si INLOP consolida
 * un maestro canónico de clientes con alias explícitos más completo, este
 * helper puede reemplazarse por una resolución directa contra ese maestro
 * sin cambiar su forma pública (normalizarClienteFiltro sigue recibiendo un
 * nombre crudo y devolviendo una clave estable). Hoy, `empresas_cliente` +
 * `razon_social` (vía tripCustomerCache/empMap en datasetProvider.js) ya
 * cubre la mayoría de los casos — esta normalización solo cierra la brecha
 * para los nombres que llegan sin `empresa_cliente_id` resuelto.
 */
import { normalizeClient } from '../customerResolver.js';

/**
 * Colapsa, SOLO al final de la cadena, una secuencia de 2 o más letras
 * sueltas separadas por espacio simple ("S A S", "S A", "E U") en su forma
 * junta ("SAS", "SA", "EU"). Acotado al final para no fusionar nombres que
 * casualmente contengan letras sueltas en medio (evita normalización
 * agresiva que fusione clientes distintos).
 */
function colapsarSufijoEspaciado(normalizado) {
  return normalizado.replace(/\b((?:[A-Z]\s+){1,}[A-Z])$/, m => m.replace(/\s+/g, ''));
}

/**
 * Clave de comparación estable para el filtro "Cliente": mismo criterio que
 * normalizeClient() más el colapso de sufijos espaciados de arriba. Cadena
 * vacía para valores vacíos/nulos o el placeholder "—" que ya usan algunos
 * datasets cuando no hay cliente resuelto.
 */
export function normalizarClienteFiltro(raw) {
  if (!raw || raw === '—') return '';
  const base = normalizeClient(raw);
  if (!base) return '';
  return colapsarSufijoEspaciado(base);
}
