/**
 * services/enturnes/normalizar.js — Normalización y validación de Enturne de Vehículos
 *
 * Funciones puras, sin dependencias de red ni de Supabase — testeables en
 * aislamiento (ver normalizar.test.js). El endpoint público en index.js
 * (POST /api/enturnes) es el único llamador en producción.
 */

export const TIPOS_VEHICULO = ['NHR', 'Turbo', 'Sencillo', 'Dobletroque', 'Patineta', 'Tractomula'];
export const TIPOS_CARROCERIA = ['Estaca', 'Furgón', 'Plancha', 'Cisterna'];

/**
 * Normaliza una placa para la comparación de unicidad diaria: mayúsculas,
 * sin espacios (ni internos ni de borde), sin guiones. No valida formato
 * de placa colombiana (6 caracteres, etc.) — la fuente (el conductor
 * escribiendo desde el celular) puede variar, y el negocio no pidió esa
 * validación estricta; solo pidió "normalizar" para evitar duplicados por
 * diferencias triviales de formato ("abc 123" / "ABC-123" / "AbC123" deben
 * colisionar como la misma placa).
 *
 * @param {string} placaCruda
 * @returns {string} Placa normalizada (ej. "ABC123"), o '' si no hay nada útil.
 */
export function normalizarPlaca(placaCruda) {
  if (typeof placaCruda !== 'string') return '';
  return placaCruda
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes por si acaso
    .replace(/[^A-Z0-9]/g, ''); // espacios, guiones, puntos — fuera
}

/**
 * Valida el cuerpo de una solicitud de enturne. Devuelve { ok, errores,
 * datos } — `datos` trae los campos ya saneados (trim, tipos numéricos)
 * listos para insertar, solo cuando ok=true.
 *
 * @param {object} body - req.body crudo del formulario público.
 * @returns {{ok:boolean, errores:string[], datos?:object}}
 */
export function validarSolicitudEnturne(body) {
  const errores = [];
  const b = body && typeof body === 'object' ? body : {};

  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : '';
  if (!nombre) errores.push('nombre es obligatorio');

  const placaCruda = typeof b.placa === 'string' ? b.placa.trim() : '';
  if (!placaCruda) errores.push('placa es obligatoria');
  const placaNormalizada = normalizarPlaca(placaCruda);
  if (placaCruda && !placaNormalizada) errores.push('placa no contiene caracteres válidos');

  const tipoVehiculo = typeof b.tipo_vehiculo === 'string' ? b.tipo_vehiculo.trim() : '';
  if (!TIPOS_VEHICULO.includes(tipoVehiculo)) errores.push('tipo_vehiculo inválido');

  const tipoCarroceria = typeof b.tipo_carroceria === 'string' ? b.tipo_carroceria.trim() : '';
  if (!TIPOS_CARROCERIA.includes(tipoCarroceria)) errores.push('tipo_carroceria inválido');

  const capacidad = Number(b.capacidad_toneladas);
  if (!Number.isFinite(capacidad) || capacidad <= 0) errores.push('capacidad_toneladas debe ser un número mayor a 0');

  let volumen = null;
  if (b.volumen_m3 !== undefined && b.volumen_m3 !== null && b.volumen_m3 !== '') {
    const v = Number(b.volumen_m3);
    if (!Number.isFinite(v) || v <= 0) errores.push('volumen_m3 debe ser un número mayor a 0 cuando se indica');
    else volumen = v;
  }

  const ruta = typeof b.ruta_frecuente === 'string' ? b.ruta_frecuente.trim() : '';
  if (!ruta) errores.push('ruta_frecuente es obligatoria');

  if (errores.length) return { ok: false, errores };

  return {
    ok: true,
    errores: [],
    datos: {
      nombre,
      placa: placaCruda,
      placa_normalizada: placaNormalizada,
      tipo_vehiculo: tipoVehiculo,
      tipo_carroceria: tipoCarroceria,
      capacidad_toneladas: capacidad,
      volumen_m3: volumen,
      ruta_frecuente: ruta,
    },
  };
}
