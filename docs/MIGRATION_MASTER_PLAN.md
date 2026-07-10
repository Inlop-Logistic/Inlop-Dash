# Migration Master Plan — cPanel → ERP

## Fuente única de verdad para toda migración del sistema legacy hacia el ERP

**Versión:** 1.0 · **Fecha:** 2026-07-10 · **Estado:** Aprobado como estrategia — sin ejecución

> Este documento gobierna toda decisión de migración de un módulo legacy (hoy en
> cPanel) hacia el ERP (`erp/`, desplegado en Railway). Ninguna migración de un
> módulo se ejecuta sin corresponder a lo aquí definido. Si una instrucción
> puntual contradice este documento, se detiene el trabajo y se eleva la
> contradicción antes de continuar — mismo principio que `CLAUDE.md` en
> `appclienteinlop`.
>
> Basado íntegramente en evidencia recolectada en las auditorías de este
> proyecto: Sprint V1.0.1 (Repository Cleanup Audit) y Sprint V1.0.3 (Public
> Surface Certification). No se asume ni se inventa ningún módulo o
> dependencia no verificado en código.

---

## 1. Objetivo de la migración

Migrar **todos** los módulos de interfaz administrativa hoy alojados en
cPanel (`https://inloplogistica.com/app/...`) hacia el ERP
(`https://merry-charisma-production-b52e.up.railway.app`), **sin interrumpir
en ningún momento** la operación diaria actual sobre cPanel.

En paralelo, `Inlop-Dash` se reduce a su rol de **motor de negocio**: API
REST, integraciones (ControlT, Bancolombia), Push, jobs de sincronización y
servicios — dejando de ser, con el tiempo, un servidor de archivos estáticos
de interfaz. El Portal Cliente (`appclienteinlop`) no forma parte de esta
migración — es un producto independiente que ya consume la API de
`Inlop-Dash` directamente y no depende de ningún archivo legacy aquí
inventariado.

La migración es **module-by-module**, nunca un corte único ("big bang").
Ningún módulo legacy se retira hasta que se cumplan, uno por uno, los
requisitos de la Política de Retiro (§6).

---

## 2. Arquitectura actual

```
                    ┌─────────────────────────────────────────────┐
                    │         PRODUCCIÓN REAL DE HOY               │
                    │  cPanel — https://inloplogistica.com/app/    │
                    │                                               │
                    │  login.html · index.html (shell BI) ·        │
                    │  operaciones.html · otif.html ·               │
                    │  financiero.html · auth/callback.html ·      │
                    │  forgot/reset-password.html · js/*.js        │
                    └───────────────────┬───────────────────────────┘
                                        │  llamadas API + Supabase Auth
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │   Inlop-Dash (Railway) — API + integraciones  │
                    │   index.js: /servicios* /usuarios* /auth/*   │
                    │   /notificaciones /push/* /api/* (ControlT)  │
                    └──┬─────────────┬──────────────┬──────────────┘
                       │             │              │
                       ▼             ▼              ▼
                 ┌──────────┐  ┌──────────┐  ┌──────────────┐
                 │ Supabase │  │ ControlT │  │  Portal       │
                 │ (Auth,   │  │ (tracking│  │  Cliente      │
                 │ Realtime,│  │ externo) │  │ (appclienteinlop,│
                 │ Push)    │  │          │  │  repo separado)│
                 └──────────┘  └──────────┘  └──────────────┘

   ┌───────────────────────────────────────────────────────────────┐
   │  HALLAZGO DE AUDITORÍA (Sprint V1.0.3): el MISMO index.js de   │
   │  Inlop-Dash, vía `express.static(__dirname)`, expone HOY una  │
   │  COPIA incidental de casi todo el árbol de cPanel en Railway  │
   │  (TorreControl.html deliberadamente; index.html/login.html/   │
   │  operaciones.html/otif.html/financiero.html/auth/* de forma   │
   │  NO documentada como intencional). Ver §10, Riesgo "despliegues│
   │  simultáneos" — esta duplicación es un riesgo activo hoy,     │
   │  no solo un riesgo futuro de la migración.                    │
   └───────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │  ERP (Railway) — merry-charisma-production   │
                    │  Subproyecto `erp/` dentro de este repo.     │
                    │  2 de 12 módulos con implementación real:    │
                    │  `programacion`, `solicitudes`. El resto,    │
                    │  scaffold vacío (`.gitkeep`).                │
                    │  Consume la API de Inlop-Dash.                │
                    └─────────────────────────────────────────────┘
```

**Nota sobre `TorreControl.html`:** es el único módulo con evidencia de
servirse deliberadamente desde Railway (comentario explícito en
`index.js`: "Servir TorreControl.html directamente desde la raíz"), no solo
desde cPanel. Su plan de migración (§9, Fase 4) debe considerar ambos
orígenes.

---

## 3. Arquitectura objetivo

```
                    ┌─────────────────────────────────────────────┐
                    │  ERP (Railway) — única interfaz administrativa│
                    │  Todos los módulos legacy migrados y          │
                    │  certificados viven aquí.                     │
                    └───────────────────┬───────────────────────────┘
                                        │  API REST
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │  Inlop-Dash (Railway) — EXCLUSIVAMENTE:      │
                    │  API · Integraciones · Motor de negocio ·    │
                    │  ControlT · Push · Jobs · Bancolombia ·      │
                    │  Servicios. Sin archivos estáticos de UI.    │
                    └──┬─────────────┬──────────────┬──────────────┘
                       ▼             ▼              ▼
                 ┌──────────┐  ┌──────────┐  ┌──────────────┐
                 │ Supabase │  │ ControlT │  │  Portal       │
                 │          │  │          │  │  Cliente      │
                 └──────────┘  └──────────┘  └──────────────┘

                    ┌─────────────────────────────────────────────┐
                    │  cPanel — RETIRADO de producción              │
                    │  (o archivado como referencia histórica,      │
                    │  ver §8). Ningún tráfico real lo alcanza.     │
                    └─────────────────────────────────────────────┘
```

Diferencias clave respecto al estado actual: (1) `Inlop-Dash` deja de servir
cualquier archivo estático de interfaz — `express.static(__dirname)` se
retira o se acota a lo estrictamente necesario (ver hallazgo de Sprint
V1.0.3); (2) cPanel deja de recibir tráfico real; (3) el ERP es la única
puerta de entrada administrativa, con sus 12 módulos completamente
implementados (hoy: 2 de 12).

---

## 4. Inventario completo de módulos legacy

Fuente: Sprint V1.0.1 y V1.0.3 (auditorías de código, no inferencia).

### 4.1 `index.html` — Shell "Control Tower BI"

| Campo | Valor |
| --- | --- |
| **Estado actual** | En producción real en cPanel (`/app/index.html`). En Railway se sirve también, de forma no confirmada como intencional (intercepta `/` por orden de registro de middleware — hallazgo Sprint V1.0.3). |
| **Dependencias** | `js/supabase.js`, `js/auth.js` (protección de ruta); carga como iframe a `operaciones.html`, `otif.html`, `financiero.html`, `TorreControl.html` (2 variantes: torre / cumplidos) según rol (`ROL_MODULOS`). |
| **Quién lo usa** | Todo usuario interno autenticado — es el punto de entrada al sistema completo. |
| **Dónde vive** | Raíz de `Inlop-Dash` (cPanel: `/app/index.html`; Railway: `/` y `/index.html`, ver hallazgo §2). |
| **Qué APIs consume** | Ninguna API de negocio directa — orquesta los iframes; la autenticación es Supabase Auth (`js/supabase.js`). |
| **Estado de migración** | No iniciada. |
| **Prioridad** | Alta — es el shell, todo lo demás depende de que exista un equivalente en el ERP antes de migrar módulos individuales. |
| **Riesgo** | Alto — es el punto de entrada único; cualquier fallo bloquea acceso a todos los módulos para todos los roles. |

### 4.2 `TorreControl.html` — Central de Monitoreo

| Campo | Valor |
| --- | --- |
| **Estado actual** | Servido deliberadamente por `Inlop-Dash`/Railway (comentario explícito en `index.js`) y también embebido en cPanel vía iframe desde `index.html` (`torre`, `cum`). |
| **Dependencias** | `/api/pendientes`, `/api/data`, `/api/alarmas`, `/api/solicitudes` (headers `x-legacy-token`, obtenido de `/legacy/tc-init`); auto-embebido vía iframe con `?vista=viajes`/`?vista=planeados`/`?vista=cumplidos`. |
| **Quién lo usa** | Operación de tráfico/monitoreo de flota, en vivo — GPS, alarmas, cumplidos. |
| **Dónde vive** | Raíz de `Inlop-Dash`, servido desde **dos orígenes simultáneos** (Railway directo + cPanel vía iframe). |
| **Qué APIs consume** | Endpoints legacy `/api/*` de `Inlop-Dash`, autenticados con el token legacy (`LEGACY-01`). |
| **Estado de migración** | No iniciada. |
| **Prioridad** | Alta — monitoreo en tiempo real, alto uso operativo diario. |
| **Riesgo** | Alto — doble origen de servicio ya activo (ver §10); cualquier cambio en `Inlop-Dash` debe validarse contra ambos. |

### 4.3 `operaciones.html` — Centro de Control Operativo

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel, embebido como iframe desde `index.html` (`MODULOS.ops.src`). |
| **Dependencias** | Carga dentro del shell `index.html`; sin dependencias de archivo detectadas fuera de su propio bloque de script inline. |
| **Quién lo usa** | Rol `operativo`, `master`, `gerencia` (según `ROL_MODULOS`). |
| **Dónde vive** | Raíz de `Inlop-Dash` — expuesto también, sin confirmar como intencional, en Railway. |
| **Qué APIs consume** | No determinado con certeza desde este repo — su lógica de datos vive inline en el propio archivo (4850 líneas); requiere inspección dedicada antes de migrar. |
| **Estado de migración** | No iniciada. Posible relación con `Operaciones_project.html` (§4.10) sin confirmar. |
| **Prioridad** | Fase 1 del roadmap (§9) — primer módulo a migrar. |
| **Riesgo** | Medio — alto volumen de lógica de negocio inline (nominaciones, cumplimiento, causas), requiere certificación funcional exhaustiva antes de certificar el equivalente ERP. |

### 4.4 `otif.html` — Indicador OTIF

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel, embebido como iframe desde `index.html` (`MODULOS.otif.src`). |
| **Dependencias** | Carga dentro del shell `index.html`. |
| **Quién lo usa** | Rol `comercial`, `master`, `gerencia`. |
| **Dónde vive** | Raíz de `Inlop-Dash`. |
| **Qué APIs consume** | No determinado con certeza desde este repo — requiere inspección dedicada. |
| **Estado de migración** | No iniciada. |
| **Prioridad** | Fase 2 del roadmap (§9). |
| **Riesgo** | Medio — módulo de reporte (On Time / In Full), menor criticidad operativa en vivo que Torre de Control, pero con impacto comercial directo. |

### 4.5 `financiero.html` — Financiero

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel, embebido como iframe desde `index.html` (`MODULOS.fin.src`). |
| **Dependencias** | Carga dentro del shell `index.html`. |
| **Quién lo usa** | Rol `financiero`, `master`, `gerencia`. |
| **Dónde vive** | Raíz de `Inlop-Dash`. |
| **Qué APIs consume** | No determinado con certeza desde este repo — requiere inspección dedicada. Módulo de mayor sensibilidad de datos (facturación, cartera, bancos). |
| **Estado de migración** | No iniciada. |
| **Prioridad** | Fase 3 del roadmap (§9). |
| **Riesgo** | Alto — datos financieros; cualquier discrepancia entre legacy y ERP durante la coexistencia (§7) debe tratarse como incidente, no como bug menor. |

### 4.6 `login.html` — Acceso

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel (`/app/login.html`), documentado en `README.md` como la página pública de acceso del sistema completo. |
| **Dependencias** | `js/supabase.js`, `js/login.js`. Enlaza a `forgot-password.html`. |
| **Quién lo usa** | Todo usuario antes de autenticarse — puerta de entrada obligatoria. |
| **Dónde vive** | Raíz de `Inlop-Dash`; también expuesto (no confirmado como intencional) en Railway. |
| **Qué APIs consume** | Supabase Auth directo (sin pasar por `Inlop-Dash`). |
| **Estado de migración** | No iniciada — el ERP necesita su propio flujo de autenticación equivalente antes de que este módulo pueda retirarse. |
| **Prioridad** | Alta — bloqueante para cualquier retiro de cPanel; debe migrarse junto con `index.html`. |
| **Riesgo** | Crítico — es autenticación. Cualquier migración de este módulo requiere el mismo nivel de cuidado que una Zona Protegida (ver §10, "romper autenticación"). |

### 4.7 `forgot-password.html` / `reset-password.html` / `auth/callback.html`

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel, flujo completo de recuperación de contraseña vía Supabase Auth (GoTrue). |
| **Dependencias** | `js/supabase.js`, `js/forgot-password.js`, `js/reset-password.js`. Redirect whitelist configurada en Supabase Dashboard apuntando explícitamente a `https://inloplogistica.com/app/...` (`README.md`). |
| **Quién lo usa** | Cualquier usuario que olvide su contraseña. |
| **Dónde vive** | Raíz de `Inlop-Dash` (`auth/callback.html` en subcarpeta `auth/`); también expuestos, no confirmado como intencional, en Railway. |
| **Qué APIs consume** | Supabase Auth (GoTrue) directo. |
| **Estado de migración** | No iniciada. |
| **Prioridad** | Alta — mismo nivel que `login.html`, es parte del mismo flujo de autenticación. |
| **Riesgo** | Crítico — la whitelist de redirect de Supabase está atada a la URL de cPanel; migrar este flujo requiere reconfigurar Supabase Dashboard con cuidado (riesgo de "pérdida de URLs", §10). |

### 4.8 `obligaciones.html`

| Campo | Valor |
| --- | --- |
| **Estado actual** | Funcional, con lógica propia real (`js/ob-services.js`, `js/ob-excel-parser.js`), pero **sin ningún enlace entrante** desde `index.html` ni de ningún otro módulo — no forma parte del `MODULOS`/`ROL_MODULOS` del shell (confirmado en Sprint V1.0.3). |
| **Dependencias** | `js/ob-services.js`, `js/ob-excel-parser.js`. |
| **Quién lo usa** | No determinado — solo alcanzable por URL directa. Requiere confirmación del equipo de negocio sobre si sigue en uso activo. |
| **Dónde vive** | Raíz de `Inlop-Dash`. |
| **Qué APIs consume** | No determinado con certeza desde este repo. |
| **Estado de migración** | No iniciada — bloqueada hasta confirmar uso real (categoría D en Sprint V1.0.3). |
| **Prioridad** | Baja hasta confirmación de uso; si se confirma activo, revalorar. |
| **Riesgo** | Bajo técnicamente (sin dependientes conocidos), pero **alto de negocio si resulta estar en uso y nadie lo sabía** — no migrar ni retirar sin confirmación explícita. |

### 4.9 `js/*.js` (compartidos: `supabase.js`, `auth.js`, `login.js`, `logout.js`, `forgot-password.js`, `reset-password.js`)

| Campo | Valor |
| --- | --- |
| **Estado actual** | Producción en cPanel — infraestructura compartida de autenticación de todo el shell legacy. |
| **Dependencias** | `supabase.js` es cargado primero por todos los demás (cliente Supabase centralizado + `INLOP_CONFIG.paths` con prefijo `/app/`). |
| **Quién lo usa** | `login.html`, `index.html`, `forgot-password.html`, `reset-password.html`, `auth/callback.html`. |
| **Dónde vive** | `js/` en la raíz de `Inlop-Dash`. |
| **Qué APIs consume** | Supabase Auth directo. |
| **Estado de migración** | Se migra junto con `login.html`/`index.html` — no tiene sentido migrarlo de forma aislada. |
| **Prioridad** | Igual a §4.6. |
| **Riesgo** | Crítico — mismo nivel que autenticación. |

### 4.10 `Operaciones_project.html` (módulo adicional detectado, no listado explícitamente por el usuario)

| Campo | Valor |
| --- | --- |
| **Estado actual** | Recién fusionado a `main` (iniciativa "Comité Operativo" / Módulo Personal / Acta Gerencial, PRs #3–#19). 554 KB. **Cero referencias entrantes** en todo el repo — no conectado al shell `index.html` (confirmado en Sprint V1.0.1 y V1.0.3). |
| **Dependencias** | Fue objeto de `inject.py` (script de un solo uso, ya ejecutado) para insertar bloques CSS/HTML/JS. Relación con `operaciones.html` sin confirmar — mismo dominio temático, posible sucesor o módulo paralelo. |
| **Quién lo usa** | No determinado. |
| **Dónde vive** | Raíz de `Inlop-Dash`. |
| **Qué APIs consume** | No determinado sin inspección dedicada. Probablemente relacionado con las 7 migraciones SQL (`SQL_01`–`06`/`04b`: `committee_commitments`, `weekend_shifts`, `personal`, `co_actas`, etc.). |
| **Estado de migración** | No iniciada — **bloqueada hasta que el equipo de "Comité Operativo" confirme su relación con `operaciones.html` y su estado real de uso.** |
| **Prioridad** | No asignable hasta resolver la ambigüedad anterior. |
| **Riesgo** | Alto por incertidumbre — no se puede planear una migración sin saber si este archivo es el reemplazo de `operaciones.html`, un módulo independiente, o trabajo en curso sin terminar de conectar. |

---

## 5. Módulos fuera de este inventario (confirmado, no por omisión)

Verificado en las auditorías previas — no requieren plan de migración porque
no son interfaz de usuario: `SQL_01…06`/`04b` (migraciones de base de datos,
de un solo uso), `inject.py` (script ya ejecutado), `docs/ARQUITECTURA.md`,
`README.md`, `package.json`/`package-lock.json` (metadatos de repo). Ver
Sprint V1.0.3 §3 para el detalle de por qué no deben ser públicos, tarea ya
independiente de esta migración.

---

## 6. Política oficial de retiro — Ningún HTML se elimina sin cumplir TODO

**Regla permanente, sin excepción sin aprobación explícita del responsable
del producto** (mismo principio que `appclienteinlop/CLAUDE.md §10.1.8`
aplicado aquí):

Un módulo legacy (HTML + su JS asociado) **solo** puede eliminarse de
producción cuando se cumplen, todos, los siguientes seis requisitos:

- [ ] ✓ **ERP equivalente desplegado** — el módulo correspondiente existe y
      está desplegado en `https://merry-charisma-production-b52e.up.railway.app`.
- [ ] ✓ **Certificación funcional** — el equivalente ERP replica el
      comportamiento del módulo legacy verificado campo por campo, no solo
      visualmente.
- [ ] ✓ **Certificación operativa** — validado por quien opera el módulo a
      diario, no solo por ingeniería.
- [ ] ✓ **Producción estable** — el equivalente ERP lleva un período de
      operación real sin incidentes (ver §7, Período de estabilización).
- [ ] ✓ **Validación del usuario** — los usuarios reales del módulo
      confirman explícitamente que pueden trabajar exclusivamente desde el
      ERP.
- [ ] ✓ **Aprobación de retiro** — decisión explícita y documentada del
      responsable del producto, no una inferencia de que "ya no se usa".

Mientras no se cumplan los seis, el módulo legacy permanece en cPanel,
sirviendo tráfico real, sin excepción.

---

## 7. Ciclo oficial de migración

```
Legacy (cPanel, producción)
   ↓
ERP (implementación del equivalente — Railway)
   ↓
Certificación (funcional + operativa, §6)
   ↓
Producción (ambos coexisten — legacy sigue siendo la fuente de verdad)
   ↓
Período de estabilización (uso real del ERP, sin incidentes, duración a
   definir por el responsable de producto — no hay fecha fija en este plan)
   ↓
Retiro (legacy deja de recibir tráfico — solo tras cumplir §6 completo)
   ↓
Archivo (ver §8)
```

Ningún módulo salta etapas. Un módulo puede estar en Certificación mientras
otro está en Producción — el ciclo es por módulo, no global.

---

## 8. Destino final del legado — Recomendación (no implementada)

Dos opciones evaluadas:

| Opción | A favor | En contra |
| --- | --- | --- |
| **Repositorio Archive separado** | Aísla completamente el código retirado del código activo; un `git clone` del repo principal no arrastra peso muerto; permite aplicar políticas de acceso/retención distintas | Rompe el historial de `git blame`/`git log` en un solo lugar; requiere mantener un segundo repositorio con su propio ciclo de vida |
| **Rama `legacy` dentro de `Inlop-Dash`** | Conserva el historial completo en un solo repositorio; un `git log --all` sigue mostrando la evolución completa; más simple de mantener con el flujo Git ya existente en este proyecto | El código retirado sigue "presente" en el repo (aunque no en `main`), puede generar confusión sobre qué está realmente vigente |

**Recomendación: rama `legacy`, no repositorio separado.** Justificación
técnica: el patrón de trabajo ya establecido en este ecosistema (ver
`appclienteinlop/CLAUDE.md §10.1.8`) es "no eliminar hasta certificar,
luego retirar sin perder historial" — una rama cumple ese principio sin
introducir un segundo repositorio a mantener, versionar y asegurar por
separado. Un repositorio Archive solo se justificaría si el volumen de
código legacy fuera significativamente mayor al de `Inlop-Dash` activo, lo
cual no es el caso hoy (10 HTML + `js/` + `auth/`, frente a un backend de
2652 líneas más el ERP en crecimiento).

**Esta es una recomendación, no una implementación.** Requiere aprobación
explícita del responsable del producto antes de crear la rama o mover
cualquier archivo.

---

## 9. Roadmap

| Fase | Módulo(s) | Depende de |
| --- | --- | --- |
| **Fase 1** | `operaciones.html` | Shell de autenticación equivalente en ERP (bloqueante implícito — sin login no hay acceso a ningún módulo) |
| **Fase 2** | `otif.html` | Fase 1 certificada (no bloqueante técnico, pero se respeta el orden para no paralelizar certificaciones) |
| **Fase 3** | `financiero.html` | Fase 2 certificada — mayor riesgo de datos, se migra con más margen de validación |
| **Fase 4** | `TorreControl.html` | Resolución previa del doble origen de servicio (Railway + cPanel, ver §10) — no se migra hasta desambiguar cuál es la fuente de verdad hoy |
| **Fase 5** | Retiro definitivo del legado | Las 4 fases anteriores certificadas y con Aprobación de retiro (§6) para cada una; incluye `login.html`/`forgot-password.html`/`reset-password.html`/`auth/callback.html`/`js/*` como parte del cierre, no como fase propia — se retiran junto con el último módulo que dependa de ellos |

`obligaciones.html` y `Operaciones_project.html` **no tienen fase asignada**
— quedan fuera del roadmap hasta resolver las ambigüedades de §4.8 y §4.10
respectivamente.

---

## 10. Riesgos críticos

1. **Afectar cPanel.** La producción real de hoy vive ahí. Ningún cambio en
   `Inlop-Dash` o en el ERP puede modificar, mover o eliminar archivos que
   cPanel sirve — cPanel es un hosting independiente, fuera del alcance de
   este repositorio, pero la configuración de Supabase Auth (redirect
   whitelist) sí está compartida y es un punto de acoplamiento real.
2. **Romper autenticación.** `login.html`/`forgot-password.html`/
   `reset-password.html`/`auth/callback.html` son, en la práctica, una Zona
   Protegida — cualquier migración de este flujo debe tratarse con el mismo
   rigor que `requireClienteAuth()` en `appclienteinlop`.
3. **Romper TorreControl.** Es el único módulo con doble origen de
   servicio *ya activo* (Railway deliberado + cPanel vía iframe) — un
   cambio en `Inlop-Dash` puede afectar ambos sin que sea obvio desde un
   solo repositorio.
4. **Pérdida de URLs.** La whitelist de redirect de Supabase Auth está
   configurada explícitamente para `https://inloplogistica.com/app/*`
   (`README.md`). Migrar sin reconfigurar esa whitelist rompe silenciosamente
   la recuperación de contraseña.
5. **Dependencias ocultas.** `operaciones.html`, `otif.html` y
   `financiero.html` tienen su lógica de datos inline (miles de líneas cada
   uno) sin documentación de qué endpoints consumen — confirmado que no se
   pudo determinar desde este repo sin inspección dedicada (§4.3-4.5).
   Migrar sin ese mapeo previo es el riesgo más alto de esta migración.
6. **Despliegues simultáneos.** Ya existe hoy — no es un riesgo futuro:
   `Inlop-Dash`/Railway sirve, sin confirmación de que sea intencional, una
   copia de casi todo el árbol de cPanel (hallazgo Sprint V1.0.3, `GET /`
   sirve `index.html` en vez de `TorreControl.html` por una colisión de
   orden de middleware). Cualquier plan de migración debe primero
   **confirmar cuál origen es la fuente de verdad para cada módulo** antes
   de construir su equivalente en el ERP — construir contra el origen
   equivocado invalida la certificación funcional (§6).
7. **`Operaciones_project.html` sin resolver.** No se puede planear su
   migración (o su descarte) sin que el equipo de "Comité Operativo"
   confirme su relación con `operaciones.html` (§4.10).

---

## 11. Matriz de seguimiento

| Módulo | Estado | Responsable | Riesgo | Dependencias | Fecha | Observaciones |
| --- | --- | --- | --- | --- | --- | --- |
| `index.html` (shell BI) | No iniciada | Por asignar | Alto | `js/supabase.js`, `js/auth.js` | — | Bloqueante de todo lo demás — es el punto de entrada |
| `login.html` + suite auth | No iniciada | Por asignar | Crítico | Supabase Auth, whitelist de redirect | — | Tratar como Zona Protegida |
| `TorreControl.html` | No iniciada | Por asignar | Alto | `/api/pendientes`, `/api/data`, `/api/alarmas`, `/api/solicitudes` | — | Doble origen ya activo (Railway + cPanel) |
| `operaciones.html` | No iniciada | Por asignar | Medio | Lógica inline sin mapear | — | Fase 1 del roadmap |
| `otif.html` | No iniciada | Por asignar | Medio | Lógica inline sin mapear | — | Fase 2 del roadmap |
| `financiero.html` | No iniciada | Por asignar | Alto | Lógica inline sin mapear | — | Fase 3 del roadmap — datos financieros |
| `obligaciones.html` | Bloqueada | Por asignar (confirmar uso) | Bajo técnico / Alto de negocio | `js/ob-services.js`, `js/ob-excel-parser.js` | — | Sin enlace entrante — no migrar sin confirmar uso |
| `Operaciones_project.html` | Bloqueada | Por asignar (Comité Operativo) | Alto (incertidumbre) | SQL_01–06/04b, relación con `operaciones.html` sin confirmar | — | Recién fusionado, cero referencias entrantes |

Este documento no asigna responsables ni fechas — corresponde al equipo de
producto completarlos al aprobar el inicio de cada fase.

---

## 12. Cómo trabajar con este documento

1. Antes de iniciar la migración de cualquier módulo, releer §6 (Política de
   retiro) y §10 (Riesgos críticos).
2. Todo módulo nuevo detectado en el legado se agrega a §4 con la misma
   estructura de campos — nunca se migra un módulo no inventariado aquí.
3. Si algo aquí queda desactualizado por una migración ya certificada,
   actualizar este documento en la misma sprint que certifica el módulo —
   no dejarlo desincronizado del estado real, mismo principio que
   `appclienteinlop/CLAUDE.md §11.3`.

---

_Fin del Migration Master Plan v1.0 — INLOP._
