# ERP ENTERPRISE EXPERIENCE STANDARD
## ERP INLOP · Constitución de Experiencia · Versión 1.0 · Julio 2026

> **Naturaleza de este documento.** No es una especificación de componentes ni de estilos. No
> define colores, ni CSS, ni props de una librería concreta — eso pertenece a la implementación
> (DataTable v2, View Engine, Filter Engine, Export Engine, Entity Workspace) y se construye
> **después** de que este documento sea aprobado. Lo que define aquí es **comportamiento**: cómo
> debe actuar cualquier módulo del ERP frente a una tabla, una entidad, un filtro, un error, un
> estado vacío, una acción o una navegación — sin importar si ese módulo es Gestión Comercial,
> Facturación, Compras, Inventario, Talento Humano, Vehículos, Conductores, Proveedores,
> Seguridad, Configuración o cualquier módulo que no exista todavía.
>
> Este documento no contiene código, no modifica archivos, no crea componentes y no se commitea.
>
> **Rama de trabajo:** `claude/clever-edison-y3au9r`
> **Documentos relacionados:** `docs/AUDITORIA_ARQUITECTONICA_CLIENTE_360.md` (auditoría de la
> que este estándar es la consecuencia directa) y `docs/GESTION_COMERCIAL_DOMAIN_MODEL.md`
> (modelo de dominio de Gestión Comercial, el primer consumidor de este estándar).
>
> **Jerarquía de documentos del ERP:**
> `ERP_ENTERPRISE_EXPERIENCE_STANDARD.md` (cómo se comporta cualquier módulo)
> → `GESTION_COMERCIAL_DOMAIN_MODEL.md` (qué entidades tiene un dominio concreto)
> → implementación (`DataTable v2`, `EntityWorkspace`, etc., construida cumpliendo ambos).

---

## Índice

1. [Enterprise Product Principles](#1-enterprise-product-principles)
2. [Enterprise Table Standard](#2-enterprise-table-standard)
3. [Entity Workspace Standard](#3-entity-workspace-standard)
4. [Workspace Plugin Standard](#4-workspace-plugin-standard)
5. [View Engine Standard](#5-view-engine-standard)
6. [Filter Standard](#6-filter-standard)
7. [Search Standard](#7-search-standard)
8. [Action Standard](#8-action-standard)
9. [Empty State Standard](#9-empty-state-standard)
10. [Error State Standard](#10-error-state-standard)
11. [Timeline Standard](#11-timeline-standard)
12. [Attachment Standard](#12-attachment-standard)
13. [Activity Feed Standard](#13-activity-feed-standard)
14. [Enterprise Navigation Standard](#14-enterprise-navigation-standard)
15. [Enterprise UX Rules](#15-enterprise-ux-rules)
16. [Comparación consolidada](#16-comparación-consolidada)

---

## 1. Enterprise Product Principles

Estos doce principios rigen cualquier decisión de experiencia en el ERP. Cuando un principio y
una preferencia de implementación entren en conflicto, gana el principio.

### 1.1 Menos clics, más contexto

Cada pantalla debe anticipar la siguiente pregunta del usuario y responderla sin que tenga que
navegar a buscarla. Ya existe precedente: `DetalleSolicitud` ofrece botones de "Ver en
Programación" / "Ver en Viajes" directamente desde el panel, sin que el usuario tenga que ir al
menú y buscar el registro manualmente. Ese principio se generaliza: ningún módulo nuevo debe
obligar al usuario a copiar un dato en un módulo para pegarlo/buscarlo en otro.

### 1.2 La información vive una sola vez

Ningún dato se duplica salvo que exista una razón de negocio explícita y documentada. El ERP ya
tiene un precedente formal de esto: `tarifa_pactada` en Solicitud es la **única** duplicación de
dato permitida en todo el dominio Comercial, y solo porque el valor debe congelarse en el momento
del pacto (RN-05 del Domain Model). Cualquier otra duplicación que aparezca durante el diseño de
un módulo nuevo debe justificarse con el mismo nivel de rigor o ser rechazada.

### 1.3 Las entidades son el centro del negocio, no los módulos

Principio ya adoptado formalmente en `GESTION_COMERCIAL_DOMAIN_MODEL.md`: los módulos administran
entidades, no las poseen. Este estándar lo extiende a toda pantalla: un `EntityWorkspace` de
Cliente no pertenece a "Gestión Comercial" — pertenece al Cliente, y Gestión Comercial es uno de
varios módulos que lo alimentan de datos (junto con Operaciones, Cumplidos, Facturación, etc.).

### 1.4 Las tablas son el centro de trabajo operativo

La pantalla principal de un módulo operativo no es un dashboard decorativo — es una tabla donde
el usuario pasa la mayor parte de su jornada. Los cuatro módulos activos del ERP (Solicitudes,
Programación, Viajes, Cumplidos) ya siguen este patrón: KPIs de un vistazo arriba, tabla como
protagonista debajo. Este estándar no introduce el principio — lo formaliza y le da un nombre:
**Enterprise Table**.

### 1.5 Ningún formulario gigante

Cualquier entidad con más de 3-4 grupos naturales de campos se organiza en secciones o pestañas
por dominio, nunca en un formulario largo de scroll único. Precedente ya existente en
`PanelSection` dentro de `SidePanel`; este estándar lo eleva a página completa cuando el volumen
de información lo exige (`EntityWorkspace`, ver §3).

### 1.6 Todo es configurable, sin perder un default sensato

Cualquier capacidad de personalización (columnas visibles, orden, filtros guardados, densidad)
debe tener un comportamiento por defecto razonable sin que el usuario configure nada. La
configuración es una mejora opcional, nunca un requisito para usar el sistema.

### 1.7 Todo es auditable

Ninguna acción de negocio relevante ocurre en silencio. El Domain Model ya define una estructura
uniforme de evento de auditoría (§13) para Comercial; este estándar la generaliza como el
**Activity Feed** de cualquier entidad del ERP (ver §13 de este documento).

### 1.8 Todo se construye una vez y se reutiliza siempre

Ninguna capacidad de tabla, filtro, exportación o vista de entidad se construye "para Clientes" —
se construye para el ERP y Clientes es simplemente su primer consumidor. Este es el mandato
explícito detrás de la Fase 0 de infraestructura.

### 1.9 Consistencia visual y de comportamiento entre módulos

Ya existe una regla formal para esto en `styles/tokens.css`: *"Nunca usar valores hardcodeados en
componentes. Siempre referenciar una variable de este archivo."* Este estándar extiende esa
misma disciplina del nivel visual al nivel de comportamiento: un filtro de fecha debe comportarse
igual en Clientes que en Facturación; una acción masiva debe sentirse igual en Vehículos que en
Conductores.

### 1.10 Los módulos consumen infraestructura común, no la reinventan

Ningún módulo nuevo debe escribir su propia tabla, su propio sistema de filtros o su propia
paginación. Si la infraestructura común no cubre un caso, el caso se resuelve extendiendo la
infraestructura común de forma aditiva — nunca bifurcando una solución paralela.

### 1.11 El sistema degrada con gracia

Los estados vacíos, de carga y de error no son un afterthought visual — son parte del diseño de
cada pantalla desde el primer día. Ya hay precedente parcial y valioso: las 4 páginas activas
implementan un patrón consistente de error (ícono + mensaje + botón "Reintentar") y de vacío
(`emptyMessage` configurable). Este estándar lo formaliza y lo extiende (ver §9, §10).

### 1.12 La navegación preserva contexto operativo

Ya existe la infraestructura para esto (`NavPayload`, `navActions`): moverse de un módulo a otro
no debe perder el hilo de lo que el usuario estaba haciendo. Este estándar exige que todo módulo
nuevo participe de ese mismo mecanismo en lugar de inventar su propio "id de contexto".

---

## 2. Enterprise Table Standard

### 2.1 Definición

Una **Enterprise Table** es la superficie de trabajo primaria de un módulo cuyo objeto de negocio
se gestiona en volumen — el usuario necesita ver, comparar, filtrar y actuar sobre muchos
registros a la vez antes de profundizar en uno solo.

### 2.2 Cuándo se usa

Cuando el módulo gestiona una colección de registros de la misma naturaleza que el usuario
necesita escanear, comparar o procesar en lote: Solicitudes, Viajes, Programación, Cumplidos,
Clientes, Proveedores, Facturas, Vehículos, Conductores, Empleados, Inventario.

### 2.3 Cuándo NO se usa

- Cuando la pantalla es de configuración de un único registro (ej. parámetros globales del
  sistema) — ahí el patrón correcto es un formulario por secciones, no una tabla.
- Cuando el "listado" nunca supera un puñado de ítems fijos y no requiere filtrado ni acción
  masiva (ej. lista de 5 tipos de vehículo en un catálogo estático) — una tabla completa sería
  sobre-ingeniería; un `Card` con lista simple basta.
- Cuando el contenido es inherentemente jerárquico/visual y no tabular (ej. el mapa de GPS ya
  usa Leaflet, correctamente, en vez de forzarlo a una tabla).

### 2.4 Capacidades obligatorias

Toda Enterprise Table, sin excepción, debe tener:

| Capacidad | Por qué es obligatoria |
|---|---|
| Estado de carga | El usuario nunca debe ver una tabla vacía sin saber si está cargando o si no hay datos |
| Estado vacío | Ver §9 — mensaje contextual, nunca una tabla en blanco sin explicación |
| Estado de error | Ver §10 — recuperación clara, nunca un error silencioso |
| Búsqueda rápida | Todo módulo con más de ~20 registros típicos necesita poder buscar sin abrir el embudo de filtros |
| Accesibilidad básica | Navegación por teclado, roles ARIA en encabezados y filas interactivas |
| Responsive | La tabla nunca debe forzar scroll horizontal de la página completa — solo de su propio contenedor |
| Eventos | Cada acción relevante sobre la tabla (clic en fila, cambio de filtro, exportación) debe ser un evento nombrado, no lógica anónima — necesario para auditoría y para telemetría de producto futura |

### 2.5 Capacidades opcionales (activables por módulo)

| Capacidad | Cuándo activarla |
|---|---|
| Ordenamiento por columna | Cuando el orden natural (ej. fecha descendente) no siempre es lo que el usuario necesita |
| Filtros por columna | Cuando el número de columnas heterogéneas es alto y una barra de filtros superior no escala (ver Auditoría 6-B) — ejemplo claro: Clientes; no necesario en Solicitudes, que ya resuelve bien con tabs + barra |
| Selección múltiple + acciones masivas | Cuando existen operaciones que el usuario razonablemente querría aplicar a varios registros a la vez (aprobar, exportar, reasignar) |
| Exportaciones | Cuando el usuario necesita sacar el dato del ERP para otro proceso (contabilidad, reportes externos) |
| Configuración de columnas | Cuando distintos roles necesitan ver distintos subconjuntos de columnas de la misma tabla |
| Persistencia de configuración | Cuando la tabla se usa con suficiente frecuencia como para que reconfigurar cada sesión sea fricción real |
| Columnas fijas (pinned) | Cuando hay muchas columnas y una identificadora (ej. código, placa) debe permanecer visible al hacer scroll horizontal |
| Densidad ajustable | Cuando la misma tabla sirve tanto para revisión rápida como para trabajo prolongado |
| Agrupación | Cuando el usuario se beneficia de ver los registros agrupados (ej. facturas agrupadas por cliente) |
| Virtualización | Cuando el volumen de filas renderizadas supera el límite en que el DOM empieza a degradar el scroll — hoy ningún módulo lo necesita (los backends ya limitan a 500 filas), se deja como capacidad futura preparada, no construida |
| Asistencia de IA | Futuro: sugerencias de filtro en lenguaje natural, resumen de la tabla visible. No se construye ahora; la arquitectura de eventos (ver arriba) es el prerrequisito que lo hace posible después |

### 2.6 Comparación

| | Estado actual INLOP | Patrón auditado (ARC/Syscar) | Decisión objetivo |
|---|---|---|---|
| Estructura de columna | `{key, header, width, render}` sin metadata de tipo | No aplica (no se auditó código) | Extender con metadata opcional de tipo, orden y filtro — aditivo |
| Filtros | Barra superior + tabs de estado | Fila de filtros por columna tras botón embudo | Adoptar como capacidad opt-in, no reemplazo universal (Auditoría 6-B) |
| Selección/acciones masivas | No existe | No se detalló explícitamente, pero es estándar en tablas enterprise | Adoptar como capacidad opt-in |
| Exportación | No existe | Menú único PDF/Excel/CSV/Imprimir | Adoptar CSV/Imprimir primero; PDF/Excel como decisión de dependencia separada (Auditoría 6-D) |
| Configuración de columnas | No existe | Mostrar/ocultar/reordenar/persistir | Adoptar con jerarquía de scope preparada (Auditoría 6-C) |
| Virtualización | No existe (no se necesita con datasets actuales) | No se detalló | Diferir — preparar la arquitectura de datos para no bloquearla, no construirla ahora |

---

## 3. Entity Workspace Standard

### 3.1 Definición

Un **Entity Workspace** es la vista de una sola entidad de negocio con volumen y complejidad
suficiente para que un panel deslizante (`SidePanel`) no alcance a representarla sin degradar la
experiencia. Es el sucesor natural de `SidePanel` para entidades "grandes" — no su reemplazo:
`SidePanel` sigue siendo correcto para vistazos rápidos (ver §3.4).

### 3.2 Cuándo se usa

Cliente, Proveedor, Vehículo, Empleado, Factura, Contrato — cualquier entidad cuya representación
completa requiere varios dominios de información simultáneos (comercial + operativo + financiero
+ documental) que un panel angosto no puede mostrar sin volverse un acordeón incómodo.

### 3.3 Cuándo NO se usa

Registros operativos de ciclo corto y forma simple (una Solicitud, un Viaje individual) siguen
usando `SidePanel` — tienen menos dominios de información y su ciclo de vida es más lineal. Un
Entity Workspace para "una Solicitud" sería sobre-construcción; el `SidePanel` actual ya resuelve
bien ese caso.

### 3.4 Componentes conceptuales de un Entity Workspace

| Elemento | Rol |
|---|---|
| **Header / Identidad** | Nombre/código de la entidad, badge de estado, metadatos clave de un vistazo (ej. NIT, ciudad) — siempre visible, no dentro de una pestaña |
| **KPIs** | Métricas de resumen específicas de esa entidad (ej. viajes del mes, cartera vencida) — visibles en el header o en la primera pestaña ("Resumen Ejecutivo") |
| **Tabs / Dominios** | Cada dominio de información (General, Comercial, Facturación, Documentos, Contactos, Operación...) vive en su propia pestaña — nunca mezclado en un solo scroll |
| **Timeline** | Historial cronológico de eventos relevantes de la entidad (ver §11) |
| **Auditoría** | Quién hizo qué y cuándo sobre esta entidad — puede vivir dentro del Timeline o como pestaña separada según volumen |
| **Comentarios** | Espacio de anotaciones humanas sobre la entidad, distinto del log de auditoría automático |
| **Archivos** | Gestión documental de la entidad (ver §12) |
| **Acciones** | Operaciones de negocio disponibles sobre esta entidad específica (aprobar, suspender, generar cotización) — ubicadas en el header, nunca escondidas dentro de una pestaña |
| **Permisos** | Qué puede ver/hacer el usuario actual sobre esta entidad — determina qué pestañas y acciones se renderizan, no una capa aparte |
| **Widgets** | Bloques de información reutilizables entre distintos tipos de entidad (ej. un widget de "últimos viajes" sirve tanto en Cliente como en Conductor) |
| **Navegación / Breadcrumbs** | Cómo se llegó aquí y cómo se vuelve — ver §14 |

### 3.5 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Mecanismo de detalle | `SidePanel` 460-480px con `PanelSection`s apiladas | Ficha completa dividida por dominios | Página completa con tabs para entidades grandes; `SidePanel` se conserva para registros simples (Auditoría 6-A) |
| Alcance de la ficha | No aplica (no existe ficha de Cliente hoy) | Solo administrativo | Vista 360° real — integra operación, no solo datos maestros |
| Organización interna | `PanelSection` vertical con scroll | Pestañas por dominio | Evolucionar el mismo principio de sección-por-dominio hacia pestañas de página completa |

---

## 4. Workspace Plugin Standard

### 4.1 Problema que resuelve

Si cada pestaña de cada Entity Workspace se codifica a mano dentro del componente de esa entidad,
el ERP termina con tantas implementaciones de "pestaña de Documentos" como entidades tenga —
exactamente el tipo de reinversión que el principio 1.10 prohíbe. El Workspace Plugin Standard
existe para que una capacidad como "Documentos" o "Timeline" se construya **una vez** y se
declare disponible para cualquier entidad que la necesite.

### 4.2 Cómo debe funcionar (arquitectura conceptual, sin código)

- Cada capacidad de pestaña (Timeline, Documentos, Mapa, Indicadores, Facturación, GPS,
  Contratos, Solicitudes, Viajes, Cartera...) se modela como un **plugin independiente**: sabe
  cómo pedir sus propios datos y cómo renderizarse, pero no sabe nada de qué tipo de entidad lo
  está usando.
- Cada tipo de entidad (Cliente, Proveedor, Vehículo...) declara, en un **manifiesto**, qué
  plugins usa y en qué orden — no escribe el código de la pestaña, solo la referencia.
- El `EntityWorkspace` (shell genérico de §3) lee ese manifiesto y monta los plugins declarados,
  pasándole a cada uno el identificador de la entidad activa y el contexto de permisos.
- Un plugin puede declarar sus propios requisitos de permiso (ej. "Cartera" solo visible para
  roles con acceso a Finanzas) — el shell respeta esa declaración sin necesitar saber el detalle
  de negocio.
- Un plugin nuevo (ej. "Cartera", cuando Finanzas exista) se agrega al catálogo de plugins
  disponibles y se declara en el manifiesto de las entidades que lo necesiten (Cliente, quizás
  Proveedor) — sin tocar el shell ni los demás plugins.

### 4.3 Regla de independencia

Ningún plugin puede importar conocimiento específico de una entidad (ej. el plugin de Timeline no
puede saber qué es un "Cliente"). Si un plugin necesita comportarse distinto según la entidad,
esa diferencia se resuelve por configuración declarada en el manifiesto, no por lógica condicional
dentro del plugin.

### 4.4 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Pestañas/secciones de detalle | No existen (solo `PanelSection` fija por módulo) | Fichas por dominio, aparentemente fijas por tipo de entidad | Arquitectura de plugins registrables — ni INLOP ni el ERP auditado la tienen; es la oportunidad de superar a ambos (Auditoría, pregunta 12) |

---

## 5. View Engine Standard

### 5.1 Definición

El **View Engine** es la capa que administra *cómo se ve* una Enterprise Table o un
`EntityWorkspace` para un usuario determinado, más allá de qué columnas están visibles. No es
solo un configurador de columnas — administra el conjunto completo de preferencias de
presentación de una superficie de datos.

### 5.2 Qué administra

Columnas visibles, orden de columnas, ancho de columnas, filtros activos, qué KPIs se muestran,
qué widgets están presentes, agrupaciones activas, criterio de ordenamiento, densidad visual, y la
persistencia de todo lo anterior como una **vista guardada** con nombre (ej. "Mi vista de cartera
vencida"), no solo como una configuración anónima de la última sesión.

### 5.3 Jerarquía de resolución (preparada, no toda implementada de inicio)

```
Vista guardada del usuario (si existe)
        ↓ si no existe
Configuración por defecto del rol
        ↓ si no existe
Configuración por defecto de la empresa
        ↓ si no existe
Configuración por defecto del sistema
```

Esta jerarquía reutiliza deliberadamente el mismo lenguaje de resolución en cascada ya adoptado
en el dominio Comercial para la búsqueda de tarifas (excepción cliente > convenio > general >
manual, Domain Model §6.6) — es el mismo principio de arquitectura aplicado a un problema
distinto, y da consistencia de estilo arquitectónico a todo el ERP.

### 5.4 Qué se implementa primero

Solo la resolución **usuario → default del sistema**. Rol y empresa quedan como niveles
presentes en el diseño del esquema pero no poblados, porque el ERP interno hoy no tiene un
catálogo formal de roles (`profiles.rol` es un string libre) — construir la resolución completa
antes de que ese catálogo exista sería construir sobre una base que no está lista (mismo
razonamiento que la Auditoría, conflicto 6-C).

### 5.5 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Alcance | No existe ningún motor de vista | Configuración de columnas (mostrar/ocultar/reordenar/persistir) | Superset: no solo columnas — vista completa (filtros, KPIs, widgets, agrupación, densidad) como unidad guardable |
| Persistencia | No existe | Persistida, alcance no especificado | Jerarquía usuario→rol→empresa→sistema, implementada por fases |

---

## 6. Filter Standard

### 6.1 Qué define

El comportamiento de cualquier filtro en cualquier Enterprise Table, más allá del tipo de dato de
la columna (ya cubierto en §2).

### 6.2 Operadores

Cada tipo de filtro soporta operadores propios de su naturaleza: texto (contiene, empieza con,
es exactamente), número (igual, mayor que, menor que, entre), fecha (antes de, después de, entre,
últimos N días), selección (es, no es, está en), booleano (sí/no/indiferente).

### 6.3 Combinación de condiciones

Los filtros de distintas columnas se combinan por defecto con **AND** (todas las condiciones
deben cumplirse) — es el comportamiento intuitivo y el que ya usan implícitamente los filtros
actuales (rango de fecha + búsqueda + tab de estado en Solicitudes, por ejemplo). El soporte para
**OR** y agrupación de condiciones (ej. "cliente A o cliente B, Y estado pendiente") es una
capacidad avanzada que se activa solo en tablas donde el volumen de combinaciones lo justifique —
no es obligatoria en todas.

### 6.4 Filtros guardados, favoritos y recientes

Un usuario puede guardar una combinación de filtros con un nombre (ej. "Clientes con cartera
vencida > 30 días"), marcarla como favorita para acceso rápido, y el sistema recuerda las últimas
combinaciones usadas sin necesidad de guardarlas explícitamente (filtros recientes). Compartir un
filtro guardado con otros usuarios del mismo rol/empresa es una capacidad futura, condicionada a
que exista el catálogo de roles (mismo prerrequisito que §5.4).

### 6.5 Filtros rápidos

Los tabs de estado que ya existen en las 4 páginas activas (`TABS` en Solicitudes, Programación,
Viajes, Cumplidos) **son** filtros rápidos — este estándar los reconoce como tal en lugar de
tratarlos como un patrón distinto. Un filtro rápido es cualquier atajo de un clic hacia una
condición de filtro común, sea presentado como tab, como botón o como chip.

### 6.6 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Mecanismo | Barra superior (fecha/búsqueda) + tabs de estado (= filtros rápidos, sin llamarse así) | Fila de filtros por columna tras embudo | Ambos coexisten: tabs para atajos comunes, fila de filtros por columna para casos heterogéneos |
| Guardado de filtros | No existe | No se detalló | Adoptar, con "compartir" diferido a que exista catálogo de roles |
| Operadores avanzados (OR, grupos) | No existe | No se detalló | Capacidad avanzada opcional, no obligatoria para todas las tablas |

---

## 7. Search Standard

### 7.1 Búsqueda rápida

Un único campo de texto libre que busca sobre los campos más relevantes de la entidad visible
(ya existe en las 4 páginas activas: código, cliente, agencia, origen/destino, etc., resuelto
client-side sobre el dataset ya cargado). Este estándar formaliza ese patrón como la búsqueda
rápida oficial de cualquier Enterprise Table.

### 7.2 Búsqueda avanzada

Cuando la búsqueda rápida no basta (usuario necesita combinar múltiples campos específicos con
operadores), se activa un panel de búsqueda avanzada — que en la práctica es la fila de Filter
Standard (§6) aplicada como búsqueda estructurada, no un mecanismo separado.

### 7.3 Búsqueda contextual

Dentro de un `EntityWorkspace`, cada plugin (§4) puede ofrecer su propia búsqueda acotada a sus
propios datos (ej. buscar dentro de los documentos de un cliente) — no compite con la búsqueda
global del ERP, vive dentro de su propio dominio.

### 7.4 Búsqueda futura con IA

Capacidad diferida: interpretar lenguaje natural ("solicitudes de Bogotá vencidas esta semana") y
traducirlo a los filtros estructurados ya definidos en §6. No se construye ahora — se deja como
posibilidad porque §6 ya define la estructura de filtros a la que ese lenguaje natural tendría que
traducirse, lo cual es el verdadero prerrequisito.

### 7.5 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Búsqueda rápida | Ya existe, client-side, por página | No se detalló | Formalizar como estándar transversal |
| Búsqueda avanzada | No existe como mecanismo separado | No se detalló | Se resuelve vía Filter Standard, no un motor aparte |
| IA | No existe | No se detalló | Diferida; depende de que Filter Standard esté maduro |

---

## 8. Action Standard

### 8.1 Jerarquía de acciones

| Tipo | Ubicación | Ejemplo actual |
|---|---|---|
| Acción primaria de página | `PageHeader.actions` | Botón "Actualizar" en las 4 páginas activas |
| Acción secundaria de página | `PageHeader.actions`, variante `outline`/`ghost` | — |
| Acción contextual de fila | Botón/ícono dentro de la fila, o al abrir el registro | Botones "Aprobar"/"Cancelar" en el footer de `DetalleSolicitud` |
| Acción masiva | Barra que aparece al seleccionar filas (Enterprise Table, §2.5) | No existe aún — se construye en Fase 0 |
| Acción rápida | Ícono inline en una celda para la operación más común de esa fila, sin abrir el registro completo | No existe aún, capacidad opcional |
| Menú de acciones | Cuando hay más de 2-3 acciones contextuales, se agrupan en un menú desplegable en vez de saturar la fila de botones | No existe aún |

### 8.2 Regla de ubicación

Toda acción que cree o transforme un registro nuevo vive en `PageHeader.actions` como botón —
nunca como FAB (rechazado explícitamente, Auditoría 6-E). Toda acción que opere sobre un registro
ya existente vive en el contexto de ese registro (fila, panel o workspace), nunca en el header
global de la página.

### 8.3 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Crear registro | Botón en `PageHeader` | FAB flotante | Mantener botón en `PageHeader` — no adoptar FAB |
| Acciones masivas | No existen | Se infiere su existencia en un ERP enterprise maduro | Adoptar como capacidad opcional de Enterprise Table |
| Acciones contextuales | Ya existen (footer de panel) | No se detalló | Formalizar como estándar, extender a menú cuando hay más de 2-3 |

---

## 9. Empty State Standard

### 9.1 Comportamiento

Todo estado vacío debe responder tres preguntas al usuario en el mismo orden: **qué está viendo**
(o no viendo), **por qué** (sin datos en el rango, sin resultados para el filtro, o realmente no
hay ningún registro todavía), y **qué puede hacer al respecto** (ampliar el rango, limpiar
filtros, o crear el primer registro si aplica). Ya existe el precedente literal: la prop
`emptyMessage` de `DataTable`, usada hoy con mensajes específicos por módulo ("No hay solicitudes
en el rango seleccionado.", "No hay viajes para los filtros seleccionados."). Este estándar exige
que ese mensaje, cuando aplique, incluya también la acción posible, no solo la explicación.

### 9.2 Distinción entre "sin datos" y "sin resultados de filtro"

Un dataset genuinamente vacío (módulo recién habilitado, cliente nuevo sin historial) y un dataset
con datos pero con filtros que no matchean nada son estados distintos y deben comunicarse
distinto — el segundo siempre ofrece la acción "Limpiar filtros".

### 9.3 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Mecanismo | `emptyMessage` configurable, ya en producción | No se detalló | Formalizar + exigir distinción "sin datos" vs. "sin resultados de filtro" + acción sugerida |

---

## 10. Error State Standard

### 10.1 Taxonomía de errores

| Tipo | Cuándo ocurre | Comportamiento esperado |
|---|---|---|
| Error de carga | Falla la petición al backend | Ícono + mensaje + botón "Reintentar" — patrón ya en producción en las 4 páginas activas |
| Error de permisos | El usuario no tiene autorización para la acción | Mensaje explícito, nunca un error genérico — precedente ya existe en `DetalleSolicitud`, que clasifica el error por patrón (`/403|401|permiso|autorizado/`) y responde "No tienes permiso para realizar esta acción. Contacta a tu administrador." |
| Error de red | Falla la conexión, no el servidor | Mensaje distinto al de permisos — mismo precedente ya distingue esto (`/network|failed to fetch|timeout/`) |
| Error funcional/de negocio | La operación es válida técnicamente pero inválida en reglas de negocio (ej. conflicto de estado, "409") | Mensaje explicando la regla de negocio violada, nunca un mensaje técnico crudo — mismo precedente ya lo hace (`/409|conflict|modificado/` → "Esta solicitud fue modificada por otro operador...") |

### 10.2 Regla central

`DetalleSolicitud` ya implementa, de forma ad-hoc, exactamente la taxonomía anterior mediante
clasificación de mensajes de error por expresión regular. Este estándar no inventa el patrón —
lo **formaliza** como comportamiento obligatorio de cualquier acción de escritura en el ERP, para
que cada módulo nuevo no tenga que redescubrirlo ni reinventarlo con su propio criterio.

### 10.3 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Errores de carga | Ya estandarizado (ícono + reintentar) en 4 páginas | No se detalló | Mantener, extender a todo módulo nuevo |
| Errores de permisos/red/negocio | Ya clasificados ad-hoc en `DetalleSolicitud` | No se detalló | Formalizar como taxonomía oficial reutilizable, no reinventada por cada módulo |

---

## 11. Timeline Standard

### 11.1 Definición

El **Timeline** es la representación cronológica de los eventos relevantes de una entidad. Ya
existe una implementación de referencia: el componente `Timeline` del módulo Solicitudes,
consumido dentro de `DetalleSolicitud`. Este estándar generaliza ese componente como el patrón
oficial para cualquier entidad con historial (Cliente, Proveedor, Vehículo, Empleado...).

### 11.2 Qué debe soportar

- **Formato uniforme de evento**: marca de tiempo, actor, tipo de evento, descripción — misma
  estructura que ya define el Domain Model para el evento de auditoría de Comercial (§13.1), que
  este estándar adopta como formato transversal de todo el ERP, no exclusivo de un dominio.
- **Agrupación**: eventos del mismo día o de la misma sesión operativa se agrupan visualmente en
  vez de listarse como entradas idénticas repetidas.
- **Filtros propios**: un Timeline con suficiente volumen debe poder filtrarse por tipo de evento
  o por actor, usando el mismo Filter Standard (§6) aplicado a su propio dataset.
- **Vínculo con auditoría**: cada entrada del Timeline con relevancia de auditoría debe ser
  trazable al evento de auditoría correspondiente (§13) — el Timeline es la vista humana; la
  auditoría es el registro de sistema; ambos deben poder reconciliarse.

### 11.3 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Implementación | Ya existe (`Timeline.tsx` en Solicitudes) | No se detalló | Generalizar como plugin de Workspace (§4) reutilizable por cualquier entidad |
| Formato de evento | Específico de Solicitud | No se detalló | Adoptar el formato uniforme ya definido en el Domain Model §13.1 como estándar transversal |

---

## 12. Attachment Standard

### 12.1 Definición

El **Attachment Standard** define cómo cualquier entidad del ERP gestiona documentos asociados
(contratos, cédulas, pólizas, facturas escaneadas, evidencias fotográficas). Es superficie
enteramente nueva — no existe ningún precedente de gestión documental en el ERP actual.

### 12.2 Qué debe soportar

| Elemento | Comportamiento esperado |
|---|---|
| Versiones | Un documento reemplazado no borra la versión anterior — se conserva con su fecha, igual que el principio de "no perder historial" ya aplicado a Cotizaciones en el Domain Model (RN-04, estado "convertida" permanente) |
| Tipos | Cada documento se clasifica por tipo (contrato, identificación, póliza, evidencia) — el tipo determina reglas de vigencia y quién puede subirlo |
| Estados | Un documento puede estar vigente, próximo a vencer, o vencido — relevante especialmente para documentos con fecha de expiración (pólizas, licencias de conductores) |
| Historial | Quién subió, reemplazó o eliminó cada versión, y cuándo |
| Responsable | Todo documento tiene un responsable de mantenerlo actualizado, no solo un subidor original |

### 12.3 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Gestión documental | No existe | Pestaña "Documentos" en la ficha de cliente | Adoptar como plugin de Workspace reutilizable — Cliente es el primer consumidor, no el único destino |

---

## 13. Activity Feed Standard

### 13.1 Definición

El **Activity Feed** es el historial funcional agregado del ERP: qué pasó, en qué entidad, quién
lo hizo. Se apoya en la misma estructura de evento de auditoría que ya define el Domain Model de
Comercial (§13.1-13.2) — este estándar la eleva de "catálogo de eventos de Comercial" a
**estructura de evento oficial de todo el ERP**.

### 13.2 Qué eventos registrar

Cualquier transición de estado de una entidad, cualquier creación o eliminación, cualquier acción
que un futuro auditor de negocio necesitaría poder reconstruir sin acceso a los logs técnicos del
servidor. La vara de decisión: si un gerente comercial preguntara *"¿quién cambió esto y por
qué?"*, la respuesta debe estar en el Activity Feed, no solo en un log de aplicación.

### 13.3 Cómo presentarlos

Como Timeline (§11) dentro del `EntityWorkspace` de la entidad afectada, y opcionalmente como
vista agregada transversal (ej. "todo lo que pasó hoy en Clientes") para roles de supervisión.

### 13.4 Cómo filtrarlos

Mismo Filter Standard (§6): por tipo de evento, por actor, por rango de fecha.

### 13.5 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Estructura de evento | Definida solo para Comercial (Domain Model §13) | No se detalló | Elevar a estándar transversal de todo el ERP, no exclusivo de un dominio |

---

## 14. Enterprise Navigation Standard

### 14.1 Flujo oficial

```
Listado (Enterprise Table)
     ↓  clic en fila / acción "ver"
Workspace (Entity Workspace, o SidePanel si la entidad es simple)
     ↓  acción "editar" dentro de una pestaña
Edición (formulario acotado al dominio de esa pestaña, nunca la entidad completa)
     ↓  guardar
Guardado (confirmación inline, sin salir del Workspace)
     ↓
Regreso (el usuario permanece en el Workspace, no es expulsado al Listado — el patrón actual
         de `SidePanel`, que se cierra pero mantiene la tabla de fondo intacta, ya modela
         correctamente este principio de "regreso sin pérdida de contexto")
```

### 14.2 Breadcrumbs

El breadcrumb del `AppShell` (`INLOP ERP > {módulo}`) hoy es estático de un solo nivel. Al
introducir Workspaces con pestañas, el breadcrumb debe volverse dinámico: `INLOP ERP > Clientes >
Acme S.A.S. > Operación` — reflejando Listado → Workspace → Pestaña, consistente con el flujo de
§14.1.

### 14.3 Historial de navegación

Dentro del ERP, "volver" a partir de un Workspace vuelve al Listado con los filtros que el
usuario tenía activos, no a un Listado reseteado — extiende el principio ya implementado en
`NavPayload` de preservar contexto entre módulos.

### 14.4 Deep links (futuro)

Hoy el ERP no tiene URLs por vista (no hay `react-router`, ver Auditoría 6-F) — cualquier "deep
link" a un Workspace específico es, por ahora, imposible de compartir fuera de la sesión activa.
Este estándar no resuelve esa limitación: la señala como la futura inversión de infraestructura
que, cuando se decida abordar, deberá diseñarse para que cada Workspace (y cada pestaña dentro de
él) tenga una URL direccionable. No se adopta como parte de esta fase.

### 14.5 Comparación

| | Estado actual INLOP | Patrón auditado | Decisión objetivo |
|---|---|---|---|
| Flujo Listado→Detalle→Regreso | Ya funciona vía `SidePanel`, preserva la tabla de fondo | No se detalló | Formalizar como flujo oficial también para Workspace de página completa |
| Breadcrumb | Estático, un nivel | No se detalló | Dinámico, refleja Listado > Workspace > Pestaña |
| Deep links | No existen (limitación estructural del ERP) | No se detalló | Diferido — decisión de infraestructura separada, no parte de esta fase |

---

## 15. Enterprise UX Rules

### 15.1 Reglas — qué SÍ hacer

- Toda capacidad nueva de tabla o de workspace se construye como extensión aditiva de la
  infraestructura común, nunca como solución particular de un módulo.
- Todo estado (vacío, error, carga) se diseña junto con el estado "feliz", no después.
- Toda acción de escritura relevante genera un evento de Activity Feed.
- Toda configuración de usuario tiene un default de sistema que funciona sin configurar nada.
- Todo módulo nuevo participa de `NavPayload`/`navActions` para preservar contexto — no inventa
  su propio mecanismo de "recordar desde dónde vine".
- Toda pestaña de un Entity Workspace se diseña como plugin independiente, sin conocimiento de
  la entidad concreta que lo usa.

### 15.2 Reglas — qué NUNCA hacer

- Nunca duplicar un dato sin una justificación de negocio documentada al mismo nivel que
  `tarifa_pactada`.
- Nunca introducir un FAB — la convención del ERP es el botón dentro de `PageHeader.actions`.
- Nunca forzar una entidad grande dentro de un `SidePanel` ensanchado — se usa `EntityWorkspace`.
- Nunca mostrar un error técnico crudo al usuario — todo error se traduce a la taxonomía de §10.
- Nunca construir una tabla, un sistema de filtros o una exportación específica de un módulo
  cuando la infraestructura común ya cubre el caso.
- Nunca romper la firma de un componente compartido para agregar una capacidad — la extensión
  siempre es aditiva (props opcionales), nunca un cambio incompatible.
- Nunca adoptar una dependencia nueva (librería de PDF, router, etc.) como efecto colateral de
  construir un módulo — es siempre una decisión explícita y separada.

### 15.3 Patrones prohibidos (heredados de la Auditoría, ratificados aquí)

FAB para creación de registros · fichas puramente administrativas sin integración operativa ·
tablas de terceros o sistemas de theming ajenos al Design System de INLOP · jerarquías de permisos
por rol construidas antes de que exista un catálogo de roles formal.

---

## 16. Comparación consolidada

| Estándar | Estado actual INLOP | Patrón auditado | Veredicto |
|---|---|---|---|
| Tabla Enterprise | Tabla básica sin filtros/orden/config | Tabla completa con filtros, config, export | **Adoptar**, extendiendo de forma aditiva |
| Entity Workspace | `SidePanel` angosto | Ficha administrativa por dominios | **Adoptar y superar** — página completa + integración operativa que ni INLOP ni el ERP auditado tienen |
| Workspace Plugin | No existe | No se detalló, probablemente fijo por tipo de entidad | **Diseñar de cero** — oportunidad de superar a ambos |
| View Engine | No existe | Solo configuración de columnas | **Adoptar y ampliar** — vista completa, no solo columnas |
| Filtros | Barra superior + tabs | Fila por columna | **Combinar ambos**, cada uno donde corresponde |
| Búsqueda | Rápida, client-side | No se detalló | **Formalizar**, IA diferida |
| Acciones | Botón en header + acciones contextuales | FAB | **Mantener convención INLOP**, rechazar FAB |
| Estados vacíos | `emptyMessage` básico | No se detalló | **Formalizar**, agregar distinción y acción sugerida |
| Estados de error | Ya taxonomizado ad-hoc en Solicitudes | No se detalló | **Formalizar** como estándar transversal |
| Timeline | Ya implementado en Solicitudes | No se detalló | **Generalizar** como plugin reutilizable |
| Documentos | No existe | Pestaña de ficha | **Adoptar** como plugin de Workspace |
| Activity Feed | Definido solo para Comercial | No se detalló | **Elevar** a estándar transversal del ERP |
| Navegación | Flujo ya correcto vía `SidePanel`/`NavPayload` | No se detalló | **Extender** a Workspace de página completa; deep links diferidos |

---

## Cierre

Este documento es la referencia obligatoria para cualquier desarrollo futuro del ERP INLOP,
empezando por la infraestructura Enterprise (DataTable v2, View Engine, Filter Engine, Export
Engine, Entity Workspace) y continuando con cada módulo que la consuma — Gestión Comercial
primero, y después Operaciones, Facturación, Compras, Inventario, Talento Humano, Vehículos,
Conductores, Proveedores, Seguridad, Configuración y cualquier módulo nuevo. Ninguna
implementación debe apartarse de lo aquí definido sin que ese apartamiento se documente y
justifique con el mismo rigor que este propio documento.
