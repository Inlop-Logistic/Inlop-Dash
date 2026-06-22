# INLOP ERP — Layout System

> **FASE 1 — Core UI System**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Arquitectura del Shell

El ERP INLOP usa un shell de aplicación fijo con tres zonas de layout:

```
┌──────────────────────────────────────────────────────────┐
│                      TOPBAR (56px)                        │  z-index: 100
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│   SIDEBAR    │         MAIN CONTENT AREA                 │
│  230px / 60px│    (scroll vertical independiente)        │
│              │                                           │
│   z: 999     │         z: 1 (base)                       │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

- **Topbar**: posición `fixed top-0 left-0 right-0`. No se desplaza.
- **Sidebar**: posición `fixed top-[56px] left-0 bottom-0`. No se desplaza.
- **Main content**: `margin-left: var(--sb-width)` ajustado por estado del sidebar. Scroll vertical propio.

---

## 2. Z-Index Stack

Jerarquía completa del sistema. Nunca usar valores fuera de esta tabla.

| Nivel | Valor | Elementos |
|---|---|---|
| **Base** | `1` | Contenido de página, cards, secciones |
| **Sticky** | `100` | Topbar, headers de tabla sticky |
| **Navigation** | `999` | Sidebar |
| **Dropdown / Tooltip** | `1000` | Dropdowns, tooltips, popovers |
| **Drawer** | `8000` | Side sheets, paneles deslizantes |
| **Modal** | `9000` | Modales y sus backdrops |
| **Toast / Notifications** | `9999` | Toasts, notificaciones flotantes |

### Regla

Nunca hardcodear z-index numéricos. Siempre usar tokens CSS:
```css
--z-base: 1;
--z-sticky: 100;
--z-navigation: 999;
--z-dropdown: 1000;
--z-drawer: 8000;
--z-modal: 9000;
--z-toast: 9999;
```

---

## 3. Componentes de Layout

### 3.1 Sidebar

**Propósito:** Navegación primaria del ERP. Persiste en todas las páginas del portal.

**Tema:** Siempre oscuro — invariante. Ver `THEMES.md § Sidebar Invariante`.

#### Estructura Interna

```
┌────────────────────┐
│ Logo INLOP         │  ← Área de marca (56px de alto)
├────────────────────┤
│ Nav Items          │  ← Lista de módulos
│  • Operaciones  ●  │  ← ítem activo (borde left + bg activo)
│  • Financiero      │
│  • OTIF            │
│  • Obligaciones    │
│  • Seguimiento     │
│  • Proyecto        │
├────────────────────┤
│ [spacer flex-1]    │
├────────────────────┤
│ User avatar        │  ← Área de usuario
│ Logout             │
└────────────────────┘
```

#### Estados del Sidebar

| Estado | Ancho | Muestra |
|---|---|---|
| Expandido | `230px` | Icono + Label |
| Colapsado | `60px` | Solo icono + tooltip en hover |
| Oculto (móvil) | `0px` | No visible (drawer en su lugar) |

#### Nav Item Anatomy

```
[ borde-left-3px (activo) ] [ icono 20px ] [ label (si expandido) ] [ badge-count? ]
```

#### Comportamiento

- Estado (expandido/colapsado) persiste en `localStorage`.
- Transición de ancho: `--duration-moderate` con `--ease-standard`.
- Tooltip al hover en estado colapsado (muestra el label).
- En móvil (< 768px) se convierte en Drawer desde la izquierda.

#### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `items` | NavItem[] | Lista de módulos con `{ id, label, icon, href, badgeCount? }` |
| `activeItem` | string | ID del módulo activo |
| `isCollapsed` | boolean | Estado controlado externamente |
| `onToggle` | function | Callback al colapsar/expandir |

---

### 3.2 Topbar

**Propósito:** Barra superior persistente. Contexto de página, búsqueda global, acciones de usuario.

#### Estructura Interna

```
┌──────────────────────────────────────────────────────────┐
│ [≡ toggle] [Título módulo]     [Search]  [Notif] [Avatar]│
└──────────────────────────────────────────────────────────┘
  ←── Left zone ──────────────────── Right zone ─────────→
```

#### Zonas

| Zona | Contenido |
|---|---|
| Izquierda | Botón toggle sidebar + Título del módulo activo + Breadcrumb opcional |
| Centro | Flexible (vacío por defecto) |
| Derecha | Search global + Selector de período + Notificaciones + Avatar/Perfil |

#### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `title` | string | Título del módulo activo |
| `breadcrumbs` | Crumb[] | Ruta de navegación |
| `rightSlot` | ReactNode | Contenido adicional a la derecha |
| `onMenuToggle` | function | Toggle del sidebar |

---

### 3.3 Header (de sección)

**Propósito:** Header interno de una sección o módulo. Diferente del Topbar (que es del shell).

#### Estructura

```
┌──────────────────────────────────────────────────────────┐
│ Título de Sección            [Acciones / Filtros / Ctrl] │
│ Subtítulo / descripción                                  │
└──────────────────────────────────────────────────────────┘
```

#### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `title` | string | Título de la sección |
| `subtitle` | string | Descripción o contexto |
| `actions` | ReactNode | Slot para botones/filtros a la derecha |
| `tabs` | TabItem[] | Si la sección tiene tabs, se integran aquí |

---

### 3.4 Footer

**Propósito:** Pie de página con metadatos del sistema.

**Nota:** El ERP INLOP no tiene footer visible por defecto en modo portal. El footer es mínimo: versión, copyright, links de soporte. Se ubica al final del `main` content, no es fixed.

---

### 3.5 PageContainer

**Propósito:** Wrapper de alto nivel que aplica el padding, max-width y contexto de página.

#### Responsabilidades

- Aplica `padding-top: 56px` para compensar el topbar fixed.
- Aplica `padding-left: var(--sb-width)` que se ajusta con el estado del sidebar.
- Aplica padding interno horizontal (`--space-6` a `--space-8`).
- Gestiona el `max-width` de contenido (default: ilimitado en ERP denso).
- Scroll vertical propio del área de contenido.

#### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `maxWidth` | string | Limitar ancho del contenido (opcional) |
| `noPadding` | boolean | Para páginas que necesitan edge-to-edge |
| `scrollRef` | ref | Ref para controlar scroll programáticamente |

---

### 3.6 SectionContainer

**Propósito:** Agrupa un título de sección, su toolbar y su contenido dentro de una página.

#### Estructura

```
┌──────────────────────────────────────────────────────────┐
│ SectionHeader                                            │
│   (título, subtítulo, acciones)                         │
├──────────────────────────────────────────────────────────┤
│ SectionBody                                              │
│   children (Cards, Tablas, Gráficas)                     │
└──────────────────────────────────────────────────────────┘
```

#### Uso

```
PageContainer
  └── SectionContainer ("Resumen Operativo")
        ├── KpiCard ×4
        └── SectionContainer ("Tendencia")
              └── ChartCard
```

---

### 3.7 Grid System

**Propósito:** Sistema de grilla para organizar Cards, KPIs y Gráficas.

#### Implementación

Tailwind CSS Grid con clases utilitarias consumiendo los breakpoints del Design System.

#### Configuración por Contexto

| Contexto | Grid | Columnas |
|---|---|---|
| KPI Row | auto-fit | 4 KPIs en desktop, 2 en tablet, 1 en móvil |
| Chart Row (2 charts) | 2 cols | 50/50 en desktop, 100% en tablet |
| Chart Row (1 chart full) | 1 col | 100% siempre |
| Chart + Tabla | 2 cols | 60/40 en desktop, 100% apilado en tablet |
| Cards generales | 3 cols | 3 en desktop, 2 en tablet, 1 en móvil |

#### Gutter

| Breakpoint | Gap |
|---|---|
| < 768px | `12px` |
| 768–1023px | `16px` |
| 1024–1279px | `20px` |
| ≥ 1280px | `24px` |

---

## 4. Scroll Management

### Reglas

1. **Scroll principal**: solo el `main content area` hace scroll vertical. Topbar y Sidebar son fixed.
2. **Scroll interno**: las tablas con muchas filas tienen scroll vertical interno (max-height configurable).
3. **Scroll horizontal**: las tablas con muchas columnas tienen scroll horizontal interno. Nunca scroll horizontal de página.
4. **Body scroll lock**: se activa cuando hay un Modal abierto.
5. **Scroll restoration**: al navegar entre módulos, la posición vuelve al inicio.

### Componentes con scroll interno

| Componente | Scroll |
|---|---|
| Table (filas) | Vertical interno, max-height configurable |
| Table (columnas) | Horizontal interno con columna sticky |
| Modal body | Vertical interno cuando contenido > 60vh |
| Sidebar | Vertical interno si items > altura viewport |
| Dropdown | Vertical interno si items > 8 |

---

## 5. Responsive Layout Behavior

| Breakpoint | Sidebar | Layout principal | Grid KPIs |
|---|---|---|---|
| < 480px | Oculto (drawer) | 1 columna, padding 12px | 1 col |
| 480–767px | Oculto (drawer) | 1 columna, padding 16px | 1 col |
| 768–1023px | Colapsado (60px) | Padding-left 60px | 2 cols |
| 1024–1279px | Colapsado (60px) | Padding-left 60px | 3 cols |
| ≥ 1280px | Expandido (230px) | Padding-left 230px | 4 cols |

### Transiciones Responsive

- El ajuste de `margin-left` del main content al colapsar/expandir sidebar se anima con `--duration-moderate`.
- En móvil, el drawer del sidebar tiene overlay backdrop.
- Las grillas no se animan al cambiar breakpoint (reflow puro, sin transición de grid).

---

## 6. Composición Típica de Página

```
App Shell
├── Sidebar (fixed, z:999)
├── Topbar (fixed, z:100)
└── PageContainer (margin-left: sidebar-width, padding-top: 56px)
      └── SectionContainer
            ├── SectionHeader
            │     └── Tabs (Resumen | Tendencia | ...)
            └── SectionBody
                  ├── Grid → KpiCard × 4
                  ├── Grid → ChartCard (60%) + ChartCard (40%)
                  └── Grid → Table (100%)
```

---

## 7. Decisiones de Diseño

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Sidebar fixed + main scroll | Layout completo scroll | El sidebar y topbar siempre visibles es crítico para navegación rápida entre módulos |
| Sidebar siempre oscuro | Seguir el tema activo | El contraste del sidebar es parte de la identidad visual. Cambiar tema del sidebar confunde navegación |
| Z-index como tokens CSS | Valores inline | Previene conflictos de stacking, facilita mantenimiento y auditoría |
| Grid Tailwind | CSS Grid custom | Tailwind ya está en el stack; evitar CSS custom cuando Tailwind cubre el caso |
| Scroll por zona | Scroll de página completa | ERP denso necesita que la tabla y el header estén visibles simultáneamente |
