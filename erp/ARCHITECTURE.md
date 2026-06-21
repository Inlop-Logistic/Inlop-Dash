# INLOP ERP — Arquitectura Frontend

> Capas del sistema, flujos de datos, patrones y decisiones técnicas.

---

## 1. Diagrama general de capas

```
┌──────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Next.js App Router                       │  │
│  │                                                            │  │
│  │   ┌─────────┐   ┌──────────┐   ┌───────────────────────┐  │  │
│  │   │  Shell  │   │  Auth    │   │    Feature Modules     │  │  │
│  │   │ (layout │   │ MSAL +   │   │  operaciones │ financiero  │  │
│  │   │ sidebar │   │ Supabase │   │  otif │ obligaciones    │  │  │
│  │   │ header) │   │          │   │  seguimiento │ proyecto│  │  │
│  │   └─────────┘   └──────────┘   └───────────────────────┘  │  │
│  │                                                            │  │
│  │   ┌────────────────────────────────────────────────────┐  │  │
│  │   │                  Services Layer                    │  │  │
│  │   │  supabase │ xlsxParser │ aiClient │ sharepoint     │  │  │
│  │   └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │   ┌────────────────────────────────────────────────────┐  │  │
│  │   │              Design System (@inlop/ds)             │  │  │
│  │   │   tokens CSS │ componentes base │ tipografía       │  │  │
│  │   └────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
     Supabase             Azure AD            Claude API
    (PostgreSQL           (MSAL /              (Anthropic)
     Auth + RT)         Microsoft)
```

---

## 2. Las cinco capas en detalle

### Capa 1 — Design System (`packages/ds`)

El design system INLOP ya existe en forma de variables CSS y clases utilitarias en el HTML monolítico. En el ERP se extrae como paquete independiente.

**Qué contiene:**
- **Tokens de color**: `--navy`, `--red`, `--green`, `--amber`, `--danger`, `--blue` y sus variantes de opacidad
- **Tokens de tipografía**: familias Anton, Barlow Condensed, DM Sans, JetBrains Mono con sus escalas de tamaño y peso
- **Tokens de espaciado**: escala de 4px base
- **Tokens de elevación**: sombras de 3 niveles (`--m-elev-1/2/3`)
- **Componentes base sin lógica**: KpiCard, Badge, ProgressBar, Card, Table, Modal, Toast, Alert
- **Dos temas**: oscuro (original) y claro (v4 `inlop-ds-v4`), activados por `data-theme` en `<html>`

**Regla**: el paquete `@inlop/ds` no importa React. Exporta CSS y tipos TypeScript de los tokens. Esto permite usarlo desde cualquier framework y garantiza que el equipo de diseño itere sin tocar lógica.

### Capa 2 — UI Components (`apps/web/src/components/ui`)

Componentes React construidos sobre el DS. No tienen lógica de negocio ni conocen Supabase.

- Reciben datos por **props tipadas**
- Emiten eventos por **callbacks**
- Son completamente testeables en aislamiento (Storybook)
- Representan el vocabulario visual: `<KpiCard>`, `<DataTable>`, `<AlertCard>`, `<ChartLine>`, `<ChartDonut>`, `<WeekSelector>`, `<FilterBar>`, `<Badge>`, `<ProgressBar>`, `<Toast>`

### Capa 3 — Layout Components (`apps/web/src/components/layout`)

Estructuras de página que componen UI Components y dan forma al shell de la aplicación.

- `<AppShell>`: estructura base (sidebar + header + área de contenido con scroll)
- `<Sidebar>`: navegación principal, soporte colapsado/expandido, tooltips en modo icono
- `<Header>`: título del módulo, usuario autenticado, reloj, controles de administrador
- `<FilterBar>`: filtros globales de semana, cliente, mes y tipo de carga (Líquida/Seca)
- `<AlertBanner>`: banner superior de estado del sistema

### Capa 4 — Feature Modules (`apps/web/src/features/<modulo>`)

Cada módulo del negocio vive en su propia carpeta `features/`. Un módulo es completamente autónomo:

```
features/operaciones/
├── components/       # Componentes exclusivos: NominacionTable, KpiGrid, AlertsGrid
├── hooks/            # Lógica de estado: useOperaciones, useFilters, useExcelUpload
├── services/         # Llamadas a Supabase y AI específicas del módulo
├── stores/           # Estado Zustand del módulo
├── types/            # Tipos del dominio: Viaje, Nominacion, SemanaData, AlertaOps
├── utils/            # Funciones puras: calcularKPIs(), buildAnalysisPrompt()
└── index.ts          # Barrel export del módulo
```

**Regla**: los módulos no se importan entre sí. El acoplamiento entre módulos se hace exclusivamente a través de `packages/types` (contratos compartidos) y del estado del shell (identidad del usuario).

### Capa 5 — Pages / Routes (`apps/web/src/app`)

Páginas de Next.js App Router. Son delegadores puros: reciben parámetros de URL, coordinan la carga de datos inicial y renderizan el feature correspondiente.

```
app/
├── (auth)/                   # Grupo sin shell: login, forgot-password, reset-password
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
├── (portal)/                 # Grupo con AppShell + auth guard
│   ├── layout.tsx            # Verifica sesión; redirige a /login si no hay sesión
│   ├── page.tsx              # Portada / dashboard consolidado
│   ├── operaciones/page.tsx  # → features/operaciones
│   ├── financiero/page.tsx   # → features/financiero
│   ├── otif/page.tsx         # → features/otif
│   ├── obligaciones/page.tsx # → features/obligaciones
│   ├── seguimiento/page.tsx  # → features/seguimiento
│   └── proyecto/page.tsx     # → features/proyecto
│
└── api/                      # Route Handlers de servidor
    └── ai/analisis/route.ts  # Proxy seguro hacia Claude API
```

---

## 3. Flujo de autenticación

```
                    Usuario llega a una ruta del portal
                                  │
                    ┌─────────────▼─────────────┐
                    │  layout.tsx verifica sesión │
                    └─────────────┬─────────────┘
                                  │
                     ¿Sesión Supabase activa?
                    /                           \
                  No                            Sí
                  │                             │
    Redirige a /login               Renderiza el módulo
                  │
    ┌─────────────┴──────────────┐
    │                            │
    ▼                            ▼
  Opción A: MSAL             Opción B: Email/Password
  Microsoft Azure AD          Supabase Auth
    │                            │
  MSAL popup → token          email + password
  → setSupabaseSession()      → supabase.signIn()
    │                            │
    └────────────┬───────────────┘
                 │
         Sesión Supabase activa
         Zustand: setUser()
                 │
         Redirige al portal
```

**PIN de administrador**: capa adicional sobre la sesión. Controla el acceso a los controles de carga de Excel y configuración. Se verifica en cliente (no invalida la sesión Supabase).

---

## 4. Flujo de ingesta de datos — Excel

```
Usuario sube o descarga desde SharePoint
         │
         ▼
  xlsxParser.ts — SheetJS lee el binario
         │
         ▼
  validateSchema() — Zod verifica la estructura
         │
    ┌────┴────┐
    │         │
  Error    Válido
    │         │
  Toast     parseRows() → DATA_LIQ[] y DATA_SEC[]
  error       │
              ├── zustand.setData()      ← estado en memoria
              ├── localStorage.setItem() ← copia offline
              └── saveToSupabase()       ← persistencia en nube
                       │
                  TanStack Query
                  invalida caché
                       │
                  Re-render reactivo
```

**Principio clave**: el parsing y la validación son funciones puras en `utils/` — testeables sin DOM, sin React, sin Supabase. El estado y la persistencia son efectos secundarios que se aplican después.

---

## 5. Flujo de análisis con IA

```
Usuario pulsa "Generar análisis"
         │
         ▼
  hooks/useAiAnalysis.ts
  → POST /api/ai/analisis
    (con token Supabase en Authorization header)
         │
         ▼
  Server Route Handler — app/api/ai/analisis/route.ts
         │
         ├── Verifica sesión Supabase (rechaza sin sesión válida)
         ├── Construye prompt con datos de la semana activa
         │   (tipo de carga, KPIs, déficits, alertas)
         ├── Llama Claude API (API key en variable de entorno servidor)
         │
         ▼
  Streaming de respuesta → Response stream
         │
         ▼
  Hook consume el stream en el cliente
         │
  Zustand actualiza el análisis por secciones
         │
  UI renderiza en tiempo real (streaming visible al usuario)
```

**Corrección de seguridad crítica**: en el sistema actual, la API key de Claude se guarda en `localStorage` del cliente y se expone en el bundle JavaScript. En el ERP, la key vive exclusivamente en variables de entorno del servidor (`process.env.ANTHROPIC_API_KEY`) y nunca llega al navegador.

---

## 6. Gestión de estado

| Tipo de estado | Tecnología | Dónde vive | Ejemplo |
|---|---|---|---|
| Datos del servidor (Supabase) | TanStack Query | Caché React Query | Tareas del comité, historial HSEQ |
| Datos de Excel (sesión) | Zustand | Memoria + localStorage | DATA_LIQ, DATA_SEC, semana activa |
| Preferencias de UI | Zustand persist | localStorage | Sidebar colapsado, filtros activos |
| Identidad del usuario | Supabase Auth context | Contexto React | Nombre, rol, oficina |
| Análisis IA (caché) | TanStack Query | Caché + localStorage | Respuestas por semana (TTL: 24h) |
| Formularios / modales | React Hook Form | Estado local del componente | Editar acción, nueva tarea comité |

---

## 7. Estrategia offline-first

El sistema actual usa `localStorage` como fallback cuando Supabase no está disponible. El ERP mantiene esa garantía con un patrón más robusto:

1. **TanStack Query** mantiene los datos del servidor en caché con `staleTime` configurable por módulo.
2. **Zustand persist** escribe los datos de Excel y las preferencias en `localStorage` automáticamente.
3. La UI muestra un indicador visual cuando opera sin conexión a Supabase.
4. Al recuperar conexión, los datos locales pendientes se sincronizan automáticamente.

Esto garantiza que el equipo de operaciones puede trabajar con el Excel aunque Supabase esté momentáneamente inaccesible.

---

## 8. Design System — Estrategia de migración desde el HTML actual

El DS actual tiene dos temas completos con ~80 variables CSS y ~40 clases de componentes. La migración sigue tres pasos:

1. **Extracción**: las variables CSS se mueven sin cambios de nombre a `packages/ds/tokens.css`. El sistema funciona igual que antes, solo cambia el archivo fuente.
2. **Extensión Tailwind**: `tailwind.config.ts` mapea los tokens a utilidades (`text-navy`, `bg-red`, `border-line2`). No se reescribe CSS, se añaden aliases.
3. **Componentización progresiva**: los patrones de HTML repetidos (`.kpi`, `.card`, `.badge`) se convierten en componentes React de UI, uno por uno, sin cambiar su aspecto visual.

**Regla de compatibilidad**: durante la transición, el CSS del DS antiguo puede coexistir en las páginas que aún no han sido migradas. No se rompe nada hasta que el componente React reemplaza al fragmento HTML.

---

## 9. Decisiones de arquitectura y alternativas descartadas

| Decisión tomada | Alternativa descartada | Razón |
|---|---|---|
| Next.js 14 App Router | Vite + React SPA | SSR mejora carga inicial de tablas grandes; Railway soporta Next.js nativamente; Server Actions para IA |
| pnpm monorepo | Múltiples repositorios | DS y tipos son compartidos; un solo repo simplifica el ciclo de revisión y los releases |
| Feature-first folders | Layer-first (`components/`, `hooks/`, `pages/`) | Cada módulo es un dominio independiente; facilita asignar módulos a desarrolladores diferentes sin conflictos |
| Zustand para datos Excel | Redux Toolkit | El estado de Excel es local a la sesión del usuario, no necesita middleware ni devtools complejos |
| Claude API en servidor | En cliente como el sistema actual | La API key nunca puede estar en el bundle del cliente; los datos del Excel pueden ser sensibles |
| Tailwind sobre CSS Modules | CSS Modules puros | Tailwind consume las variables CSS existentes sin cambiar el sistema de tokens; productividad inmediata |
| Chart.js (mismo que hoy) | Recharts / Victory | Curva cero; los charts actuales ya están configurados y funcionan bien con los datos del dominio |

---

## 10. Responsabilidades por módulo

| Módulo | Fuente de datos | Nivel de interactividad | IA generativa | Tiempo real |
|---|---|---|---|---|
| **Operaciones** | Excel upload + Supabase (acciones, causas) | Alto (filtros, edición inline) | Sí (análisis semanal y gerencial) | No |
| **Financiero** | Supabase | Medio | No (fase inicial) | No |
| **OTIF** | Supabase + Excel | Medio | No (fase inicial) | No |
| **Obligaciones** | Supabase | Medio (CRUD) | No | No |
| **Torre de Control** | Supabase Realtime | Alto | No (fase inicial) | Sí |
| **Project / Comité** | Supabase | Alto (edición inline, ruleta HSEQ) | No | No |
| **Portal** | Supabase (stats consolidadas) | Bajo (navegación) | No | No |
