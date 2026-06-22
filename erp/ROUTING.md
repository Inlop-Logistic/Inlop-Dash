# INLOP ERP — Routing Structure

> **FASE 2 — Application Shell**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Estrategia de Routing

El ERP usa el **App Router de Next.js 14+** con:

- **Route Groups**: `(auth)` y `(portal)` para separar layouts.
- **Layouts anidados**: el shell persiste; solo el área de contenido cambia.
- **Server Components por defecto**: los módulos son RSC; solo los componentes interactivos se marcan como Client Components.
- **Streaming**: las páginas envían el shell inmediatamente y streaman el contenido del módulo.
- **Parallel Routes**: para módulos que muestran múltiples paneles independientes (futuro).

---

## 2. Árbol de Rutas Completo

```
app/
│
├── layout.tsx                      ← Root layout (providers globales, fuentes, meta)
│
├── (auth)/                         ← Grupo sin shell principal
│   ├── layout.tsx                  ← Layout centrado para auth
│   ├── login/
│   │   └── page.tsx                → /login
│   ├── callback/
│   │   └── page.tsx                → /callback  (MSAL OAuth return)
│   ├── error/
│   │   └── page.tsx                → /error     (auth error display)
│   └── sin-permiso/
│       └── page.tsx                → /sin-permiso
│
└── (portal)/                       ← Grupo con shell principal (Sidebar + Topbar)
    ├── layout.tsx                  ← Shell layout (AuthGuard + Shell components)
    │
    ├── page.tsx                    → /  (redirect → /operaciones)
    │
    ├── operaciones/
    │   ├── layout.tsx              ← Layout del módulo (tabs, filtros de módulo)
    │   ├── page.tsx                → /operaciones  (redirect → /operaciones/resumen)
    │   ├── resumen/
    │   │   └── page.tsx            → /operaciones/resumen
    │   ├── tendencia/
    │   │   └── page.tsx            → /operaciones/tendencia
    │   ├── seguimiento/
    │   │   └── page.tsx            → /operaciones/seguimiento
    │   └── envio/
    │       └── [id]/
    │           ├── page.tsx        → /operaciones/envio/[id]
    │           └── loading.tsx     ← Skeleton de detalle de envío
    │
    ├── financiero/
    │   ├── layout.tsx
    │   ├── page.tsx                → /financiero  (redirect → /financiero/dashboard)
    │   ├── dashboard/
    │   │   └── page.tsx            → /financiero/dashboard
    │   ├── ingresos/
    │   │   └── page.tsx            → /financiero/ingresos
    │   ├── egresos/
    │   │   └── page.tsx            → /financiero/egresos
    │   ├── flujo-caja/
    │   │   └── page.tsx            → /financiero/flujo-caja
    │   └── reportes/
    │       └── page.tsx            → /financiero/reportes
    │
    ├── otif/
    │   ├── layout.tsx
    │   ├── page.tsx                → /otif  (redirect → /otif/dashboard)
    │   ├── dashboard/
    │   │   └── page.tsx            → /otif/dashboard
    │   ├── analisis/
    │   │   └── page.tsx            → /otif/analisis
    │   └── historico/
    │       └── page.tsx            → /otif/historico
    │
    ├── obligaciones/
    │   ├── layout.tsx
    │   ├── page.tsx                → /obligaciones  (redirect → /obligaciones/dashboard)
    │   ├── dashboard/
    │   │   └── page.tsx            → /obligaciones/dashboard
    │   ├── vencimientos/
    │   │   └── page.tsx            → /obligaciones/vencimientos
    │   ├── documentos/
    │   │   └── page.tsx            → /obligaciones/documentos
    │   └── calendario/
    │       └── page.tsx            → /obligaciones/calendario
    │
    ├── seguimiento/
    │   ├── layout.tsx
    │   ├── page.tsx                → /seguimiento  (redirect → /seguimiento/mapa)
    │   ├── mapa/
    │   │   └── page.tsx            → /seguimiento/mapa
    │   ├── lista/
    │   │   └── page.tsx            → /seguimiento/lista
    │   └── alertas/
    │       └── page.tsx            → /seguimiento/alertas
    │
    ├── planeacion/
    │   ├── layout.tsx
    │   ├── page.tsx                → /planeacion  (redirect → /planeacion/dashboard)
    │   ├── dashboard/
    │   │   └── page.tsx            → /planeacion/dashboard
    │   ├── capacidad/
    │   │   └── page.tsx            → /planeacion/capacidad
    │   ├── calendario/
    │   │   └── page.tsx            → /planeacion/calendario
    │   └── simulador/
    │       └── page.tsx            → /planeacion/simulador
    │
    └── proyecto/
        ├── layout.tsx
        ├── page.tsx                → /proyecto  (redirect → /proyecto/dashboard)
        ├── dashboard/
        │   └── page.tsx            → /proyecto/dashboard
        ├── proyectos/
        │   └── page.tsx            → /proyecto/proyectos
        ├── proyecto/
        │   └── [id]/
        │       ├── page.tsx        → /proyecto/proyecto/[id]
        │       └── loading.tsx
        ├── comite/
        │   └── page.tsx            → /proyecto/comite
        └── comite/
            └── [id]/
                └── page.tsx        → /proyecto/comite/[id]
```

---

## 3. Archivos Especiales de Ruta

### 3.1 `loading.tsx` — Skeleton de Carga

Cada módulo define su propio `loading.tsx` con un skeleton que replica la estructura visual esperada:

| Módulo | Contenido del skeleton |
|---|---|
| `operaciones` | 4 KpiCard skeleton + 2 ChartCard skeleton + Table skeleton |
| `financiero` | 3 KpiCard skeleton + ChartCard skeleton + Table skeleton |
| `otif` | 2 KpiCard skeleton + ChartCard skeleton |
| `seguimiento` | Mapa placeholder + lista skeleton |
| Recursos `[id]` | Skeleton del layout de detalle específico |

### 3.2 `error.tsx` — Manejo de Errores

Cada módulo define su propio `error.tsx` con el componente `ErrorState`:

- Muestra mensaje descriptivo del error.
- Botón para reintentar (llama a `router.refresh()`).
- Link para volver al dashboard del módulo.
- No expone stack trace en producción.

### 3.3 `not-found.tsx` — 404

Una única página 404 global en el root de `(portal)`:

- Indica que la sección no existe.
- Sugiere volver al módulo principal.
- No muestra error de ruta técnico.

### 3.4 `layout.tsx` del Portal

El layout raíz del grupo `(portal)` es el que monta el shell:

```
PortalLayout responsabilidades:
  1. Verificar sesión activa (AuthGuard)
  2. Cargar datos del usuario y empresa
  3. Inicializar Providers (Empresa, Permisos, Notificaciones)
  4. Renderizar Sidebar + Topbar
  5. Renderizar {children} en el área de contenido
```

### 3.5 `layout.tsx` de Módulo

Cada módulo puede tener su propio layout que agrega:
- Verificación de permiso específico del módulo.
- Filtros y contextos compartidos entre sub-rutas del módulo.
- Tabs de segundo nivel.

---

## 4. Rutas de API (Route Handlers)

Next.js App Router Route Handlers en `app/api/`:

```
app/api/
├── auth/
│   ├── session/route.ts            → GET  /api/auth/session
│   └── logout/route.ts             → POST /api/auth/logout
│
├── ai/
│   └── analisis/route.ts           → POST /api/ai/analisis
│                                       (proxy seguro hacia Claude API)
│
├── excel/
│   └── upload/route.ts             → POST /api/excel/upload
│
└── export/
    └── reportes/route.ts           → POST /api/export/reportes
```

### Principio de API Routes

Las API Routes solo existen para:
1. **Operaciones server-side obligatorias**: llamadas a Claude API (clave secreta), exportaciones pesadas.
2. **Proxies de seguridad**: operaciones que no deben exponer claves al cliente.
3. **Webhooks**: receptores de eventos externos.

Las llamadas a Supabase se hacen directamente desde Server Components o desde el cliente con el cliente público de Supabase. No se crea un API REST interno innecesario.

---

## 5. Parámetros de Ruta

### 5.1 Segmentos Dinámicos

| Segmento | Módulo | Descripción |
|---|---|---|
| `/operaciones/envio/[id]` | Operaciones | ID del envío |
| `/proyecto/proyecto/[id]` | Proyecto | ID del proyecto |
| `/proyecto/comite/[id]` | Proyecto | ID del acta de comité |

### 5.2 Validación de Parámetros

- Los IDs dinámicos se validan en el Server Component antes de hacer fetch.
- Si el ID no existe o el usuario no tiene acceso al recurso: se renderiza `not-found()`.
- No se usa `try/catch` de navegación; Next.js maneja el error vía `error.tsx`.

### 5.3 Query Params Estándar

| Param | Tipo | Módulos que lo consumen |
|---|---|---|
| `desde` | `YYYY-MM-DD` | Todos |
| `hasta` | `YYYY-MM-DD` | Todos |
| `q` | string | Operaciones, OTIF, Obligaciones |
| `carrier` | string | OTIF |
| `estado` | string | Operaciones, Obligaciones |
| `empresa` | string (UUID) | Global (multiempresa) |

---

## 6. Redirects y Reescrituras

### 6.1 Redirects de Raíz

```
/                    →  /operaciones/resumen    (módulo por defecto)
/operaciones         →  /operaciones/resumen
/financiero          →  /financiero/dashboard
/otif                →  /otif/dashboard
/obligaciones        →  /obligaciones/dashboard
/seguimiento         →  /seguimiento/mapa
/planeacion          →  /planeacion/dashboard
/proyecto            →  /proyecto/dashboard
```

Estos redirects son `permanentes: false` (código 307) ya que el módulo por defecto puede cambiar según el rol del usuario.

### 6.2 Redirect Post-Login

```
Flujo:
  1. Usuario intenta acceder a /financiero/ingresos sin sesión
  2. Guard redirige a /login?returnUrl=/financiero/ingresos
  3. Usuario se autentica
  4. Sistema redirige a /financiero/ingresos (el returnUrl)
  5. Si no hay returnUrl: redirige a /operaciones/resumen
```

### 6.3 Redirect por Cambio de Empresa

```
Al cambiar empresa:
  - Si el módulo actual existe en la nueva empresa: permanece en la ruta actual
  - Si el módulo no existe en la nueva empresa: redirige a /operaciones/resumen
```

---

## 7. Middleware de Ruta

El `middleware.ts` en la raíz del proyecto intercepta todas las requests para:

### 7.1 Responsabilidades del Middleware

| Responsabilidad | Descripción |
|---|---|
| **Auth check** | Verifica que el token de sesión sea válido. Si no: redirige a /login. |
| **Return URL** | Si hay redirect a login, guarda la URL original como query param. |
| **Empresa check** | Si hay multiempresa, verifica que `empresa` en cookie/param sea válida para el usuario. |
| **CORS headers** | Agrega headers de seguridad a las respuestas. |

### 7.2 Rutas Excluidas del Middleware

```
Excluidas (públicas):
  /login
  /callback
  /error
  /api/auth/*
  /_next/*
  /favicon.ico
  /public/*
```

---

## 8. Estrategia de Rendering por Ruta

| Tipo de ruta | Rendering | Razón |
|---|---|---|
| `/login`, `/callback` | CSR / Client Component | Depende de estado del browser (MSAL SDK) |
| Dashboards de módulo | RSC + Streaming | Datos del servidor, SEO interno irrelevante |
| Vistas de detalle `[id]` | RSC con suspense | Fetch del recurso específico en servidor |
| Componentes interactivos | Client Component | Filtros, gráficas, formularios |
| Layout del shell | RSC | Se renderiza en servidor; no cambia por interacción |

---

## 9. Caché de Rutas

### 9.1 Router Cache (Client)

Next.js cachea el payload de rutas visitadas en el cliente:

- Duración por defecto: 30s para páginas dinámicas.
- El ERP invalida el Router Cache al:
  - Cambiar de empresa.
  - Cerrar sesión.
  - Carga exitosa de Excel (datos cambiaron).

### 9.2 Data Cache (Server)

Las funciones `fetch` de Server Components usan el Data Cache de Next.js:

- Los datos de Supabase se revalidan con `revalidatePath` / `revalidateTag` cuando hay mutaciones.
- Los datos de KPIs tienen TTL corto (30s–2min).
- Los datos históricos tienen TTL largo (10min+).

### 9.3 Full Route Cache

No se usa Static Generation para ninguna ruta del ERP (todos los datos son dinámicos y por usuario). Todas las rutas son dinámicas.
