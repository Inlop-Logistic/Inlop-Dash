# INLOP ERP — Themes

> **FASE 1 — Core UI System**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Estrategia de Temas

El ERP INLOP soporta **dos temas completos** más una zona invariante:

| Tema | ID | Descripción |
|---|---|---|
| **Dark** | `dark` | Oscuro original. Superficies azul-slate profundas. Predeterminado. |
| **Light v4** | `light` | Claro institucional. Blanco/gris muy claro. Para contextos diurnos o impresión. |
| **Sidebar** | invariante | Siempre oscuro independientemente del tema activo. |

### Mecanismo de Switching

- El tema activo se almacena en `localStorage` con clave `inlop-theme`.
- Al cambiar de tema, se aplica la clase `data-theme="dark"` o `data-theme="light"` al elemento `<html>`.
- Todos los tokens CSS están definidos bajo estos selectores.
- No hay flash de tema incorrecto (FOUC) porque el tema se lee y aplica antes del primer render, en un script inline en `<head>`.
- La transición entre temas usa `transition: background-color, color, border-color` con `--duration-moderate`.

---

## 2. Tema Oscuro — Tabla Completa de Tokens

### Superficies

| Token | Valor | Uso |
|---|---|---|
| `--c0` | `#0a0e17` | Fondo base de página |
| `--c1` | `#0e1420` | Header, Topbar, Sidebar |
| `--c2` | `#131b2a` | Cards, modales, panels |
| `--c3` | `#1a2436` | Table headers, secciones elevadas |
| `--c4` | `#212e42` | Hover states, filas seleccionadas |
| `--c5` | `#2a3a54` | Bordes visibles, separadores |

### Texto

| Token | Valor | Uso |
|---|---|---|
| `--text-primary` | `#E8EDF5` | Texto principal |
| `--text-secondary` | `#8FA0BC` | Labels, subtítulos |
| `--text-muted` | `#4A5568` | Placeholders, metadatos |
| `--text-inverse` | `#111827` | Texto sobre fondos claros |

### Bordes

| Token | Valor |
|---|---|
| `--border-default` | `rgba(255,255,255,0.06)` |
| `--border-strong` | `rgba(255,255,255,0.12)` |
| `--border-focus` | `#3b82f6` |

### Estados Semánticos

| Token | Valor | Uso |
|---|---|---|
| `--color-success` | `#00d97e` | Positivo |
| `--color-success-bg` | `rgba(0,217,126,0.12)` | Fondo success soft |
| `--color-warning` | `#f59e0b` | Advertencia |
| `--color-warning-bg` | `rgba(245,158,11,0.12)` | Fondo warning soft |
| `--color-danger` | `#ef4444` | Error / Crítico |
| `--color-danger-bg` | `rgba(239,68,68,0.12)` | Fondo danger soft |
| `--color-info` | `#3b82f6` | Información |
| `--color-info-bg` | `rgba(59,130,246,0.12)` | Fondo info soft |

### Marca

| Token | Valor |
|---|---|
| `--brand-navy` | `#012A6B` |
| `--brand-red` | `#C00613` |
| `--brand-primary` | `#1A56DB` |

### Sombras

| Token | Valor |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 4px 16px -2px rgba(0,0,0,0.45)` |
| `--shadow-lg` | `0 12px 40px -8px rgba(0,0,0,0.6)` |

---

## 3. Tema Claro — Tabla Completa de Tokens

### Superficies

| Token | Valor | Uso |
|---|---|---|
| `--c0` | `#F5F7FA` | Fondo base de página |
| `--c1` | `#FFFFFF` | Header, Topbar (cards base) |
| `--c2` | `#FFFFFF` | Cards, modales, panels |
| `--c3` | `#F9FAFC` | Table headers, secciones |
| `--c4` | `#EEF2F8` | Hover states, filas seleccionadas |
| `--c5` | `#E2E8F0` | Bordes visibles, separadores |

### Texto

| Token | Valor | Uso |
|---|---|---|
| `--text-primary` | `#111827` | Texto principal |
| `--text-secondary` | `#4B5563` | Labels, subtítulos |
| `--text-muted` | `#9CA3AF` | Placeholders, metadatos |
| `--text-inverse` | `#E8EDF5` | Texto sobre fondos oscuros |

### Bordes

| Token | Valor |
|---|---|
| `--border-default` | `rgba(0,0,0,0.08)` |
| `--border-strong` | `rgba(0,0,0,0.15)` |
| `--border-focus` | `#0284C7` |

### Estados Semánticos

| Token | Valor | Uso |
|---|---|---|
| `--color-success` | `#00875F` | Positivo |
| `--color-success-bg` | `rgba(0,135,95,0.1)` | Fondo success soft |
| `--color-warning` | `#D97706` | Advertencia |
| `--color-warning-bg` | `rgba(217,119,6,0.1)` | Fondo warning soft |
| `--color-danger` | `#DC2626` | Error / Crítico |
| `--color-danger-bg` | `rgba(220,38,38,0.1)` | Fondo danger soft |
| `--color-info` | `#0284C7` | Información |
| `--color-info-bg` | `rgba(2,132,199,0.1)` | Fondo info soft |

### Marca

| Token | Valor |
|---|---|
| `--brand-navy` | `#012A6B` |
| `--brand-red` | `#E10613` |
| `--brand-primary` | `#0EA5E9` |

### Sombras

| Token | Valor |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 4px 16px -2px rgba(0,0,0,0.12)` |
| `--shadow-lg` | `0 12px 40px -8px rgba(0,0,0,0.18)` |

---

## 4. Sidebar — Tokens Invariantes

El sidebar **NUNCA cambia con el tema**. Siempre usa su propia paleta oscura navy.

| Token | Valor | Uso |
|---|---|---|
| `--sb-bg` | `#0A1735` | Fondo del sidebar |
| `--sb-bg2` | `#0F1F45` | Hover, ítem activo |
| `--sb-bg3` | `#162552` | Fondo sub-menú |
| `--sb-text` | `#8FA0BC` | Texto de ítems |
| `--sb-text-active` | `#FFFFFF` | Texto ítem seleccionado |
| `--sb-text-hover` | `#C8D8F0` | Texto en hover |
| `--sb-accent` | `#1A56DB` | Indicador borde izquierdo activo |
| `--sb-icon` | `#6B84A8` | Color de iconos |
| `--sb-icon-active` | `#FFFFFF` | Icono activo |
| `--sb-divider` | `rgba(255,255,255,0.06)` | Separadores |
| `--sb-width-expanded` | `230px` | Ancho expandido |
| `--sb-width-collapsed` | `60px` | Ancho colapsado |

### Implementación del Invariante

El sidebar tiene su propio scope de tokens que no están bajo `[data-theme]`. Se definen directamente en `:root` o en el selector `.sidebar` y **no se sobreescriben** en ninguna de las dos variantes de tema.

---

## 5. Comparación de Temas — Side by Side

| Elemento UI | Tema Oscuro | Tema Claro |
|---|---|---|
| Fondo de página | `#0a0e17` (azul muy oscuro) | `#F5F7FA` (gris muy claro) |
| Card background | `#131b2a` (azul oscuro) | `#FFFFFF` (blanco) |
| Table header bg | `#1a2436` (azul medio-oscuro) | `#F9FAFC` (gris humo) |
| Hover row | `#212e42` (azul hover) | `#EEF2F8` (azul-gris claro) |
| Texto principal | `#E8EDF5` (gris muy claro) | `#111827` (casi negro) |
| Texto secundario | `#8FA0BC` (gris azulado) | `#4B5563` (gris medio) |
| Borde default | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |
| Success | `#00d97e` (verde brillante) | `#00875F` (verde oscuro) |
| Warning | `#f59e0b` (ámbar brillante) | `#D97706` (ámbar oscuro) |
| Danger | `#ef4444` (rojo brillante) | `#DC2626` (rojo oscuro) |
| Sombra card | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.12)` |
| Sidebar | Invariante navy | Invariante navy |

---

## 6. Adaptaciones por Componente

### KpiCard

| Propiedad | Tema Oscuro | Tema Claro |
|---|---|---|
| Fondo | `--c2` | `--c2 (blanco)` |
| Border | `--border-default` | `--border-default` |
| Valor (Anton) | `--text-primary` | `--text-primary` |
| Tendencia positiva | `--color-success` | `--color-success` |
| Tendencia negativa | `--color-danger` | `--color-danger` |

### Table

| Propiedad | Tema Oscuro | Tema Claro |
|---|---|---|
| Header bg | `--c3` | `--c3` |
| Row bg | `--c2` | `--c2` |
| Row hover | `--c4` | `--c4` |
| Borde separador | `--border-default` | `--border-default` |
| Texto celdas (mono) | `--text-primary` | `--text-primary` |

### Modal

| Propiedad | Tema Oscuro | Tema Claro |
|---|---|---|
| Backdrop | `rgba(0,0,0,0.7)` | `rgba(0,0,0,0.5)` |
| Modal bg | `--c2` | `--c1` |
| Header border | `--border-default` | `--border-default` |

### Input / Select

| Propiedad | Tema Oscuro | Tema Claro |
|---|---|---|
| Background | `--c3` | `--c3` |
| Border | `--border-strong` | `--border-default` |
| Border focus | `--border-focus` | `--border-focus` |
| Placeholder | `--text-muted` | `--text-muted` |

---

## 7. Adaptación de Charts al Tema

Chart.js no consume tokens CSS automáticamente. Los colores de charts se inyectan via JavaScript. El hook `useChartTheme` provee un objeto de configuración que adapta los colores al tema activo.

### Paleta de Charts — Tema Oscuro

| Slot | Color | Uso |
|---|---|---|
| Serie 1 | `#3b82f6` | Línea/barra principal |
| Serie 2 | `#00d97e` | Línea/barra secundaria |
| Serie 3 | `#f59e0b` | Terciaria |
| Serie 4 | `#a855f7` | Cuaternaria |
| Serie 5 | `#ef4444` | Quinta / alerta |
| Grilla | `rgba(255,255,255,0.06)` | Grid lines |
| Labels ejes | `#8FA0BC` | Tick labels |
| Tooltip bg | `#1a2436` | Fondo tooltip |
| Tooltip text | `#E8EDF5` | Texto tooltip |

### Paleta de Charts — Tema Claro

| Slot | Color | Uso |
|---|---|---|
| Serie 1 | `#0284C7` | Línea/barra principal |
| Serie 2 | `#00875F` | Línea/barra secundaria |
| Serie 3 | `#D97706` | Terciaria |
| Serie 4 | `#7C3AED` | Cuaternaria |
| Serie 5 | `#DC2626` | Quinta / alerta |
| Grilla | `rgba(0,0,0,0.06)` | Grid lines |
| Labels ejes | `#4B5563` | Tick labels |
| Tooltip bg | `#FFFFFF` | Fondo tooltip |
| Tooltip text | `#111827` | Texto tooltip |

---

## 8. Implementación del Theme Provider

### Flujo (sin código)

1. Script inline en `<head>` lee `localStorage['inlop-theme']` y aplica `data-theme` a `<html>` antes del render. Evita FOUC.
2. Un Context/Provider React expone `{ theme, setTheme, toggleTheme }`.
3. El hook `useTheme()` consume el Context para que los componentes accedan al tema activo.
4. Al cambiar tema, `setTheme` actualiza el Context, el atributo `data-theme` en `<html>` y `localStorage`.
5. El hook `useChartTheme()` observa el `theme` del Context y retorna la paleta de colores Chart.js correspondiente.

### Persistencia

| Mecanismo | Uso |
|---|---|
| `localStorage` | Preferencia del usuario entre sesiones |
| `data-theme` en `<html>` | Activar CSS token scope vía selector |
| Context React | Acceso reactivo al tema en componentes |

### Preferencia del Sistema

Si no hay preferencia guardada en `localStorage`, se usa `prefers-color-scheme` del navegador como fallback. Si tampoco hay preferencia de sistema, se usa `dark` como default.

---

## 9. Reglas de Uso de Tokens

1. **Nunca hardcodear** colores hex en componentes. Siempre usar tokens CSS.
2. **Nunca usar** tokens de superficie oscura (`#131b2a`) en componentes que deben adaptarse al tema claro.
3. **Los tokens semánticos** (`--color-success`, `--color-danger`, etc.) **son los únicos** que los componentes deben consumir para estados.
4. **El sidebar** es la única zona que usa su propio scope de tokens; todos los demás componentes consumen `--c0..c5` y tokens semánticos.
5. Si un componente necesita ser tema-invariante (siempre oscuro o siempre claro), usa tokens primitivos explícitos y documenta la excepción.
