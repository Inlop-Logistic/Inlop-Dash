# INLOP ERP — Application Shell

> **FASE 2 — Application Shell**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Visión General del Shell

El Application Shell es la capa de infraestructura UI que envuelve todos los módulos del ERP. Es persistente: nunca se desmonta durante la sesión activa. Los módulos se renderizan dentro del shell, no en lugar de él.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOPBAR (56px)                            │  z: 100
├──────────────────┬──────────────────────────────────────────────┤
│                  │  BREADCRUMB BAR (36px, condicional)          │
│   SIDEBAR        ├──────────────────────────────────────────────┤
│   230px/60px     │                                              │
│                  │         MAIN CONTENT AREA                    │
│   z: 999         │         (scroll vertical propio)             │
│                  │                                              │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘

  Overlays (sobre el shell, z > 999):
  ├── Dropdowns / Tooltips   z: 1000
  ├── Drawers                z: 8000
  ├── Modales                z: 9000
  └── Toasts                 z: 9999
```

### Principios del Shell

1. **Persistencia** — El shell nunca hace unmount. La navegación solo cambia el área de contenido.
2. **Contexto compartido** — El shell provee contextos de tema, usuario, empresa y permisos a todos los módulos.
3. **Independencia de módulos** — El shell no conoce la lógica interna de ningún módulo.
4. **Rendimiento** — Los componentes del shell se renderizan una sola vez; se evita re-render por cambios de ruta.

---

## 2. Sidebar Principal

### 2.1 Estructura de Zonas

```
┌──────────────────────┐
│  ZONA MARCA (56px)   │  ← Logo INLOP + botón colapsar
├──────────────────────┤
│                      │
│  ZONA EMPRESA        │  ← Selector multiempresa (ver §7)
│  (condicional)       │
├──────────────────────┤
│                      │
│  ZONA NAVEGACIÓN     │  ← Nav items de módulos
│  (flex-1, scroll)    │
│                      │
├──────────────────────┤
│  ZONA ACCIONES       │  ← Quick Actions, Settings
├──────────────────────┤
│  ZONA USUARIO (64px) │  ← Avatar, nombre, logout
└──────────────────────┘
```

### 2.2 Nav Items — Módulos

| Orden | Módulo | Icono | Ruta base | Roles con acceso |
|---|---|---|---|---|
| 1 | Operaciones | `BarChart2` | `/operaciones` | admin, operaciones, viewer |
| 2 | Financiero | `DollarSign` | `/financiero` | admin, financiero, viewer |
| 3 | OTIF | `Target` | `/otif` | admin, operaciones, viewer |
| 4 | Obligaciones | `FileText` | `/obligaciones` | admin, juridico, viewer |
| 5 | Seguimiento en Vivo | `Activity` | `/seguimiento` | admin, operaciones, viewer |
| 6 | Planeación | `Calendar` | `/planeacion` | admin, operaciones |
| 7 | Proyecto / Comité | `Briefcase` | `/proyecto` | admin, proyecto |

### 2.3 Anatomía de Nav Item

```
[ borde-left 3px (activo) ] [ icono 20px ] [ label ] [ badge-count? ]

Estado activo:    borde --sb-accent + fondo --sb-bg2 + texto --sb-text-active
Estado hover:     fondo --sb-bg2 (60% opacidad) + texto --sb-text-hover
Estado default:   sin fondo + texto --sb-text
Estado disabled:  opacidad 0.4, no interactivo (módulo sin permiso)
```

### 2.4 Estados del Sidebar

| Estado | Ancho | Comportamiento |
|---|---|---|
| **Expandido** | `230px` | Muestra icono + label + badge |
| **Colapsado** | `60px` | Solo icono + tooltip en hover con label |
| **Drawer (móvil)** | `280px` | Overlay desde la izquierda con backdrop |
| **Oculto** | `0px` | Solo en rutas de auth (login, callback) |

### 2.5 Persistencia de Estado

- El estado expandido/colapsado se guarda en `localStorage` con clave `inlop-sidebar-state`.
- Al iniciar sesión, se restaura el estado guardado.
- Default si no hay estado previo: expandido en desktop, colapsado en tablet.

### 2.6 Tooltip en Estado Colapsado

Cuando el sidebar está colapsado, cada nav item muestra un tooltip a la derecha con:
- Nombre del módulo
- Badge de notificaciones (si aplica)

El tooltip usa z-index `--z-dropdown` (1000).

---

## 3. Topbar (Header Superior)

### 3.1 Estructura de Zonas

```
┌───────────────────────────────────────────────────────────────────────┐
│  [≡ toggle]  [Título Módulo]  [Breadcrumb]      [Search] [🔔] [👤]   │
│              ←── Zona Izquierda ──→              ←── Zona Derecha ──→ │
└───────────────────────────────────────────────────────────────────────┘
  Height: 56px
  Background: --c1
  Border-bottom: --border-default
  Position: fixed top-0 left-0 right-0
  z-index: --z-sticky (100)
```

### 3.2 Zona Izquierda

| Elemento | Descripción |
|---|---|
| **Toggle Sidebar** | Botón ≡ que colapsa/expande el sidebar. En móvil abre el drawer. |
| **Título del Módulo** | Nombre del módulo activo. Fuente: Barlow Condensed 700, 18px. Cambia con la ruta. |
| **Breadcrumb** | Ruta de navegación actual. Visible solo si hay más de 1 nivel de profundidad. Ver §4. |

### 3.3 Zona Derecha

| Elemento | Descripción | Comportamiento |
|---|---|---|
| **Selector de Período** | Rango de fechas global. Afecta a los módulos que lo consumen. | Abre DatePicker tipo `range` con presets. |
| **Search Global** | Búsqueda transversal del ERP. | Al hacer click expande campo; ver §6. |
| **Notificaciones** | Campana con badge de conteo. | Abre panel lateral (Drawer); ver §5. |
| **Selector de Empresa** | Visible solo en cuentas multiempresa. | Dropdown con lista de empresas. |
| **Menú de Usuario** | Avatar + nombre. | Abre dropdown; ver §4. |

---

## 4. Breadcrumbs

### 4.1 Posición

Los breadcrumbs se ubican en la zona izquierda del Topbar, a la derecha del título del módulo, separados por un `/` visual.

```
[Operaciones]  /  [Resumen Operativo]  /  [Detalle Envío #4521]
     ↑                   ↑                         ↑
  Módulo raíz        Sub-sección              Recurso específico
  (no clickeable      (clickeable)              (no clickeable,
  si es la actual)                              estado actual)
```

### 4.2 Reglas de Generación

| Nivel de ruta | Muestra breadcrumb |
|---|---|
| `/operaciones` (raíz del módulo) | No muestra breadcrumbs |
| `/operaciones/resumen` | `Operaciones / Resumen Operativo` |
| `/operaciones/envio/4521` | `Operaciones / Seguimiento / Envío #4521` |

### 4.3 Truncado

- En pantallas < 1024px, el breadcrumb se colapsa: solo muestra el nivel actual con un `< Atrás` al inicio.
- Máximo 3 niveles visibles. Si hay más, el nivel intermedio se reemplaza por `...`.

### 4.4 Origen de los Labels

Cada segmento del breadcrumb obtiene su label de:
1. Configuración estática de la ruta (para secciones fijas).
2. Datos del recurso actual (para recursos dinámicos como `envío #4521`).

---

## 5. Menú de Usuario

### 5.1 Trigger

Avatar circular (32px) + nombre del usuario + chevron-down. Click abre dropdown.

### 5.2 Contenido del Dropdown

```
┌────────────────────────────────┐
│  👤  Juan Pérez                │  ← Nombre completo (no clickeable)
│      juan.perez@inlop.com.co   │  ← Email
│      Rol: Administrador        │  ← Rol activo
├────────────────────────────────┤
│  ⚙️  Configuración de perfil   │
│  🌓  Cambiar tema              │  ← Toggle dark/light
│  🏢  Cambiar empresa           │  ← Solo si multiempresa
├────────────────────────────────┤
│  📋  Documentación             │
│  ❓  Soporte                   │
├────────────────────────────────┤
│  🚪  Cerrar sesión             │  ← Danger color
└────────────────────────────────┘
```

### 5.3 Avatar

- Si el usuario tiene foto de perfil (Microsoft AD): se muestra la imagen.
- Si no: se generan iniciales sobre fondo de color derivado del nombre (hash).
- Tamaño en Topbar: 32px. Tamaño en dropdown header: 48px.

---

## 6. Notificaciones

### 6.1 Badge de Conteo

- Se muestra sobre el ícono de campana en el Topbar.
- Máximo visible: `99+`. Si hay más de 99, muestra `99+`.
- El conteo se actualiza en tiempo real via Supabase Realtime.

### 6.2 Panel de Notificaciones (Drawer)

Al hacer click en la campana, se abre un Drawer desde la derecha.

```
┌──────────────────────────────────┐
│  Notificaciones              [×] │
│  [Todas] [No leídas] [Sistema]   │  ← Tabs de filtro
├──────────────────────────────────┤
│  ● Alerta: OTIF crítico          │  ← No leída
│    Carrier XYZ - hace 5 min      │
├──────────────────────────────────┤
│  ○ Carga de Excel completada     │  ← Leída
│    Financiero - hace 2h          │
├──────────────────────────────────┤
│  ○ Nuevo comentario en Comité    │
│    Proyecto Alpha - ayer         │
├──────────────────────────────────┤
│  [ Ver todas las notificaciones ]│
└──────────────────────────────────┘
  Width: 380px
  z-index: --z-drawer (8000)
```

### 6.3 Tipos de Notificación

| Tipo | Origen | Semántica |
|---|---|---|
| `alerta` | Sistema (reglas de negocio) | KPI crítico, umbral superado |
| `proceso` | Jobs async (Excel, Claude AI) | Proceso completado o fallido |
| `colaboracion` | Acciones de otros usuarios | Comentarios, asignaciones |
| `sistema` | Infraestructura | Mantenimiento, actualizaciones |

### 6.4 Acciones por Notificación

- Click en notificación: navega al contexto relacionado + marca como leída.
- Ícono de marca leída/no leída individual.
- Acción global: `Marcar todas como leídas`.

---

## 7. Quick Actions

### 7.1 Ubicación

Botón `+` o `Acciones rápidas` en la zona inferior del sidebar (sobre la zona de usuario) o en el Topbar según breakpoint.

### 7.2 Acciones Disponibles

```
┌──────────────────────────────────┐
│  Acciones Rápidas                │
├──────────────────────────────────┤
│  📤  Cargar Excel                │  ← Abre modal de upload
│  📊  Nueva análisis IA           │  ← Inicia flujo Claude AI
│  📋  Nuevo reporte               │  ← Selector de módulo + período
│  🔗  Compartir vista actual      │  ← Copia URL con filtros activos
└──────────────────────────────────┘
```

### 7.3 Visibilidad por Rol

| Acción | Roles habilitados |
|---|---|
| Cargar Excel | admin, operaciones, financiero |
| Nueva análisis IA | admin, operaciones, financiero |
| Nuevo reporte | admin, viewer (solo lectura) |
| Compartir vista | todos |

---

## 8. Search Global

### 8.1 Comportamiento

- **Collapsed:** Icono de lupa en el Topbar.
- **Expanded:** Campo de texto que aparece con animación `scale-in` desde el ícono. Ocupa hasta 400px.
- Al hacer Escape o click fuera: vuelve a collapsed.
- Shortcut de teclado: `Ctrl+K` / `Cmd+K`.

### 8.2 Alcance de Búsqueda

| Categoría | Ejemplos |
|---|---|
| **Módulos** | Navega al módulo: `Operaciones`, `Financiero` |
| **Envíos** | `#4521`, `Envío a Bogotá` |
| **Reportes** | `Reporte OTIF Junio` |
| **Acciones** | `Cargar Excel`, `Cambiar tema` |
| **Ayuda** | `¿Cómo exportar?` |

### 8.3 Resultados

```
┌──────────────────────────────────────────┐
│  🔍 [           buscar...          ]     │
├──────────────────────────────────────────┤
│  MÓDULOS                                 │
│  ▸ Operaciones                           │
│  ▸ Financiero                            │
├──────────────────────────────────────────┤
│  ACCIONES                                │
│  ⚡ Cargar Excel                         │
│  ⚡ Nueva análisis IA                    │
├──────────────────────────────────────────┤
│  RECIENTES                               │
│  🕐 Reporte OTIF Mayo                    │
└──────────────────────────────────────────┘
  Posición: bajo el campo, alineado derecha
  z-index: --z-dropdown (1000)
  Max-height: 480px (scroll interno)
```

### 8.4 Debounce y Performance

- Debounce: 250ms antes de ejecutar búsqueda.
- Resultados de módulos y acciones: instantáneos (local).
- Resultados de datos (envíos, reportes): async con Supabase.
- Máximo 5 resultados por categoría visible antes de `Ver más`.

---

## 9. Selector Multiempresa

### 9.1 Cuándo Aparece

Solo para usuarios con acceso a más de una empresa. Los usuarios de empresa única nunca ven este selector.

### 9.2 Ubicación

En el Topbar (zona derecha, antes de notificaciones) cuando hay multiempresa activa. En el sidebar (zona empresa) muestra la empresa activa siempre.

### 9.3 Componente en Topbar

```
[ Logo empresa ] [ Nombre empresa ]  ▾
     ↓ click
┌──────────────────────────────────┐
│  🏢  INLOP Logística S.A.S. ✓   │  ← Empresa activa
│  🏢  INLOP Carga Aérea           │
│  🏢  INLOP Internacional          │
└──────────────────────────────────┘
```

### 9.4 Efecto del Cambio de Empresa

Al cambiar de empresa:
1. Se invalida toda la caché de TanStack Query.
2. Se redirige al dashboard raíz del módulo actual.
3. Los filtros activos se resetean.
4. El contexto de empresa se actualiza en el Provider global.
5. Se registra el cambio en el log de auditoría.

### 9.5 Empresa en el Contexto

El shell mantiene un `EmpresaContext` que expone:
- `empresa.id`
- `empresa.nombre`
- `empresa.logo`
- `empresa.modulos` (módulos habilitados para esa empresa)
- `empresa.configuracion` (settings específicos de la empresa)

Todos los servicios de datos incluyen `empresa_id` automáticamente en cada request.

---

## 10. Contextos del Shell

El shell provee los siguientes React Contexts a todos los módulos hijos:

| Context | Datos expuestos | Responsabilidad |
|---|---|---|
| `AuthContext` | `user`, `session`, `isLoading` | Identidad del usuario autenticado |
| `EmpresaContext` | `empresa`, `setEmpresa` | Empresa activa |
| `PermisosContext` | `can(accion, recurso)` | Evaluación de permisos |
| `ThemeContext` | `theme`, `toggleTheme` | Tema activo (dark/light) |
| `NotificacionesContext` | `count`, `marcarLeida` | Estado de notificaciones |
| `SidebarContext` | `isCollapsed`, `toggle` | Estado del sidebar |

Ningún módulo accede a estos datos por prop drilling. Todos consumen los Contexts via hooks.

---

## 11. Shell en Rutas de Auth

En las rutas del grupo `(auth)` (login, callback, error), el shell se comporta diferente:

| Elemento | En rutas (portal) | En rutas (auth) |
|---|---|---|
| Sidebar | Visible | Oculto |
| Topbar | Visible | Oculto |
| Breadcrumbs | Visible | Oculto |
| Fondo | `--c0` (ERP) | `--brand-navy` (corporativo) |
| Layout | Shell + módulo | Centrado vertical/horizontal |

Las rutas `(auth)` tienen su propio layout independiente del shell principal.
