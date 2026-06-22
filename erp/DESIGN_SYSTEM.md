# INLOP ERP — Design System

> **FASE 1 — Core UI System**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Filosofía

El Design System del ERP INLOP se rige por tres valores fundacionales:

| Valor | Descripción |
|---|---|
| **Claridad operativa** | La información crítica debe ser visible de inmediato, sin fricción cognitiva. Densidad sin ruido. |
| **Densidad informativa** | Paneles con múltiples KPIs, tablas densas y gráficas en simultáneo. El espacio se optimiza, no se malgasta. |
| **Identidad corporativa** | Paleta navy/rojo INLOP, tipografías institucionales y componentes que reflejan el ADN de la empresa. |

---

## 2. Jerarquía de Tokens

Se utiliza un sistema de tres niveles para garantizar coherencia y mantenibilidad:

```
Nivel 1 — Primitivos
  Valores brutos: colores hex, tamaños px, fuentes
  Ejemplo: --primitive-blue-500: #3b82f6

Nivel 2 — Semánticos
  Asignación de significado: qué hace cada valor
  Ejemplo: --color-surface-card: var(--primitive-slate-800)

Nivel 3 — Componente
  Tokens específicos de un componente
  Ejemplo: --button-primary-bg: var(--color-brand-primary)
```

Los tokens semánticos son los únicos que los componentes deben consumir directamente. Nunca consumir primitivos desde componentes.

---

## 3. Sistema de Color

### 3.1 Tema Oscuro — Superficies

| Token | Valor | Uso |
|---|---|---|
| `--c0` | `#0a0e17` | Base / fondo de página |
| `--c1` | `#0e1420` | Header, Sidebar, topbar |
| `--c2` | `#131b2a` | Cards, panels, modales |
| `--c3` | `#1a2436` | Table headers, secciones elevadas |
| `--c4` | `#212e42` | Hover states, filas seleccionadas |

### 3.2 Tema Claro — Superficies

| Token | Valor | Uso |
|---|---|---|
| `--c0` | `#F5F7FA` | Base / fondo de página |
| `--c1` | `#FFFFFF` | Header, Sidebar, topbar |
| `--c3` | `#F9FAFC` | Table headers, secciones elevadas |
| `--c4` | `#EEF2F8` | Hover states, filas seleccionadas |

### 3.3 Sidebar — Tokens Invariantes (siempre oscuro)

| Token | Valor | Uso |
|---|---|---|
| `--sb-bg` | `#0A1735` | Fondo del sidebar |
| `--sb-bg2` | `#0F1F45` | Hover / ítem activo sidebar |
| `--sb-width-expanded` | `230px` | Ancho expandido |
| `--sb-width-collapsed` | `60px` | Ancho colapsado |
| `--sb-text` | `#8FA0BC` | Texto de navegación |
| `--sb-text-active` | `#FFFFFF` | Texto ítem activo |
| `--sb-accent` | `#1A56DB` | Indicador de selección |

### 3.4 Marca INLOP

| Token | Valor | Uso |
|---|---|---|
| `--brand-navy` | `#012A6B` | Color corporativo principal |
| `--brand-red-dark` | `#C00613` | Rojo tema oscuro |
| `--brand-red-light` | `#E10613` | Rojo tema claro |

### 3.5 Estados Semánticos

| Estado | Tema oscuro | Tema claro | Uso |
|---|---|---|---|
| **Éxito / Positivo** | `#00d97e` | `#00875F` | KPIs positivos, badges success |
| **Advertencia** | `#f59e0b` | `#D97706` | Alertas, indicadores de riesgo |
| **Peligro / Error** | `#ef4444` | `#DC2626` | Errores, críticos, alertas rojas |
| **Información / Acción** | `#3b82f6` | `#0284C7` | Acciones primarias, info badges |
| **Neutro** | `#6b7280` | `#6B7280` | Texto secundario, bordes |

### 3.6 Texto

| Token | Tema oscuro | Tema claro | Uso |
|---|---|---|---|
| `--text-primary` | `#E8EDF5` | `#111827` | Títulos, datos principales |
| `--text-secondary` | `#8FA0BC` | `#4B5563` | Labels, descripciones |
| `--text-muted` | `#4A5568` | `#9CA3AF` | Placeholders, metadatos |
| `--text-inverse` | `#111827` | `#E8EDF5` | Texto sobre fondos invertidos |

### 3.7 Bordes

| Token | Tema oscuro | Tema claro |
|---|---|---|
| `--border-default` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |
| `--border-strong` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.15)` |
| `--border-focus` | `#3b82f6` | `#0284C7` |

---

## 4. Tipografía

### 4.1 Familias Tipográficas

| Familia | Peso(s) | Rol | Uso principal |
|---|---|---|---|
| **Anton** | 400 | Display / Impacto | Títulos de módulo, KPI valores grandes, hero numbers |
| **Barlow Condensed** | 500, 700 | Labels / Navegación | Etiquetas de tabla, nav items, botones, badges |
| **DM Sans** | 400, 500, 600 | Body / UI | Texto general, descripciones, párrafos |
| **JetBrains Mono** | 400, 500 | Datos tabulares | Números en tablas, porcentajes, valores numéricos |

### 4.2 Escala Tipográfica

| Token | Tamaño | Familia | Uso |
|---|---|---|---|
| `--text-xs` | `8px` | Barlow Condensed | Micro-labels, indicadores |
| `--text-sm` | `10px` | Barlow Condensed | Labels secundarios, badges |
| `--text-base` | `12px` | DM Sans | Texto base, cuerpo |
| `--text-md` | `13px` | DM Sans | UI texto, descripciones |
| `--text-lg` | `14px` | DM Sans | Títulos de sección pequeños |
| `--text-xl` | `16px` | DM Sans | Títulos de card |
| `--text-2xl` | `18px` | Barlow Condensed | Headers de módulo |
| `--text-3xl` | `22px` | Anton | Sub-títulos destacados |
| `--text-4xl` | `28px` | Anton | KPI valores medianos |
| `--text-5xl` | `36px` | Anton | KPI valores grandes |
| `--text-display` | `48px` | Anton | Valores hero |
| `--text-hero` | `58px` | Anton | Valores máximo impacto |

### 4.3 Altura de Línea

| Token | Valor | Uso |
|---|---|---|
| `--leading-tight` | `1.1` | Títulos display, Anton |
| `--leading-snug` | `1.25` | Headers de sección |
| `--leading-normal` | `1.5` | Cuerpo de texto |
| `--leading-relaxed` | `1.75` | Descripciones largas |

### 4.4 Espaciado entre Letras

| Token | Valor | Uso |
|---|---|---|
| `--tracking-tight` | `-0.02em` | Anton display |
| `--tracking-normal` | `0` | DM Sans body |
| `--tracking-wide` | `0.05em` | Barlow labels |
| `--tracking-wider` | `0.08em` | Barlow uppercase |

---

## 5. Espaciado

Base: **4px**. Todos los tokens son múltiplos de 4px.

| Token | Valor | Uso típico |
|---|---|---|
| `--space-0` | `0px` | Reset |
| `--space-1` | `4px` | Micro gaps, icon padding |
| `--space-2` | `8px` | Padding interno de badges, chips |
| `--space-3` | `12px` | Padding de botones (vertical) |
| `--space-4` | `16px` | Padding de cards |
| `--space-5` | `20px` | Gaps entre secciones internas |
| `--space-6` | `24px` | Padding de panels |
| `--space-7` | `28px` | Separación entre cards |
| `--space-8` | `32px` | Padding de secciones |
| `--space-10` | `40px` | Separaciones mayores |
| `--space-12` | `48px` | Padding de página |

### 5.1 Insets de Componentes

| Componente | Padding |
|---|---|
| Button small | `6px 12px` |
| Button medium | `8px 16px` |
| Button large | `10px 20px` |
| Card | `16px 20px` |
| KPI Card | `20px 24px` |
| Table cell | `8px 12px` |
| Input / Select | `8px 12px` |
| Modal header | `20px 24px` |
| Modal body | `24px` |
| Sidebar item | `10px 16px` |

---

## 6. Elevaciones

| Nivel | Token | Sombra | Uso |
|---|---|---|---|
| 0 — Flat | `--shadow-none` | `none` | Elementos en superficie base |
| 1 — Raised | `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Cards, panels, tablas |
| 2 — Floating | `--shadow-md` | `0 4px 16px -2px rgba(0,0,0,0.45)` | Dropdowns, tooltips |
| 3 — Modal | `--shadow-lg` | `0 12px 40px -8px rgba(0,0,0,0.6)` | Modales, sidesheets |

En tema claro, las sombras usan opacidades reducidas (~50%) ya que el contraste base es menor.

---

## 7. Bordes

### 7.1 Radio

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | `2px` | Badges pequeños, chips |
| `--radius-sm` | `4px` | Botones, inputs |
| `--radius-md` | `6px` | Cards, panels |
| `--radius-lg` | `8px` | Modales, drawers |
| `--radius-xl` | `12px` | Containers destacados |
| `--radius-full` | `100px` | Pills, avatares |

### 7.2 Grosor

| Token | Valor | Uso |
|---|---|---|
| `--border-hairline` | `0.5px` | Divisores sutiles en tablas |
| `--border-default` | `1px` | Bordes estándar de componentes |
| `--border-accent` | `3px` | Indicadores activos, borde izquierdo sidebar |

---

## 8. Motion

### 8.1 Duraciones

| Token | Valor | Uso |
|---|---|---|
| `--duration-instant` | `100ms` | Hover states, foco |
| `--duration-fast` | `150ms` | Transiciones de color |
| `--duration-normal` | `200ms` | Apertura de dropdowns, tooltips |
| `--duration-moderate` | `300ms` | Modales, drawers, slides |
| `--duration-slow` | `500ms` | Animaciones de entrada de página |
| `--duration-xslow` | `2000ms` | Contadores, progress bars animadas |

### 8.2 Easing

| Token | Curva | Uso |
|---|---|---|
| `--ease-standard` | `cubic-bezier(.4, 0, .2, 1)` | Transiciones generales |
| `--ease-decelerate` | `cubic-bezier(0, 0, .2, 1)` | Elementos que entran |
| `--ease-accelerate` | `cubic-bezier(.4, 0, 1, 1)` | Elementos que salen |
| `--ease-spring` | `cubic-bezier(.34, 1.56, .64, 1)` | Feedback de acción |

### 8.3 Patrones de Animación

| Patrón | Descripción | Uso |
|---|---|---|
| **Fade in** | `opacity 0→1`, `--duration-fast` | Toast, tooltips |
| **Slide up** | `translateY(8px)→0` + fade | Modales, panels |
| **Slide in left** | `translateX(-100%)→0` | Sidebar drawer |
| **Scale in** | `scale(0.95)→1` + fade | Dropdowns |
| **Count up** | Número animado con `requestAnimationFrame` | KPI valores |
| **Shimmer** | Gradient scan horizontal | Skeleton loaders |

---

## 9. Opacidad

| Token | Valor | Uso |
|---|---|---|
| `--opacity-disabled` | `0.4` | Componentes deshabilitados |
| `--opacity-muted` | `0.6` | Texto secundario sobre fondos |
| `--opacity-overlay` | `0.7` | Backdrop de modales |
| `--opacity-ghost` | `0.08` | Fondos hover ghost buttons |

---

## 10. Sistema Responsive

### 10.1 Breakpoints

| Token | Valor | Contexto |
|---|---|---|
| `--bp-xs` | `480px` | Móvil pequeño |
| `--bp-sm` | `768px` | Tablet / móvil grande |
| `--bp-md` | `1024px` | Laptop |
| `--bp-lg` | `1280px` | Desktop estándar |
| `--bp-xl` | `1600px` | Desktop wide / ultrawide |

### 10.2 Comportamiento del Grid por Breakpoint

| Breakpoint | Columnas | Gutter | Sidebar |
|---|---|---|---|
| < 768px | 1 | 12px | Oculto (drawer) |
| 768–1023px | 2 | 16px | Colapsado (60px) |
| 1024–1279px | 3 | 20px | Colapsado (60px) |
| 1280–1599px | 4 | 24px | Expandido (230px) |
| ≥ 1600px | 4–6 | 28px | Expandido (230px) |

### 10.3 Unidades

- Usar `rem` para tipografía (accesibilidad)
- Usar `px` para bordes y sombras (precisión)
- Usar `%` o `fr` para layouts flexibles
- Evitar `vh` para alturas de contenido (problema mobile browsers)
- Usar `dvh` solo cuando sea necesario

---

## 11. Convenciones de Nomenclatura

### CSS Custom Properties

```
--{categoría}-{modificador}-{estado}

Ejemplos:
  --color-surface-card
  --color-text-primary
  --color-brand-primary
  --shadow-md
  --radius-lg
  --space-4
  --text-xl
```

### Clases Tailwind / BEM

```
Componente base:    .btn
Variante:           .btn--primary  /  .btn--ghost
Tamaño:             .btn--sm  /  .btn--lg
Estado:             .is-active  /  .is-disabled  /  .is-loading
Módulo:             .kpi-card  /  .chart-card
```

### Componentes React

```
Nombre:             PascalCase         → Button, KpiCard, ChartCard
Props variante:     string literal     → variant="primary" | "ghost"
Props estado:       boolean            → isLoading, isDisabled
Props tamaño:       string literal     → size="sm" | "md" | "lg"
Callbacks:          on + verbo         → onClick, onClose, onChange
```

### Archivos

```
Componentes React:  PascalCase.tsx     → Button.tsx, KpiCard.tsx
Hooks:              camelCase.ts       → useTheme.ts, useModal.ts
Utilidades:         camelCase.ts       → formatNumber.ts
Estilos:            kebab-case.css     → design-tokens.css
Constantes:         UPPER_SNAKE.ts     → BREAKPOINTS.ts
```
