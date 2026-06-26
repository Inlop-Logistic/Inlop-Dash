# INLOP Platform — Documento de Arquitectura Maestro

**Versión:** 1.1
**Fecha:** 2026-06-26
**Clasificación:** Interno — Referencia Técnica Obligatoria
**Rol:** Principal Software Architect / Enterprise Solution Architect

> Este documento es la Constitución técnica del ecosistema INLOP.
> Toda decisión de diseño, implementación, o refactoring debe ser compatible con lo aquí establecido.
> Cualquier desviación requiere discusión explícita y actualización del documento antes de ejecutarse.

---

## Índice

0. [Filosofía del Proyecto](#0-filosofía-del-proyecto)
1. [Visión General](#1-visión-general)
2. [Arquitectura General](#2-arquitectura-general)
3. [Arquitectura Frontend](#3-arquitectura-frontend)
4. [Arquitectura Backend](#4-arquitectura-backend)
5. [Arquitectura de Eventos](#5-arquitectura-de-eventos)
6. [Arquitectura de Integraciones](#6-arquitectura-de-integraciones)
7. [Arquitectura de Seguridad](#7-arquitectura-de-seguridad)
8. [Arquitectura de Base de Datos](#8-arquitectura-de-base-de-datos)
9. [Estrategia de Escalabilidad](#9-estrategia-de-escalabilidad)
10. [Convenciones Oficiales](#10-convenciones-oficiales)
11. [Roadmap Arquitectónico](#11-roadmap-arquitectónico)
12. [Reglas para Desarrollo Asistido por IA](#12-reglas-para-desarrollo-asistido-por-ia)

---

## 0. Filosofía del Proyecto

### 0.1 Por Qué Existe Esta Sección

La arquitectura define el qué y el cómo. La filosofía define el porqué detrás de cada decisión y el criterio que debe aplicarse cuando la arquitectura no responde explícitamente a una situación nueva. Cualquier desarrollador que incorpore al proyecto debe interiorizar esta filosofía antes de escribir su primera línea de código.

### 0.2 Principios Filosóficos Fundamentales

**Simplicidad deliberada sobre complejidad accidental**

La complejidad que no resuelve un problema real es deuda técnica disfrazada de arquitectura. Antes de agregar una abstracción, una dependencia, o una capa nueva, la pregunta obligatoria es: ¿qué problema concreto de hoy resuelve esto? Si la respuesta es "prepararnos para el futuro", la respuesta es no. El futuro se diseña, no se implementa anticipadamente.

Un sistema simple que funciona en producción es superior a un sistema elegante que nadie entiende. La elegancia verdadera está en resolver bien un problema, no en la complejidad de la solución.

**Mantenibilidad como métrica principal**

El código se escribe una vez y se lee cientos de veces. Se mantiene durante años por personas que no estuvieron en la discusión original. El criterio de calidad de cualquier pieza de código no es si funciona hoy, sino si un desarrollador nuevo puede entenderla, modificarla, y confiar en ella seis meses después sin necesitar al autor original.

La mantenibilidad tiene tres componentes: legibilidad (el código dice lo que hace), predecibilidad (el comportamiento es consistente con las convenciones del proyecto), y modificabilidad (cambiar una parte no rompe silenciosamente otras).

**Consistencia sobre perfección local**

Un componente que sigue las convenciones del proyecto aunque no sea la solución más elegante para ese caso específico es superior a una solución brillante que introduce un patrón nuevo. La consistencia reduce la carga cognitiva del equipo: cuando todo sigue el mismo patrón, el foco mental puede estar en el problema de negocio, no en descifrar el código.

Si se descubre un patrón mejor, se adopta en todo el proyecto, no solo en el módulo donde se descubrió.

**Reutilización como primer instinto**

Antes de crear algo nuevo, la búsqueda del equivalente existente es obligatoria. La duplicación de lógica es la forma más costosa de deuda técnica: cuando el comportamiento debe cambiar, el cambio debe hacerse en todos los lugares donde existe la copia, y descubrir cuántos lugares son es imposible con certeza.

La reutilización no es solo de componentes UI — aplica a funciones de utilidad, esquemas de validación, tipos TypeScript, constantes, y patrones de manejo de errores.

**Escalabilidad estructural, no prematura**

El sistema debe poder crecer: más módulos, más superficies, más integraciones, más usuarios. Pero crecer no significa que todo deba ser construido en escala desde el principio. Significa que el diseño no debe crear obstáculos artificiales al crecimiento.

La diferencia entre diseñar para escalar y sobreingeniería prematura es concreta: diseñar para escalar significa que los módulos están desacoplados y pueden crecer independientemente. Sobreingeniería prematura significa construir la infraestructura de escala antes de que el problema de escala exista.

**Honestidad técnica**

Las decisiones de diseño tienen costos y beneficios. Los costos no deben ocultarse en el entusiasmo por una tecnología nueva. Cuando se propone un cambio arquitectónico, la justificación debe incluir tanto los beneficios concretos como los costos reales: tiempo de adopción, curva de aprendizaje, deuda de migración, y complejidad operacional.

Una tecnología adoptada sin entender sus costos genera deuda oculta. Una tecnología rechazada por desconocimiento genera deuda por oportunidad perdida. La honestidad técnica requiere conocer ambas caras.

**Baja deuda técnica como disciplina continua**

La deuda técnica no es solo código malo. Es cualquier decisión que hoy resulta conveniente pero que mañana costará más de lo que ahorró: un hack temporal que se vuelve permanente, una función duplicada porque era más rápido copiarla, un test omitido porque el deadline apretaba, un magic string en lugar de una constante nombrada.

La deuda técnica se acumula con interés. Un proyecto que la ignora consistentemente llega a un punto donde cualquier cambio es peligroso y el costo de cada feature nueva es desproporcionado. La disciplina de no generarla —o de liquidarla cuando se genera— es parte del trabajo, no un extra.

### 0.3 Valores que Guían las Decisiones

Cuando surja una decisión de diseño no cubierta explícitamente por este documento, aplicar los valores en este orden de prioridad:

1. **Seguridad** — Nunca sacrificada por conveniencia o velocidad
2. **Corrección** — El código hace exactamente lo que dice hacer
3. **Mantenibilidad** — Puede ser entendido y modificado sin riesgo
4. **Consistencia** — Sigue los patrones establecidos del proyecto
5. **Rendimiento** — Optimizar solo cuando hay un problema medible
6. **Brevedad** — El código más corto que cumpla los valores anteriores

El rendimiento aparece en el puesto 5 deliberadamente. Un sistema lento y correcto se puede optimizar. Un sistema rápido e incorrecto tiene un problema más profundo.

### 0.4 Lo que Este Proyecto No Es

**No es un proyecto de demostración tecnológica.** Las decisiones de stack existen porque resuelven problemas reales de INLOP, no porque sean las más modernas o las más interesantes técnicamente.

**No es un proyecto académico.** La arquitectura debe ser comprensible para un desarrollador mid-level con conocimiento de React y Node.js, no solo para arquitectos senior. Si algo requiere un doctorado para entenderse, está mal diseñado.

**No es un proyecto desechable.** Cada pieza de código que se escribe tiene que estar a la altura de un sistema que operará durante años, en producción, con datos reales de clientes reales.

---

## 1. Visión General

### 1.1 Objetivo del Ecosistema INLOP

INLOP opera en logística de última milla y transporte de carga a nivel nacional. El ecosistema de software tiene un objetivo único: **digitalizar y automatizar la cadena completa de valor logístico**, desde que un cliente solicita un servicio hasta que ese servicio queda documentado, facturado y analizado.

El ecosistema se compone de siete superficies de usuario que comparten un único núcleo de negocio:

| Superficie | Usuarios | Propósito |
|---|---|---|
| **ERP INLOP** | Operadores, coordinadores, administrativos | Centro de operaciones: solicitudes, asignación, seguimiento |
| **Portal Cliente** | Clientes corporativos | Autogestión: crear solicitudes, seguir viajes, ver cumplidos |
| **Portal Conductores** | Conductores propios y vinculados | Recibir viajes asignados, reportar novedades, firmar cumplidos |
| **Portal Comercial** | Equipo comercial | Gestión de clientes, cotizaciones, contratos |
| **Portal Administrativo** | Facturación, tesorería | Liquidaciones, anticipos, conciliaciones |
| **Dashboard Ejecutivo** | Gerencia, directivos | KPIs en tiempo real, analytics operacional |
| **App Móvil (futuro)** | Conductores + supervisores de campo | Versión nativa del Portal Conductores |

Todos comparten: **el mismo backend, la misma base de datos, el mismo sistema de autenticación, y el mismo design system.**

### 1.2 Principios Arquitectónicos

Estos principios no son sugerencias. Son restricciones de diseño que toda decisión técnica debe respetar.

**P1 — Separación clara de responsabilidades**
Cada capa tiene un contrato explícito. Una capa nunca invoca directamente a la capa que no le corresponde. El controlador no toca la base de datos. El repositorio no contiene lógica de negocio.

**P2 — Componentes reutilizables, no copias**
Un componente, un lugar. Si algo existe dos veces en el codebase, existe una vez más de lo necesario. Esto aplica a componentes UI, funciones de utilidad, esquemas de validación, y constantes.

**P3 — Falla rápido y ruidosamente**
Un sistema que falla silenciosamente es más peligroso que uno que crashea. Las configuraciones incorrectas deben impedir el arranque. Los errores en producción deben ser visibles, trazables y accionables.

**P4 — Diseñar para la evolución, no para el futuro imaginado**
No construir hoy lo que se necesitará en dos años. Pero sí diseñar de manera que agregar esa funcionalidad en el futuro no requiera reescribir lo que existe.

**P5 — Seguridad como requisito, no como feature**
Autenticación, autorización y auditoría son obligatorios en cada endpoint, cada operación de escritura, y cada dato sensible. No es negociable ni diferible.

**P6 — La experiencia de usuario es parte de la arquitectura**
El design system, los tokens de diseño y la consistencia visual entre superficies son decisiones arquitectónicas de primer orden, no decoración.

**P7 — Código honesto**
El código dice lo que hace. Nombres descriptivos, sin abreviaciones crípticas, sin comentarios que expliquen qué hace el código (eso lo dicen los nombres), solo comentarios que expliquen por qué existe una decisión no obvia.

### 1.3 Decisiones de Diseño Fundamentales

Estas decisiones están tomadas. No requieren re-evaluación en cada feature.

| Decisión | Elección | Razón de Ser |
|---|---|---|
| Lenguaje backend | TypeScript (migración planificada desde JS) | Tipos compartibles con frontend, detección temprana de errores |
| Lenguaje frontend | TypeScript estricto | Sin `any`, sin `as`, sin escape hatches |
| Base de datos | PostgreSQL vía Supabase | RLS nativa, REST API, Auth integrada, tiempo real disponible |
| Auth | Supabase Auth (JWT) | Unifica todas las superficies, no gestionar passwords propios |
| Estilo CSS | Tailwind CSS v4 con design tokens CSS | Velocidad de desarrollo + rebrandabilidad |
| Routing frontend | React Router v7 | Curva de adopción baja, compatibilidad con el ecosistema React 19 |
| Validación | Zod | Schemas TypeScript-first, reutilizables en frontend y backend |
| Logging | Pino (backend) | JSON estructurado, cero overhead en producción |
| Deploy | Railway | Simplicidad operacional para el tamaño actual del equipo |
| Monorepo | No por ahora | Overhead innecesario con el equipo actual; revisable cuando haya 3+ repos activos |

---

## 2. Arquitectura General

### 2.1 Diagrama de Ecosistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTES (Browsers / Apps)                    │
│                                                                       │
│  [ERP]  [Portal Cliente]  [Portal Conductor]  [Comercial]  [Exec]   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     INLOP BACKEND  (Railway)                         │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │  REST API   │  │  Auth Layer  │  │  Job Runner  │               │
│  │  /api/v1/   │  │  (JWT)       │  │  (Sync Jobs) │               │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘               │
│         │                │                  │                        │
│  ┌──────▼──────────────────────────────────▼──────┐               │
│  │              Business Logic (Services)           │               │
│  └──────────────────────┬──────────────────────────┘               │
│                          │                                           │
│  ┌───────────────────────▼──────────────────────────┐              │
│  │         Integration Adapters                       │              │
│  │  [ControlT]  [Avansat]  [WhatsApp]  [Email]      │              │
│  └───────────────────────────────────────────────────┘              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
     ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
     │  Supabase   │  │   ControlT   │  │   Avansat      │
     │  (Postgres) │  │   (GPS)      │  │   (Docs)       │
     └─────────────┘  └──────────────┘  └────────────────┘
```

### 2.2 Frontend

Cada superficie de usuario es una **SPA React independiente**. Comparten el design system pero tienen su propio bundle, su propio dominio, y sus propias rutas.

- Las SPAs se comunican con el backend exclusivamente vía `fetch()` al API REST.
- No hay SSR. No hay Next.js. Las SPAs son estáticas — `npm run build` produce `dist/` que Railway sirve como archivos estáticos.
- El estado global de autenticación vive en Supabase Auth (el JWT está en `localStorage` gestionado por el SDK).

### 2.3 Backend

Un único servicio Node.js/Express organizado en capas. No son microservicios — es un **monolito modular**: estructura interna de módulos independientes, pero un único proceso, un único deploy.

El backend tiene tres responsabilidades principales:
1. **API REST** para todas las superficies frontend
2. **Proxy de integraciones externas** (ControlT, Avansat, WhatsApp)
3. **Jobs de sincronización** en background

### 2.4 Base de Datos

PostgreSQL vía Supabase. Una única base de datos para todo el ecosistema. El aislamiento entre módulos se logra mediante **Row Level Security (RLS)** y **schemas de Postgres** (cuando la complejidad lo justifique), no mediante bases separadas.

El backend accede a Supabase usando el **service role key** únicamente para operaciones administrativas y jobs. Las operaciones del usuario final se ejecutan bajo el **JWT del usuario**, permitiendo que RLS filtre automáticamente lo que cada quien puede ver.

### 2.5 Flujo de Información — Solicitud de Transporte

```
[Portal Cliente]
  → POST /api/v1/solicitudes
  → Backend: validar + autorizar + SolicitudService.crear()
  → Repository: INSERT en Supabase
  → Supabase: trigger → historial_estado
  → EventEmitter: emit('solicitud.creada', payload)
    → NotificacionService: INSERT notificación en BD
    → (futuro) WhatsAppAdapter: enviar confirmación al cliente
    → (futuro) EmailAdapter: enviar copia al coordinador

[ERP - Coordinador]
  → PATCH /api/v1/solicitudes/:id/estado
  → Backend: validar + autorizar + SolicitudService.aprobar()
  → Repository: UPDATE estado + INSERT historial
  → EventEmitter: emit('solicitud.aprobada', payload)
    → Portal Cliente: notificación en tiempo real (Supabase Realtime)
```

---

## 3. Arquitectura Frontend

### 3.1 Estructura de Carpetas — Feature First

La organización es por **dominio de negocio**, no por tipo de archivo. Los archivos que cambian juntos viven juntos.

```
erp/src/
├── app/                          ← Bootstrap de la aplicación
│   ├── router.tsx                ← Definición central de rutas
│   ├── providers.tsx             ← Context providers globales
│   └── main.tsx                  ← Entry point
│
├── features/                     ← Módulos de negocio
│   ├── solicitudes/
│   │   ├── components/
│   │   │   ├── SolicitudesPage.tsx
│   │   │   ├── SolicitudDetalle.tsx
│   │   │   ├── SolicitudForm.tsx
│   │   │   └── TimeLine.tsx
│   │   ├── hooks/
│   │   │   ├── useSolicitudes.ts
│   │   │   └── useSolicitudDetalle.ts
│   │   ├── api/
│   │   │   └── solicitudes.api.ts
│   │   ├── types/
│   │   │   └── solicitud.types.ts
│   │   └── index.ts              ← Barrel export del feature
│   │
│   ├── viajes/
│   │   └── (misma estructura)
│   │
│   ├── conductores/
│   │   └── (misma estructura)
│   │
│   └── auth/
│       ├── components/
│       │   └── LoginPage.tsx
│       ├── hooks/
│       │   └── useAuth.ts
│       └── index.ts
│
├── components/
│   ├── ui/                       ← Design System (framework-agnóstico)
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── DataTable.tsx
│   │   ├── KpiCard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── SidePanel.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx          ← futuro
│   │   └── index.ts
│   │
│   └── layout/                   ← Estructuras de página
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       └── TopBar.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts             ← fetch wrapper base (auth headers, error handling)
│   │   └── index.ts
│   ├── supabase.ts               ← Singleton Supabase client
│   └── utils/
│       ├── dates.ts
│       ├── format.ts
│       └── cn.ts                 ← classNames helper
│
├── styles/
│   ├── tokens.css                ← Design tokens — ÚNICA fuente de verdad visual
│   ├── typography.css            ← @font-face declarations
│   └── globals.css               ← Reset + base styles
│
├── types/
│   └── global.d.ts               ← Tipos globales del proyecto
│
└── constants/
    ├── estados.ts                ← ESTADO_CFG y variantes por módulo
    └── routes.ts                 ← Rutas como constantes tipadas
```

### 3.2 Routing — React Router v7

**Tecnología elegida: React Router v7**

**Justificación sobre TanStack Router:**
TanStack Router ofrece mejor tipado de params y search params out-of-the-box, y su integración con TanStack Query es más fluida. Sin embargo, en el contexto de INLOP hoy, estos beneficios son prematuros: el equipo es pequeño, los módulos son pocos, y la curva de adopción de TanStack Router —sumada a la adopción de TanStack Query que vendría con ella— introduce complejidad de configuración que no paga dividendos todavía. React Router v7 cubre el 100% de los requerimientos actuales con un setup de 30 minutos.

**Regla de revisión:** Si el ERP llega a 8+ módulos con fetching paralelo complejo, evaluar migración a TanStack Router. No antes.

```
Rutas ERP:
/login                            ← Pública
/                                 ← Redirige a /solicitudes
/solicitudes                      ← SolicitudesPage
/solicitudes/:id                  ← Detalle (future)
/viajes                           ← ViajesPage (futuro)
/viajes/:id                       ← Detalle viaje
/conductores                      ← ConductoresPage (futuro)
/clientes                         ← ClientesPage (futuro)
/reportes                         ← ReportesPage (futuro)
/configuracion                    ← Administración
```

Las rutas se definen como constantes tipadas en `constants/routes.ts` para evitar strings mágicos en los `Link` y `navigate()`.

### 3.3 Design System

El design system tiene dos niveles:

**Nivel 1 — Design Tokens (`styles/tokens.css`)**
Variables CSS que controlan toda la apariencia. Son la única fuente de verdad visual. Cambiar una variable cambia la apariencia en todas las superficies simultáneamente.

```css
/* Paleta de marca */
--inlop-navy:   #012A6B;
--inlop-red:    #E30613;

/* Grises (escala semántica) */
--gray-50:  #F8F9FC;
--gray-100: #ECEEF3;
--gray-200: #DDE1EA;
--gray-400: #8A93A8;
--gray-500: #6B7589;
--gray-700: #3A4257;
--gray-800: #1E2535;

/* Tipografía */
--font-display: "Barlow Condensed", sans-serif;
--font-sans:    "DM Sans", system-ui, sans-serif;
--font-mono:    "DM Mono", "Courier New", monospace;

/* Espaciado base */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;

/* Sombras */
--shadow-card:  0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-panel: -8px 0 32px rgba(0,0,0,0.12);
```

**Nivel 2 — Componentes UI (`components/ui/`)**
Componentes React que consumen los tokens. Nunca tienen colores hardcodeados — siempre usan variables CSS. Estos componentes no conocen el dominio de negocio: no saben qué es una "solicitud" ni un "viaje".

Regla: **un componente UI nunca importa desde `features/`.**

### 3.4 Manejo de Estado

El estado en el ERP tiene tres tipos con estrategias distintas:

| Tipo | Estrategia | Ejemplo |
|---|---|---|
| Estado del servidor | `useState` + `useEffect` + fetch | Lista de solicitudes, detalle de solicitud |
| Estado de UI local | `useState` en el componente | Panel abierto/cerrado, tab activo |
| Estado global de sesión | Supabase Auth SDK | Usuario autenticado, rol, empresa |

**No se usa Redux, Zustand, ni Jotai en esta fase.** El estado del servidor se gestiona con fetch directo. Cuando la complejidad de cache y sincronización lo justifique (múltiples componentes que necesitan el mismo dato, actualizaciones optimistas), se evaluará TanStack Query. La evaluación se hace por módulo, no globalmente.

### 3.5 Fetch y API Layer

```
components/ o features/
  → custom hook (useSolicitudes)
  → feature api (solicitudes.api.ts)
  → lib/api/client.ts          ← agrega auth header, parsea errores
  → fetch() al backend
```

`client.ts` es el único lugar que conoce la URL base del API y el formato de error del backend. Si el backend cambia el formato de error, se cambia en un único archivo.

### 3.6 Estrategia para Superficies Futuras

Cada nueva superficie (Portal Conductores, Portal Comercial, etc.) es un nuevo proyecto Vite en la misma estructura monorepo-light:

```
inlop-dash/
├── erp/              ← SPA ERP
├── portal-cliente/   ← SPA Portal Cliente (ya existe como appclienteinlop)
├── portal-conductor/ ← SPA futura
├── portal-comercial/ ← SPA futura
└── backend/          ← API unificada (futuro: extraer de index.js)
```

Todas las SPAs importan los tokens CSS mediante copia (hasta que `@inlop/ui` sea un paquete npm privado). El design system es el mismo — solo los permisos y el scope de datos cambian.

---

## 4. Arquitectura Backend

### 4.1 Principio Fundamental: Capas con Contratos Explícitos

```
HTTP Request
    ↓
[Middleware Stack]       ← auth, validación, rate limiting, logging
    ↓
[Controller]             ← recibe request, llama service, envía response
    ↓
[Service]                ← lógica de negocio, orquestación, eventos
    ↓
[Repository]             ← acceso a datos, abstracción de Supabase
    ↓
[Supabase / External]    ← PostgreSQL, PostgREST, integraciones
```

**Regla crítica:** La dependencia siempre fluye hacia abajo. Un Repository nunca llama a un Service. Un Controller nunca llama a un Repository directamente. Una capa superior solo conoce la interfaz de la capa inmediatamente inferior.

### 4.2 Estructura de Carpetas — Backend

```
backend/src/
│
├── config/
│   ├── env.ts                    ← Validación de variables de entorno al startup
│   ├── supabase.ts               ← Singleton cliente Supabase (service role)
│   └── logger.ts                 ← Instancia Pino configurada
│
├── middleware/
│   ├── auth.ts                   ← requireErpAuth, requireClienteAuth, requireAdmin
│   ├── errorHandler.ts           ← Handler centralizado de errores (último middleware)
│   ├── rateLimiter.ts            ← express-rate-limit por endpoint
│   ├── requestLogger.ts          ← Log de entrada/salida de requests
│   └── validate.ts               ← Factory: validate(schema) → middleware Zod
│
├── modules/
│   │
│   ├── solicitudes/
│   │   ├── solicitudes.controller.ts
│   │   ├── solicitudes.service.ts
│   │   ├── solicitudes.repository.ts
│   │   ├── solicitudes.routes.ts
│   │   ├── solicitudes.schema.ts     ← Schemas Zod
│   │   └── solicitudes.types.ts      ← DTOs TypeScript
│   │
│   ├── conductores/
│   │   └── (misma estructura)
│   │
│   ├── viajes/
│   │   └── (misma estructura)
│   │
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.routes.ts
│   │
│   └── clientes/
│       └── (misma estructura)
│
├── integrations/
│   ├── controlt/
│   ├── avansat/
│   ├── whatsapp/
│   └── email/
│
├── jobs/
│   ├── jobManager.ts
│   ├── syncViajes.job.ts
│   ├── syncAlarmas.job.ts
│   ├── syncSolicitudes.job.ts
│   └── syncPlaneados.job.ts
│
├── events/
│   ├── eventEmitter.ts
│   ├── handlers/
│   │   ├── onSolicitudCreada.ts
│   │   ├── onSolicitudAprobada.ts
│   │   └── onViajeIniciado.ts
│   └── events.types.ts
│
├── utils/
│   ├── dates.ts                  ← parseSchedulate, formatFecha, toColombiaTime
│   ├── sorting.ts                ← sortViajes, getPrioridad
│   └── pagination.ts
│
├── constants/
│   ├── estados.ts
│   └── grupos.ts
│
├── types/
│   └── express.d.ts              ← Extensión de Request (req.userId, req.userRole)
│
└── app.ts                        ← Express app factory (sin listen)
index.ts                          ← Entry point: importa app, llama listen
```

### 4.3 Responsabilidades por Capa

#### Controller
- Recibe el `Request` HTTP y envía el `Response`
- Extrae params, query, body del request
- Llama al Service con los datos ya extraídos
- **No contiene lógica de negocio**
- **No accede a la base de datos**
- Maneja el código HTTP de respuesta
- En caso de error, hace `next(err)` — nunca captura directamente

#### Service
- Contiene toda la lógica de negocio
- Orquesta múltiples repositories cuando es necesario
- Emite eventos de negocio
- **No conoce Express** — no maneja `req`, `res`
- **No hace queries directas a Supabase** — siempre vía Repository
- Puede llamar a adaptadores de integración

#### Repository
- Única capa que conoce Supabase y la estructura de la base de datos
- Traduce entre el modelo de dominio y el modelo de base de datos
- **No contiene lógica de negocio** — solo operaciones de datos
- Retorna tipos del dominio, no crudos de Supabase
- Maneja los `select` de PostgREST, los `filter`, los `join`

### 4.4 DTOs (Data Transfer Objects)

Los DTOs definen el contrato de cada operación. Existen en dos formas:

**DTOs de Entrada** — validados con Zod en el middleware antes de llegar al Controller.

**DTOs de Salida** — interfaces TypeScript que definen exactamente qué retorna cada endpoint. El Repository mapea los datos crudos de Supabase a estos tipos. El Controller serializa estos tipos como JSON.

Un DTO nunca expone campos internos de la base de datos que no sean relevantes para el cliente (IDs internos, campos de auditoría interna, datos de otras entidades no solicitadas).

### 4.5 Versionado de API

Todos los endpoints se sirven bajo `/api/v1/`. La ruta `/api/` sin versión no existe en producción.

```
/api/v1/solicitudes          GET (listar), POST (crear)
/api/v1/solicitudes/:id      GET (detalle), PATCH (actualizar estado)
/api/v1/viajes               GET
/api/v1/conductores          GET, POST
/api/v1/auth/login           POST
/api/v1/auth/logout          POST
```

Cuando haya un cambio breaking en el contrato de un endpoint, se crea `/api/v2/` para ese módulo específico. No se versiona todo el API, solo el módulo que cambia.

### 4.6 Middleware Stack

El orden de los middleware es parte de la arquitectura:

```
1. requestLogger        ← Log de request entrante (antes de todo)
2. cors(corsConfig)     ← CORS con origins permitidos (no wildcard)
3. express.json()       ← Parse body
4. globalRateLimiter    ← Rate limiting global
   ... rutas ...
N-1. notFoundHandler    ← 404 si ninguna ruta respondió
N.   errorHandler       ← Handler de errores (siempre último)
```

### 4.7 Manejo Centralizado de Errores

Un único `errorHandler` al final del stack. Todos los routes hacen `next(err)` y nunca capturan directamente con `res.status().json()`.

Tipos de error del dominio: `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `DatabaseError`.

El `errorHandler` es el único lugar que formatea las respuestas de error y decide qué información exponer al cliente (nunca stack traces en producción).

### 4.8 Logging con Pino

JSON estructurado. Nivel configurable por variable de entorno (`LOG_LEVEL`). Contexto obligatorio en cada log: al menos `userId` o `jobName` o `path`, más `solicitudId` u otro ID del recurso cuando aplique.

Los logs son para diagnóstico en producción, no para debugging durante desarrollo. El nivel `debug` nunca se activa en producción.

---

## 5. Arquitectura de Eventos

### 5.1 Principio

Los eventos de negocio son hechos que ya ocurrieron. Quien produce el evento no sabe quién lo consume. Esta arquitectura usa **Node.js EventEmitter** — síncrono, en proceso, sin infraestructura adicional. El diseño permite migrar a Bull/BullMQ o EventBridge en el futuro sin cambiar el código que produce los eventos.

### 5.2 Catálogo de Eventos de Negocio

| Evento | Disparado por | Consecuencias |
|---|---|---|
| `solicitud.creada` | Portal Cliente / ERP | Notificación, WhatsApp (futuro), Email coordinador (futuro) |
| `solicitud.aprobada` | ERP Coordinador | Notificación cliente, Email confirmación |
| `solicitud.cancelada` | ERP / Portal Cliente | Notificación cliente, WhatsApp cancelación, Email |
| `vehiculo.asignado` | ERP Coordinador | Notificación con conductor + placa |
| `viaje.iniciado` | Sync ControlT | Notificación en camino |
| `viaje.finalizado` | Sync ControlT | Notificación entregado, Email resumen |
| `cumplido.recibido` | ERP / Sync | Notificación, Email con documento |

Cada evento incluye: `id` (UUID para idempotencia futura), `occurredAt` (ISO timestamp), `userId` (quién disparó), y el `payload` específico del evento.

### 5.3 Camino hacia Event Bus Distribuido

```
Hoy:     eventEmitter.emit('solicitud.creada', payload)
Futuro:  eventBus.publish('solicitud.creada', payload)
```

El código que produce eventos no cambia. Solo se reemplaza el singleton. Los handlers pasan de listeners síncronos a workers de cola.

---

## 6. Arquitectura de Integraciones

### 6.1 Principio: Patrón Adaptador

El sistema de negocio no sabe cómo funciona ControlT, WhatsApp, o Avansat. Solo sabe que puede pedirle a un adaptador que haga algo. Si ControlT cambia su API, se cambia el adaptador — nada más.

```
Service
  ↓ llama interfaz
Adapter Interface (contrato)
  ↓ implementa
Concrete Adapter
  ↓ HTTP
External API
```

### 6.2 Estructura

```
integrations/
├── controlt/
│   ├── index.ts            ← Facade pública
│   ├── private.ts          ← integrations.controlt.io
│   ├── public.ts           ← app.controlt.com.co/apipublic
│   ├── token.ts            ← Gestión de tokens (ambas APIs)
│   ├── types.ts
│   └── mapper.ts           ← Mapeo ControlT → dominio INLOP
├── whatsapp/
├── avansat/
├── email/
└── interfaces/
    ├── notification.adapter.ts
    └── tracking.adapter.ts
```

### 6.3 Gestión de Tokens

Cada integración que requiere autenticación gestiona su token internamente en un `TokenManager`. Si el token falla, lanza excepción — nunca retorna null ni string vacío. El código que llama nunca maneja la lógica de renovación.

### 6.4 Supabase — Estrategia de Integración

El backend usa `@supabase/supabase-js` con service role. El frontend ERP nunca accede directamente a Supabase para datos de negocio — solo para autenticación.

```
Backend:  supabase.auth.admin.*   ← service role, operaciones admin
          supabase.from('tabla')  ← queries, sin RLS (service role)

Frontend: supabase.auth.*         ← login, logout, sesión
          fetch('/api/v1/...')    ← TODOS los datos de negocio
```

---

## 7. Arquitectura de Seguridad

### 7.1 Autenticación

Supabase Auth para todas las superficies. El backend verifica el JWT en cada request autenticado. El middleware extrae `userId`, `userRole`, y `empresaId` del JWT verificado y los agrega al objeto `Request`.

### 7.2 Autorización — RBAC

Los roles se almacenan en `app_metadata` del JWT (no `user_metadata` — solo el service role puede modificar `app_metadata`).

```
admin          ← Acceso completo, configuración del sistema
coordinador    ← Aprobar solicitudes, asignar conductores
operador       ← Ver solicitudes, registrar novedades
comercial      ← Módulo comercial, clientes
conductor      ← Portal Conductores únicamente
cliente_admin  ← Admin del Portal Cliente
cliente_user   ← Usuario básico del Portal Cliente
```

Los permisos se verifican en el Service, no en el Controller. El middleware `requireRole()` es un factory que produce middlewares Express para verificar roles antes de llegar al controller.

### 7.3 Row Level Security

RLS es la segunda línea de defensa. Incluso si el middleware falla, RLS en Postgres garantiza que un usuario no puede ver datos de otra empresa o rol.

### 7.4 Variables de Entorno

Las variables con `_KEY`, `_PASS`, `_TOKEN`, `_SECRET` en el nombre:
- Nunca van al repositorio
- Nunca tienen fallback hardcodeado en código
- El proceso no arranca si no están presentes

### 7.5 Auditoría

Toda operación de escritura en datos de negocio deja registro en la tabla `auditoria` con: tabla afectada, ID del registro, operación, estado previo (JSONB), estado nuevo (JSONB), usuario, IP, y timestamp. El Service escribe la auditoría — no el Repository.

### 7.6 Rate Limiting

```
Auth endpoints:    10 requests / 15 minutos
API general:       300 requests / minuto
Webhooks:          100 requests / minuto
```

---

## 8. Arquitectura de Base de Datos

### 8.1 Principios

1. Una única base de datos para todo el ecosistema
2. Nombres en español para tablas y columnas de negocio
3. `snake_case` para todos los identificadores de Postgres
4. `UUID v4` como primary key (`gen_random_uuid()`)
5. Timestamps en UTC como `TIMESTAMPTZ`
6. Soft delete — nunca borrado físico de entidades de negocio (`eliminado_en TIMESTAMPTZ NULL`)
7. Historial de estados — tabla `*_historial` por cada entidad con flujo de estados

### 8.2 Estructura de Entidades Principales

```
empresas_cliente
  └─< agencias_cliente
  └─< usuarios_cliente
  └─< solicitudes
        └─< solicitudes_historial
        └─< solicitudes_documentos
        └─< notificaciones_cliente

conductores
  └─< viajes
        └─< viajes_eventos

planeados
cumplidos
auditoria
```

### 8.3 Convenciones de Nombres de BD

```
Tablas:          plural snake_case           → solicitudes, conductores
Columnas:        snake_case                  → empresa_cliente_id
Foreign keys:    {tabla_singular}_id         → conductor_id
Timestamps:      *_en                        → creado_en, actualizado_en
Booleanos:       activo, habilitado, leida   (sin prefijo is_)
Historial:       {tabla}_historial           → solicitudes_historial
Relaciones:      {tabla_a}_{tabla_b}         → solicitudes_documentos
```

### 8.4 Repositorios

Cada repositorio expone exactamente las operaciones que necesita el negocio — no hay repositorios genéricos con métodos sin filtros. La interfaz del repositorio se define como TypeScript interface; la implementación accede a Supabase.

---

## 9. Estrategia de Escalabilidad

### 9.1 Fases de Crecimiento

```
FASE ACTUAL
  Backend: index.js monolítico (refactoring en progreso)
  Superficies: ERP + Portal Cliente
  Módulos: Solicitudes

FASE 1 (3-6 meses)
  Backend: monolito modular estructurado
  Módulos: Solicitudes + Conductores + Viajes básico

FASE 2 (6-12 meses)
  Superficies: + Portal Conductores
  Módulos: + Asignación + Mapa en vivo + Reportes básicos
  Integraciones: WhatsApp + Email transaccional

FASE 3 (12-18 meses)
  Superficies: + Portal Comercial + Dashboard Ejecutivo
  Módulos: + Clientes + Contratos + Analytics
  Infraestructura: + Bull/BullMQ para jobs asíncronos

FASE 4 (18-24 meses)
  Superficies: + App Móvil (React Native + Expo)
  Módulos: + Facturación + Conciliación + Liquidaciones
  Infraestructura: Evaluar separación si el equipo > 8 personas
```

### 9.2 Cómo Agregar una Nueva Superficie

1. Nueva SPA Vite con la misma estructura de carpetas
2. Copiar `styles/tokens.css` del ERP
3. Crear `lib/api/client.ts` propio
4. Agregar roles en `middleware/auth.ts` del backend
5. Crear rutas bajo `/api/v1/{superficie}/` en el backend
6. Deploy en Railway como servicio separado

No requiere tocar código existente — solo agregar.

### 9.3 Cuándo Considerar Microservicios

Solo cuando se cumplan simultáneamente: equipo > 8 desarrolladores, deployments conflictivos entre equipos, un módulo con requerimientos de escala radicalmente distintos, y el monolito modular ya causa problemas medibles.

### 9.4 Cuándo Extraer `@inlop/ui`

Cuando más de dos superficies comparten componentes y sincronizar tokens CSS entre proyectos genera inconsistencias en producción. Hasta ese momento: copiar `styles/tokens.css` y `components/ui/`.

---

## 10. Convenciones Oficiales

### 10.1 Naming

```
Componentes React:     PascalCase.tsx              → SolicitudDetalle.tsx
Hooks:                 use + PascalCase.ts          → useSolicitudes.ts
Servicios backend:     camelCase.service.ts         → solicitudes.service.ts
Controladores:         camelCase.controller.ts      → solicitudes.controller.ts
Repositorios:          camelCase.repository.ts      → solicitudes.repository.ts
Schemas Zod:           camelCase.schema.ts          → solicitudes.schema.ts
Tipos/Interfaces:      camelCase.types.ts           → solicitudes.types.ts
Adaptadores:           camelCase.adapter.ts         → controlt.adapter.ts

Variables/funciones:   camelCase                    → getSolicitudDetalle
Clases:                PascalCase                   → SolicitudService
Interfaces TS:         PascalCase sin prefijo I     → SolicitudDetalle
Constantes globales:   SCREAMING_SNAKE_CASE         → ESTADO_CFG
CSS variables:         --kebab-case                 → --inlop-navy
```

### 10.2 Commits

```
tipo(alcance): descripción corta en imperativo

feat(solicitudes): agregar filtro por canal en listado
fix(auth): corregir renovación de token expirado
refactor(backend): extraer syncViajes a módulo jobs
chore(deps): actualizar pino a v9
```

### 10.3 Reglas Obligatorias

**Frontend:**
- TypeScript estricto: `strict: true`, sin `any`, sin `as` para castear
- Cada feature tiene `index.ts` de barrel export
- Los componentes UI nunca importan desde `features/`
- Colores siempre como variables CSS, nunca valores hex directos
- Cada página tiene loading state y error state visibles
- Formularios validados con el mismo schema Zod que el backend
- React Router para toda navegación — nunca `useState<'vista1' | 'vista2'>`

**Backend:**
- Todos los endpoints bajo `/api/v1/`
- Todos los endpoints autenticados tienen su middleware de auth
- Todos los inputs validados con Zod antes del Controller
- Todos los errores terminan en `next(err)` — nunca `res.status().json()` directo
- Ningún `console.log` en código de producción — siempre `logger.*`
- Ninguna credencial hardcodeada — ni como fallback

**Ambos:**
- Sin comentarios que expliquen qué hace el código
- Sin `TODO` en código commiteado — van al issue tracker
- Sin código comentado — Git guarda el historial
- Sin archivos de más de 300 líneas

### 10.4 Patrones Prohibidos

```
❌ sbFetch() directo en controller o service
❌ fetch() al backend en un componente React (sin hook intermedio)
❌ Secrets como fallback: const PASS = env.PASS || 'valor_real'
❌ Misma función definida en dos lugares (parseSchedulate x2)
❌ Lógica de negocio en un Controller
❌ Acceso a base de datos en un Controller
❌ Catch silencioso: } catch(e) { return []; }
❌ res.status(500).json() directamente en un route handler
❌ cors() sin configuración de origins
❌ Importar desde otro feature directamente sin pasar por su index.ts
❌ Colores hex hardcodeados en componentes: color: #E30613
❌ Nuevas rutas fuera de /api/v1/ sin justificación documentada
```

### 10.5 Patrones Aprobados

```
✅ Handler de error global con next(err)
✅ Logging estructurado con contexto: logger.info({ solicitudId, userId }, 'msg')
✅ Zod para validación en frontend y backend (mismo schema cuando es posible)
✅ PostgREST embedded joins para evitar N+1
✅ Supabase Realtime para notificaciones push
✅ Feature flags vía variables de entorno: WHATSAPP_ENABLED=true
✅ Guard clauses en lugar de else profundos
✅ Tipos explícitos en todas las funciones públicas
```

---

## 11. Roadmap Arquitectónico

### Fase 0 — Deuda de Seguridad Crítica

1. Rotar `CT_PUBLIC_PASS` — expuesta en el repositorio
2. Eliminar todos los fallbacks hardcodeados de `index.js`
3. Startup con `process.exit(1)` para variables requeridas faltantes
4. Eliminar debug logs con cuerpos de ControlT (líneas 233-238)
5. Restringir CORS a orígenes específicos
6. Mover `SUPABASE_ANON_KEY` fuera del código fuente

**No se escribe feature nueva hasta que Fase 0 esté completa.**

### Fase 1 — Identidad Visual y Routing

1. Unificar design tokens CSS entre ERP y Portal Cliente
2. Agregar Barlow Condensed + DM Sans + DM Mono al ERP
3. Ajustar border-radius a 4-6px en componentes UI
4. Rediseñar LoginPage al estilo del Portal Cliente
5. Implementar React Router v7
6. Agregar `ErrorBoundary` global
7. Implementar sistema de Toast

### Fase 2 — Backend Estructurado

1. Crear estructura `src/` en el backend
2. Extraer utilidades a `utils/`
3. Extraer constantes a `constants/`
4. Implementar `errorHandler.ts` centralizado
5. Implementar `pino`
6. Crear módulo `solicitudes` (controller + service + repository)
7. Agregar auth middleware a endpoints ERP
8. Validación Zod en todos los endpoints con input
9. Prefix `/api/v1/`

### Fase 3 — Jobs y Cache Persistente

1. Jobs con guards anti-overlap
2. Supabase como persistencia para datos ControlT
3. PostgREST embedded joins para solicitudes
4. Handlers de eventos básicos

### Fase 4+ — Portal Conductores, Notificaciones, Comercial

Ver sección 9.1 para el detalle por fase.

### Lo que Nunca Debe Hacerse

```
🚫 Agregar lógica de negocio a index.js directamente
🚫 Resolver problemas de arquitectura con más código en el mismo archivo
🚫 Hardcodear URLs de APIs externas fuera del archivo de config del adaptador
🚫 Reemplazar Supabase Auth por un sistema propio
🚫 Introducir microservicios sin haber agotado el monolito modular
🚫 Agregar una abstracción sin un problema concreto que la justifique
🚫 Saltarse la validación de entrada porque el frontend ya validó
🚫 Deploy directo a producción sin pasar por la rama de desarrollo
🚫 Agregar dependencias npm sin evaluar mantenibilidad, tamaño y seguridad
```

---

## 12. Reglas para Desarrollo Asistido por IA

### 12.1 Propósito de Esta Sección

Esta sección define el contrato de comportamiento que Claude y cualquier otra IA deben respetar al trabajar en el ecosistema INLOP. El objetivo es que la IA opere como un desarrollador senior incorporado al proyecto: con criterio, con contexto, con disciplina, y con la misma responsabilidad que cualquier miembro del equipo.

La IA no es solo un generador de código. Es un participante activo en la toma de decisiones técnicas. Por eso sus acciones deben ser predecibles, conservadoras respecto a la arquitectura, y siempre justificadas.

### 12.2 Protocolo de Inicio Obligatorio

Antes de escribir, modificar, o eliminar cualquier archivo, la IA debe:

1. **Leer y entender el contexto relevante.** Si la tarea involucra un módulo existente, leer los archivos relacionados antes de actuar. No asumir el estado del código — verificarlo.

2. **Verificar la existencia de soluciones reutilizables.** Buscar si ya existe un componente, función, tipo, o patrón que resuelva el problema antes de crear algo nuevo. La búsqueda es obligatoria, no opcional.

3. **Identificar conflictos con el Documento de Arquitectura.** Si la solicitud entra en conflicto con alguna decisión documentada en este archivo, detener la implementación, explicar el conflicto específico, y proponer una alternativa compatible antes de proceder.

4. **Comunicar el plan antes de ejecutarlo** cuando el cambio afecta más de un archivo o involucra una decisión de diseño no trivial.

### 12.3 Reglas de Implementación

**Regla 1 — No duplicar lógica ni componentes**

Si ya existe una función `parseSchedulate` en `utils/dates.ts`, no crear otra en otro archivo. Si ya existe un componente `Button` en `components/ui/`, no crear un botón inline con estilos propios en un feature. Toda duplicación es un error de arquitectura que debe señalarse y corregirse, no perpetuarse.

**Regla 2 — Buscar primero, crear después**

El orden es siempre: buscar → reutilizar → extender → crear. Crear algo desde cero solo cuando las tres primeras opciones no resuelven el problema. Si se crea algo nuevo que es candidato a ser reutilizado en el futuro, debe ubicarse en el lugar correspondiente según la arquitectura (no en el feature que lo necesita primero).

**Regla 3 — No romper funcionalidades existentes**

Todo cambio que modifique código existente debe considerar explícitamente su impacto en los módulos que dependen de ese código. Si hay riesgo de regresión, la IA debe identificarlo y mitigarlo antes de hacer el cambio, o alertar al equipo. El silencio ante un riesgo de regresión no es aceptable.

**Regla 4 — No modificar arquitectura sin justificación**

Si la implementación de una tarea requiere desviarse de la arquitectura definida en este documento, la IA debe:
1. Detenerse
2. Explicar qué aspecto de la arquitectura está en conflicto
3. Proponer una alternativa compatible
4. Esperar aprobación antes de proceder

No se modifica la arquitectura para facilitar una tarea. Se busca la forma de hacer la tarea dentro de la arquitectura.

**Regla 5 — Compatibilidad con el Documento de Arquitectura Maestro**

Este documento es la referencia de diseño. Toda implementación debe ser compatible con él. Si el documento no cubre un caso específico, la IA debe decidir en el espíritu del documento (extrapolando los principios existentes), documentar la decisión tomada, y proponer actualizar el documento si la decisión establece un nuevo patrón.

**Regla 6 — Todo cambio debe compilar sin errores**

Antes de reportar una implementación como completa, la IA debe verificar que el código compila sin errores de TypeScript (`tsc --noEmit`). Un cambio que no compila no está completo. No se hace commit de código con errores de TypeScript.

**Regla 7 — TypeScript limpio y estricto**

- Prohibido `any` — si el tipo es desconocido, usar `unknown` y narrowing explícito
- Prohibido `as` para castear — si se necesita, hay un problema de tipado que resolver correctamente
- Prohibido `// @ts-ignore` y `// @ts-expect-error` sin justificación documentada en el mismo comentario
- Tipos explícitos en todas las firmas de funciones públicas — no depender de inferencia en la API pública de un módulo
- Interfaces para contratos externos, types para uniones y aliases

**Regla 8 — No eliminar funcionalidades sin autorización**

Si durante una tarea se identifica código que parece obsoleto o innecesario, la IA debe señalarlo y esperar confirmación antes de eliminarlo. El juicio de que algo "no se usa" puede ser incorrecto sin el contexto completo del sistema. La eliminación de código existente requiere autorización explícita.

**Regla 9 — Justificar nuevas dependencias externas**

Agregar una dependencia npm es una decisión de arquitectura, no de implementación. Toda nueva dependencia debe justificarse con:
- El problema concreto que resuelve que no tiene solución con el código existente o con las dependencias ya presentes
- El tamaño del bundle que agrega (frontend) o la superficie de ataque que introduce (backend)
- El nivel de mantenimiento del paquete (última versión, issues abiertos, descargas semanales)
- La alternativa nativa o manual que fue descartada y por qué

Si la justificación no es sólida, usar la solución sin dependencia externa aunque sea más código.

**Regla 10 — Consistencia visual con el Portal Cliente**

Toda implementación UI en el ERP debe ser consistente con el lenguaje visual del Portal Cliente: tipografía Barlow Condensed + DM Sans + DM Mono, border-radius 4-6px, tokens de color del design system, espaciado consistente. Si existe un componente equivalente en el Portal Cliente, el equivalente en el ERP debe seguir el mismo patrón visual aunque sea una implementación independiente.

**Regla 11 — Reutilización sobre velocidad**

Cuando hay una tensión entre implementar algo rápido con código nuevo versus tomarse el tiempo de reutilizar o extender lo que existe, la respuesta correcta es siempre la reutilización. La velocidad de corto plazo que genera deuda técnica no es velocidad real — es deuda disfrazada de avance.

**Regla 12 — Proponer mejores soluciones antes de implementar la solicitada**

Si durante el análisis de una tarea la IA identifica que la solución solicitada tiene problemas técnicos, entra en conflicto con la arquitectura, o existe una alternativa notablemente mejor, debe:
1. Explicar la solución solicitada y su problema
2. Proponer la alternativa con su justificación
3. Esperar confirmación del equipo

No implementar silenciosamente una solución distinta a la solicitada sin comunicarlo primero. Tampoco implementar la solución solicitada cuando se sabe que tiene un problema — señalarlo es parte del rol.

### 12.4 Reglas de Comunicación

**Antes de actuar:** Confirmar el entendimiento de la tarea con una oración. Si hay ambigüedad, preguntar antes de asumir.

**Durante la implementación:** Comunicar decisiones no triviales en el momento en que se toman. No trabajar en silencio durante cambios que afectan múltiples archivos.

**Al completar:** Informar qué se hizo, qué archivos se modificaron, y si hubo alguna decisión de diseño que deba ser revisada o documentada.

**Ante un conflicto arquitectónico:** Nunca resolverlo silenciosamente. Siempre escalar al equipo con el conflicto explicado y las opciones disponibles.

### 12.5 Alcance de las Restricciones

Estas reglas aplican sin excepción a:
- Cualquier archivo bajo `erp/src/`
- Cualquier archivo bajo `backend/src/`
- El archivo `index.js` hasta que sea migrado
- Los archivos de configuración del proyecto (`tsconfig.json`, `vite.config.ts`, `package.json`)
- Este documento de arquitectura

Cualquier modificación a este documento requiere aprobación explícita del equipo técnico y debe ser registrada como una versión nueva con fecha y descripción del cambio.

### 12.6 Lo que la IA Nunca Debe Hacer Sin Autorización Explícita

```
🚫 Modificar la rama main o producción
🚫 Tocar archivos de appclienteinlop (Portal Cliente) — solo lectura para referencia
🚫 Eliminar archivos existentes
🚫 Cambiar la estructura de carpetas definida en este documento
🚫 Agregar dependencias npm sin justificación documentada
🚫 Modificar configuraciones de deploy (railway.json, Dockerfile)
🚫 Cambiar variables de entorno en producción
🚫 Hacer push a ramas distintas a las asignadas en la sesión
🚫 Crear PRs sin instrucción explícita del equipo
🚫 Implementar una solución diferente a la discutida sin comunicarlo primero
```

---

*Documento de Arquitectura Maestro — Versión 1.1*
*Ecosistema INLOP — Referencia técnica obligatoria para todo el desarrollo*
*Cualquier cambio a este documento requiere aprobación explícita y bump de versión*
