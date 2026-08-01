# Certificación Fase 2 — ControlT SOAP Integration

**Estado:** ✅ FASE 2 CERTIFICADA  
**Fecha de certificación:** 2026-08-01  
**Rama:** `claude/clever-edison-y3au9r`  
**Commit final:** `298d465`

---

## 1. Objetivo

Fase 2 establece el contrato SOAP con ControlT y certifica la comunicación extremo a extremo:

- Autenticación SOAP (`Login`) con obtención de `AuthenticationToken` UUID.
- Consulta de detalle de viaje (`GetDetailMonitoringOrder`) con el token adquirido.
- Ciclo de vida del token: singleton en memoria, invalidación reactiva ante faults de autenticación, colapso de llamadas concurrentes.
- Corrección de mojibake (doble-codificación UTF-8/Latin-1) en todos los valores de cadena del resultado SOAP.
- Endpoint de diagnóstico permanente `GET /api/controlt/diag` para validación en Railway sin acceso local.

---

## 2. Arquitectura del módulo

```
services/controlt-soap/
├── config.js           — Lectura y validación de variables de entorno
├── errors.js           — Jerarquía de errores tipados (Fase 1)
├── authManager.js      — Token singleton + colapso de llamadas concurrentes
├── auditLogger.js      — Pino estructurado con redacción de secretos
├── soapGateway.js      — Envelopes SOAP, HTTP POST, parseo XML, mojibake fix
└── integration-test.js — Script de humo manual (no corre en npm test)

routes/
└── controltDiag.js     — GET /api/controlt/diag (endpoint de diagnóstico)

utils/
└── mojibake.js         — Función fixMojibake (Fase 1)
```

### Dependencias

| Paquete | Uso |
|---|---|
| `fast-xml-parser` | Parseo de respuestas SOAP XML |
| `pino` | Logging estructurado en auditLogger |

---

## 3. Componentes certificados

### `config.js`
- Lee `CONTROLT_USER` y `CONTROLT_PASS` (variables compartidas con la integración REST).
- Lee `CONTROLT_SOAP_TIMEOUT_MS` (rango 1 000–60 000 ms; default 10 000).
- Endpoint hardcodeado: `https://app.controlt.com.co/WS/service.asmx`.
- Fail-fast: lanza `ConfigError` si alguna credencial está ausente.
- Retorna objeto congelado `{ user, pass, timeoutMs, endpoint, namespace }`.

### `authManager.js`
- `getToken(loginFn)`: devuelve el token en caché o invoca `loginFn` una sola vez aunque lleguen N llamadas concurrentes (promise queue).
- `invalidate()`: descarta el token; la próxima llamada a `getToken` ejecutará un nuevo Login.
- `_resetAuth()`: helper exclusivo para tests.

### `auditLogger.js`
- Basado en Pino; nivel INFO en producción, DEBUG en desarrollo.
- `redactSensitive(obj)`: elimina recursivamente claves `pass`, `password`, `token`, `authToken`, `authenticationToken`, `Authorization`.
- `logOperacion`, `logSoapPayload`, `logAuthEvent`, `logError`.
- `logSoapPayload` es no-op en producción (`NODE_ENV=production` o nivel > DEBUG).

### `soapGateway.js`
- `makeLoginFn(config)` → función `loginFn` para pasar a `authManager.getToken()`.
- `getDetailMonitoringOrder(codigoViaje, config)` → objeto SOAP con mojibake corregido.
- `deepFixMojibake(node)` — exportada; aplica `fixMojibake` recursivamente.
- `_redactXml(xml)` — redacta `<*:password>` y `<*:AuthenticationToken>` en logs de consola.
- Instrumentación temporal de auditoría en `sendSoap()` (`_logReqAudit` / `_logResAudit`): registra por consola la comunicación HTTP completa con credenciales redactadas para diagnóstico en Railway.

---

## 4. Flujo Login → Token → GetDetailMonitoringOrder

```
caller
  │
  ▼
getDetailMonitoringOrder(codigoViaje, config)
  │
  ├─ authManager.getToken(loginFn)
  │     ├─ [token en caché] → retorna inmediatamente
  │     └─ [sin token] → loginFn()
  │             │
  │             ▼
  │         sendSoap(endpoint, 'Login', envelope, timeoutMs)
  │             │  POST https://app.controlt.com.co/WS/service.asmx
  │             │  Content-Type: text/xml; charset=utf-8
  │             │  SOAPAction: "http://controlt.com.co/Login"
  │             ▼
  │         parseXml(xml) → LoginResponse.LoginResult → token UUID
  │
  ├─ buildGetDetailEnvelope(token, user, pass, codigoViaje)
  │
  ├─ sendSoap(endpoint, 'GetDetailMonitoringOrder', envelope, timeoutMs)
  │     │  SOAPAction: "http://controlt.com.co/GetDetailMonitoringOrder"
  │     ▼
  │  parseXml(xml)
  │     ├─ SoapFaultError con "token/session/authen/autoriza" → invalidate() + re-throw
  │     └─ OK → body.GetDetailMonitoringOrderResponse
  │
  └─ deepFixMojibake(responseNode) → retorna al caller
```

---

## 5. Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `CONTROLT_USER` | Sí | Usuario de ControlT (compartida con REST) |
| `CONTROLT_PASS` | Sí | Contraseña de ControlT (compartida con REST). **Nunca en logs.** |
| `CONTROLT_SOAP_TIMEOUT_MS` | No | Timeout en ms (1 000–60 000). Default: 10 000 |
| `INTERNAL_API_KEY` | Sí (endpoint diag) | Header `X-Internal-Api-Key` para acceso al endpoint `/api/controlt/diag` |
| `CONTROLT_DIAG_VIAJE` | No | Código de viaje por defecto para el endpoint de diagnóstico |

---

## 6. Endpoint de diagnóstico

```
GET /api/controlt/diag?viaje=IN018108
Header: X-Internal-Api-Key: <INTERNAL_API_KEY>
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "etapas": {
    "config":    { "ok": true, "endpoint": "...", "timeoutMs": 10000, "usuarioConfigurado": "us***" },
    "login":     { "ok": true, "duracionMs": 412, "tokenObtenido": true },
    "getDetail": { "ok": true, "duracionMs": 830, "codigoViaje": "IN018108", "camposRecibidos": 12 }
  },
  "duracionTotalMs": 1248
}
```

- HTTP 200 siempre (el campo `ok` indica el resultado real).
- HTTP 400 si no se proporciona `?viaje=` ni `CONTROLT_DIAG_VIAJE`.
- No expone: credenciales, tokens UUID, ni datos completos de carga.
- `?reset=1` fuerza un nuevo Login descartando el token en memoria.

---

## 7. Contrato SOAP validado

### Login

```xml
POST https://app.controlt.com.co/WS/service.asmx
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://controlt.com.co/Login"

<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:con="http://controlt.com.co/">
   <soapenv:Header/>
   <soapenv:Body>
      <con:Login>
         <con:username>USUARIO</con:username>
         <con:password>CONTRASEÑA</con:password>
      </con:Login>
   </soapenv:Body>
</soapenv:Envelope>
```

Resultado esperado: `Envelope.Body.LoginResponse.LoginResult` → UUID string.

### GetDetailMonitoringOrder

```xml
POST https://app.controlt.com.co/WS/service.asmx
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://controlt.com.co/GetDetailMonitoringOrder"

<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:con="http://controlt.com.co/">
   <soapenv:Header>
      <con:SecuredToken>
         <con:UserName>USUARIO</con:UserName>
         <con:Password>CONTRASEÑA</con:Password>
         <con:AuthenticationToken>UUID-TOKEN</con:AuthenticationToken>
      </con:SecuredToken>
   </soapenv:Header>
   <soapenv:Body>
      <con:GetDetailMonitoringOrder>
         <con:code_company>57INLOP</con:code_company>
         <con:number_travel_main>IN018108</con:number_travel_main>
      </con:GetDetailMonitoringOrder>
   </soapenv:Body>
</soapenv:Envelope>
```

---

## 8. Problemas encontrados y correcciones aplicadas

Durante la validación en Railway se detectaron 8 desviaciones respecto al contrato validado con SoapUI:

| # | Problema | Corrección |
|---|---|---|
| 1 | Login tenía `<SecuredToken>` en el header (con token vacío) | Header cambiado a `<soapenv:Header/>` vacío — Login no lleva header |
| 2 | Login usaba `<ns:user>` | Corregido a `<con:username>` (nombre exacto del campo) |
| 3 | GetDetail usaba `<ns:user>` | Corregido a `<con:UserName>` (capitalización correcta) |
| 4 | GetDetail usaba `<ns:password>` | Corregido a `<con:Password>` (capitalización correcta) |
| 5 | Faltaba el campo `<con:code_company>57INLOP</con:code_company>` | Añadido como campo requerido en el body |
| 6 | Orden incorrecto en SecuredToken | Orden correcto: `UserName`, `Password`, `AuthenticationToken` |
| 7 | Prefijo de namespace `soap:` en lugar de `soapenv:` | Corregido globalmente |
| 8 | Prefijo de namespace `ns:` en lugar de `con:` | Corregido globalmente |

Todas las correcciones están en el commit `298d465`.

---

## 9. Resultados de la validación final

Validado en Railway con credenciales de producción mediante `GET /api/controlt/diag?viaje=<viaje_real>`:

| Etapa | Resultado |
|---|---|
| Configuración de módulo | ✅ OK |
| Autenticación SOAP (Login) | ✅ OK — `AuthenticationToken` recibido |
| GetDetailMonitoringOrder | ✅ OK — datos de viaje recibidos |
| Corrección de mojibake | ✅ OK — sin caracteres `Ã` en la respuesta |
| Endpoint HTTPS | ✅ OK — `https://app.controlt.com.co/WS/service.asmx` |
| Endpoint de diagnóstico | ✅ OK — accesible con `X-Internal-Api-Key` |

Suite de tests unitarios: **76/76 pasando** (Node 22 built-in runner).

---

## 10. Estado

✅ **FASE 2 CERTIFICADA**

El módulo SOAP de ControlT está listo para ser consumido por la Fase 3 (TripMapper + PersistenceLayer). El contrato SOAP queda congelado — ninguna modificación a los envelopes de Login o GetDetailMonitoringOrder debe realizarse sin una nueva certificación.

**Próxima fase:** Fase 3 — Mapeo del modelo de dominio y persistencia en Supabase (`controlt_viajes`).

**Acción manual pendiente:** Ejecutar `supabase/migrations/20260801000000_controlt_viajes.sql` en Supabase (staging primero, luego producción) antes del deploy de Fase 4.
