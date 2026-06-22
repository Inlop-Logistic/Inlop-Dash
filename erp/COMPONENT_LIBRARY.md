# INLOP ERP — Component Library

> **FASE 1 — Core UI System**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## Principios de Componentes

1. **Composición sobre herencia** — Componentes pequeños que se combinan.
2. **Props explícitas** — Sin magic strings; usar TypeScript unions.
3. **Sin lógica de negocio** — Los componentes UI solo gestionan presentación y estado visual.
4. **Accesibles por defecto** — ARIA roles, keyboard navigation, focus visible.
5. **Tema-agnósticos** — Consumen tokens CSS; no hardcodean colores.

---

## Categorías

```
/packages/ds/components/
├── ui/           ← 16 componentes base de interfaz
├── layout/       ← 7 componentes de estructura
└── shared/       ← 5 componentes de estado compartido
```

---

# UI Components

---

## 01. Button

**Propósito:** Acción principal del usuario. El componente más reutilizado del sistema.

### Variantes

| Variante | Uso |
|---|---|
| `primary` | Acción principal por pantalla. Máximo 1 visible por sección. |
| `secondary` | Acción secundaria o alternativa. |
| `ghost` | Acciones terciarias, en toolbars o junto a tablas. |
| `danger` | Acciones destructivas: eliminar, cancelar proceso. |
| `outline` | Acción neutral con contorno visible. |
| `link` | Apariencia de enlace inline. |

### Tamaños

| Tamaño | Alto | Fuente | Uso |
|---|---|---|---|
| `xs` | 24px | 10px | Acciones en filas de tabla |
| `sm` | 30px | 12px | Toolbars secundarios |
| `md` | 36px | 13px | Estándar de interfaz |
| `lg` | 44px | 14px | CTAs principales |

### Estados

`default` · `hover` · `active` · `focus` · `disabled` · `loading`

### Anatomía

```
[ icono-izq? ] [ label ] [ icono-der? ]
```

- Puede tener icono izquierdo, derecho o ninguno.
- En estado `loading` el label se reemplaza por un spinner inline.
- En estado `disabled` opacidad `--opacity-disabled` y `pointer-events: none`.

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | `primary \| secondary \| ghost \| danger \| outline \| link` |
| `size` | string union | `xs \| sm \| md \| lg` |
| `leftIcon` | ReactNode | Icono antes del label |
| `rightIcon` | ReactNode | Icono después del label |
| `isLoading` | boolean | Muestra spinner, deshabilita clics |
| `isDisabled` | boolean | Deshabilita visualmente e interactivamente |
| `fullWidth` | boolean | Ocupa 100% del contenedor |

### Anti-patrones

- No usar `primary` más de una vez por sección visible.
- No ocultar botones destructivos; usar `danger` claramente.
- No usar buttons para navegación; usar Link o NavItem.

---

## 02. Badge

**Propósito:** Indicador de estado, conteo o categoría. Siempre informativo, nunca interactivo.

### Variantes

| Variante | Color | Uso |
|---|---|---|
| `success` | Verde | Estado positivo, completado |
| `warning` | Ámbar | Atención requerida |
| `danger` | Rojo | Error, crítico |
| `info` | Azul | Información neutral |
| `neutral` | Gris | Estado inactivo, pendiente |
| `navy` | Navy INLOP | Categoría corporativa |

### Tamaños

`xs` (8px font) · `sm` (10px font) · `md` (12px font — defecto)

### Estilos

`filled` (fondo sólido) · `soft` (fondo 15% opacidad) · `outline` (solo borde)

### Anatomía

```
[ dot? ] [ label ] [ count? ]
```

- Dot opcional a la izquierda (círculo de 6px del color correspondiente).
- Count opcional a la derecha (número entre paréntesis).

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | Estado semántico |
| `size` | string union | `xs \| sm \| md` |
| `style` | string union | `filled \| soft \| outline` |
| `dot` | boolean | Mostrar indicador de punto |

---

## 03. Card

**Propósito:** Contenedor visual para agrupar información relacionada. Unidad base de composición de layout.

### Variantes

| Variante | Uso |
|---|---|
| `default` | Panel general de contenido |
| `elevated` | Destacado, sombra nivel 2 |
| `flat` | Sin borde ni sombra; sobre fondos `--c0` |
| `interactive` | Con hover state; clickeable como unidad |

### Anatomía

```
┌─────────────────────────────────┐
│ CardHeader                      │
│   title · subtitle · actions    │
├─────────────────────────────────┤
│ CardBody                        │
│   contenido principal           │
├─────────────────────────────────┤
│ CardFooter (opcional)           │
│   acciones · metadata           │
└─────────────────────────────────┘
```

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | Estilo visual |
| `padding` | string union | `none \| sm \| md \| lg` |
| `isClickable` | boolean | Agrega cursor y hover state |
| `accentColor` | string | Borde izquierdo de color (3px) |

---

## 04. Table

**Propósito:** Presentar datos tabulares densos. Componente crítico del ERP — maneja grandes volúmenes de información.

### Sub-componentes

`Table` · `TableHeader` · `TableBody` · `TableRow` · `TableCell` · `TableFooter`

### Variantes

| Variante | Uso |
|---|---|
| `default` | Tabla estándar con bordes |
| `striped` | Filas alternas; mejor legibilidad en tablas largas |
| `compact` | Altura de fila reducida para alta densidad |
| `borderless` | Sin bordes visibles; sobre Cards |

### Características

| Feature | Descripción |
|---|---|
| Ordenamiento | Click en header ordena; indicador de dirección |
| Selección | Checkbox en primera columna; selección múltiple |
| Fixed header | El `<thead>` se queda fijo al hacer scroll vertical |
| Columna fija | Primera columna puede ser sticky horizontal |
| Empty state | Slot para componente `EmptyState` cuando no hay datos |
| Loading state | Skeleton rows mientras carga |
| Paginación | Footer con controles de página y tamaño |

### Props Clave de TableCell

| Prop | Tipo | Descripción |
|---|---|---|
| `align` | string union | `left \| center \| right` |
| `fontFamily` | string union | `mono \| sans` (datos vs labels) |
| `sortable` | boolean | Solo en `<th>` |
| `sticky` | boolean | Columna fija izquierda |

### Anti-patrones

- No anidar tablas.
- No mostrar más de 10 columnas sin toggle de columnas.
- No implementar lógica de fetch dentro del componente tabla.

---

## 05. Modal

**Propósito:** Diálogo bloqueante para acciones que requieren confirmación o entrada de datos.

### Tamaños

| Tamaño | Ancho | Uso |
|---|---|---|
| `sm` | 400px | Confirmaciones, alertas |
| `md` | 560px | Formularios simples |
| `lg` | 720px | Formularios complejos, previews |
| `xl` | 960px | Vistas de detalle |
| `full` | 100vw - 48px | Editores, tablas expandidas |

### Anatomía

```
┌────────────────────────────┐
│ ModalHeader                │
│   title · [×]              │
├────────────────────────────┤
│ ModalBody                  │
│   (scroll interno si >60vh)│
├────────────────────────────┤
│ ModalFooter                │
│   [Cancel] [Confirm]       │
└────────────────────────────┘
  Backdrop: --opacity-overlay
```

### Comportamiento

- Backdrop clickeable cierra el modal (configurable con `closeOnBackdrop`).
- `Escape` siempre cierra.
- Focus trap dentro del modal mientras está abierto.
- Scroll del body bloqueado mientras el modal está activo.
- Animación: slide up + fade in (`--duration-moderate`).

### Z-index: `9000`

---

## 06. Alert

**Propósito:** Comunicar información contextual inline. No bloqueante. No requiere acción del usuario.

### Variantes

`info` · `success` · `warning` · `danger`

### Estilos

`inline` (dentro del layout) · `toast` (flotante, ver componente Toast)

### Anatomía

```
[ icono ] [ título · descripción ] [ acción? ] [ ×? ]
```

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | Tipo semántico |
| `title` | string | Título del mensaje |
| `description` | string | Detalle adicional |
| `isCloseable` | boolean | Mostrar botón × |
| `action` | object | `{ label, onClick }` link de acción |

---

## 07. KpiCard

**Propósito:** Mostrar un indicador de rendimiento clave con contexto. Componente central de los dashboards INLOP.

### Anatomía

```
┌──────────────────────────────────┐
│ [icono]  Label / Título          │
│                                  │
│   ████ Valor principal           │ ← Anton, 36-48px
│                                  │
│   ↑ +12.4%  vs. período anterior │ ← Tendencia
│                                  │
│   Subtexto / Contexto            │
└──────────────────────────────────┘
```

### Variantes de Tendencia

| Dirección | Visual | Semántica configurable |
|---|---|---|
| `up` | Flecha ↑ verde | Positivo (configurable: podría ser negativo) |
| `down` | Flecha ↓ roja | Negativo (configurable) |
| `neutral` | Línea — gris | Sin cambio |

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `label` | string | Nombre del KPI |
| `value` | string \| number | Valor principal |
| `unit` | string | Sufijo (%, USD, uds) |
| `trend` | object | `{ direction, value, label }` |
| `icon` | ReactNode | Icono identificador |
| `accentColor` | string | Color del borde izquierdo |
| `isPositiveUp` | boolean | Define si ↑ es positivo o negativo |
| `isAnimated` | boolean | Animación count-up al montar |

### Anti-patrones

- No mostrar más de 6 KpiCards por fila visible sin scroll.
- No incluir gráficas dentro de KpiCard — usar ChartCard.

---

## 08. ChartCard

**Propósito:** Contenedor para gráficas Chart.js con header, controles y estados de carga.

### Anatomía

```
┌──────────────────────────────────┐
│ Título                  [ctrl×]  │
│ Subtítulo / período              │
├──────────────────────────────────┤
│                                  │
│   [Chart.js canvas]              │
│                                  │
└──────────────────────────────────┘
```

### Tipos de Gráfica Soportados

`line` · `bar` · `doughnut` · `radar` · `mixed (line+bar)`

### Estados

`loading` (skeleton) · `empty` (EmptyState) · `error` (ErrorState) · `data`

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `title` | string | Título de la gráfica |
| `subtitle` | string | Período o descripción |
| `chartType` | string union | Tipo Chart.js |
| `data` | ChartData | Dataset Chart.js |
| `options` | ChartOptions | Opciones Chart.js |
| `isLoading` | boolean | Mostrar skeleton |
| `controls` | ReactNode | Filtros, toggles en header |

### Nota de implementación

ChartCard **solo gestiona el contenedor**. La configuración de data/options se define en el feature que usa el componente. Los temas (colores de Chart.js) se aplican via un hook `useChartTheme` que provee paletas adaptadas al tema activo.

---

## 09. Tabs

**Propósito:** Navegación por secciones dentro de un mismo contexto visual. Sin cambio de URL (URL tabs se manejan con navegación de router).

### Variantes

| Variante | Uso |
|---|---|
| `underline` | Estándar, sobre fondos de card |
| `pills` | Sub-navegación en panels |
| `segmented` | Máximo 3-4 opciones, toggle tipo radio |

### Anatomía

```
[ Tab 1 ] [ Tab 2* ] [ Tab 3 ]    ← TabList
─────────────────────────────     ← Indicador activo
  Contenido del tab activo        ← TabPanel
```

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `defaultTab` | string | Tab activo inicial |
| `onChange` | function | Callback al cambiar tab |
| `variant` | string union | Estilo visual |
| `tabs` | TabItem[] | Array de `{ id, label, badge?, icon? }` |

---

## 10. Dropdown

**Propósito:** Menú contextual de opciones. Puede ser de selección o de acciones.

### Variantes

`action-menu` (lista de acciones) · `select-menu` (selección de valor)

### Anatomía

```
[ Trigger Button ▾ ]
  ┌─────────────────┐
  │ Opción 1        │
  │ Opción 2        │
  │ ─────────────── │
  │ Opción peligro  │
  └─────────────────┘
```

### Comportamiento

- Se abre hacia abajo por defecto; detecta espacio y se invierte si es necesario.
- Click fuera cierra. `Escape` cierra.
- Keyboard navigation: `Arrow Up/Down`, `Enter` para seleccionar.
- Z-index: `1000`

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `trigger` | ReactNode | Elemento que activa el dropdown |
| `items` | DropdownItem[] | `{ label, icon?, onClick, isDanger?, isDivider? }` |
| `placement` | string union | `bottom-start \| bottom-end \| top-start` |

---

## 11. Input

**Propósito:** Campo de texto. Componente base para formularios y búsquedas.

### Variantes

`default` · `filled` · `flushed` (solo borde inferior)

### Estados

`default` · `focus` · `disabled` · `error` · `success` · `readonly`

### Anatomía

```
[ Label ]                          ← opcional
[ adorno-izq? ][ input ][ adorno-der? ]
[ helper text / error message ]    ← opcional
```

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `label` | string | Label visible |
| `placeholder` | string | Placeholder |
| `errorMessage` | string | Mensaje de error (activa estado error) |
| `helperText` | string | Texto de ayuda |
| `leftAdornment` | ReactNode | Icono/texto a la izquierda |
| `rightAdornment` | ReactNode | Icono/texto a la derecha |
| `isDisabled` | boolean | Estado deshabilitado |
| `isReadOnly` | boolean | Solo lectura |

---

## 12. Select

**Propósito:** Selector de valor de una lista de opciones. ERP usa frecuentemente para filtros.

### Variantes

`single` · `multi` (con chips) · `searchable` (con búsqueda interna)

### Anatomía

```
[ Label ]
[ valor seleccionado · chip×  ▾ ]
[ helper / error ]
```

### Comportamiento Multi-Select

- Opciones seleccionadas aparecen como chips removibles dentro del campo.
- Máximo visible de chips antes de colapsar: configurable (`maxVisible`).
- Conteo de extras: `+N más` cuando colapsa.

---

## 13. Search

**Propósito:** Búsqueda global o contextual. Variante especializada de Input con comportamiento propio.

### Variantes

`inline` (dentro de una sección) · `global` (en Topbar, expandible)

### Comportamiento

- Debounce configurable (default 300ms).
- Icono de lupa a la izquierda.
- Botón × para limpiar cuando hay texto.
- En variante `global`: se expande al hacer focus; colapsa con Escape.
- Resultados en dropdown posicionado bajo el campo.

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `onSearch` | function | Callback con valor (debounced) |
| `debounceMs` | number | Delay en ms (default 300) |
| `variant` | string union | `inline \| global` |
| `placeholder` | string | Texto guía |

---

## 14. DatePicker

**Propósito:** Selección de fechas y rangos. Crítico para filtros de períodos en reportes.

### Modos

`single` · `range` · `month` · `year`

### Presets de Rango

El modo `range` incluye presets rápidos configurables:
- Hoy, Esta semana, Este mes, Trimestre actual, Año actual
- Últimos 7/30/90 días
- Personalizado

### Comportamiento

- Abre un popover con el calendario posicionado con Floating UI.
- Formato de visualización configurable (default: `dd/MM/yyyy`).
- Locale configurable (default: `es-CO`).
- Validación de rango mínimo/máximo.

---

## 15. Toast

**Propósito:** Notificación no bloqueante. Confirma acciones o informa de eventos del sistema.

### Variantes

`success` · `error` · `warning` · `info`

### Posición

Default: `bottom-right`. Configurable por instancia.

### Comportamiento

- Auto-dismiss configurable (default: 4000ms).
- Hover pausa el countdown.
- Máximo 5 toasts simultáneos; los más viejos se desplazan.
- Acción inline opcional (`{ label, onClick }`).
- Z-index: `9999`

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | Tipo semántico |
| `title` | string | Mensaje principal |
| `description` | string | Detalle adicional |
| `duration` | number | Auto-dismiss en ms (0 = persistente) |
| `action` | object | `{ label, onClick }` |

---

## 16. Loader

**Propósito:** Indicar estado de carga. Múltiples formas según contexto.

### Variantes

| Variante | Uso |
|---|---|
| `spinner` | Carga inline, botones, íconos |
| `skeleton` | Placeholder de contenido (texto, cards, rows) |
| `progress-bar` | Carga de archivo, proceso largo |
| `overlay` | Bloquea sección mientras carga |
| `page` | Pantalla completa en navegación |

### Skeleton Sub-componentes

`SkeletonText` · `SkeletonCard` · `SkeletonRow` · `SkeletonKpi`

---

# Layout Components

> Ver `LAYOUT_SYSTEM.md` para especificación completa de estructura, Z-index y comportamiento responsive.

---

## 17. Sidebar

**Propósito:** Navegación principal del ERP. Siempre oscuro (tema invariante).

**Docs:** Ver `LAYOUT_SYSTEM.md § Sidebar`

---

## 18. Topbar

**Propósito:** Barra superior con contexto de página, búsqueda global y acciones de usuario.

**Docs:** Ver `LAYOUT_SYSTEM.md § Topbar`

---

## 19. PageContainer

**Propósito:** Wrapper de página que aplica max-width, padding y scroll behavior.

**Docs:** Ver `LAYOUT_SYSTEM.md § PageContainer`

---

## 20. SectionContainer

**Propósito:** Wrapper de sección dentro de página. Agrupa título de sección y su contenido.

**Docs:** Ver `LAYOUT_SYSTEM.md § SectionContainer`

---

# Shared Components

---

## 21. EmptyState

**Propósito:** Comunicar que un contenedor no tiene datos. Reemplaza tablas o listas vacías.

### Anatomía

```
        [ ilustración / icono ]
           Título principal
         Descripción de por qué
        [ Acción principal? ]
```

### Variantes

`no-data` · `no-results` (búsqueda sin resultados) · `no-permission` · `first-time` (onboarding)

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `variant` | string union | Contexto semántico |
| `title` | string | Mensaje principal |
| `description` | string | Detalle o instrucción |
| `action` | object | `{ label, onClick }` CTA |
| `icon` | ReactNode | Icono personalizado |

---

## 22. ErrorState

**Propósito:** Comunicar un error en la carga de datos, con opción de reintentar.

### Anatomía

```
        [ icono de error ]
           Error al cargar
         Mensaje técnico (opcional, colapsable)
        [ Reintentar ]
```

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `title` | string | Mensaje de error |
| `description` | string | Detalle técnico |
| `onRetry` | function | Callback del botón reintentar |
| `showDetails` | boolean | Mostrar mensaje técnico |

---

## 23. LoadingState

**Propósito:** Estado de carga estándar para secciones que están esperando datos.

### Variantes

`spinner` (carga rápida < 1s) · `skeleton` (carga lenta > 1s, placeholder de contenido)

### Regla de uso

- < 300ms: no mostrar indicador (evita flash).
- 300ms–1s: spinner centrado.
- > 1s: skeleton de la forma esperada del contenido.

---

## 24. StatusBadge

**Propósito:** Badge especializado con semántica de estado de proceso del negocio. Extiende Badge con lógica de mapeo de estados.

### Diferencia con Badge

`Badge` es genérico. `StatusBadge` mapea estados de dominio (`PENDIENTE`, `EN_PROCESO`, `COMPLETADO`, `CRITICO`) a variantes visuales automáticamente.

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `status` | string | Estado de dominio (string arbitrario) |
| `statusMap` | object | Mapeo `{ [status]: BadgeVariant }` |
| `label` | string | Override del texto mostrado |

---

## 25. ProgressBar

**Propósito:** Indicar progreso de un proceso o completitud de una métrica.

### Variantes

`linear` (barra horizontal) · `radial` (arco circular) · `stepped` (pasos discretos)

### Semántica de Color Automática

| Rango de valor | Color |
|---|---|
| 0–40% | Rojo (`--color-danger`) |
| 41–70% | Ámbar (`--color-warning`) |
| 71–100% | Verde (`--color-success`) |

Configurable con prop `colorMode: 'semantic' | 'fixed'`.

### Props Clave

| Prop | Tipo | Descripción |
|---|---|---|
| `value` | number | Valor actual (0–100 o 0–max) |
| `max` | number | Valor máximo (default: 100) |
| `variant` | string union | `linear \| radial \| stepped` |
| `colorMode` | string union | `semantic \| fixed` |
| `color` | string | Color fijo (solo si `colorMode: fixed`) |
| `showLabel` | boolean | Mostrar porcentaje dentro o junto a la barra |
| `isAnimated` | boolean | Animación de llenado al montar |

---

## Resumen del Inventario

| # | Componente | Categoría | Prioridad FASE 1 |
|---|---|---|---|
| 01 | Button | UI | Alta |
| 02 | Badge | UI | Alta |
| 03 | Card | UI | Alta |
| 04 | Table | UI | Alta |
| 05 | Modal | UI | Alta |
| 06 | Alert | UI | Media |
| 07 | KpiCard | UI | Alta |
| 08 | ChartCard | UI | Alta |
| 09 | Tabs | UI | Alta |
| 10 | Dropdown | UI | Media |
| 11 | Input | UI | Alta |
| 12 | Select | UI | Alta |
| 13 | Search | UI | Media |
| 14 | DatePicker | UI | Alta |
| 15 | Toast | UI | Media |
| 16 | Loader | UI | Alta |
| 17 | Sidebar | Layout | Alta |
| 18 | Topbar | Layout | Alta |
| 19 | PageContainer | Layout | Alta |
| 20 | SectionContainer | Layout | Media |
| 21 | EmptyState | Shared | Media |
| 22 | ErrorState | Shared | Media |
| 23 | LoadingState | Shared | Alta |
| 24 | StatusBadge | Shared | Media |
| 25 | ProgressBar | Shared | Media |
