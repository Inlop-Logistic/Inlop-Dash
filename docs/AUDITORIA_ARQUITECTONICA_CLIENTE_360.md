# AUDITORÍA ARQUITECTÓNICA — MÓDULO CLIENTES / CLIENTE 360°
## ERP INLOP · Julio 2026 · Documento de arquitectura (NO ejecutable)

> **Naturaleza de este documento.** Es una auditoría, no una implementación. No contiene código,
> no contiene SQL, no contiene componentes React. Es el insumo para decidir *cómo* construir el
> módulo Clientes / Cliente 360° sin romper la arquitectura ya validada del ERP. Ninguna línea de
> este documento debe interpretarse como instrucción de commit.
>
> **Rama de trabajo:** `claude/clever-edison-y3au9r`
> **Documento relacionado:** `docs/GESTION_COMERCIAL_DOMAIN_MODEL.md` (Constitución del dominio
> Gestión Comercial, v1.0) — esta auditoría no contradice esa constitución, la asume como dada y
> resuelve la capa de *presentación y experiencia* (tabla, ficha, navegación) que la Constitución
> deliberadamente dejó fuera de alcance.

---

## Índice

1. [Método de la auditoría](#1-método-de-la-auditoría)
2. [Arquitectura actual del ERP INLOP](#2-arquitectura-actual-del-erp-inlop)
3. [Lo observado en el ERP auditado (ARC/Syscar)](#3-lo-observado-en-el-erp-auditado-arcsyscar)
4. [Comparación: INLOP actual vs. ERP auditado vs. arquitectura objetivo](#4-comparación-inlop-actual-vs-erp-auditado-vs-arquitectura-objetivo)
5. [Análisis de reutilización](#5-análisis-de-reutilización)
6. [Conflictos arquitectónicos y decisiones requeridas](#6-conflictos-arquitectónicos-y-decisiones-requeridas)
7. [Propuesta de implementación por fases](#7-propuesta-de-implementación-por-fases)
8. [Orden recomendado de desarrollo](#8-orden-recomendado-de-desarrollo)
9. [Riesgos transversales y mitigaciones](#9-riesgos-transversales-y-mitigaciones)
10. [Lo que NO se debe hacer](#10-lo-que-no-se-debe-hacer)
11. [Apéndice: inventario de archivos auditados](#11-apéndice-inventario-de-archivos-auditados)

---

## 1. Método de la auditoría

Se revisó el código fuente completo del ERP INLOP en la rama `claude/clever-edison-y3au9r`:
frontend (`erp/src`), backend (`index.js` monolítico en la raíz), y la Constitución del dominio
Gestión Comercial ya redactada. No se revisó código del ERP auditado (ARC/Syscar) — el análisis de
ese sistema se basa exclusivamente en los patrones descritos por el usuario en el encargo. Esta
auditoría no instala dependencias, no ejecuta el proyecto y no modifica ningún archivo de código.

---

## 2. Arquitectura actual del ERP INLOP

### 2.1 Frontend

| Aspecto | Estado real |
|---|---|
| Stack | React 19 + Vite 8 + Tailwind 4. Sin librería de componentes externa (no MUI, no AntD, no shadcn). |
| Enrutamiento | **No existe `react-router` ni ninguna librería de rutas.** La navegación es un `NavigationProvider` con un único estado `vista: Vista` en memoria (`core/navigation/NavigationContext.tsx`). No hay URL sincronizada, no hay deep-link, no hay botón atrás del navegador funcional dentro del ERP. |
| Estructura de módulos | *Feature-sliced*: cada dominio vive en `modules/<nombre>/{components, hooks, services, types.ts, constants.ts, index.ts}`, con un `pages/<Nombre>Page.tsx` delgado que solo importa y renderiza. Patrón consistente en Solicitudes, Programación, Viajes, Cumplidos, GPS. |
| Estado global | No hay Redux/Zustand/Jotai. Solo `AuthContext` (perfil/rol) y `NavigationContext` (vista activa). Cada módulo maneja su propio estado con hooks locales (`useSolicitudes`, patrón `useXxx`). |
| Kit de UI compartido | `components/ui`: `Badge`, `Button`, `Card`/`CardSection`, `DataTable`, `KpiCard`, `PageHeader`, `SidePanel`/`PanelSection`/`InfoRow`. Deliberadamente minimalista y hecho a mano. |
| Design tokens | Centralizados en `styles/tokens.css`, con la regla explícita en el propio archivo: *"Nunca usar valores hardcodeados en componentes. Siempre referenciar una variable de este archivo."* Paleta de marca (`--navy #012A6B`, `--inlop-red #E30613`), escala de grises, radios (4–16px, sesgo "empresarial contenido"), sombras, espaciado base-4, tipografía 10–32px, z-index escalonado. |
| Patrón de detalle | `SidePanel` — panel deslizante desde la derecha, ancho máximo 460–480px, organizado en `PanelSection`s temáticas (ver `DetalleSolicitud.tsx`: Identificación, Cliente, Operación, Asignación, Observaciones, Módulos relacionados, Historial). **Esto ya es una organización por dominios** — pero constreñida a un panel angosto, no a una página completa. |
| Módulos con scaffold pero sin implementar | `comercial`, `configuracion`, `finanzas`, `flota`, `monitoreo`, `notificaciones`, `planeacion`, `talento-humano` — todos existen como carpetas vacías (`.gitkeep`). **No existe ni siquiera el scaffold de `clientes`.** |
| Navegación ya preparada para Clientes | `ModuloId` ya incluye `"clientes"`; `navActions.verCliente(clienteId, from)` ya existe y apunta a él; `NavPayload` ya tiene `clienteId?: string`. Pero `"clientes"` **no está** en `MODULOS_IMPLEMENTADOS`, así que hoy renderiza `<ComingSoon titulo="Clientes" />`. Es decir: **la plomería de navegación para Clientes ya fue diseñada de antemano** — solo falta construir la página. |

### 2.2 Backend

| Aspecto | Estado real |
|---|---|
| Arquitectura | Monolito Express (`index.js`, ~125K, un solo archivo) sobre Supabase, sin ORM. Acceso a datos vía `sbFetch(path)` — wrapper delgado sobre PostgREST. |
| Patrón de queries | *Column allowlisting* explícito por endpoint (arrays tipo `SOL_SELECT`), y *joins manuales* vía lookups por lote (`id=in.(...)`) resueltos con `Promise.all` y mapeados en JS (ver `/api/solicitudes`). No hay N+1 real porque el patrón ya evita eso conscientemente. |
| Autenticación — dos realms distintos | (1) ERP interno: Supabase Auth + tabla `profiles` (`id, nombre, cargo, rol, email`), protegido con `requireLegacyOrInternal` / `requireInternalApiKey`. (2) Portal Cliente: JWT propio vía `requireClienteAuth` / `requireAdminCliente`, con roles *hardcodeados* `['admin_cliente', 'encargado', 'coordinador']` en el propio `index.js`. **No hay tabla de roles ni enumeración formal en el lado ERP** — `profiles.rol` es un string libre. |
| Tendencia reciente (últimos 5 commits) | Migración de endpoints legacy compartidos hacia **endpoints dedicados por módulo**: `/api/viajes`, `/api/cumplidos`, `/api/gps` (reemplazando patrones anteriores más genéricos). Esta es la convención emergente a seguir para cualquier módulo nuevo. |
| Tablas relevantes ya en producción | `empresas_cliente` (id, razon_social, nombre_controlt, activa), `agencias_cliente` (id, nombre, ciudad, empresa_cliente_id, activa), `usuarios_cliente` (id, nombre, empresa_cliente_id, agencias[], rol, activo), `solicitudes`. |
| Endpoints de Clientes | **No existen.** No hay `/api/clientes` en ninguna forma. `/usuarios` y `/agencias` existen pero pertenecen al realm del Portal Cliente (un admin_cliente gestionando sus propios usuarios/agencias), no al ERP gestionando su cartera de clientes. |
| Persistencia de preferencias de usuario | **No existe ninguna tabla** de tipo `preferencias_usuario`, `configuracion_columnas` o equivalente. Cualquier configuración de columnas persistida es superficie 100% nueva. |
| Exportación de datos | **No existe ninguna capacidad de exportación** (PDF/Excel/CSV/impresión) en ningún módulo actual. Es superficie 100% nueva, no una extensión de algo existente. |

### 2.3 Dominio (ya constituido, no auditado aquí)

La Constitución `GESTION_COMERCIAL_DOMAIN_MODEL.md` ya resolvió: qué es la entidad `Cliente`
(`empresas_cliente` extendida, no reemplazada), qué campos nuevos necesita (§17.1: `nit`,
`tipo_cliente`, `sector`, `ciudad_principal`, `canal_preferido`, `credito_habilitado`,
`dias_credito`, `notas_comerciales`, `convenio_activo_id`), y la jerarquía Cliente → Contacto
Comercial → Convenio → Lista de Precios → Cotización/Pedido → Solicitud. Esta auditoría **no
reabre esas decisiones**; las toma como el modelo de datos objetivo sobre el cual se apoyará la
capa de presentación.

---

## 3. Lo observado en el ERP auditado (ARC/Syscar)

Registro neutral de los ocho patrones señalados, sin valorarlos todavía (la valoración está en
§5–§6):

1. Pantalla principal = tabla enterprise a pantalla casi completa, no un dashboard.
2. Filtros por columna, ocultos tras un botón de embudo, aparecen como segunda fila bajo encabezados; tipo de filtro depende del tipo de campo (texto/número/lista/fecha/estado).
3. Configuración de columnas: mostrar/ocultar, buscar, reordenar (drag & drop y flechas), persistir.
4. Exportaciones agrupadas en un solo menú: PDF, Excel, CSV, Imprimir.
5. FAB (botón flotante) para crear registros.
6. Maestro de Clientes abre una **ficha** dividida por dominios (General, Comercial, Facturación, Documentos, Contactos, Referencias, Tributaria), no un formulario plano.
7. Cada dominio de la ficha administra solo su información — evita formularios gigantes.
8. Limitación detectada: la ficha es administrativa, no es una Vista 360° real — no integra operación, viajes, solicitudes, OTIF, indicadores, historial, cartera ni facturación consolidada.

---

## 4. Comparación: INLOP actual vs. ERP auditado vs. arquitectura objetivo

| Dimensión | INLOP hoy | ERP auditado (ARC/Syscar) | Arquitectura objetivo INLOP |
|---|---|---|---|
| Pantalla central | Ya es tabla + KPIs + filtros + panel (Solicitudes es el precedente) | Tabla enterprise pura | Mantener el patrón ya validado: KPIs + tabla + panel/ficha. No copiar "solo tabla, sin KPIs" — los KPIs ya son idioma INLOP. |
| Filtros | Barra superior + tabs de estado (patrón repetido en 4 módulos) | Fila de filtros por columna, oculta tras embudo | Añadir filtros por columna **como capacidad opcional de `DataTable`**, no como reemplazo del patrón de barra+tabs en los módulos que ya funcionan bien así. |
| Configuración de columnas | No existe | Mostrar/ocultar/reordenar/persistir | Adoptar el concepto, pero la persistencia debe respetar la jerarquía usuario > rol > empresa > default — y hoy **no existe tabla de roles formal en el ERP**, así que esto requiere una decisión previa (§6-D). |
| Exportación | No existe en ningún módulo | Menú único PDF/Excel/CSV/Imprimir | Adoptar como componente compartido (`ExportMenu` conceptual) reutilizable por cualquier módulo, no exclusivo de Clientes — pero requiere elegir una dependencia nueva para PDF (§6-F). |
| Crear registro | Botón dentro de `PageHeader.actions` (convención en las 5 páginas activas) | FAB flotante | **No adoptar el FAB.** Rompe la convención visual de las 5 páginas ya construidas sin aportar valor funcional nuevo. |
| Detalle de un registro | `SidePanel` deslizante, 460–480px, con `PanelSection`s | Ficha completa por dominios (pestañas o secciones) | Para Clientes, el volumen de información (comercial + operación + cartera + documentos) excede lo que un panel de 480px puede mostrar sin degradar la experiencia. Se necesita un patrón nuevo: **página completa con tabs por dominio** (§6-A). |
| Organización de la ficha | `PanelSection` apiladas verticalmente, con scroll | Dominios separados (pestañas) | Evolucionar `PanelSection` hacia tabs de página completa — mismo principio, mejor forma para el volumen de datos. |
| Alcance de "cliente" | Solo datos administrativos (`empresas_cliente`) | Solo datos administrativos | **Vista 360° real**: agregación de Solicitudes, Viajes, Cumplidos/OTIF, GPS, y (cuando exista) Cartera/Facturación — el verdadero diferencial que ni INLOP ni el ERP auditado tienen hoy. |
| Backend para la ficha | No existe `/api/clientes` | (desconocido, fuera de alcance) | Endpoint agregador dedicado, siguiendo la convención emergente (`/api/viajes`, `/api/cumplidos`) y el idioma de *batched lookups* ya usado en `/api/solicitudes`. |

---

## 5. Análisis de reutilización

Respuesta directa a las 12 preguntas del encargo.

**1. Qué ya existe y puede reutilizarse.**
`Card`, `Button`, `Badge`, `KpiCard`, `PageHeader` tal cual, sin modificación. `SidePanel` /
`PanelSection` / `InfoRow` para vistas rápidas (peek) de un cliente, aunque no para la ficha
completa. Los tokens de `styles/tokens.css` íntegros. El patrón `modules/<dominio>/{components,
hooks, services}` para estructurar el nuevo módulo `clientes`. `navActions.verCliente()` y
`NavPayload.clienteId`, ya definidos y sin usar. El idioma de backend (`sbFetch` + batched
`id=in.()` + `Promise.all`) usado en `/api/solicitudes`, replicable para `/api/clientes`.

**2. Qué componentes actuales sirven tal cual.**
`Badge`, `Button`, `Card`, `KpiCard`, `PageHeader` — cero cambios necesarios. El patrón
`useXxx()` hook por módulo (estado + fetch + filtros con `useMemo`) usado en `useSolicitudes`.

**3. Qué debe refactorizarse (no reescribirse).**
`DataTable`: hoy es `{key, header, width, render}` sin tipo de dato, sin sorting, sin filtros,
sin paginación. Necesita evolucionar a una versión que **siga aceptando la firma actual** (los
4 módulos que la consumen no deben romperse) pero agregue capacidades opcionales activables por
prop (filtros por columna, orden, densidad). Es extensión aditiva, no reescritura.

**4. Qué arquitectura debemos mantener.**
Sin excepción: ausencia de librería de tabla de terceros (mantener hecho a mano, coherente con
el resto del kit); tokens centralizados; estructura de módulo; el patrón backend de
column-allowlisting + batched joins; la separación de los dos auth realms (ERP interno vs.
Portal Cliente) — Clientes es un módulo *interno* del ERP, debe usar `requireInternalApiKey` /
`requireLegacyOrInternal`, nunca el realm de Portal Cliente.

**5. Qué arquitectura debemos modificar (extender, no romper).**
`DataTable` (extensión aditiva, ver punto 3). `MODULOS_IMPLEMENTADOS` (agregar `"clientes"`,
cambio de una línea, sin riesgo). El árbol de navegación necesita un segundo tipo de destino
para registros individuales — hoy `NavigationDestination` solo transporta un `payload` plano;
una ficha de cliente por tabs necesita también recordar *qué tab* está activo si se navega desde
otro módulo (ej. "ver cartera de este cliente" debería abrir la ficha directo en la pestaña
Cartera). Esto es una extensión menor de `NavPayload`, no una reescritura del motor de
navegación.

**6. Qué riesgos existen.**
(a) Sobrecargar `DataTable` con demasiadas responsabilidades y que dejе de ser "hecho a mano y
simple" — mitigar manteniendo cada capacidad como prop opt-in independiente. (b) Que la ficha de
cliente se construya como un monolito de una sola página con 400 líneas de JSX — mitigar
exigiendo que cada dominio de la ficha sea su propio componente en
`modules/clientes/components/`. (c) Que la agregación 360° dispare N llamadas secuenciales al
backend — mitigar exigiendo que el endpoint agregador use el mismo patrón `Promise.all` ya
probado en `/api/solicitudes`. (d) Que "configuración de columnas por rol" se construya antes de
que exista una tabla de roles formal en el ERP — riesgo de tener que migrar el esquema dos veces.

**7. Qué rompería compatibilidad.**
Cambiar la firma de `Column<T>` en `DataTable` rompería Solicitudes, Programación, Viajes y
Cumplidos simultáneamente — **no se debe hacer**. Cualquier cambio debe ser superset aditivo.
Agregar `"clientes"` a `MODULOS_IMPLEMENTADOS` no rompe nada (es exactamente el mecanismo para el
que ese Set existe). Nada en el backend actual se ve afectado por crear endpoints nuevos bajo
`/api/clientes/*`.

**8. Qué impacto tendría incorporar estas funcionalidades.**
Alto valor de negocio (Cliente 360° es el pedido explícito), impacto técnico moderado si se
sigue la ruta aditiva descrita, impacto alto si se intenta copiar el patrón del ERP auditado
literalmente (tabla de terceros, FAB, ficha sin jerarquía de scope) porque eso sí requeriría
reescribir partes ya estables.

**9. Qué dependencias existen.**
Las tablas nuevas de la Constitución (`contactos_comerciales`, `convenios_comerciales`, etc.) no
son prerrequisito estricto para un Cliente 360° mínimo — el 360° puede construirse primero sobre
lo que ya existe (`empresas_cliente`, `solicitudes`, `viajes`, `cumplidos`) y anexar
Comercial/Convenios cuando esas tablas existan. Cartera/Facturación consolidada **sí** es un
bloqueo real: el módulo `finanzas` está vacío, no hay tabla ni endpoint de qué agregar.

**10. Qué patrones del ERP auditado realmente valen la pena adoptar.**
Filtros por columna (como capacidad opt-in), configuración de columnas con jerarquía de scope,
menú de exportación único, ficha por dominios en vez de formulario plano.

**11. Cuáles NO deberíamos copiar.**
El FAB (rompe convención visual establecida). Un formulario/ficha "solo administrativa" sin
integración operativa (es precisamente la limitación que el usuario quiere superar). Cualquier
tabla de terceros o sistema de theming ajeno al de INLOP.

**12. Oportunidades de diseñar algo superior a ambos.**
Ni INLOP ni el ERP auditado integran hoy operación + comercial + cartera + documentos en una
sola vista. Esa es la oportunidad real: la ficha de cliente de INLOP puede ser estrictamente
mejor que la del ERP auditado en el primer día que tenga *cualquier* pestaña operativa, porque
ese ERP nunca la tuvo. No hace falta paridad de features (drag & drop de columnas, etc.) para
superarlo en lo que importa — conviene priorizar la Vista 360° operativa antes que el pulido de
configuración de tabla.

---

## 6. Conflictos arquitectónicos y decisiones requeridas

Cada punto sigue el formato exigido: conflicto → alternativas → recomendación. Ninguno se
implementa en este documento.

### 6-A. Ficha de cliente: ¿panel deslizante o página completa?

**Conflicto.** El único patrón de "detalle" que existe hoy es `SidePanel` (max 480px). Una ficha
360° con Información General, Comercial, Operación, Cartera, Documentos y Contactos no cabe en
ese ancho sin degradarse a un acordeón incómodo.

**Alternativas.**
- (a) Forzar todo en el `SidePanel` existente, con scroll largo — barato pero pobre para el
  volumen de datos objetivo.
- (b) Ensanchar `SidePanel` dramáticamente (ej. 900px+) — deja de ser un "panel" y compite mal
  contra una página real, además de afectar visualmente a los demás módulos que sí esperan un
  panel angosto (`SidePanel` es compartido).
- (c) Crear un patrón nuevo, página completa con tabs internas, navegable vía
  `navActions.verCliente(clienteId, from)` (que ya existe) y renderizada al agregar `"clientes"`
  a `MODULOS_IMPLEMENTADOS`.

**Recomendación.** (c). Es la única opción que no degrada un patrón compartido y que escala al
volumen de información que el 360° necesita. `SidePanel` se conserva intacto para su uso actual
(peek rápido de una fila, confirmar una acción) en todos los módulos, incluido un eventual
"vistazo rápido" de cliente desde otras pantallas.

### 6-B. Filtros por columna: ¿reemplazan la barra de filtros actual?

**Conflicto.** Cuatro módulos activos (Solicitudes, Programación, Viajes, Cumplidos) ya usan
barra superior + tabs de estado como convención consistente. El patrón del ERP auditado es fila
de filtros bajo encabezados.

**Alternativas.**
- (a) Reemplazar la barra actual por filtros por columna en todos los módulos — unifica pero
  reescribe 4 pantallas que ya funcionan.
- (b) Añadir filtros por columna como capacidad opt-in de `DataTable`, sin tocar los módulos
  existentes, reservada para donde el número de columnas heterogéneas lo justifique (Clientes,
  con nit/tipo/sector/ciudad/cartera, es un caso claro; Solicitudes con 5 tabs de estado no lo
  necesita).

**Recomendación.** (b). Consistencia de UX no exige un único mecanismo de filtro para todo — exige
que cada mecanismo se sienta parte del mismo sistema visual (tokens, tipografía, radios), lo cual
se preserva estilando los filtros de columna con los mismos `--gray-*`, `--radius-*`, etc.

### 6-C. Configuración de columnas: ¿por usuario, rol, empresa o sistema?

**Conflicto.** El usuario pidió explícitamente una jerarquía de 4 niveles (usuario > rol >
empresa > default del sistema). Hoy no existe tabla de preferencias, y — más importante — **no
existe una tabla de roles formal en el lado ERP interno** (`profiles.rol` es un string libre sin
catálogo).

**Alternativas.**
- (a) Construir la persistencia solo a nivel de usuario primero (más simple, no depende de nada
  más) y difierir rol/empresa/default hasta que exista un catálogo de roles.
- (b) Construir los 4 niveles de una vez, lo que implica primero formalizar un catálogo de roles
  del lado ERP interno — trabajo que no está en el alcance de "Clientes" y le agregaría una
  dependencia oculta.
- (c) Diseñar el esquema de datos para soportar los 4 niveles desde el principio (mismo espíritu
  de jerarquía de prioridad ya usado en el dominio Comercial: excepción cliente > convenio >
  general > manual, ver Constitución §6.6), pero implementar primero solo resolución
  usuario→default, dejando rol/empresa como columnas presentes pero sin poblar hasta que el
  catálogo de roles exista.

**Recomendación.** (c). Reutiliza el mismo lenguaje de "jerarquía de prioridad de resolución" que
el dominio Comercial ya adoptó, da consistencia arquitectónica al ERP completo, y no bloquea el
avance de Clientes esperando un catálogo de roles que pertenece a otro dominio (Talento
Humano/Configuración).

### 6-D. Exportaciones: ¿qué dependencia de PDF se adopta?

**Conflicto.** No existe ninguna capacidad de exportación hoy. `package.json` no tiene ninguna
librería de PDF, Excel o impresión. Agregar cualquiera de estas es una decisión de dependencia
nueva, no una extensión de algo existente.

**Alternativas.**
- (a) CSV y "Imprimir" primero (usable con `window.print()` + CSS de impresión, cero
  dependencias nuevas) y diferir PDF/Excel real a una segunda iteración.
- (b) Adoptar de una vez una librería de PDF/Excel en el frontend.

**Recomendación.** (a) para el primer corte — resuelve el 80% del valor (CSV cubre Excel para la
mayoría de usuarios de oficina; Imprimir cubre PDF informalmente) sin la carga de evaluar y
aprobar una dependencia nueva antes de saber si el volumen de uso la justifica. La decisión de
qué librería de PDF/Excel adoptar debe ser explícita y separada, no empaquetada dentro de
"Clientes".

### 6-E. FAB vs. botón en `PageHeader`

**Conflicto.** Ninguno real — es una decisión de estilo, no de arquitectura de datos. Se incluye
aquí porque el usuario pidió explícitamente evaluarlo.

**Recomendación.** No adoptar el FAB. Las 5 páginas activas del ERP ya resuelven "crear/actualizar
registro" con un `Button` dentro de `PageHeader.actions`. Introducir un FAB solo en Clientes
rompería la coherencia visual entre módulos sin aportar ninguna capacidad que el botón actual no
tenga.

### 6-F. Ausencia de enrutamiento por URL

**Conflicto.** No es un conflicto que "Clientes" cause — es una limitación estructural del ERP
completo que este módulo simplemente hereda. Sin `react-router`, no habrá URL compartible ni
bookmarkeable para "ver la ficha del cliente X", ni back/forward del navegador dentro del ERP.

**Alternativas.**
- (a) Aceptar la limitación para Clientes, igual que la aceptan los otros 5 módulos activos hoy.
- (b) Adoptar `react-router` como parte de esta tarea, para que Clientes sea el primer módulo con
  URLs reales.

**Recomendación.** (a). Adoptar un router es una decisión que afecta a *todo* el ERP (las 5
páginas activas, el `AppShell`, el `NavigationContext` completo) y no debe tomarse como efecto
colateral de construir un módulo de dominio. Si el negocio necesita URLs compartibles para
clientes en particular, esa es una decisión de infraestructura que merece su propia auditoría, no
una que se cuele dentro de esta.

---

## 7. Propuesta de implementación por fases

| Fase | Alcance | Prioridad | Complejidad | Impacto | Riesgos | Dependencias |
|---|---|---|---|---|---|---|
| **F0 — DataTable v2** | Extender `DataTable` de forma aditiva: orden por columna, filtros por columna opt-in, prop de densidad. Sin tocar la firma que ya consumen Solicitudes/Programación/Viajes/Cumplidos. | Alta | Media | Habilita todo lo demás | Bajo si se mantiene aditivo; alto si se reescribe la firma | Ninguna |
| **F1 — Módulo Clientes: listado** | Activar `"clientes"` en `MODULOS_IMPLEMENTADOS`. Página con KPIs + tabla sobre `empresas_cliente` extendida (campos §17.1 de la Constitución) + filtros por columna (usa F0). Detalle rápido vía `SidePanel` existente (peek), sin ficha completa todavía. Backend: `GET /api/clientes` siguiendo el idioma de `/api/solicitudes`. | Alta | Media | Alto — desbloquea navegación ya cableada (`navActions.verCliente`) | Bajo | F0; campos nuevos de `empresas_cliente` (Constitución §17.1) |
| **F2 — Ficha Cliente 360: shell + Información General/Comercial** | Página completa nueva (patrón 6-A) con tabs. Primeras pestañas: General, Comercial, Contactos (si `contactos_comerciales` ya existe) o solo General/Comercial si no. | Alta | Media-Alta | Alto — es el entregable central pedido | Medio — primer uso del patrón "página completa con tabs", exige disciplina de componentización | F1; opcionalmente `contactos_comerciales` de la Constitución |
| **F3 — Integración operativa (pestaña Operación)** | Endpoint agregador `GET /api/clientes/:id/resumen` (patrón `Promise.all` de `/api/solicitudes`) que combina Solicitudes, Viajes, Cumplidos/OTIF, GPS recientes del cliente. Pestaña nueva en la ficha. | Alta (es el diferencial pedido) | Alta | Muy alto — es lo que ni INLOP ni el ERP auditado tienen hoy | Medio — riesgo de N+1 si no se sigue el patrón batched existente | F2; módulos Solicitudes/Viajes/Cumplidos/GPS (ya existen) |
| **F4 — Pestaña Cartera/Facturación** | Agregar cartera y facturación consolidada a la ficha. | Media | Alta | Alto, pero bloqueado | **Bloqueado**: módulo `finanzas` está vacío, sin tabla ni endpoint | Requiere que Finanzas exista primero — fuera del alcance de esta tarea |
| **F5 — Configuración de columnas + exportaciones** | Persistencia de columnas visibles/orden (resolución usuario→default primero, ver 6-C), menú de exportación CSV/Imprimir (ver 6-D) como componente compartido en `components/ui`. | Media | Media | Medio — "sensación enterprise", no bloquea el valor central | Bajo si se sigue 6-C/6-D | F0; ninguna dependencia externa nueva si se usa la ruta CSV/Imprimir |

---

## 8. Orden recomendado de desarrollo

```
F0 (DataTable v2)
  └─▶ F1 (Listado de Clientes)
        └─▶ F2 (Ficha 360 — shell + General/Comercial)
              ├─▶ F3 (Pestaña Operación — el diferencial real)
              └─▶ F5 (Config. de columnas + exportaciones — en paralelo, no bloquea F3)

F4 (Pestaña Cartera/Facturación) — se integra cuando Finanzas exista;
                                    no bloquea el resto del roadmap.
```

F3 y F5 pueden avanzar en paralelo una vez completado F2, porque no comparten superficie de
código (F3 toca el backend agregador y una pestaña nueva; F5 toca `DataTable` y un componente de
exportación compartido). F4 queda deliberadamente al final porque depende de un módulo que hoy no
existe — no tiene sentido bloquear el resto del roadmap por él.

---

## 9. Riesgos transversales y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `DataTable` termina cargando demasiadas responsabilidades y deja de ser simple | Cada capacidad (orden, filtro por columna, densidad, config. persistida) como prop independiente y opcional; ningún módulo existente cambia su código para seguir funcionando. |
| La ficha 360° se vuelve un componente monolítico | Cada pestaña es su propio componente en `modules/clientes/components/`, siguiendo el mismo patrón de `DetalleSolicitud.tsx` + sub-componentes. |
| El endpoint agregador dispara demasiadas llamadas seriales | Exigir el mismo patrón `Promise.all` + batched `id=in.()` ya probado en `/api/solicitudes`. |
| Se construye jerarquía de roles para columnas antes de que exista un catálogo de roles ERP | Seguir 6-C: diseñar el esquema para 4 niveles, poblar solo usuario→default hasta que el catálogo de roles exista. |
| Se agrega una dependencia de PDF/Excel sin evaluación explícita | Seguir 6-D: CSV/Imprimir primero, decisión de librería PDF/Excel como punto de decisión separado y explícito. |
| Se rompe la convención visual (FAB, paneles anchos) sin necesidad | Seguir 6-A/6-E: página completa con tabs para la ficha, botón en `PageHeader` para crear, no FAB. |

---

## 10. Lo que NO se debe hacer

- No reescribir la firma de `Column<T>` en `DataTable` — rompe 4 módulos en producción.
- No copiar el FAB del ERP auditado.
- No ensanchar `SidePanel` para forzar la ficha 360° dentro de él.
- No construir una ficha "solo administrativa" — es exactamente la limitación que se busca
  superar.
- No adoptar `react-router` como efecto colateral de este módulo.
- No agregar una librería de PDF/Excel sin que sea una decisión explícita y separada.
- No construir la jerarquía completa de configuración de columnas (rol/empresa) antes de que
  exista un catálogo de roles formal del lado ERP interno.
- No tocar ni una tabla SQL, ni un componente React, ni hacer commits — esta tarea es
  exclusivamente de arquitectura.

---

## 11. Apéndice: inventario de archivos auditados

**Frontend**
`erp/package.json` · `erp/src/App.tsx` · `erp/src/components/ui/{Badge,Button,Card,DataTable,
KpiCard,PageHeader,SidePanel,index}.tsx` · `erp/src/core/navigation/{NavigationContext,
navigationActions,types,index}.ts(x)` · `erp/src/types/{auth,navigation}.ts` ·
`erp/src/state/AuthContext.tsx` · `erp/src/styles/tokens.css` · `erp/src/lib/api.ts` ·
`erp/src/modules/solicitudes/**` (módulo de referencia completo) · estructura de
`comercial/configuracion/finanzas/flota/monitoreo/notificaciones/planeacion/talento-humano`
(scaffolds vacíos).

**Backend**
`index.js` (raíz) — rutas completas (`grep` de todos los `app.get/post/patch/put/delete`),
implementación de `/api/solicitudes` (GET listado y detalle), `/usuarios`, `/agencias`, realms de
autenticación (`requireLegacyOrInternal`, `requireInternalApiKey`, `requireClienteAuth`,
`requireAdminCliente`), uso de `empresas_cliente` / `agencias_cliente` / `usuarios_cliente` en
todo el archivo.

**Dominio**
`docs/GESTION_COMERCIAL_DOMAIN_MODEL.md` (Constitución completa, 17 secciones) — tomado como
insumo, no reabierto.

**Historial**
`git log` de la rama `claude/clever-edison-y3au9r` (últimos 5 commits) para identificar la
convención emergente de endpoints dedicados por módulo.
