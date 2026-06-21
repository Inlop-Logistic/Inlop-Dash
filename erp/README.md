# INLOP ERP — Nueva Plataforma de Inteligencia de Negocio

> Construcción del nuevo ERP logístico sobre una arquitectura frontend moderna, modular y escalable.  
> **Esta rama no afecta producción.**

---

## Contexto

El sistema actual (`main`) es una **MPA vanilla HTML/CSS/JS** compuesta por archivos independientes desplegados en Railway. El módulo más maduro —`Operaciones_project_10.html`— sirve como referencia visual y funcional para la nueva plataforma.

El nuevo ERP reemplaza esa estructura por un **monorepo React/Next.js con TypeScript**, preservando el diseño de marca, los tokens visuales y las integraciones con Supabase y Microsoft MSAL ya existentes.

---

## Módulos del sistema

| Módulo | Archivo actual (referencia) | Descripción |
|---|---|---|
| **Portal / Shell** | `index.html` | Navegación principal, autenticación, composición de módulos |
| **Operaciones** | `operaciones.html` / `Operaciones_project_10.html` | KPIs semanales, alertas, análisis IA, nominación, histórico, Project |
| **Financiero** | `financiero.html` | Indicadores financieros y control de presupuesto |
| **OTIF** | `otif.html` | On-Time In-Full · indicadores de servicio al cliente |
| **Obligaciones** | `obligaciones.html` | Control de compromisos y vencimientos |
| **Torre de Control** | `TorreControl.html` | Seguimiento en vivo y planeación operativa (tiempo real) |
| **Auth** | `login.html` / `forgot-password.html` | Autenticación MSAL + Supabase |

---

## Stack tecnológico

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | **Next.js 14+** (App Router) | SSR + RSC + routing declarativo; soporte nativo en Railway |
| Lenguaje | **TypeScript** estricto | Contratos tipados entre módulos; elimina errores de integración |
| Estilos | **Tailwind CSS** + tokens INLOP DS | Preserva el design system actual sin reescribir los tokens |
| Backend / DB | **Supabase** | Ya en producción: Auth, Realtime, Storage, PostgreSQL |
| Autenticación | **MSAL** (Azure AD) + Supabase Auth | Identidad empresarial ya probada en el sistema actual |
| Estado servidor | **TanStack Query** | Cache, revalidación, optimistic UI, soporte offline |
| Estado cliente | **Zustand** | State mínimo y explícito por módulo |
| Visualización | **Chart.js** | Ya en uso en producción; curva de aprendizaje cero |
| Excel parsing | **SheetJS (XLSX)** | Ya en producción; pipeline de ingesta conocido por el equipo |
| IA generativa | **Claude API (Anthropic)** vía Server Actions | Análisis operativos; ejecutado en servidor (API key nunca expuesta) |
| Monorepo | **pnpm workspaces** + Turborepo | Compartir design system, tipos y utilidades entre módulos |
| Deploy | **Railway** | Infraestructura actual; soporte Next.js sin cambios de configuración |

---

## Principios de diseño de software

1. **Feature-first, no layer-first** — cada módulo es autónomo: UI, lógica, servicios y tipos propios, sin acoplamiento cruzado.
2. **Design system como fuente de verdad** — los tokens CSS (`--navy`, `--red`, `--green`…) no viven en ninguna página; viven en el paquete `@inlop/ds`.
3. **Servicios agnósticos de UI** — la capa de datos (Supabase, AI, XLSX) no depende de React; los módulos consumen servicios, no llaman directamente a APIs externas.
4. **Sin estado global implícito** — cada módulo gestiona su propio estado; el shell solo orquesta identidad y navegación.
5. **Compatibilidad progresiva** — la nueva plataforma coexiste con el sistema HTML durante la transición; comparten el mismo proyecto Supabase y la misma configuración MSAL.
6. **Seguridad en capa de servidor** — las API keys de terceros (Claude, SharePoint) solo viven en variables de entorno del servidor; nunca en el cliente.

---

## Documentación de arquitectura

| Documento | Contenido |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Capas del sistema, flujos de datos, patrones de diseño, decisiones técnicas |
| [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) | Árbol de directorios comentado (monorepo completo) |
| [`ROADMAP.md`](./ROADMAP.md) | Plan de construcción por fases con criterios de salida |

---

> **Rama activa de desarrollo**: `claude/modest-euler-3m3s4t`  
> **Producción**: rama `main` — no modificar directamente  
> **Referencia visual de diseño**: `Operaciones_project_10.html` (módulo más maduro del sistema actual)
