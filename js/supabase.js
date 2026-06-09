/**
 * supabase.js — Cliente Supabase centralizado
 * INLOP · Integral Logistics Operations
 *
 * IMPORTANTE: Este archivo es el único lugar donde se definen
 * las credenciales de Supabase. Todos los demás módulos lo importan.
 *
 * Para producción: mover SB_URL y SB_KEY a variables de entorno
 * o a un archivo de configuración excluido del repositorio público.
 */

'use strict';

const INLOP_CONFIG = {
  supabaseUrl: 'https://gtyydandwcgoaratmnqh.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI',

  // Rutas de la aplicación (ajusta si cambia tu estructura en cPanel)
  paths: {
    login:         '/app/login.html',
    dashboard:     '/app/index.html',
    resetPassword: '/app/reset-password.html',
    callback:      '/app/auth/callback.html',
  },

  // Clave de sesión en sessionStorage
  sessionKey: 'inlop_user',
};

// Inicialización única del cliente Supabase v2
const _supabaseClient = supabase.createClient(
  INLOP_CONFIG.supabaseUrl,
  INLOP_CONFIG.supabaseKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,         // Persiste en localStorage de Supabase automáticamente
      detectSessionInUrl: true,     // Captura tokens en callback.html
    }
  }
);

// Exporta como global para que los demás scripts accedan
window.INLOP = window.INLOP || {};
window.INLOP.config  = INLOP_CONFIG;
window.INLOP.sb      = _supabaseClient;

window.SUPABASE_URL = INLOP_CONFIG.supabaseUrl;
window.SUPABASE_KEY = INLOP_CONFIG.supabaseKey;
