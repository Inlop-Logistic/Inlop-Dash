# INLOP ERP — Navigation System

> **FASE 2 — Application Shell**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Modelo de Navegación

El ERP INLOP usa un modelo de navegación de **dos niveles**:

```
Nivel 1 — Módulo
  Sidebar principal → cambia el módulo activo
  Ejemplo: click en "Operaciones" → navega a /operaciones

Nivel 2 — Sub-sección
  Tabs dentro del módulo → cambia la vista sin salir del módulo
  Ejemplo: Tab "Resumen" vs Tab "Tendencia" en Operaciones
```

### Principios

1. **La URL es la fuente de verdad** — El estado de navegación se deriva de la URL, no de estado local.
2. **Navegación sin pérdida de datos** — Al cambiar de tab o sub-sección, los filtros activos se preservan en la URL.
3. **Shallow routing para filtros** — Los filtros (fechas, búsqueda) se guardan como query params, no como rutas.
4. **Prefetch en hover** — Al hacer hover sobre un nav item, Next.js prefetchea la ruta de ese módulo.

---

## 2. Mapa de Módulos

### 2.1 Operaciones

```
/operaciones
├── /resumen           (default)
│     ├── Tab: Resumen Operativo
│     └── Tab: Tendencia
├── /seguimiento       → detalle en vivo de operaciones
└── /envio/[id]        → vista detalle de envío individual
```

### 2.2 Financiero

```
/financiero
├── /dashboard         (default)
├── /ingresos
├── /egresos
├── /flujo-caja
└── /reportes
```

### 2.3 OTIF

```
/otif
├── /dashboard         (default)
│     ├── Tab: Resumen OTIF
│     └── Tab: Por Carrier
├── /analisis
└── /historico
```

### 2.4 Obligaciones

```
/obligaciones
├── /dashboard         (default)
├── /vencimientos
├── /documentos
└── /calendario
```

### 2.5 Seguimiento en Vivo

```
/seguimiento
├── /mapa              (default)
├── /lista
└── /alertas
```

### 2.6 Planeación

```
/planeacion
├── /dashboard         (default)
├── /capacidad
├── /calendario
└── /simulador
```

### 2.7 Proyecto / Comité

```
/proyecto
├── /dashboard         (default)
├── /proyectos         → lista de proyectos
├── /proyecto/[id]     → vista detalle de proyecto
├── /comite            → actas de comité
└── /comite/[id]       → acta específica
```

---

## 3. Estado Activo en Sidebar

### 3.1 Determinación del Ítem Activo

El ítem activo del sidebar se determina comparando el `pathname` actual con la ruta base de cada módulo:

| Pathname actual | Ítem activo |
|---|---|
| `/operaciones` | Operaciones |
| `/operaciones/resumen` | Operaciones |
| `/operaciones/envio/4521` | Operaciones |
| `/financiero/ingresos` | Financiero |

Se usa `startsWith` para el match, no igualdad exacta. El módulo raíz siempre está activo si cualquier subruta del módulo está activa.

### 3.2 Indicador Visual de Activo

```
Activo:
  border-left: 3px solid --sb-accent
  background: --sb-bg2
  color: --sb-text-active

Hover (no activo):
  background: --sb-bg2 con 60% opacidad
  color: --sb-text-hover

Default:
  background: transparent
  color: --sb-text
```

---

## 4. Navegación entre Módulos

### 4.1 Flujo de Transición

1. Usuario hace click en nav item del sidebar.
2. Next.js ejecuta navegación client-side (`router.push`).
3. El módulo anterior se desmonta.
4. El módulo nuevo monta con sus `loading.tsx` skeleton mientras carga datos.
5. Una vez cargados los datos, se reemplaza skeleton por contenido.
6. El breadcrumb se actualiza.
7. El título del Topbar se actualiza.

### 4.2 Preservación de Estado entre Módulos

| Estado | Se preserva? | Mecanismo |
|---|---|---|
| Filtros del módulo anterior | No (se resetean) | — |
| Tema activo | Sí | Context / localStorage |
| Empresa activa | Sí | Context / localStorage |
| Estado del sidebar | Sí | Context / localStorage |
| Período global | Sí | Query params / Context |
| Datos cacheados | Sí | TanStack Query cache |

### 4.3 Prefetch Strategy

- Next.js prefetchea automáticamente las rutas visibles en el viewport.
- El sidebar está siempre visible → todos los módulos se prefetchean pasivamente.
- En hover sobre un nav item: prefetch explícito del chunk del módulo.

---

## 5. Navegación con Tabs (Sub-secciones)

### 5.1 Tabs en URL

Los tabs de segundo nivel se reflejan en la URL como segmento de ruta:

```
/operaciones/resumen      → Tab "Resumen Operativo"
/operaciones/tendencia    → Tab "Tendencia"
```

No usar query params para tabs. La URL debe ser siempre compartible con el tab correcto activo.

### 5.2 Tab Default

Cada módulo define un tab por defecto. Acceder a la raíz del módulo redirige al tab default:

```
/operaciones  →  redirect  →  /operaciones/resumen
/otif         →  redirect  →  /otif/dashboard
```

### 5.3 Persistencia de Filtros en Tabs

Al cambiar entre tabs de un mismo módulo, los filtros comunes (período, búsqueda) se preservan como query params:

```
/operaciones/resumen?desde=2024-06-01&hasta=2024-06-30
    ↓ click Tab "Tendencia"
/operaciones/tendencia?desde=2024-06-01&hasta=2024-06-30
                       ↑ filtros preservados
```

---

## 6. Navegación por Teclado

### 6.1 Shortcuts de Módulo

| Shortcut | Acción |
|---|---|
| `Ctrl+K` / `Cmd+K` | Abre Search Global |
| `Ctrl+1` ... `Ctrl+7` | Navega al módulo 1–7 en el orden del sidebar |
| `Escape` | Cierra modal / drawer / dropdown activo |
| `Alt+←` | Navega atrás en el historial |
| `Alt+→` | Navega adelante en el historial |

### 6.2 Navegación en Sidebar

Cuando el foco está dentro del sidebar:
- `Tab` / `Shift+Tab`: recorre los nav items.
- `Enter` / `Space`: activa el nav item.
- `Arrow Up` / `Arrow Down`: navega entre items.

### 6.3 Focus Management

- Al navegar a una nueva ruta, el foco se mueve al `<h1>` principal del módulo.
- Los modales y drawers atrapan el foco dentro (focus trap).
- Al cerrar un modal, el foco regresa al elemento que lo abrió.

---

## 7. Navegación Móvil

### 7.1 Drawer Móvil

En breakpoints < 768px, el sidebar se convierte en Drawer:

```
Trigger: Botón ≡ en Topbar izquierda
Comportamiento:
  - Drawer aparece desde la izquierda
  - Backdrop oscuro cubre el contenido
  - Click en backdrop cierra el drawer
  - Swipe desde borde izquierdo abre el drawer
  - Swipe desde adentro hacia la izquierda cierra
  - Al seleccionar un módulo, el drawer se cierra automáticamente
```

### 7.2 Bottom Navigation (Futuro)

En una iteración futura para móvil, se evaluará una barra de navegación inferior con los 4–5 módulos más usados. Fuera del alcance de FASE 2.

---

## 8. Navegación Guards

### 8.1 Guard de Autenticación

Todas las rutas del grupo `(portal)` requieren sesión activa. Si no hay sesión, redirigen a `/login` con el return URL como query param:

```
/operaciones  →  (no autenticado)  →  /login?returnUrl=/operaciones
```

Una vez autenticado, el sistema redirige al `returnUrl`.

### 8.2 Guard de Permisos

Cada módulo verifica permisos antes de renderizar. Si el usuario no tiene acceso:

```
/financiero  →  (sin rol financiero)  →  /sin-permiso
                                         (página de acceso denegado)
```

### 8.3 Guard de Empresa

Si el usuario tiene empresa activa seleccionada y navega a un módulo no disponible en esa empresa:

```
/planeacion  →  (módulo no activo para empresa)  →  /operaciones
                                                    (redirect al módulo default)
```

### 8.4 Guard de Módulo en Construcción

Durante el desarrollo, los módulos no implementados muestran una página de `coming-soon` en lugar de un 404. El nav item se mantiene visible pero muestra un badge `Próximamente`.

---

## 9. Historial y Deep Links

### 9.1 URLs Compartibles

Cualquier URL del ERP debe ser compartible y reproducir el mismo estado al abrirse:
- Módulo activo.
- Tab seleccionada.
- Filtros de fecha (como query params).
- Filtros de búsqueda (como query params).
- Recurso específico (como segmento de ruta).

### 9.2 Query Params Estándar

| Param | Descripción | Ejemplo |
|---|---|---|
| `desde` | Fecha inicio del filtro | `?desde=2024-06-01` |
| `hasta` | Fecha fin del filtro | `?hasta=2024-06-30` |
| `q` | Término de búsqueda | `?q=carrier+xyz` |
| `empresa` | ID de empresa activa | `?empresa=inlop-01` |
| `tab` | Tab activa (si no está en ruta) | `?tab=tendencia` |

### 9.3 Sanitización de Query Params

- Fechas inválidas se ignoran (se usa el default).
- Params desconocidos se ignoran silenciosamente.
- IDs de empresa sin acceso se ignoran (se mantiene la empresa activa).

---

## 10. Indicadores de Carga durante Navegación

| Elemento | Comportamiento |
|---|---|
| **Top progress bar** | Barra fina en la parte superior de la pantalla que avanza durante la navegación. Similar a NProgress. |
| **Skeleton del módulo** | Mientras carga el módulo, se muestra un skeleton de la estructura esperada (KpiCards + tabla). |
| **Fade transition** | El contenido nuevo hace fade-in suave (`--duration-fast`) al aparecer. |
| **Sidebar activo** | El ítem del sidebar se marca como activo inmediatamente, antes de que el módulo cargue. |

---

## 11. Módulos Deshabilitados

Un módulo puede estar deshabilitado por tres razones:

| Razón | Visual en Sidebar | Comportamiento al click |
|---|---|---|
| Sin permiso de rol | Ítem con opacidad 0.4, sin cursor pointer | No navega. Tooltip: "Sin acceso" |
| No disponible en empresa | Ítem oculto | — |
| En construcción | Ítem visible + badge `Próx.` | Navega a página coming-soon |
