/**
 * Diagnóstico permanente de la integración ControlT SOAP.
 *
 * Ruta: GET /api/controlt/diag
 * Protección: X-Internal-Api-Key (requireInternalApiKey — mismo mecanismo
 *             que todos los endpoints /api/* internos del ERP).
 *
 * Propósito:
 *   Verificar en cualquier momento que el módulo SOAP está correctamente
 *   configurado y que ControlT responde. Útil en deploys, incidentes y
 *   validaciones de Fase.
 *
 * No expone: credenciales, tokens UUID activos ni datos completos de carga.
 * Solo informa el estado de cada etapa (ok/error) y métricas operativas.
 */

import { Router } from 'express';
import { getConfig } from '../services/controlt-soap/config.js';
import { makeLoginFn, getDetailMonitoringOrder } from '../services/controlt-soap/soapGateway.js';
import { _resetAuth, getToken } from '../services/controlt-soap/authManager.js';

const router = Router();

/**
 * GET /api/controlt/diag
 *
 * Query params:
 *   viaje {string}  — código de viaje de prueba (default: env CONTROLT_DIAG_VIAJE o 'IN018108')
 *   reset {string}  — si vale '1', fuerza un nuevo Login descartando el token en memoria
 *
 * Respuesta exitosa (todas las etapas ok):
 *   { ok: true, etapas: { config, login, getDetail }, duracionTotalMs }
 *
 * Respuesta con fallo en alguna etapa:
 *   { ok: false, etapas: { ... }, error: { etapa, tipo, mensaje } }
 *
 * HTTP status: 200 siempre que el endpoint responda — el campo `ok` indica
 * el resultado real. Esto permite leer la respuesta completa aunque fallen
 * etapas intermedias.
 */
router.get('/diag', async (req, res) => {
  const t0 = Date.now();
  const codigoViaje = req.query.viaje || process.env.CONTROLT_DIAG_VIAJE || null;
  if (!codigoViaje) {
    return res.status(400).json({
      ok: false,
      error: {
        etapa: 'input',
        tipo: 'MissingViaje',
        mensaje: 'Se requiere un código de viaje. Envíalo como ?viaje=XXXXXXXX o configura CONTROLT_DIAG_VIAJE en las variables de entorno.',
      },
    });
  }
  const forceReset = req.query.reset === '1';

  const etapas = {
    config:    { ok: false },
    login:     { ok: false },
    getDetail: { ok: false },
  };

  // ── Etapa 1: Validar configuración ────────────────────────────────────────
  let config;
  try {
    config = getConfig();
    etapas.config = {
      ok: true,
      endpoint: config.endpoint,
      timeoutMs: config.timeoutMs,
      // Usuario truncado — confirma que la var existe sin exponerla
      usuarioConfigurado: config.user ? `${config.user.slice(0, 2)}***` : null,
    };
  } catch (err) {
    etapas.config = { ok: false, error: err.message };
    return res.json({
      ok: false,
      etapas,
      error: { etapa: 'config', tipo: 'ConfigError', mensaje: err.message },
      duracionTotalMs: Date.now() - t0,
    });
  }

  // ── Etapa 2: Login SOAP — obtener AuthenticationToken ────────────────────
  if (forceReset) _resetAuth();

  const loginFn = makeLoginFn(config);
  const t1 = Date.now();
  try {
    await getToken(loginFn);
    etapas.login = {
      ok: true,
      duracionMs: Date.now() - t1,
      // El token UUID NUNCA se incluye en la respuesta
      tokenObtenido: true,
    };
  } catch (err) {
    etapas.login = {
      ok: false,
      duracionMs: Date.now() - t1,
      error: err.message,
      tipo: err.code ?? err.constructor.name,
    };
    return res.json({
      ok: false,
      etapas,
      error: { etapa: 'login', tipo: err.code ?? err.constructor.name, mensaje: err.message },
      duracionTotalMs: Date.now() - t0,
    });
  }

  // ── Etapa 3: GetDetailMonitoringOrder ─────────────────────────────────────
  const t2 = Date.now();
  try {
    const resultado = await getDetailMonitoringOrder(codigoViaje, config);

    // Resumir la respuesta: claves de primer nivel + conteo de paradas si existe
    const claves = resultado && typeof resultado === 'object'
      ? Object.keys(resultado)
      : [];
    const paradasCount = Array.isArray(resultado?.paradas ?? resultado?.GetDetailMonitoringOrderResult?.paradas)
      ? (resultado?.paradas ?? resultado?.GetDetailMonitoringOrderResult?.paradas).length
      : null;

    etapas.getDetail = {
      ok: true,
      duracionMs: Date.now() - t2,
      codigoViaje,
      camposRecibidos: claves.length,
      camposRaiz: claves,
      ...(paradasCount !== null && { paradasCount }),
    };
  } catch (err) {
    etapas.getDetail = {
      ok: false,
      duracionMs: Date.now() - t2,
      codigoViaje,
      error: err.message,
      tipo: err.code ?? err.constructor.name,
    };
    return res.json({
      ok: false,
      etapas,
      error: { etapa: 'getDetail', tipo: err.code ?? err.constructor.name, mensaje: err.message },
      duracionTotalMs: Date.now() - t0,
    });
  }

  res.json({
    ok: true,
    etapas,
    duracionTotalMs: Date.now() - t0,
  });
});

export default router;
