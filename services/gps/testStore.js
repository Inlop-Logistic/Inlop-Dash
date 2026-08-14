/**
 * services/gps/testStore.js — mock sbFetch multi-tabla para tests (Fase 10B,
 * reutilizado también por services/reportes/*.test.js en Fase 10D para
 * probar la integración con Seguimiento GPS). No termina en `.test.js` a
 * propósito: no es una suite en sí, es el helper que varias suites
 * comparten (mismo espíritu que el mock de scheduler.test.js, generalizado
 * a varias tablas porque el flujo de enlace→OTP→sesión toca 4 tablas
 * distintas, y ahora también reportes_automaticos/personal para 10D).
 *
 * Interpreta los filtros PostgREST reales que usa services/gps/*.js y
 * services/reportes/*.js (eq., is.null, lte., gte., in.()) sobre un
 * almacén en memoria por tabla, y soporta GET/POST/PATCH/DELETE — para que
 * los tests validen la consulta real que se envía, no solo la
 * orquestación.
 */
import { randomUUID } from 'crypto';

function aplicaFiltro(valor, condicion) {
  if (condicion === 'is.null') return valor === null || valor === undefined;
  if (condicion.startsWith('eq.')) {
    const esperado = decodeURIComponent(condicion.slice(3));
    if (esperado === 'true')  return valor === true;
    if (esperado === 'false') return valor === false;
    return String(valor) === esperado;
  }
  if (condicion.startsWith('lte.')) {
    if (valor === null || valor === undefined) return false;
    return new Date(valor).getTime() <= new Date(decodeURIComponent(condicion.slice(4))).getTime();
  }
  if (condicion.startsWith('gte.')) {
    if (valor === null || valor === undefined) return false;
    return new Date(valor).getTime() >= new Date(decodeURIComponent(condicion.slice(4))).getTime();
  }
  if (condicion.startsWith('in.(') && condicion.endsWith(')')) {
    const lista = condicion.slice(4, -1).split(',').map(decodeURIComponent);
    return lista.includes(String(valor));
  }
  return true; // select=, order=, limit= — metadatos, no filtran
}

const CAMPOS_META = new Set(['select', 'order', 'limit']);

/**
 * @param {Record<string, object[]>} tablasIniciales — ej. { reportes_automaticos: [...] }
 */
export function crearAlmacen(tablasIniciales = {}) {
  const tablas = {};
  for (const [nombre, filas] of Object.entries(tablasIniciales)) {
    tablas[nombre] = filas.map(f => ({ ...f }));
  }
  const llamadas = [];

  function coincide(fila, filtroEntries) {
    return filtroEntries.every(([campo, condicion]) => aplicaFiltro(fila[campo], condicion));
  }

  async function sbFetch(qs, method = 'GET', body = null) {
    llamadas.push({ qs, method, body });
    const [ruta, query] = qs.split('?');
    const tabla = ruta.slice(1);
    if (!tablas[tabla]) tablas[tabla] = [];
    const params = new URLSearchParams(query ?? '');
    const filtroEntries = [...params.entries()].filter(([k]) => !CAMPOS_META.has(k));

    if (method === 'POST') {
      const nuevaFila = { id: randomUUID(), created_at: new Date().toISOString(), ...body };
      tablas[tabla].push(nuevaFila);
      return [nuevaFila];
    }

    if (method === 'PATCH') {
      const afectadas = tablas[tabla].filter(f => coincide(f, filtroEntries));
      afectadas.forEach(fila => Object.assign(fila, body));
      return afectadas;
    }

    if (method === 'DELETE') {
      const antes = tablas[tabla].length;
      tablas[tabla] = tablas[tabla].filter(f => !coincide(f, filtroEntries));
      return tablas[tabla].length < antes ? [] : null;
    }

    // GET
    let resultado = tablas[tabla].filter(f => coincide(f, filtroEntries));
    const order = params.get('order');
    if (order) {
      const [campoOrden, dir] = order.split('.');
      resultado = [...resultado].sort((a, b) => {
        if (a[campoOrden] === b[campoOrden]) return 0;
        const cmp = a[campoOrden] < b[campoOrden] ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      });
    }
    const limit = params.get('limit');
    if (limit) resultado = resultado.slice(0, Number(limit));
    return resultado;
  }

  sbFetch.llamadas = llamadas;
  sbFetch.tablas = tablas;
  return sbFetch;
}
