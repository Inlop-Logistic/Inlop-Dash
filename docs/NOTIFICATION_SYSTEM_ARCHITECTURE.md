# NOTIFICATION SYSTEM ARCHITECTURE

## Ecosistema INLOP — Framework de Notificaciones Empresarial

**Versión:** 1.0  
**Estado:** Propuesta Arquitectónica  
**Autor:** Arquitectura de Producto  
**Fecha:** 2026-07-19  
**Alcance:** Inlop-Dash (Backend), App Cliente (Frontend), ERP Platform, Torre de Control  

---

## ÍNDICE

- [Fase 0 — Auditoría del Sistema Actual](#fase-0--auditoría-del-sistema-actual)
- [Fase 1 — Inventario de Eventos de Negocio](#fase-1--inventario-de-eventos-de-negocio)
- [Fase 2 — Matriz de Audiencias](#fase-2--matriz-de-audiencias)
- [Fase 3 — Modelo de Contenido](#fase-3--modelo-de-contenido)
- [Fase 4 — Arquitectura de Contenido](#fase-4--arquitectura-de-contenido)
- [Fase 5 — Estrategia de Canales](#fase-5--estrategia-de-canales)
- [Fase 6 — Reglas de UX](#fase-6--reglas-de-ux)
- [Fase 7 — Escalabilidad](#fase-7--escalabilidad)
- [Fase 8 — Gobernanza](#fase-8--gobernanza)
- [Fase 9 — Roadmap de Evolución](#fase-9--roadmap-de-evolución)

---

## Fase 0 — Auditoría del Sistema Actual

### 0.1 Topología General

El sistema de notificaciones actual opera sobre una arquitectura de tres capas parcialmente conectadas:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE ORIGEN                                │
│                                                                     │
│  syncSolicitudes (polling 65s)     POST /servicios (manual)         │
│  syncCumplidos (polling)           PATCH /solicitudes/:id/estado     │
│        │                                    │                       │
│        └──── Estado Machine ────────────────┘                       │
│                    │                                                │
│           publishBusinessEvent()                                    │
└────────────────────┼────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│                   CAPA DE ORQUESTACIÓN                               │
│                                                                     │
│  Notification Orchestrator (services/notificationOrchestrator.js)   │
│      │                                                              │
│      ├─ Idempotencia (business_events.idempotency_key)              │
│      ├─ Resolución de canales (EVENT_CHANNELS — estático)           │
│      ├─ Template stub (_renderTemplate — passthrough)               │
│      ├─ Encolamiento (notification_deliveries — Supabase)           │
│      │                                                              │
│      └─ Channel Workers                                             │
│           ├─ pushChannel.js  → web-push (VAPID)                     │
│           └─ emailChannel.js → Resend SDK                           │
│                 └─ recipientResolver.js (EMAIL_AUDIENCES)           │
│                 └─ templates.js (renderTemplate)                    │
└─────────────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│                   CAPA DE ENTREGA                                    │
│                                                                     │
│  Push: navegador del usuario (ServiceWorker)                        │
│  Email: bandeja del destinatario (Resend → SMTP)                    │
│  In-App (Portal Cliente):                                           │
│      notificaciones_cliente → Supabase Realtime                     │
│      → NotificationBridge → NotificationProvider → UI               │
│                                                                     │
│  In-App (ERP): ❌ NO CONECTADO (TopbarNotifications recibe [])      │
│  In-App (Torre de Control): ❌ NO EXISTE                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 0.2 Componentes Auditados

#### A. Notification Orchestrator (`services/notificationOrchestrator.js`)

**Fortalezas:**
- Patrón fire-and-forget garantizado (nunca bloquea lógica de negocio)
- Idempotencia nativa por `idempotency_key` (consulta antes de insertar)
- DI pattern limpio (deps = {sbFetch, sbAuthAdmin})
- Channel Registry extensible (agregar canal = agregar entrada en objeto)
- Promise.allSettled para envío paralelo por canal sin fallo cruzado

**Limitaciones identificadas:**
- EVENT_CHANNELS es estático en código — no consultable, no configurable por empresa
- _renderTemplate es un passthrough (devuelve event.titulo / event.mensaje sin transformación)
- No hay retry/backoff: un delivery fallido queda en estado 'pending' sin reintento
- No hay dead-letter queue ni alertas por fallo acumulado
- No hay rate limiting ni throttling
- No hay priorización efectiva (el campo `prioridad` se persiste pero no influye en el envío)
- No hay TTL por notificación (una notificación expirada se envía igual)
- La marca `procesado=true` ocurre después del envío — si el proceso muere entre envío y marca, el reintento es correcto (idempotencia), pero el delivery puede duplicarse en el canal externo

#### B. Push Channel (`services/channels/pushChannel.js`)

**Fortalezas:**
- Configuración VAPID correcta con degradación segura (PUSH_CONFIGURADO guard)
- Desactivación automática de suscripciones expiradas (404/410)
- Actualiza delivery a 'sent' en éxito, 'failed' en error

**Limitaciones:**
- No distingue entre fallo temporal (red) y permanente (suscripción inválida) más allá de 404/410
- No agrupa envíos por usuario (si un usuario tiene N suscripciones, genera N deliveries independientes)
- No hay payload structurado por tipo de notificación (usa pushPayload genérico del evento)

#### C. Email Channel (`services/channels/emailChannel.js`)

**Fortalezas:**
- Lazy Client pattern (Resend SDK construido al primer uso)
- Guard EMAIL_CONFIGURADO evita crashes por configuración faltante
- Delegación limpia a recipientResolver para resolución de audiencia

**Limitaciones:**
- No hay tracking de apertura/click
- No hay unsubscribe header (CAN-SPAM compliance pendiente)
- No hay fallback si Resend falla (sin proveedor secundario)
- El subject y body vienen del template stub — no hay personalización por contexto

#### D. Recipient Resolver (`services/email/recipientResolver.js`)

**Fortalezas:**
- EMAIL_AUDIENCES centraliza quién recibe qué tipo de evento
- Resolución de 'ops' desde variable de entorno (configurable sin deploy)
- Resolución de 'cliente' vía Supabase Auth Admin (email real del usuario)

**Limitaciones:**
- Audiencia 'ops' es una sola dirección de email (no soporta lista de operadores)
- Audiencia 'cliente' trae TODOS los usuarios de Auth (?per_page=1000) y filtra en memoria — no escala
- No existe audiencia 'agencia' (encargados de agencia específica del servicio)
- No existe audiencia 'conductor' (driver asignado al viaje)
- No hay preferencias de usuario (opt-out imposible)
- EMAIL_AUDIENCES no cubre todos los EVENT_CHANNELS (ej. SERVICIO_CANCELADO no tiene audiencia email definida, pero EVENT_CHANNELS tampoco lo envía por email — consistente pero no documentado)

#### E. Template Engine (`services/email/templates.js`)

**Fortalezas:**
- HTML-escape de datos de usuario (previene XSS en email)
- Separación audiencia ops vs cliente en subject

**Limitaciones:**
- No hay plantillas reales — todo es `event.titulo` + `event.mensaje` envuelto en HTML mínimo
- No hay personalización por tipo de evento (SOLICITUD_CREADA luce igual que SERVICIO_COMPLETADO)
- No hay locale/i18n
- No hay branding INLOP (logo, colores, footer legal)
- No hay call-to-action con deep link al servicio
- No hay template versionado ni A/B testing

#### F. Frontend — App Cliente

**Fortalezas:**
- Arquitectura completa de recepción: Supabase Realtime → Bridge → Provider → UI
- Traducción tipada (filaNotificacionClienteToNotificacion)
- Integración con TanStack Query (cache, invalidación)
- Lifecycle tracking best-effort (read_at, actioned_at, delivered_at)
- Acciones ejecutables desde notificación (ejecutarAccion)

**Limitaciones:**
- Depende de Supabase Realtime exclusivamente (sin fallback polling)
- No hay agrupación de notificaciones (N servicios en ruta = N notificaciones separadas)
- No hay filtrado por tipo/prioridad en la UI
- No hay configuración de preferencias (el usuario no puede silenciar tipos)

#### G. Frontend — ERP Platform

**Estado:** Infraestructura UI construida, sin fuente de datos.

- `TopbarNotifications.tsx` implementa dropdown completo con badge, lista, mark-as-read
- `AppNotification` interface define: id, title, body, read, createdAt, source, href
- Actualmente recibe `notifications={[]}` desde AppShell — siempre vacío
- No hay NotificationProvider, no hay Bridge, no hay API de notificaciones para ERP
- No hay Supabase Realtime (ERP no usa Supabase directamente)

#### H. Frontend — Torre de Control

**Estado:** Sin sistema de notificaciones.

- Monolito HTML legacy (`TorreControl.html`)
- Sin framework reactivo, sin WebSocket, sin polling de notificaciones
- Única señalización: indicadores visuales en el mapa (no son notificaciones)

### 0.3 Modelo de Datos Actual

```
business_events
├── id (UUID, PK)
├── tipo (TEXT) — SOLICITUD_CREADA | SERVICIO_CONFIRMADO | SERVICIO_EN_RUTA | SERVICIO_COMPLETADO | SERVICIO_CANCELADO
├── usuario_id (UUID, FK → auth.users)
├── empresa_id (UUID, FK → empresas_cliente)
├── solicitud_id (UUID, FK → solicitudes, nullable)
├── payload (JSONB) — {titulo, mensaje, push_payload}
├── prioridad (TEXT) — HIGH | MEDIUM | LOW
├── idempotency_key (TEXT, UNIQUE)
├── procesado (BOOLEAN)
└── created_at (TIMESTAMPTZ)

notification_deliveries
├── id (UUID, PK)
├── business_event_id (UUID, FK → business_events)
├── canal (TEXT) — push | email | whatsapp
├── estado (TEXT) — pending | sent | failed
├── intentos (INTEGER)
└── created_at (TIMESTAMPTZ)

notificaciones_cliente (App Cliente — Supabase con RLS)
├── id (UUID, PK)
├── usuario_id (UUID, FK → auth.users)
├── tipo (TEXT)
├── titulo (TEXT)
├── mensaje (TEXT)
├── leida (BOOLEAN)
├── metadata (JSONB)
├── solicitud_id (UUID, nullable)
├── delivered_at (TIMESTAMPTZ, nullable)
├── read_at (TIMESTAMPTZ, nullable)
├── actioned_at (TIMESTAMPTZ, nullable)
└── created_at (TIMESTAMPTZ)

push_subscriptions
├── id (UUID, PK)
├── usuario_id (UUID, FK)
├── subscription (JSONB) — web-push subscription object
├── activa (BOOLEAN)
└── created_at (TIMESTAMPTZ)
```

### 0.4 Flujos de Emisión Actuales

**Flujo 1 — Creación de Solicitud (POST /servicios):**
```
Portal Cliente → POST /servicios → insert solicitud → publishBusinessEvent(SOLICITUD_CREADA)
                                                       └→ canal: ['email']
                                                       └→ audiencia: ['ops']
                                                       └→ destinatario: INLOP_OPS_EMAIL
```

**Flujo 2 — Confirmación Automática (syncSolicitudes):**
```
syncSolicitudes (65s poll) → match solicitud↔trip → estado 'confirmado'
  → insert notificaciones_cliente (legacy)
  → publishBusinessEvent(SERVICIO_CONFIRMADO)
    └→ canales: ['push', 'email']
    └→ push: suscripciones del usuario_id
    └→ email audiencia: ['cliente', 'ops']
```

**Flujo 3 — En Ruta (syncSolicitudes):**
```
syncSolicitudes → trip con GPS activo → estado 'en_ruta'
  → insert notificaciones_cliente (legacy)
  → publishBusinessEvent(SERVICIO_EN_RUTA)
    └→ canal: ['push']
    └→ push: suscripciones del usuario_id
```

**Flujo 4 — Completado (syncCumplidos):**
```
syncCumplidos → trip finalizado → estado 'completado'
  → insert notificaciones_cliente (legacy)
  → publishBusinessEvent(SERVICIO_COMPLETADO)
    └→ canales: ['push', 'email']
    └→ push + email
```

**Flujo 5 — Cancelado (PATCH /solicitudes/:id/estado):**
```
ERP/TC → PATCH estado='cancelado'
  → insert notificaciones_cliente
  → publishBusinessEvent(SERVICIO_CANCELADO)
    └→ canal: ['push']
```

### 0.5 Defectos Estructurales Identificados

| # | Severidad | Hallazgo | Evidencia |
|---|-----------|----------|-----------|
| 1 | 🔴 Crítico | **Dualidad de sistemas**: `notificaciones_cliente` (legacy, insert directo en syncSolicitudes) coexiste con `business_events` + `notification_deliveries` (Orchestrator). Ambos se ejecutan en paralelo para el mismo evento, sin coordinación. | index.js:1303 `_notifs()` + index.js:1234 `publishBusinessEvent()` |
| 2 | 🔴 Crítico | **ERP sin notificaciones**: TopbarNotifications es UI muerta — recibe array vacío. Los operadores INLOP no tienen visibilidad en tiempo real de eventos. | TopbarNotifications.tsx recibe `notifications={[]}` |
| 3 | 🟠 Alto | **Recipient resolver no escala**: audiencia 'cliente' hace `GET /admin/users?per_page=1000` y filtra en memoria por empresa_id. Con 100+ empresas activas, esto consulta TODOS los usuarios del sistema por cada email. | recipientResolver.js resolveCliente() |
| 4 | 🟠 Alto | **Sin retry**: notification_deliveries con estado 'failed' no se reintentan. No hay proceso de reconciliación. | Orchestrator no tiene scheduler de retry |
| 5 | 🟠 Alto | **Sin preferencias**: un usuario no puede opt-out de ningún canal ni tipo de notificación. No hay tabla `notification_preferences`. | EVENT_CHANNELS es hardcoded |
| 6 | 🟡 Medio | **Template sin identidad**: emails son texto plano envuelto en HTML mínimo sin branding, sin CTA, sin contexto estructurado del servicio. | templates.js renderTemplate() |
| 7 | 🟡 Medio | **Sin observabilidad**: no hay métricas de entrega (tasa de éxito/fallo por canal, latencia, bounce rate). Los logs son la única señal. | No hay instrumentación de métricas |
| 8 | 🟡 Medio | **Prioridad decorativa**: el campo `prioridad` se guarda pero no afecta orden de envío, throttling, ni comportamiento de canal. | Orchestrator ignora `prioridad` después de persistir |
| 9 | 🟡 Medio | **Tag parsing bug**: `tag.split('-')` para derivar tipo de evento produce resultados incorrectos para estados con guion bajo (`en_ruta` → `'en'`). | index.js:1238 |
| 10 | 🟢 Bajo | **Torre de Control aislada**: sin capacidad de recibir alertas en tiempo real (sin WebSocket, sin polling, sin push). | TorreControl.html — monolito HTML estático |

### 0.6 Fortalezas a Preservar

1. **Patrón fire-and-forget**: la lógica de notificación nunca bloquea ni puede fallar la operación de negocio que la origina. Esta garantía es arquitectónica y no debe relajarse.

2. **Idempotencia nativa**: el `idempotency_key` previene duplicados en reprocessing. El patrón consulta-antes-de-insertar es correcto y debe mantenerse.

3. **DI pattern**: la inyección de `sbFetch`/`sbAuthAdmin` permite testear cada módulo aisladamente y evita acoplamientos globales.

4. **Channel Registry**: agregar un canal nuevo es agregar una entrada al registro + implementar la interfaz `send(delivery, renderedEvent, deps)`.

5. **Separación Bridge/Provider en App Cliente**: la capa de recepción está bien diseñada con traducción tipada y integración TanStack Query.

6. **Supabase Realtime para in-app**: el mecanismo de postgres_changes sobre `notificaciones_cliente` es eficiente para entrega en tiempo real al Portal Cliente.

---

## Fase 1 — Inventario de Eventos de Negocio

### 1.1 Eventos Implementados (Sprint 5.0–5.1)

| Evento | Origen | Trigger | Datos Disponibles |
|--------|--------|---------|-------------------|
| `SOLICITUD_CREADA` | POST /servicios | Creación manual desde Portal Cliente | usuario_id, empresa_id, solicitud_id, tipo_vehiculo, origen, destino, fecha_requerida |
| `SERVICIO_CONFIRMADO` | syncSolicitudes | Match solicitud↔trip en ControlT | usuario_id, empresa_id, solicitud_id, conductor, vehículo, trip_number |
| `SERVICIO_EN_RUTA` | syncSolicitudes | Trip con GPS activo (ControlT) | usuario_id, empresa_id, solicitud_id, posición GPS, ETA |
| `SERVICIO_COMPLETADO` | syncCumplidos | Trip finalizado en ControlT | usuario_id, empresa_id, solicitud_id, fecha_fin, distancia |
| `SERVICIO_CANCELADO` | PATCH /solicitudes/:id/estado | Acción manual ERP/TC | usuario_id, empresa_id, solicitud_id, notas cancelación |

### 1.2 Eventos No Implementados (Identificados en Código)

| Evento Potencial | Origen Identificado | Justificación |
|------------------|--------------------|----|
| `SERVICIO_ASIGNADO` | syncSolicitudes (match sin cambio de estado visible) | Hoy se fusiona con CONFIRMADO — pero asignación de conductor es distinta de confirmación logística |
| `CONDUCTOR_CAMBIO` | Reasignación en ControlT | No hay detección de cambio de conductor entre syncs |
| `ALARMA_VEHICULO` | syncAlarmas (ControlT Alarm API) | Alertas de exceso de velocidad, parada prolongada, desvío de ruta — se almacenan pero no notifican |
| `VIAJE_PROGRAMADO` | syncPendientes / syncPlaneados | Viaje futuro programado — relevante para planificación de agencia |
| `DOCUMENTO_GENERADO` | (futuro) | Remesa, factura, POD disponible |
| `SLA_EN_RIESGO` | (futuro) | Cálculo de tiempo restante vs ETA — alerta proactiva |
| `RETRASO_DETECTADO` | (futuro) | Comparación fecha_requerida vs progreso real |

### 1.3 Taxonomía Propuesta de Eventos

Organización por dominio y ciclo de vida:

```
DOMINIO: SOLICITUDES
├── SOLICITUD_CREADA          (inicio del ciclo)
├── SOLICITUD_MODIFICADA      (cambio de datos antes de asignación)
└── SOLICITUD_CANCELADA       (cancelación pre-asignación)

DOMINIO: SERVICIOS
├── SERVICIO_ASIGNADO         (conductor/vehículo asignado)
├── SERVICIO_CONFIRMADO       (confirmación logística)
├── SERVICIO_EN_RUTA          (inicio de movimiento)
├── SERVICIO_COMPLETADO       (entrega confirmada)
├── SERVICIO_CANCELADO        (cancelación post-asignación)
└── SERVICIO_REASIGNADO       (cambio de conductor/vehículo)

DOMINIO: OPERACIONES
├── ALARMA_VELOCIDAD          (exceso de velocidad)
├── ALARMA_PARADA             (parada no programada prolongada)
├── ALARMA_DESVIO             (fuera de ruta esperada)
├── RETRASO_DETECTADO         (ETA > fecha_requerida)
└── SLA_EN_RIESGO             (umbral de cumplimiento comprometido)

DOMINIO: DOCUMENTOS
├── DOCUMENTO_DISPONIBLE      (remesa, factura, POD)
└── FIRMA_REQUERIDA           (documento pendiente de firma)

DOMINIO: SISTEMA
├── MANTENIMIENTO_PROGRAMADO  (ventana de downtime)
├── INTEGRACION_FALLO         (ControlT desconectado)
└── SYNC_RECUPERADO           (reconexión tras fallo)
```

### 1.4 Estructura Canónica del BusinessEvent

Basado en la estructura actual (`business_events` table) con extensiones propuestas:

```
BusinessEvent {
  id:               UUID (generado por Supabase)
  tipo:             string (de la taxonomía §1.3)
  dominio:          string (SOLICITUDES | SERVICIOS | OPERACIONES | DOCUMENTOS | SISTEMA)
  usuario_id:       UUID (destinatario primario — puede ser null para eventos de sistema)
  empresa_id:       UUID (scope de empresa)
  agencia_id:       UUID (scope de agencia — hoy ausente, necesario para routing)
  solicitud_id:     UUID (nullable — referencia al objeto de negocio)
  payload:          JSONB (datos estructurados del evento — ver §3)
  prioridad:        enum (CRITICAL | HIGH | MEDIUM | LOW)
  ttl_minutes:      integer (nullable — expiración de relevancia)
  idempotency_key:  string (UNIQUE — previene duplicados)
  procesado:        boolean
  created_at:       timestamptz
}
```

**Campos nuevos propuestos vs. estado actual:**
- `dominio`: permite filtrado y routing por área funcional
- `agencia_id`: necesario para resolver audiencia de encargados de agencia
- `ttl_minutes`: permite descartar notificaciones que perdieron relevancia antes de entregarse

---

## Fase 2 — Matriz de Audiencias

### 2.1 Roles del Ecosistema INLOP

| Rol | Producto | Scope | Descripción |
|-----|----------|-------|-------------|
| `admin_cliente` | App Cliente | Toda la empresa (todas agencias) | Administrador del cliente — visibilidad total |
| `encargado` | App Cliente | Agencias asignadas (usuario_agencias) | Encargado de agencia — ve solo sus agencias |
| `operador_inlop` | ERP | Cross-empresa | Operador logístico INLOP — gestiona servicios |
| `admin_inlop` | ERP | Cross-empresa | Administrador INLOP — configuración y gestión |
| `despachador` | Torre de Control | Cross-empresa (en tiempo real) | Monitoreo de flota y despacho |
| `conductor` | Driver Platform | Sus viajes asignados | Conductor de vehículo |

### 2.2 Matriz Evento × Audiencia

| Evento | admin_cliente | encargado | operador_inlop | admin_inlop | despachador | conductor |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| SOLICITUD_CREADA | — | — | ✅ Email | ✅ Email | — | — |
| SERVICIO_ASIGNADO | ✅ Push+Email | ✅ Push+Email | — | — | — | ✅ Push |
| SERVICIO_CONFIRMADO | ✅ Push+Email | ✅ Push+Email | ✅ In-App | — | — | — |
| SERVICIO_EN_RUTA | ✅ Push | ✅ Push | ✅ In-App | — | ✅ In-App | — |
| SERVICIO_COMPLETADO | ✅ Push+Email | ✅ Push+Email | ✅ In-App+Email | — | — | — |
| SERVICIO_CANCELADO | ✅ Push | ✅ Push | ✅ In-App | — | ✅ In-App | — |
| ALARMA_VELOCIDAD | — | — | ✅ In-App | — | ✅ Push+In-App | — |
| ALARMA_PARADA | — | — | ✅ In-App | — | ✅ Push+In-App | — |
| ALARMA_DESVIO | — | — | ✅ In-App | — | ✅ Push+In-App | — |
| RETRASO_DETECTADO | ✅ Push+Email | ✅ Push | ✅ In-App | — | ✅ In-App | — |
| SLA_EN_RIESGO | ✅ Email | — | ✅ In-App+Email | ✅ Email | ✅ Push | — |
| DOCUMENTO_DISPONIBLE | ✅ Push+Email | ✅ Push | — | — | — | — |

### 2.3 Reglas de Resolución de Audiencia

**Principio:** La resolución de audiencia opera en dos niveles — quién debería recibir (determinado por el evento + reglas de negocio) y por qué canal (determinado por preferencias del usuario + capacidades del producto).

**Resolución por nivel:**

1. **Nivel Empresa** — ¿Qué empresa está involucrada?
   - Extraído directamente del BusinessEvent.empresa_id
   - Determina el pool de usuarios candidatos

2. **Nivel Agencia** — ¿Qué agencia específica?
   - Extraído del BusinessEvent.agencia_id (propuesto)
   - Hoy: ausente en business_events, disponible vía solicitud → agencia_id
   - Filtra encargados a solo los de esa agencia (via usuario_agencias)

3. **Nivel Rol** — ¿Qué roles reciben este tipo de evento?
   - Determinado por la Matriz §2.2
   - Implementación actual: hardcoded en EMAIL_AUDIENCES → evolucionar a tabla configurable

4. **Nivel Usuario** — ¿El usuario individual ha optado out?
   - Hoy: no existe
   - Propuesto: consulta a `notification_preferences` (§2.4)

### 2.4 Modelo de Preferencias (Propuesto)

```
notification_preferences {
  id:           UUID (PK)
  usuario_id:   UUID (FK → auth.users)
  evento_tipo:  string (o '*' para todos)
  canal:        string (push | email | in_app | *)
  habilitado:   boolean
  created_at:   timestamptz
  updated_at:   timestamptz
}
```

**Reglas de resolución de preferencia:**
- Default: todo habilitado (opt-out model, no opt-in)
- Precedencia: preferencia específica (evento+canal) > preferencia de canal (*+canal) > preferencia de evento (evento+*) > default (true)
- Eventos con prioridad CRITICAL ignoran preferencias de usuario (nunca se pueden silenciar)
- Canales obligatorios por compliance (ej. email de cancelación) se marcan como `override: true` en la configuración del evento

### 2.5 Gap Analysis — Audiencia Actual vs. Requerida

| Audiencia | Estado Actual | Gap |
|-----------|--------------|-----|
| ops (operador INLOP) | ✅ Implementado (INLOP_OPS_EMAIL env var) | Solo soporta 1 dirección; no distingue entre operadores |
| cliente (admin_cliente) | ⚠️ Parcial (GoTrue full-scan) | No filtra por agencia; no escala |
| encargado (por agencia) | ❌ No existe | Requiere join solicitud→agencia→usuario_agencias |
| despachador | ❌ No existe | Requiere integración Torre de Control |
| conductor | ❌ No existe | Requiere integración Driver Platform |
| admin_inlop | ❌ No existe | Requiere definición de rol en sistema ERP |

---

## Fase 3 — Modelo de Contenido

### 3.1 Estado Actual del Contenido

El contenido de notificaciones hoy se genera en el punto de emisión (syncSolicitudes, POST /servicios) como strings planos:

```
{
  titulo: "Solicitud Creada",
  mensaje: "Tu solicitud SOL-XXXX ha sido creada exitosamente",
  pushPayload: { /* raw web-push payload */ }
}
```

**Problemas:**
- El contenido se decide en el origen, no en la entrega — impide personalización por canal/audiencia
- No hay datos estructurados del dominio (solo strings pre-formateados)
- No hay soporte para locale/idioma
- No hay soporte para personalización (nombre del usuario, nombre de la agencia)
- Push y email reciben el mismo texto — desaprovechan capacidades de cada canal

### 3.2 Modelo de Contenido Propuesto

Separación de concerns en tres capas:

```
┌─────────────────────────────────────────────┐
│         CAPA 1: DATOS DEL EVENTO            │
│  (Payload estructurado — fuente de verdad)  │
│                                             │
│  {                                          │
│    solicitud_codigo: "SOL-00234",           │
│    empresa_nombre: "CONQUERS SAS",          │
│    agencia_nombre: "Sede Barranquilla",     │
│    vehiculo_placa: "ABC-123",              │
│    conductor_nombre: "Juan Pérez",          │
│    origen: "Barranquilla",                  │
│    destino: "Cartagena",                    │
│    fecha_requerida: "2026-07-20",           │
│    estado_anterior: "pendiente",            │
│    estado_nuevo: "confirmado"               │
│  }                                          │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│       CAPA 2: PLANTILLA POR CANAL           │
│  (Template engine — transforma datos → UX)  │
│                                             │
│  push_template(datos) → {                   │
│    title: "Servicio Confirmado ✓",          │
│    body: "SOL-00234 · Placa ABC-123",       │
│    icon: "/icons/confirmado.png",           │
│    actions: [{action:"ver", title:"Ver"}]   │
│  }                                          │
│                                             │
│  email_template(datos) → {                  │
│    subject: "Confirmación: SOL-00234",      │
│    html: "<branded email con detalles>",    │
│    text: "Versión plain text"               │
│  }                                          │
│                                             │
│  inapp_template(datos) → {                  │
│    titulo: "Servicio Confirmado",           │
│    mensaje: "SOL-00234 asignado...",        │
│    icono: "truck-check",                    │
│    accion: {tipo:"navegar", ruta:"/s/234"}  │
│  }                                          │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│       CAPA 3: PERSONALIZACIÓN               │
│  (Contexto del destinatario)                │
│                                             │
│  - Nombre del usuario                       │
│  - Timezone (formateo de fechas)            │
│  - Idioma (locale) — futuro                 │
│  - Preferencia de densidad (detallado/breve)│
└─────────────────────────────────────────────┘
```

### 3.3 Payload Estructurado por Tipo de Evento

| Evento | Campos Requeridos en Payload | Campos Opcionales |
|--------|------------------------------|-------------------|
| SOLICITUD_CREADA | solicitud_codigo, empresa_nombre, agencia_nombre, tipo_vehiculo, origen, destino, fecha_requerida | solicitante_nombre, notas |
| SERVICIO_CONFIRMADO | solicitud_codigo, conductor_nombre, vehiculo_placa, vehiculo_tipo | conductor_telefono, ETA |
| SERVICIO_EN_RUTA | solicitud_codigo, vehiculo_placa, posicion_actual | ETA_destino, distancia_restante |
| SERVICIO_COMPLETADO | solicitud_codigo, fecha_completado, distancia_km | firma_url, pod_url |
| SERVICIO_CANCELADO | solicitud_codigo, motivo_cancelacion, cancelado_por | notas |
| ALARMA_VELOCIDAD | vehiculo_placa, conductor_nombre, velocidad_actual, velocidad_limite, ubicacion | trip_number |
| RETRASO_DETECTADO | solicitud_codigo, fecha_requerida, ETA_actual, retraso_estimado_min | causa_probable |

### 3.4 Evolución del Template Engine

**Sprint actual (stub):**
```
_renderTemplate(event, canal) → { titulo, mensaje, pushPayload }
```

**Propuesta de interfaz evolucionada:**
```
renderNotification(tipo, canal, audiencia, payload, contexto) → ChannelContent
```

Donde:
- `tipo`: tipo del evento (taxonomía §1.3)
- `canal`: push | email | in_app
- `audiencia`: ops | cliente | encargado | despachador | conductor
- `payload`: datos estructurados (§3.3)
- `contexto`: {nombre_usuario, timezone, locale}

**Almacenamiento de templates:**
- Fase inmediata: templates en código (archivos `.js` por tipo+canal)
- Fase siguiente: templates en base de datos (`notification_templates` table) para edición sin deploy
- Fase futura: editor visual de templates para equipo de operaciones

---

## Fase 4 — Arquitectura de Contenido

### 4.1 Jerarquía de Información por Canal

#### Push (Web Push / Mobile Push)

Restricciones del medio:
- Title: máx ~50 caracteres visibles
- Body: máx ~120 caracteres visibles (varía por OS/navegador)
- Acción primaria implícita (click abre la app)
- Máximo 2 acciones adicionales (botones)

Jerarquía:
1. **Qué pasó** (title): verbo + objeto ("Servicio Confirmado", "En Ruta")
2. **Identificador** (body): código de solicitud + dato clave ("SOL-234 · Placa ABC-123")
3. **Acción** (click): navegar al detalle del servicio

#### Email

Restricciones del medio:
- Subject: máx ~60 caracteres (preview en inbox)
- Preheader: ~100 caracteres (complementa subject sin repetir)
- Body: sin límite práctico — pero atención decae después de 3 párrafos
- CTA: máximo 2 botones prominentes

Jerarquía:
1. **Subject**: estado + identificador ("Confirmado: SOL-00234 → Cartagena")
2. **Header visual**: logo INLOP + estado con color semántico
3. **Resumen**: una oración con la acción principal que ocurrió
4. **Detalle**: tabla con datos del servicio (origen, destino, conductor, placa, fecha)
5. **CTA primario**: "Ver Servicio" (deep link al Portal Cliente)
6. **Footer**: legal, unsubscribe, contacto soporte

#### In-App (Notification Center)

Restricciones del medio:
- Espacio: card compacta en dropdown (Topbar)
- Interacción: click → navegación; swipe → archivar
- Persistencia: visible hasta leída/archivada
- Agrupación posible (N notificaciones del mismo tipo)

Jerarquía:
1. **Icono semántico**: estado del servicio (color + ícono)
2. **Título**: acción que ocurrió ("Servicio en ruta")
3. **Descripción**: código + dato contextual ("SOL-234 salió de Barranquilla")
4. **Timestamp**: relativo ("hace 5 min") o absoluto si > 24h
5. **Acción**: click navega al detalle

### 4.2 Reglas de Contenido por Audiencia

| Audiencia | Tono | Nivel de Detalle | Datos Sensibles |
|-----------|------|-----------------|-----------------|
| cliente (admin/encargado) | Informativo, profesional | Alto — incluye conductor, placa, tiempos | No mostrar costos internos INLOP |
| operador_inlop | Operativo, conciso | Máximo — toda la información disponible | Acceso completo |
| despachador | Alertivo, priorizado | Mínimo esencial + ubicación | Solo datos operativos en tiempo real |
| conductor | Directivo, simple | Solo lo que necesita saber para actuar | No mostrar datos del cliente |

### 4.3 Internacionalización (i18n)

**Estado actual:** Todo en español. Sin framework de i18n.

**Decisión arquitectónica:** El contenido de notificaciones se genera en el backend. El locale se determina por:
1. Preferencia explícita del usuario (campo en perfil — no existe hoy)
2. Configuración de la empresa (campo en empresas_cliente — no existe hoy)
3. Default: `es-CO`

**Implicación:** Los templates deben parametrizar todo texto visible. Los datos del dominio (nombres de ciudad, tipos de vehículo) no se traducen — son datos propios del negocio colombiano.

**Estrategia de implementación:** Postergar i18n formal hasta que exista demanda de cliente no-hispanohablante. Preparar la arquitectura (templates parametrizados) sin implementar el multiidioma.

---

## Fase 5 — Estrategia de Canales

### 5.1 Canales Activos

| Canal | Tecnología | Estado | Latencia | Costo |
|-------|-----------|--------|----------|-------|
| Push (Web) | web-push (VAPID) | ✅ Producción | < 2s | Gratis |
| Email | Resend SDK | ✅ Producción (debugging) | 5-30s | $0.001/email |
| In-App (Portal Cliente) | Supabase Realtime | ✅ Producción | < 1s | Incluido en plan |

### 5.2 Canales Planificados

| Canal | Tecnología Propuesta | Prioridad | Prerequisitos |
|-------|---------------------|-----------|---------------|
| In-App (ERP) | SSE o WebSocket desde backend propio | Alta | Definir API de notificaciones ERP |
| In-App (Torre Control) | WebSocket (misma infra que ERP) | Alta | Modernizar TC o crear API compatible |
| Push (Mobile) | Firebase Cloud Messaging | Media | App móvil (fuera de scope actual) |
| WhatsApp | WhatsApp Business API (360dialog / Meta) | Media | Aprobación de templates por Meta, opt-in explícito |
| SMS | Twilio / AWS SNS | Baja | Solo para CRITICAL cuando otros canales fallan |

### 5.3 Selección de Canal por Evento

La selección de canal no es solo "qué canales están configurados" — es una decisión de producto basada en:

1. **Urgencia del evento**: ¿Requiere acción inmediata?
2. **Riqueza de contenido**: ¿El mensaje necesita datos estructurados o basta una línea?
3. **Persistencia requerida**: ¿El usuario necesita referenciarlo después?
4. **Contexto del usuario**: ¿Está probablemente frente a la pantalla?

**Modelo de decisión:**

```
CRITICAL (requiere acción inmediata):
  → Push + Email + In-App (todos los canales disponibles)
  Ejemplos: ALARMA_VELOCIDAD, SLA_EN_RIESGO

HIGH (importante, acción esperada):
  → Push + In-App; Email si tiene datos estructurados
  Ejemplos: SERVICIO_CONFIRMADO, SERVICIO_COMPLETADO

MEDIUM (informativo, sin acción urgente):
  → In-App; Push si el usuario no está conectado
  Ejemplos: SERVICIO_EN_RUTA, SOLICITUD_CREADA (para ops)

LOW (registro, referencia futura):
  → In-App solamente
  Ejemplos: DOCUMENTO_DISPONIBLE, MANTENIMIENTO_PROGRAMADO
```

### 5.4 Fallback y Escalación

Cuando un canal falla, el sistema debe escalar al siguiente:

```
Intento 1: Canal primario (según §5.3)
  ↓ fallo
Intento 2: Retry del mismo canal (backoff exponencial: 30s, 2min, 10min)
  ↓ 3 fallos
Escalación: Canal secundario (push falla → email; email falla → in-app persiste)
  ↓ todos fallan
Dead Letter: Registro en dead_letter_queue + alerta a admin_inlop
```

**Estado actual:** No hay retry ni escalación. Un fallo es silencioso y permanente.

### 5.5 Capacidad de Canal por Producto

| Producto | Push | Email | In-App | WhatsApp | SMS |
|----------|:----:|:-----:|:------:|:--------:|:---:|
| App Cliente (Web) | ✅ | ✅ | ✅ | Futuro | — |
| App Cliente (Móvil) | Futuro (FCM) | ✅ | ✅ | Futuro | Futuro |
| ERP Platform | — | ✅ | Propuesto | — | — |
| Torre de Control | — | — | Propuesto | — | — |
| Driver Platform | Futuro (FCM) | — | Futuro | Futuro | — |

---

## Fase 6 — Reglas de UX

### 6.1 Principios de Notificación

1. **Relevancia sobre volumen**: Una notificación que no requiere acción o atención no debería existir.
2. **Contexto sobre contenido**: El usuario debe entender qué pasó y qué hacer sin abrir la notificación.
3. **Respeto por la atención**: Notificaciones repetitivas sobre el mismo tema se agrupan, no se multiplican.
4. **Acción inmediata**: Toda notificación con acción posible debe ofrecer el camino más corto hacia esa acción.
5. **Degradación graceful**: Si un canal falla, el usuario no pierde la información — otro canal la entrega.

### 6.2 Reglas de Supresión

| Regla | Descripción | Ejemplo |
|-------|-------------|---------|
| **Deduplicación temporal** | No enviar la misma notificación dos veces en ventana de 5 minutos | syncSolicitudes procesa el mismo match dos veces seguidas |
| **Agrupación por objeto** | Múltiples eventos sobre la misma solicitud en < 30 min se agrupan | confirmado + en_ruta en rápida sucesión → "SOL-234: confirmado y en ruta" |
| **Silencio por presencia** | Si el usuario está viendo el detalle del servicio, no enviar push de ese servicio | Detectar presencia vía Realtime (canal presence de Supabase) |
| **Horario laboral** | Notificaciones no-CRITICAL se retienen fuera de horario laboral (7am-8pm) y se entregan al inicio del siguiente día | Push a las 11pm → se entrega a las 7am |
| **Rate limit por usuario** | Máximo 20 push / hora por usuario | Escenario de alta actividad (10+ servicios simultáneos) |

### 6.3 Notification Center — UX del Portal Cliente

**Estado actual:** Lista cronológica con badge de no leídas. Funcional pero básica.

**Evolución propuesta:**

```
┌─────────────────────────────────────────┐
│ 🔔 Notificaciones              3 nuevas │
├─────────────────────────────────────────┤
│ [Hoy]                                   │
│                                         │
│ 🟢 Servicio Completado     hace 12 min  │
│    SOL-00234 · Entregado en Cartagena   │
│    [Ver Servicio]                        │
│                                         │
│ 🔵 En Ruta                  hace 45 min  │
│    SOL-00234 · Placa ABC-123            │
│    [Seguir en Mapa]                      │
│                                         │
│ ─────────────────────────────────────── │
│ [Ayer]                                  │
│                                         │
│ ✅ Servicio Confirmado     19 Jul 14:30  │
│    SOL-00234 · Conductor: J. Pérez      │
│    [Ver Detalles]                        │
│                                         │
├─────────────────────────────────────────┤
│ Marcar todas como leídas    Configurar  │
└─────────────────────────────────────────┘
```

**Requisitos UX:**
- Agrupación por día (hoy, ayer, esta semana, anteriores)
- Color semántico por estado (success/info/warning/error según statusConfig.ts)
- Acción primaria visible sin expandir
- Badge en Topbar muestra count de no leídas (existente)
- Empty state: ilustración + "Todo al día" (existente)
- Filtro por tipo: Todos | Servicios | Alertas | Sistema

### 6.4 Notification Center — UX del ERP

**Estado actual:** Shell vacío (TopbarNotifications).

**Propuesta:**

El ERP tiene necesidades distintas al Portal Cliente:
- Volumen alto (N empresas × M servicios)
- Foco en acción operativa, no en seguimiento
- Necesita filtro por empresa/prioridad
- Notificaciones como "tareas pendientes", no como "actualizaciones"

```
┌─────────────────────────────────────────┐
│ 🔔 Centro de Notificaciones    12 → 5  │
├─────────────────────────────────────────┤
│ [Filtros: Todas | ⚡Alta | 🏢Empresa ▾]│
├─────────────────────────────────────────┤
│ 🔴 CRITICAL                            │
│ Alarma: Exceso de velocidad             │
│ Placa XYZ-789 · 120km/h (máx 80)       │
│ hace 2 min · [Ver en Mapa] [Contactar] │
│                                         │
│ 🟠 ALTA                                │
│ Nueva solicitud: CONQUERS SAS           │
│ SOL-00567 · Barranquilla → Cartagena    │
│ hace 15 min · [Asignar] [Ver]           │
│                                         │
│ 🟠 ALTA                                │
│ Servicio completado: SOL-00234          │
│ WASTE SERVICES · Entregado 14:30        │
│ hace 1h · [Generar Remesa] [Ver]        │
├─────────────────────────────────────────┤
│ Ver historial completo                  │
└─────────────────────────────────────────┘
```

### 6.5 Email — Guía de Diseño

**Identidad visual:**
- Header: Logo INLOP (isotipo flecha) + barra de estado con color semántico
- Tipografía: system fonts (no webfonts en email — compatibilidad)
- Colores: palette reducida de §6 CLAUDE.md (--inlop-red para CTA, --navy para estructura)
- Footer: dirección física INLOP + link unsubscribe + link "Ver en Portal"

**Estructura por tipo:**

Transaccional (confirmaciones, completados):
- Subject con estado + código
- Tabla de datos del servicio
- CTA: "Ver en Portal"
- Sin marketing, sin cross-sell

Alerta (alarmas, SLA):
- Subject con severidad explícita ("[URGENTE]" para CRITICAL)
- Descripción del problema en una línea
- Datos contextuales mínimos
- CTA: "Tomar Acción"

Digest (resumen diario — futuro):
- Subject: "Resumen del día: N servicios, M alertas"
- Tabla resumen con estados
- Solo para usuarios que configuren digest en preferencias

### 6.6 Push — Guía de Diseño

**Títulos (máx 50 chars):**
- Usar verbo pasado: "Servicio Confirmado", "En Ruta", "Completado"
- Incluir emoji semántico al inicio: ✅ 🚛 📍 ⚠️ ❌

**Body (máx 120 chars):**
- Código de solicitud siempre primero: "SOL-00234"
- Separador ` · ` entre datos
- Dato más relevante del contexto (placa, destino, conductor)

**Acciones (máx 2 botones):**
- Acción primaria: "Ver" (abre detalle)
- Acción secundaria (según tipo): "Seguir" (mapa), "Contactar" (teléfono conductor)

---

## Fase 7 — Escalabilidad

### 7.1 Volumen Proyectado

| Métrica | Actual (estimado) | 6 meses | 12 meses |
|---------|-------------------|---------|----------|
| Empresas activas | ~10 | ~30 | ~80 |
| Usuarios Portal Cliente | ~50 | ~200 | ~600 |
| Servicios/día | ~100 | ~400 | ~1500 |
| Eventos de negocio/día | ~500 | ~2000 | ~7500 |
| Push notifications/día | ~300 | ~1500 | ~6000 |
| Emails/día | ~100 | ~500 | ~2000 |
| In-App notifications/día | ~500 | ~2500 | ~10000 |

### 7.2 Cuellos de Botella Identificados

#### A. Recipient Resolver — Escalabilidad O(N) total usuarios

**Problema:** `resolveCliente()` hace `GET /admin/users?per_page=1000` por cada evento que necesita resolver audiencia 'cliente'. Con 600 usuarios, cada evento escanea 600 registros en memoria.

**Solución propuesta:** Crear vista materializada o tabla `usuario_empresa` que indexe usuario_id → empresa_id, consultable con filtro directo:
```
/usuario_empresa?empresa_id=eq.{id}&select=email
```

**Impacto:** O(N total) → O(1) por empresa.

#### B. Orchestrator Síncrono — Latencia acumulada

**Problema:** `publishBusinessEvent()` ejecuta todo inline: persistir evento → resolver canales → crear deliveries → enviar por cada canal. Si Resend tiene latencia de 2s y web-push de 500ms, el total es 2.5s+ bloqueando el thread del sync job.

**Mitigación actual:** Fire-and-forget (no bloquea la respuesta HTTP al cliente).

**Problema residual:** Dentro de `syncSolicitudes`, el loop procesa solicitudes secuencialmente. Si se procesan 10 solicitudes en un ciclo, y cada una dispara `publishBusinessEvent` con 2.5s de latencia, el sync tarda 25s extra, acercándose al intervalo de 65s.

**Solución propuesta (fase futura):** Separar persistencia (síncrona) de entrega (asíncrona):
1. `publishBusinessEvent` solo persiste en `business_events` + `notification_deliveries` (< 100ms)
2. Proceso separado (worker/cron) consume deliveries pendientes y ejecuta channel workers
3. Permite retry, rate limiting, y priorización sin afectar el sync loop

#### C. Supabase Realtime — Límite de conexiones simultáneas

**Problema:** Cada usuario conectado al Portal Cliente mantiene un WebSocket abierto. El plan de Supabase tiene límite de conexiones simultáneas.

**Mitigación:** El volumen proyectado (200-600 usuarios) está dentro de los límites estándar de Supabase Pro. Monitorear y escalar plan si se acerca al 80% del límite.

#### D. Push Subscriptions — Múltiples dispositivos

**Problema:** Un usuario con 3 dispositivos genera 3 push_subscriptions. Con 600 usuarios y promedio 2 dispositivos, hay 1200 subscriptions. El push channel hoy envía a TODAS las subscriptions activas del usuario, secuencialmente.

**Solución:** Envío paralelo (Promise.allSettled ya se usa a nivel de canal, pero no a nivel de subscription dentro del canal). Impacto bajo con volumen actual, pero debe paralelizarse antes de 500+ usuarios.

### 7.3 Arquitectura de Escalabilidad — Fases

**Fase Actual (Sprint 5.x) — Inline:**
```
syncJob → publishBusinessEvent → [persist + deliver inline]
```
Adecuado para: < 500 eventos/día, < 50 usuarios.

**Fase Intermedia (Sprint 6-7) — Queue Separada:**
```
syncJob → publishBusinessEvent → [persist only]
              ↓
deliveryWorker (setInterval 5s) → [consume pending deliveries → channel workers]
```
Adecuado para: 500-5000 eventos/día, < 300 usuarios.

**Fase Avanzada (Sprint 8+) — Event-Driven:**
```
syncJob → INSERT business_events → Supabase webhook/trigger
              ↓
Edge Function / External Worker → [resolve → deliver → update status]
```
Adecuado para: 5000+ eventos/día, 300+ usuarios, múltiples canales.

### 7.4 Observabilidad Requerida

| Métrica | Tipo | Alerta si |
|---------|------|-----------|
| delivery_success_rate | Gauge por canal | < 95% en ventana de 1h |
| delivery_latency_p95 | Histogram por canal | > 30s para push, > 60s para email |
| delivery_queue_depth | Gauge | > 100 pendientes por más de 5 min |
| delivery_failure_streak | Counter por canal | > 5 fallos consecutivos |
| recipient_resolve_duration | Histogram | > 2s |
| push_subscription_churn | Rate | > 10% desactivadas/día |
| email_bounce_rate | Gauge | > 5% |

---

## Fase 8 — Gobernanza

### 8.1 Ownership del Sistema

| Componente | Owner | Responsabilidad |
|------------|-------|-----------------|
| Notification Orchestrator | Backend Lead | Routing, idempotencia, lifecycle |
| Channel Workers | Backend Lead | Integración con proveedores externos |
| Recipient Resolver | Backend Lead | Lógica de audiencia, preferencias |
| Template Engine | Producto + Backend | Contenido, branding, i18n |
| notification_preferences | Producto | Reglas de opt-out, compliance |
| Monitoring & Alertas | SRE / Backend | Observabilidad, dead letters |
| UX de Notification Center | Frontend Lead | Implementación UI en cada producto |

### 8.2 Proceso de Adición de Eventos

Para agregar un nuevo tipo de evento de negocio:

1. **Propuesta** (Producto): documentar evento, audiencias, canales, prioridad
2. **Revisión** (Arquitectura): validar que no duplica evento existente, que el payload es completo
3. **Template** (Producto + Diseño): diseñar contenido por canal × audiencia
4. **Implementación** (Backend):
   - Agregar tipo a taxonomía (`EVENT_CHANNELS`, `EMAIL_AUDIENCES`)
   - Implementar template por canal
   - Agregar resolución de audiencia si es nueva
   - Emitir `publishBusinessEvent` en el punto de origen correcto
5. **Validación** (QA): verificar entrega en todos los canales configurados
6. **Activación**: merge a producción

**Checklist de nuevo evento:**
- [ ] Tipo definido en taxonomía (§1.3)
- [ ] Payload estructurado documentado (§3.3)
- [ ] Audiencias definidas en Matriz (§2.2)
- [ ] Canales asignados en EVENT_CHANNELS
- [ ] Audiencias asignadas en EMAIL_AUDIENCES (si aplica email)
- [ ] Template por canal implementado
- [ ] Idempotency key definida (patrón: `{tipo}:{solicitud_id}:{timestamp|version}`)
- [ ] Prioridad asignada
- [ ] TTL definido (si aplica)
- [ ] Reglas de supresión consideradas (§6.2)
- [ ] Verificado en entorno de desarrollo

### 8.3 Proceso de Adición de Canales

Para agregar un nuevo canal de entrega:

1. **Evaluación** (Producto + Arquitectura): ¿Qué problema resuelve que los canales existentes no?
2. **Selección de proveedor**: evaluar API, pricing, confiabilidad, compliance
3. **Implementación**:
   - Crear `services/channels/{canal}Channel.js` implementando interfaz `send(delivery, renderedEvent, deps)`
   - Agregar entrada en `CHANNEL_REGISTRY`
   - Implementar Lazy Client pattern (§5.4 CLAUDE.md)
   - Agregar templates para el nuevo canal
4. **Configuración**: variables de entorno, API keys (secrets management)
5. **Rollout gradual**: activar por empresa antes de activar globalmente

### 8.4 Compliance y Regulación

| Requisito | Estado | Acción Requerida |
|-----------|--------|-----------------|
| CAN-SPAM (email) | ❌ No cumple | Agregar unsubscribe header + link en footer |
| GDPR (datos personales en notificaciones) | ⚠️ Parcial | Implementar derecho al olvido (purge de notificaciones por usuario) |
| Ley 1581/2012 (Habeas Data Colombia) | ⚠️ Parcial | Consentimiento explícito para canales invasivos (WhatsApp, SMS) |
| Retención de datos | ❌ No definida | Definir política: business_events TTL, notificaciones_cliente purge |
| Opt-out | ❌ No implementado | notification_preferences + unsubscribe por canal |

### 8.5 Política de Retención

| Tabla | Retención Propuesta | Justificación |
|-------|--------------------|----|
| business_events | 90 días (procesados), indefinido (no procesados) | Auditoría operativa; los no procesados indican fallo |
| notification_deliveries | 30 días (sent), 90 días (failed) | Debugging; failed se retiene más para análisis |
| notificaciones_cliente | 90 días (leídas), 30 días (archivadas) | UX — historial relevante sin acumular ruido |
| push_subscriptions | Indefinido (activas), eliminar al desactivar | Limpieza de registros muertos |
| dead_letter_queue | 180 días | Análisis de patrones de fallo |

---

## Fase 9 — Roadmap de Evolución

### 9.1 Sprints Inmediatos (Consolidación)

#### Sprint 5.2 — Estabilización Email + Observabilidad Básica

**Objetivo:** Email Channel funcional y verificable para SOLICITUD_CREADA.

- Resolver causa raíz del fallo de _enqueueDelivery (debug logs desplegados)
- Implementar log estructurado con métricas básicas (success/fail count por canal)
- Verificar idempotencia end-to-end
- Eliminar dualidad: notificaciones_cliente las crea el Orchestrator (via pushChannel), no syncSolicitudes directamente

**Entregable:** Email de SOLICITUD_CREADA llega a ops. Logs muestran tasa de éxito.

#### Sprint 5.3 — Templates con Identidad + CAN-SPAM

**Objetivo:** Emails con branding INLOP y compliance básico.

- Diseñar email template base con identidad INLOP (logo, colores, footer legal)
- Implementar templates diferenciados por tipo de evento (al menos 3: creación, confirmación, completado)
- Agregar unsubscribe header y link funcional
- Payload estructurado en business_events (migrar de strings a datos §3.3)

**Entregable:** Emails profesionales con branding. Cumplimiento CAN-SPAM.

#### Sprint 5.4 — Recipient Resolver Escalable

**Objetivo:** Resolución de audiencia que no degrade con el crecimiento.

- Crear tabla/vista `usuario_empresa_email` indexada por empresa_id
- Implementar audiencia 'encargado' (por agencia_id via usuario_agencias)
- Eliminar full-scan de GoTrue users
- Agregar agencia_id a business_events

**Entregable:** Resolución de recipients en < 100ms para cualquier tamaño de base.

### 9.2 Sprints de Expansión

#### Sprint 6.0 — ERP Notification Channel

**Objetivo:** Operadores INLOP reciben notificaciones en tiempo real.

- Diseñar API de notificaciones para ERP (SSE endpoint en backend)
- Implementar canal 'erp_inapp' en CHANNEL_REGISTRY
- Conectar TopbarNotifications a fuente de datos real
- Definir audiencia 'operador_inlop' en Recipient Resolver
- Implementar filtros por empresa/prioridad en UI

**Entregable:** ERP muestra notificaciones en tiempo real. TopbarNotifications funcional.

#### Sprint 6.1 — Notification Preferences

**Objetivo:** Usuarios controlan qué reciben y por qué canal.

- Crear tabla notification_preferences
- Implementar UI de preferencias en Portal Cliente (Configuración → Notificaciones)
- Integrar preferencias en resolución de canales (reemplazar EVENT_CHANNELS estático)
- Respetar override para CRITICAL

**Entregable:** Usuarios pueden silenciar tipos/canales específicos.

#### Sprint 6.2 — Retry + Dead Letter Queue

**Objetivo:** Ninguna notificación se pierde silenciosamente.

- Implementar delivery worker separado (consume pendientes cada 5s)
- Backoff exponencial: 30s → 2min → 10min → 1h → dead letter
- Dead letter queue con alertas a admin_inlop
- Dashboard de health en ERP (tasa de entrega, fallos recientes)

**Entregable:** Sistema auto-recuperable. Fallos visibles para operaciones.

### 9.3 Sprints de Madurez

#### Sprint 7.0 — Eventos Operacionales (Alarmas)

**Objetivo:** Alertas de flota llegan al despachador y operador.

- Implementar eventos ALARMA_* desde syncAlarmas
- Canal Torre de Control (WebSocket o polling endpoint)
- Priorización: CRITICAL bypasses rate limiting
- Agrupación: N alarmas del mismo vehículo en ventana → 1 notificación

**Entregable:** Alertas operacionales en ERP y Torre de Control.

#### Sprint 7.1 — WhatsApp Business

**Objetivo:** Canal WhatsApp para clientes que prefieren mensajería.

- Seleccionar proveedor (360dialog / Meta directo)
- Registrar templates en Meta Business Manager
- Implementar whatsappChannel.js con Lazy Client pattern
- Opt-in explícito (Ley 1581/2012)
- Solo mensajes template (no conversacionales — compliance Meta)

**Entregable:** Clientes reciben confirmaciones por WhatsApp.

#### Sprint 8.0 — Event-Driven Architecture

**Objetivo:** Desacoplar emisión de entrega para escalar a 5000+ eventos/día.

- Migrar de inline delivery a trigger/webhook en Supabase
- Delivery worker como Edge Function o servicio separado
- Priorización real: CRITICAL antes que LOW en la cola
- Batch processing para digest emails

**Entregable:** Arquitectura lista para escalar sin cambiar el Orchestrator.

### 9.4 Dependencias entre Sprints

```
5.2 (Estabilización) ─────────────────────┐
  │                                        │
  ▼                                        ▼
5.3 (Templates)          5.4 (Recipients) ──→ 6.0 (ERP)
  │                        │                     │
  ▼                        ▼                     ▼
  └────────→ 6.1 (Preferencias) ←────────────────┘
               │
               ▼
             6.2 (Retry + DLQ)
               │
               ├──→ 7.0 (Alarmas)
               │
               └──→ 7.1 (WhatsApp)
                      │
                      ▼
                    8.0 (Event-Driven)
```

### 9.5 Criterios de Éxito por Fase

| Sprint | KPI Principal | Target |
|--------|--------------|--------|
| 5.2 | Email delivery rate para SOLICITUD_CREADA | 100% (ops recibe) |
| 5.3 | Email open rate (Resend analytics) | > 50% |
| 5.4 | Recipient resolve latency P95 | < 100ms |
| 6.0 | ERP notification delivery latency | < 3s end-to-end |
| 6.1 | Usuarios que configuran preferencias | > 20% en primer mes |
| 6.2 | Delivery eventual success rate | > 99.5% |
| 7.0 | Alarma → Notificación latencia | < 10s |
| 7.1 | WhatsApp delivery rate | > 95% |
| 8.0 | Throughput sostenido | 100 eventos/minuto sin degradación |

---

## Apéndice A — Glosario

| Término | Definición en Contexto INLOP |
|---------|------------------------------|
| BusinessEvent | Registro inmutable de algo que ocurrió en el negocio. Fuente de verdad para el sistema de notificaciones. |
| Delivery | Intento de entrega de un BusinessEvent por un canal específico a un destinatario específico. |
| Channel Worker | Módulo que implementa `send(delivery, renderedEvent, deps)` para un canal de entrega. |
| Recipient Resolver | Componente que determina quién debe recibir una notificación basado en el tipo de evento y las reglas de audiencia. |
| Scope | Conjunto de empresa + agencias que un usuario puede ver, resuelto por authScope.js. |
| Fire-and-forget | Garantía arquitectónica: la notificación nunca bloquea ni puede fallar la operación de negocio que la origina. |
| Dead Letter | Delivery que ha agotado todos los reintentos sin éxito. Requiere intervención manual o análisis. |
| Idempotency Key | Identificador único que previene la creación duplicada de un BusinessEvent ante reprocessing. |

## Apéndice B — Decisiones Arquitectónicas Registradas

| ADR | Decisión | Justificación |
|-----|----------|---------------|
| ADR-N01 | Fire-and-forget es innegociable | Un fallo de notificación nunca debe bloquear syncSolicitudes ni un POST /servicios. La notificación es efecto secundario, no parte de la transacción. |
| ADR-N02 | Idempotencia por key, no por lock | El patrón consulta-antes-de-insertar con idempotency_key es suficiente para el volumen actual y evita locks distribuidos. |
| ADR-N03 | Canales como plugins (Registry) | Agregar un canal nuevo no debe requerir modificar el Orchestrator. Interfaz `send()` es el contrato. |
| ADR-N04 | Preferencias opt-out, no opt-in | Default: todo habilitado. El usuario desactiva lo que no quiere. Excepción: WhatsApp/SMS requieren opt-in explícito por regulación. |
| ADR-N05 | Backend es fuente de verdad de routing | El frontend no decide qué canal usar ni quién recibe. Solo presenta lo que el backend ya decidió entregar. |
| ADR-N06 | Templates en código antes que en DB | Hasta que exista demanda de edición sin deploy, los templates viven como código versionado. La interfaz se diseña para migrar a DB sin reescritura. |
| ADR-N07 | Delivery worker separado antes que event-driven | El paso intermedio (worker con polling) es implementable sin infraestructura nueva. Event-driven requiere Supabase webhooks o Edge Functions que aún no están en el stack. |

---

*Fin del documento — NOTIFICATION_SYSTEM_ARCHITECTURE.md v1.0*
