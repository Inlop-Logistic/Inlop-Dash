# INLOP ERP — Roadmap de Construcción

> Plan de desarrollo por fases con objetivos, entregables y criterios de salida.

---

## Principios del roadmap

- Cada fase entrega **algo funcional y desplegable** — no hay fases que solo "preparan".
- Los módulos se construyen en orden de **impacto operativo**, no de dificultad técnica.
- El sistema HTML actual en `main` sigue en producción durante toda la construcción.
- Las fases son secuenciales en lo que se refiere al core; los módulos de negocio pueden solaparse.

---

## Resumen de fases

| Fase | Nombre | Duración estimada | Entregable principal |
|---|---|---|---|
| **0** | Fundaciones del monorepo | 1 semana | Repo configurado, DS extraído, CI funcionando |
| **1** | Shell + Autenticación | 2 semanas | Login funcional, AppShell con navegación |
| **2** | Design System React | 2 semanas | Librería de componentes UI + Storybook |
| **3** | Módulo Operaciones | 4 semanas | Primer módulo feature-complete en el nuevo stack |
| **4** | Módulos Financiero, OTIF y Obligaciones | 5 semanas | Tres módulos de consulta migrados |
| **5** | Torre de Control + Project/Comité | 3 semanas | Tiempo real y módulo de gestión de tareas |
| **6** | Consolidación, IA y optimización | 2 semanas | IA segura en servidor, performance, accesibilidad |

**Total estimado**: ~19 semanas (≈ 5 meses)

---

## Fase 0 — Fundaciones del monorepo

**Duración**: 1 semana

### Objetivo
Tener la infraestructura del monorepo lista antes de escribir cualquier componente o página.

### Tareas

- [ ] Inicializar `pnpm workspaces` con la estructura de `apps/` y `packages/`
- [ ] Configurar Turborepo con pipelines `build`, `dev`, `lint`, `test`
- [ ] Crear `apps/web` con Next.js 14 + TypeScript + Tailwind CSS en modo minimal
- [ ] Crear `packages/ds` y migrar **todos** los tokens CSS del HTML actual sin modificarlos
- [ ] Configurar `tailwind.config.ts` para consumir los tokens del DS
- [ ] Crear `packages/types` con las interfaces de dominio más urgentes (`Viaje`, `SemanaData`, `UsuarioInlop`)
- [ ] Crear `packages/supabase` con los clientes browser/server y generar los tipos con Supabase CLI
- [ ] Configurar variables de entorno: `.env.example` documentado con todas las keys necesarias
- [ ] Configurar Railway para el despliegue de `apps/web` desde esta rama (entorno staging separado)
- [ ] Configurar ESLint + Prettier con reglas compartidas en el workspace root

### Criterios de salida
- `pnpm dev` levanta la app en local sin errores
- Los tokens del DS están disponibles como utilidades Tailwind (`bg-navy`, `text-red`, etc.)
- Railway despliega `apps/web` en un entorno de staging (URL diferente a producción)
- Los tipos de Supabase están generados y actualizados

---

## Fase 1 — Shell + Autenticación

**Duración**: 2 semanas

### Objetivo
Tener el esqueleto de la aplicación funcionando: login real, sesión persistente y navegación entre módulos (aunque los módulos aún estén vacíos).

### Tareas

**Semana 1 — Autenticación**
- [ ] Crear `packages/auth` con la configuración MSAL y la función `setSupabaseSession()`
- [ ] Construir la página `/login` con las dos opciones de autenticación (MSAL + email/password)
- [ ] Implementar las páginas `/forgot-password` y `/reset-password` con Supabase Auth
- [ ] Implementar el auth guard en `app/(portal)/layout.tsx`
- [ ] Persistir la sesión entre recargas de página
- [ ] Implementar logout con limpieza de tokens MSAL y sesión Supabase

**Semana 2 — Shell y navegación**
- [ ] Construir el componente `<AppShell>` con la estructura sidebar + header + área de contenido
- [ ] Construir el `<Sidebar>` con los 6 módulos, soporte de colapso/expansión y tooltips en modo icono
- [ ] Construir el `<Header>` con título del módulo, reloj, avatar del usuario autenticado y controles de admin (ocultos por defecto)
- [ ] Implementar el modal de PIN de administrador
- [ ] Construir la `<FilterBar>` con los selectores de semana, cliente, mes y tipo de carga (Líquida/Seca)
- [ ] Construir la página de portada (dashboard vacío con los cards de módulo)
- [ ] Verificar que la navegación entre módulos funciona con el estado del sidebar preservado

### Criterios de salida
- Un usuario puede autenticarse con Microsoft y con email/password
- La sesión persiste después de recargar la página
- El AppShell es idéntico visualmente al del sistema actual
- La navegación entre los 6 módulos (vacíos) funciona sin errores
- El PIN de administrador muestra/oculta los controles de carga de Excel

---

## Fase 2 — Design System React

**Duración**: 2 semanas

### Objetivo
Tener una librería de componentes React documentada que cualquier feature puede consumir sin reinventar la rueda visual.

### Tareas

**Semana 1 — Componentes de datos**
- [ ] `<KpiCard>` con las 5 variantes de acento y soporte de delta/barra de progreso
- [ ] `<DataTable>` con header sticky, scroll de body, fila de totales y soporte de filtros por columna
- [ ] `<AlertCard>` con las 4 severidades (crítica, advertencia, ok, info) y slot para causa
- [ ] `<Badge>` con las variantes ok/warn/crit/none/new
- [ ] `<ProgressBar>` horizontal y mini (para uso en tablas)
- [ ] `<ChartWrapper>` genérico sobre Chart.js con defaults del DS (colores INLOP, tipografía, grid)

**Semana 2 — Componentes de interacción y documentación**
- [ ] `<Modal>` genérico con variantes de tamaño
- [ ] `<Toast>` con las 3 severidades y auto-dismiss
- [ ] `<Spinner>` animado (spinner del DS actual)
- [ ] `<SectionHeading>` con barra de color, texto y línea divisoria
- [ ] `<AnalysisBlock>` para el resumen ejecutivo con grid de items
- [ ] Configurar Storybook con todos los componentes documentados
- [ ] Verificar que los dos temas (oscuro/claro) funcionan en todos los componentes

### Criterios de salida
- Todos los componentes listados están en Storybook con ejemplos de las variantes
- Cambiar `data-theme` en el `<html>` cambia el tema en toda la app visualmente
- Los componentes son visualmente idénticos a sus equivalentes en el HTML actual

---

## Fase 3 — Módulo Operaciones

**Duración**: 4 semanas  
**Prioridad**: más alta — es el módulo más maduro y el de mayor uso diario.

### Objetivo
Replicar completamente el módulo Operaciones en el nuevo stack, incluyendo la ingesta de Excel, los KPIs, las alertas, el análisis y el histórico.

### Tareas

**Semana 1 — Ingesta de datos y estado**
- [ ] Crear `packages/xlsx` con `parseWorkbook()`, `validateSchema()` y `mapRow()`
- [ ] Escribir tests unitarios para el parser (datos reales de Excel)
- [ ] Crear el Zustand store `operacionesStore` con DATA_LIQ, DATA_SEC, semana activa, filtros
- [ ] Implementar `saveMem()` y `loadMem()` con Zustand persist
- [ ] Implementar `saveToSupabase()` y `loadFromSupabase()` para el módulo
- [ ] Implementar el componente de carga de Excel (drag & drop + clic)
- [ ] Implementar descarga desde SharePoint via MSAL

**Semana 2 — KPIs, gráficos y tabla**
- [ ] Construir `<KpiGrid>` con los 5 indicadores (Solicitados, Cargados, Balance, Cumplimiento, Rutas)
- [ ] Construir el gráfico de participación por cliente (donut + leyenda)
- [ ] Construir el semáforo de clientes con scroll interno
- [ ] Construir `<NominacionTable>` con header fijo, scroll de body y fila de totales
- [ ] Construir los filtros de tabla (por estado de cumplimiento)
- [ ] Construir las tarjetas de versión móvil

**Semana 3 — Alertas, análisis y tendencia**
- [ ] Construir `<AlertsGrid>` con las alertas críticas/advertencias/ok generadas desde los datos
- [ ] Construir `<AnalisisBlock>` para el resumen ejecutivo (estático, con placeholders de IA)
- [ ] Construir la sub-pestaña Tendencia con los 4 gráficos históricos
- [ ] Construir la tabla histórica consolidada
- [ ] Construir el análisis gerencial histórico

**Semana 4 — IA y módulo Project integrado**
- [ ] Construir el Route Handler `/api/ai/analisis` con Claude API (streaming)
- [ ] Integrar el análisis IA en tiempo real en `<AnalisisBlock>`
- [ ] Construir el módulo Project (tabla de tareas del comité + KPIs)
- [ ] Construir la Ruleta HSEQ con canvas + animación
- [ ] Construir el historial de encargados HSEQ
- [ ] Migrar el botón de WhatsApp (resumen operativo como texto)

### Criterios de salida
- Un operador puede cargar un Excel real y ver todos los KPIs, alertas y gráficos
- Los datos persisten entre sesiones (Supabase + localStorage)
- El análisis IA funciona con streaming visible al usuario
- La Ruleta HSEQ funciona y guarda el historial en Supabase
- La app es visualmente indistinguible del sistema actual en este módulo

---

## Fase 4 — Módulos Financiero, OTIF y Obligaciones

**Duración**: 5 semanas (pueden solaparse, uno por semana + integración)

### Objetivo
Migrar los tres módulos de consulta/gestión al nuevo stack, reutilizando al máximo los componentes del DS.

### Semana 1-2 — Módulo Financiero
- [ ] Analizar `financiero.html` y extraer el modelo de datos
- [ ] Definir tipos en `packages/types/domain/financiero.ts`
- [ ] Construir los componentes específicos del módulo
- [ ] Conectar con Supabase

### Semana 3 — Módulo OTIF
- [ ] Analizar `otif.html` y extraer el modelo de datos
- [ ] Definir tipos en `packages/types/domain/otif.ts`
- [ ] Construir los componentes específicos
- [ ] Conectar con Supabase

### Semana 4-5 — Módulo Obligaciones + integración
- [ ] Analizar `obligaciones.html` y extraer el modelo de datos
- [ ] Implementar CRUD de obligaciones en Supabase
- [ ] Construir los componentes específicos
- [ ] Pruebas de integración de los tres módulos con datos reales

### Criterios de salida
- Los tres módulos muestran los mismos datos que sus equivalentes HTML
- Los datos se cargan desde Supabase (no desde archivos hardcodeados)
- Las tablas y gráficos usan los componentes del DS

---

## Fase 5 — Torre de Control + Project/Comité

**Duración**: 3 semanas

### Objetivo
Implementar el módulo de seguimiento en tiempo real y completar el módulo de gestión de tareas.

### Semana 1-2 — Torre de Control (Seguimiento en vivo)
- [ ] Analizar `TorreControl.html` y definir la arquitectura de tiempo real
- [ ] Configurar suscripciones Supabase Realtime para actualizaciones de flota
- [ ] Construir `<FlotaStatus>` con pipeline de estados en tiempo real
- [ ] Construir `<PipelineRealtime>` con actualización automática
- [ ] Implementar `useRealtime()` hook compartido

### Semana 2-3 — Planeación Operativa
- [ ] Construir el módulo de planeación con viajes programados vs activos
- [ ] Implementar los filtros de fecha, cliente y estado
- [ ] Integrar con el módulo de Operaciones (datos compartidos de viajes)

### Criterios de salida
- Las actualizaciones de flota se reflejan en pantalla sin recargar la página
- Los módulos de seguimiento y planeación están sincronizados con la misma fuente de datos

---

## Fase 6 — Consolidación, IA y optimización

**Duración**: 2 semanas

### Objetivo
Afinar la experiencia de usuario, asegurar la seguridad, mejorar el rendimiento y preparar el sistema para reemplazar producción.

### Tareas

**Seguridad y robustez**
- [ ] Auditar que ninguna API key está expuesta en el cliente
- [ ] Revisar permisos en Supabase Row Level Security (RLS) por módulo
- [ ] Implementar rate limiting en los Route Handlers de IA
- [ ] Validar que el auth guard cubre todas las rutas del portal

**Rendimiento**
- [ ] Medir y optimizar el tiempo de carga inicial (LCP < 2.5s)
- [ ] Implementar `Suspense` y `loading.tsx` en todas las rutas del portal
- [ ] Verificar que las tablas grandes (500+ filas) usan virtualización o paginación
- [ ] Optimizar las fuentes (subset, preload)

**Accesibilidad y UX**
- [ ] Verificar navegación por teclado en todos los componentes interactivos
- [ ] Añadir `aria-label` a los iconos y controles sin texto visible
- [ ] Verificar contraste en ambos temas
- [ ] Pruebas en móvil para los breakpoints definidos en el DS

**Migración y cutover**
- [ ] Documentar el plan de cutover (fecha, rollback, comunicación al equipo)
- [ ] Pruebas de aceptación con usuarios reales del equipo de operaciones
- [ ] Configurar Railway para apuntar producción a `apps/web` del nuevo ERP
- [ ] Archivar los archivos HTML legacy (no eliminar — conservar como referencia)

### Criterios de salida
- El nuevo ERP está en producción en Railway
- El equipo de operaciones confirma que la experiencia es equivalente o mejor al sistema anterior
- No hay API keys expuestas en el bundle del cliente
- Los archivos HTML legacy están archivados y documentados

---

## Hitos clave

```
Semana 1  ──── [ Fase 0 ] Monorepo + DS + CI
Semana 2  ─┐
           ├── [ Fase 1 ] Shell + Auth completo
Semana 3  ─┘
Semana 4  ─┐
           ├── [ Fase 2 ] Librería UI en Storybook
Semana 5  ─┘
Semana 6  ─┐
Semana 7   │
           ├── [ Fase 3 ] Módulo Operaciones feature-complete ★
Semana 8   │
Semana 9  ─┘
Semana 10 ─┐
Semana 11  │
           ├── [ Fase 4 ] Financiero + OTIF + Obligaciones
Semana 12  │
Semana 14 ─┘
Semana 15 ─┐
           ├── [ Fase 5 ] Torre de Control + Planeación
Semana 17 ─┘
Semana 18 ─┐
           ├── [ Fase 6 ] Consolidación → PRODUCCIÓN ★★
Semana 19 ─┘
```

★ Hito de validación interna — equipo de operaciones prueba el módulo con datos reales.  
★★ Hito de go-live — el ERP reemplaza los archivos HTML en Railway.

---

## Qué no está en este roadmap

- **App móvil nativa**: el sistema es responsivo desde Fase 1, pero no incluye React Native.
- **Internacionalización (i18n)**: el sistema opera exclusivamente en español.
- **Integración con sistemas ERP externos (SAP, Oracle)**: fuera de alcance para v1.
- **Machine learning propio**: el sistema usa Claude API como servicio externo; no entrena modelos.
