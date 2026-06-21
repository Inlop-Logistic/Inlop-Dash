# INLOP ERP — Estructura de Carpetas

> Árbol completo del monorepo con explicación de cada directorio.

---

## Vista general del monorepo

```
inlop-erp/                          ← Raíz del monorepo
│
├── apps/
│   └── web/                        ← Aplicación web principal (Next.js)
│
├── packages/
│   ├── ds/                         ← Design System INLOP
│   ├── types/                      ← Tipos TypeScript compartidos
│   ├── supabase/                   ← Cliente y tipos de base de datos
│   ├── auth/                       ← MSAL + Supabase Auth
│   ├── xlsx/                       ← Parser de Excel
│   └── utils/                      ← Utilidades compartidas
│
├── docs/                           ← Documentación técnica adicional
│
├── package.json                    ← pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json                      ← Configuración de Turborepo
├── tsconfig.base.json              ← TypeScript base compartido
└── .env.example                    ← Variables de entorno necesarias
```

---

## `apps/web/` — Aplicación web Next.js

```
apps/web/
│
├── src/
│   ├── app/                        ← Next.js App Router (rutas)
│   │   ├── (auth)/                 ← Grupo de rutas sin AppShell
│   │   │   ├── login/
│   │   │   │   └── page.tsx        ← Página de login (MSAL + email)
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (portal)/               ← Grupo de rutas con AppShell + auth guard
│   │   │   ├── layout.tsx          ← Verifica sesión; redirige a login si no hay
│   │   │   ├── page.tsx            ← Portada / dashboard consolidado
│   │   │   ├── operaciones/
│   │   │   │   └── page.tsx        ← Módulo Operaciones
│   │   │   ├── financiero/
│   │   │   │   └── page.tsx        ← Módulo Financiero
│   │   │   ├── otif/
│   │   │   │   └── page.tsx        ← Módulo OTIF
│   │   │   ├── obligaciones/
│   │   │   │   └── page.tsx        ← Módulo Obligaciones
│   │   │   ├── seguimiento/
│   │   │   │   └── page.tsx        ← Torre de Control (tiempo real)
│   │   │   └── proyecto/
│   │   │       └── page.tsx        ← Comité HSEQ / Project
│   │   │
│   │   ├── api/                    ← Route Handlers de servidor
│   │   │   └── ai/
│   │   │       └── analisis/
│   │   │           └── route.ts    ← Proxy seguro hacia Claude API
│   │   │
│   │   ├── layout.tsx              ← Root layout: fuentes, providers globales
│   │   └── not-found.tsx
│   │
│   │
│   ├── components/                 ← Componentes React reutilizables
│   │   │
│   │   ├── ui/                     ← Componentes base sin lógica de negocio
│   │   │   ├── KpiCard/
│   │   │   ├── DataTable/
│   │   │   ├── AlertCard/
│   │   │   ├── Badge/
│   │   │   ├── ProgressBar/
│   │   │   ├── ChartLine/
│   │   │   ├── ChartDonut/
│   │   │   ├── ChartBar/
│   │   │   ├── Modal/
│   │   │   ├── Toast/
│   │   │   ├── Spinner/
│   │   │   └── index.ts            ← Barrel export de todos los UI components
│   │   │
│   │   └── layout/                 ← Estructuras de página (shell)
│   │       ├── AppShell/           ← Wrapper raíz: sidebar + header + content
│   │       ├── Sidebar/            ← Navegación colapsable con tooltips
│   │       ├── Header/             ← Título del módulo, usuario, reloj, admin controls
│   │       ├── FilterBar/          ← Semana, cliente, mes, tipo de carga
│   │       └── AlertBanner/        ← Banner superior de estado del sistema
│   │
│   │
│   ├── features/                   ← Módulos de negocio (feature slices)
│   │   │
│   │   ├── operaciones/
│   │   │   ├── components/         ← KpiGrid, NominacionTable, AlertsGrid,
│   │   │   │                         AnalisisBlock, HistoricoPanel, PipelineCard
│   │   │   ├── hooks/              ← useOperaciones, useFilters, useExcelUpload,
│   │   │   │                         useAiAnalysis, useHistorico
│   │   │   ├── services/           ← saveAcciones(), loadAcciones(), saveCausas()
│   │   │   ├── stores/             ← operacionesStore (Zustand): DATA_LIQ, DATA_SEC,
│   │   │   │                         semanaActiva, cargo, filtros
│   │   │   ├── types/              ← Viaje, Nominacion, SemanaData, AlertaOps,
│   │   │   │                         KpiOperaciones, AccionComite
│   │   │   └── utils/              ← calcularKPIs(), buildPrompt(), parseRows(),
│   │   │                             calcularTendencia(), detectarAlertas()
│   │   │
│   │   ├── financiero/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── stores/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   ├── otif/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   ├── obligaciones/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   ├── seguimiento/            ← Torre de Control (tiempo real)
│   │   │   ├── components/         ← MapaRutas, FlotaStatus, PipelineRealtime
│   │   │   ├── hooks/              ← useRealtimeFlota, useSeguimientoData
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   └── proyecto/               ← Comité HSEQ / Project
│   │       ├── components/         ← TaskTable, HseqRuleta, HseqHistorial, ProjKpis
│   │       ├── hooks/              ← useProyecto, useRuleta, useHseqHistory
│   │       ├── services/           ← saveTarea(), loadTareas(), saveHseqWinner()
│   │       ├── types/              ← TareaComite, HseqEncargado, SemanaProyecto
│   │       └── utils/
│   │
│   │
│   ├── services/                   ← Servicios de aplicación (no exportados como paquete)
│   │   └── ai.ts                   ← Wrapper cliente para /api/ai/analisis
│   │
│   ├── hooks/                      ← Hooks compartidos entre features
│   │   ├── useSupabaseSession.ts   ← Hook de sesión y usuario autenticado
│   │   ├── useAdminAccess.ts       ← Verificación de PIN de administrador
│   │   └── useRealtime.ts          ← Suscripción a canales Supabase Realtime
│   │
│   ├── lib/                        ← Configuración y bootstrapping de librerías
│   │   ├── supabase.ts             ← Instancia del cliente Supabase del browser
│   │   ├── queryClient.ts          ← Configuración de TanStack Query
│   │   └── chartDefaults.ts        ← Defaults globales de Chart.js (colores INLOP DS)
│   │
│   └── styles/
│       ├── globals.css             ← Importa tokens del DS + Tailwind base
│       └── themes/
│           ├── dark.css            ← Overrides para data-theme="dark"
│           └── light.css           ← Overrides para data-theme="light"
│
│
├── public/
│   └── fonts/                      ← Fuentes locales (Anton, Barlow Condensed, DM Sans, JetBrains Mono)
│
├── next.config.ts
├── tailwind.config.ts              ← Mapea tokens DS a utilidades Tailwind
├── tsconfig.json
└── package.json
```

---

## `packages/ds/` — Design System INLOP

```
packages/ds/
│
├── tokens/
│   ├── colors.css              ← --navy, --red, --green, --amber, --danger, --blue
│   ├── typography.css          ← familias, tamaños, pesos, tracking
│   ├── spacing.css             ← escala 4px base
│   ├── elevation.css           ← sombras --m-elev-1/2/3
│   └── index.css               ← Importa todos los tokens
│
├── themes/
│   ├── dark.css                ← Tema oscuro (original del sistema actual)
│   └── light.css               ← Tema claro (v4 inlop-ds-v4)
│
├── components/
│   └── base.css                ← Clases CSS base (no React): .kpi, .card, .badge, .sh
│
├── types/
│   └── tokens.ts               ← Tipos TypeScript de los tokens para autocompletar
│
└── package.json
```

---

## `packages/types/` — Tipos compartidos del dominio

```
packages/types/
│
├── domain/
│   ├── operaciones.ts          ← Viaje, Nominacion, SemanaData, CargaTipo
│   ├── proyecto.ts             ← TareaComite, HseqEncargado
│   ├── usuario.ts              ← UsuarioInlop, RolUsuario, Oficina
│   └── common.ts               ← KpiMetric, StatusLevel, DateRange
│
├── api/
│   ├── supabase.ts             ← Tipos de las tablas de Supabase (generados)
│   └── ai.ts                   ← Tipos de request/response de Claude API
│
└── package.json
```

---

## `packages/supabase/` — Cliente Supabase compartido

```
packages/supabase/
│
├── client/
│   ├── browser.ts              ← createBrowserClient() para componentes cliente
│   └── server.ts               ← createServerClient() para RSC y Route Handlers
│
├── schema/
│   └── database.types.ts       ← Tipos generados por Supabase CLI (supabase gen types)
│
└── package.json
```

---

## `packages/auth/` — Autenticación MSAL + Supabase

```
packages/auth/
│
├── msal/
│   ├── config.ts               ← Configuración MSAL (clientId, authority, scopes)
│   └── instance.ts             ← Instancia MSAL singleton
│
├── supabase/
│   └── session.ts              ← setSupabaseSession() a partir de token MSAL
│
├── guards/
│   └── requireAuth.ts          ← HOC / middleware para proteger rutas
│
└── package.json
```

---

## `packages/xlsx/` — Parser de Excel

```
packages/xlsx/
│
├── parser.ts                   ← parseWorkbook() → { liq: Viaje[], sec: Viaje[] }
├── validator.ts                ← Esquema Zod + validateSchema()
├── mapper.ts                   ← mapRow() row bruta → tipo Viaje tipado
├── sharepoint.ts               ← Descarga de Excel desde SharePoint via MSAL token
└── package.json
```

---

## Separación de responsabilidades — Resumen visual

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA           │  CONTIENE                        │  CONOCE        │
├─────────────────┼──────────────────────────────────┼────────────────┤
│  packages/ds    │  Tokens CSS, tipos de tokens      │  Nada          │
│  packages/types │  Interfaces del dominio           │  DS (solo tipos│
│  packages/supa  │  Cliente Supabase, tipos DB       │  Types         │
│  packages/auth  │  MSAL, sesión, guards             │  Supabase      │
│  packages/xlsx  │  Parser, validador, mapper        │  Types         │
│  components/ui  │  Componentes visuales puros       │  DS            │
│  components/lay │  Shell, sidebar, header           │  UI, Auth      │
│  features/*     │  Lógica de negocio, estado        │  UI, Supabase, │
│                 │                                  │  Types, XLSX   │
│  app/(routes)   │  Composición de páginas           │  Features, Lay │
│  app/api        │  Route Handlers servidor          │  Claude API    │
└─────────────────┴──────────────────────────────────┴────────────────┘
```

**Regla de dependencia**: las flechas solo van hacia abajo en la tabla. `features/operaciones` puede usar `packages/types`, pero `packages/types` jamás importa de `features/operaciones`.
