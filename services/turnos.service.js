'use strict';
/**
 * turnos.service.js — Capa de acceso a datos para Gestión de Turnos.
 * Usa raw fetch (PostgREST) con JWT de la sesión activa de Supabase.
 * No instancia un nuevo cliente; lee el token de localStorage igual
 * que el patrón de Operaciones_project.html.
 */

const _T_SB_URL = 'https://gtyydandwcgoaratmnqh.supabase.co/rest/v1';
const _T_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI';

function _tHeaders() {
  let tok = '';
  try {
    const raw = localStorage.getItem('sb-gtyydandwcgoaratmnqh-auth-token');
    if (raw) { const p = JSON.parse(raw); tok = p?.access_token || p?.token || ''; }
  } catch (_) {}
  return {
    'Content-Type': 'application/json',
    'apikey': _T_SB_KEY,
    'Authorization': 'Bearer ' + (tok || _T_SB_KEY),
  };
}

async function _tFetch(path, method, body, extra) {
  const headers = Object.assign({}, _tHeaders(), extra || {});
  const opts = { method: method || 'GET', headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(_T_SB_URL + path, opts);
  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw new Error('[TurnosService] ' + (method || 'GET') + ' ' + path + ' → HTTP ' + r.status + ' ' + msg);
  }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

window.TurnosService = {
  /** Colaboradores activos para selector de asignación */
  getProfiles() {
    return _tFetch('/profiles?activo=eq.true&select=id,nombre,cargo,telefono&order=nombre.asc');
  },

  /** Turnos en un rango de fechas, incluyendo datos del perfil asignado */
  getTurnos(fechaDesde, fechaHasta) {
    return _tFetch(
      '/turnos?fecha=gte.' + fechaDesde + '&fecha=lte.' + fechaHasta +
      '&select=*,profile:profiles!profile_id(id,nombre,cargo,telefono)' +
      '&order=area.asc,subarea.asc,fecha.asc'
    );
  },

  /** Crea un turno y devuelve el registro creado */
  createTurno(data) {
    return _tFetch('/turnos', 'POST', data, { 'Prefer': 'return=representation' });
  },

  /** Actualiza un turno por id y devuelve el registro actualizado */
  updateTurno(id, patch) {
    return _tFetch('/turnos?id=eq.' + id, 'PATCH', patch, { 'Prefer': 'return=representation' });
  },

  /** Elimina un turno por id */
  deleteTurno(id) {
    return _tFetch('/turnos?id=eq.' + id, 'DELETE');
  },
};
