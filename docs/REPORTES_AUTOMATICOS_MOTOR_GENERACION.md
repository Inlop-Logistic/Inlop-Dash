# REPORTES AUTOMÁTICOS — MOTOR DE GENERACIÓN

## Fase 9A — Arquitectura y Decisiones Aprobadas

**Versión:** 1.0
**Estado:** Arquitectura aprobada — sin implementar
**Alcance:** Backend (`index.js` + `services/`), módulo Configuración → Parámetros → Reportes Automáticos
**Fecha:** 2026-08-11

---

## ÍNDICE

- [1. Resumen](#1-resumen)
- [2. Auditoría base](#2-auditoría-base)
- [3. Arquitectura propuesta](#3-arquitectura-propuesta)
- [4. Flujo de ejecución](#4-flujo-de-ejecución)
- [5. Decisiones aprobadas](#5-decisiones-aprobadas)
- [6. Compatibilidad técnica](#6-compatibilidad-técnica)
- [7. Archivos/componentes a crear](#7-archivoscomponentes-a-crear)
- [8. Riesgos y decisiones aún pendientes](#8-riesgos-y-decisiones-aún-pendientes)
- [9. Próximos pasos](#9-próximos-pasos)

---

## 1. Resumen

Este documento cierra la Fase 9A: define cómo se ejecutará un reporte automático activo — desde el dataset real hasta el archivo final adjuntable — y registra las decisiones aprobadas sobre los puntos que quedaron abiertos en la propuesta inicial. **No se implementa nada en esta fase.** Sirve como referencia para las fases 9B en adelante (dataset provider, filter engine, column resolver, builders de Excel/HTML) y, más adelante, para el scheduler y el envío.

## 2. Auditoría base

| Dataset (`tipo_reporte`) | Fuente real | Endpoint hoy | Parametrización actual |
|---|---|---|---|
| `viajes_activos` | `cache.viajes.data` (RAM, sync 60s) | `GET /api/viajes` — handler síncrono, `.map()` puro | Sin filtros server-side |
| `centro_gps` | `cache.viajes.data` filtrado por `ESTADOS_MONITOREABLES` | `GET /api/gps` — handler síncrono | Sin filtros server-side |
| `solicitudes` | Supabase `solicitudes` + joins (empresas/agencias/usuarios) | `GET /api/solicitudes` | `?desde&hasta&estado` — filtra por `creado_en`, default hoy |
| `programacion` | Supabase `planeados` | `GET /api/programacion` | `?desde&hasta` — filtra por `fecha_programada_dia`, default hoy |
| `viajes_finalizados` | Supabase `cumplidos`, paginado | `GET /api/cumplidos` | `?limit=N` (Fase 8C), tope 500, sin push-down de filtros |

`reportes_automaticos` ya persiste todo lo necesario para ejecutar un reporte: `tipo_reporte`, `filtros` (`{campo,operador,valor|valor_desde|valor_hasta}[]`), `columnas` (`{campo,titulo,orden}[]`), `formato` (`excel|html_filas|html_columnas`), `recurrencia` (`{tipo,horas[],dias_semana?,dia_mes?,fecha_inicio,fin}`), `destinatarios` (`{personal_ids[],correos_externos[]}`). No falta ninguna columna en BD para lo que cubre esta fase.

Infraestructura reutilizable ya existente:
- `services/notificationOrchestrator.js` + `services/channels/emailChannel.js` — envío por Resend, patrón *lazy client* (fase de envío futura, fuera de 9A).
- Patrón de scheduler propio del proyecto: `setInterval` en el arranque de `index.js` (sin cola externa, sin Redis) — mismo molde que `syncViajes`, `syncSolicitudes`, etc.
- Ninguna librería de generación de Excel está instalada todavía (`exceljs`/`xlsx` no están en `package.json`).

## 3. Arquitectura propuesta

100% backend, cero dependencia del navegador. El generador vive en el mismo proceso Node que hoy corre `index.js`:

```
Trigger (futuro scheduler)
        │
        ▼
Report Runner  ──►  Dataset Provider  ──►  Filter Engine  ──►  Column Resolver  ──►  File Builder
(orquesta)          (datos completos,       (mismos            (campo/título/         (Excel / HTML,
                      con push-down de        operadores          orden, misma           en memoria)
                      fecha cuando aplica)     de 8D, portados)    semántica de Preview)
        │
        ▼
   (futuro, fuera de 9A) Delivery — emailChannel/Resend con adjunto
```

Principio rector: el Report Runner nunca vuelve a golpear los endpoints HTTP propios. Llama **en proceso** a las mismas funciones que hoy arman la respuesta de `/api/viajes`, `/api/solicitudes`, etc. — extraídas a funciones reutilizables, sin loopback HTTP ni doble autenticación.

## 4. Flujo de ejecución

1. **Trigger** (fuera de 9A) identifica una ejecución pendiente: un reporte `activo=true`, `borrador=false`, y una hora de `recurrencia.horas` que corresponde ejecutar ahora (ver §5.5).
2. **Report Runner** carga la fila completa de `reportes_automaticos`.
3. **Dataset Provider** resuelve `tipo_reporte` → obtiene el dataset **completo** (no la muestra de 10 de Preview), aplicando el criterio de fecha de §5.2.
4. **Filter Engine** aplica el resto de `filtros` (los que no se resolvieron por push-down) — misma semántica de operadores y mismo criterio AND que la Preview (8D), incluida la comparación de fechas por formato real de transporte (MDY/DMY/ISO).
5. **Column Resolver** arma `{campo,titulo}[]` desde `columnas`, con la misma semántica exacta de Preview (§5.6).
6. **File Builder** genera el archivo en memoria (`Buffer`): Excel con `exceljs`, o HTML en la variante configurada (§5.3).
7. *(Fuera de 9A)* Delivery adjunta el buffer y envía por Resend a los destinatarios resueltos.
8. *(Fuera de 9A)* Scheduler recalcula la próxima ejecución.

## 5. Decisiones aprobadas

### 5.1 Pipeline 100% backend
`Dataset → Filtros → Columnas → Builder` vive íntegramente en backend. El frontend no participa en la generación del archivo real — la Preview de 8C/8D sigue siendo, y seguirá siendo, una maqueta de 10 filas ajena a este pipeline.

### 5.2 Solicitudes / Programación — fecha por defecto
Por defecto, el Dataset Provider consulta con `desde=hasta=fecha de ejecución (Colombia)` — mismo comportamiento que hoy tienen los endpoints sin parámetros. Si `filtros` trae una condición explícita de fecha (`es`/`antes_de`/`despues_de`/`entre`) **sobre el campo que el endpoint ya usa para acotar la consulta**, se traduce a `desde`/`hasta` y se envía como push-down en la llamada a Supabase, en vez de traer todo y filtrar en memoria.

Precisión técnica necesaria para 9B (no es una incompatibilidad, es el mapeo exacto a respetar):
- `solicitudes`: el `desde/hasta` del endpoint filtra sobre `creado_en`. Solo un filtro sobre `creado_en` puede empujarse como `desde/hasta`. Un filtro sobre `fecha_requerida` (el otro campo fecha filtrable de este dataset) **no** corresponde al mismo parámetro — debe resolverse en el Filter Engine, en memoria, después de traer el rango por defecto (o completo, si no hay filtro de `creado_en`).
- `programacion`: el `desde/hasta` del endpoint filtra sobre `fecha_programada_dia` (columna derivada, ya normalizada a día Colombia a partir de `schedulate_origin` en el momento del sync). Un filtro sobre `schedulate_origin` (el único campo fecha filtrable de este dataset) sí corresponde semánticamente al mismo día y puede empujarse como `desde/hasta` sin ambigüedad.

### 5.3 Formatos HTML
- `html_filas` = tabla tradicional: fila = registro, columna = campo (igual disposición que Excel y que la tabla de Preview).
- `html_columnas` = formato transpuesto: fila = campo (con su título configurado), columna = registro.

Sin incompatibilidad técnica. Observación de producto (no bloqueante): con muchos registros, `html_columnas` genera una columna por registro — el formato rinde mejor con volúmenes acotados; no se propone ningún límite automático en esta fase, queda como criterio a vigilar cuando haya datos reales de uso.

### 5.4 Archivos efímeros, sin Storage
El `File Builder` devuelve un `Buffer` en memoria; el Report Runner lo pasa directo al paso de envío (fuera de 9A) sin persistir en Supabase Storage ni en disco. No se crea bucket nuevo en esta fase.

Restricción operativa a documentar (no bloqueante en 9A, sí relevante para 9B+): Resend acepta adjuntos hasta ~40MB por correo. Sin Storage, un reporte que se acerque a ese límite no tiene mecanismo de respaldo (no hay dónde descargarlo después). Si el volumen real de algún reporte se acerca a ese techo, esta decisión debería revisarse — no antes.

### 5.5 Múltiples horas = ejecuciones independientes
Cada hora en `recurrencia.horas` dispara una ejecución completa e independiente del pipeline completo (Dataset → Filtros → Columnas → Builder → envío), no una entrega incremental. Con `horas: ["08:00", "14:00"]`, el reporte se genera y se envía dos veces al día, cada vez con el dataset completo vigente en ese momento (no solo lo nuevo desde la ejecución anterior).

Consecuencia directa de combinar esta decisión con §5.2: dos ejecuciones el mismo día calendario consultan el mismo rango de fecha por defecto (hoy) y pueden devolver conjuntos de datos distintos solo porque el tiempo avanzó entre una y otra (más solicitudes creadas, más viajes activos, etc.) — es el comportamiento esperado, no un defecto a corregir.

### 5.6 `columnas=[]`
Mantiene exactamente la semántica ya implementada en Preview (`resolverColumnas()`, Fase 8D): todas las columnas `seleccionableColumna=true` del catálogo, en el orden del catálogo, con el `label` del catálogo como título. El Column Resolver del backend es un puerto directo de esa función, sin variaciones de comportamiento.

## 6. Compatibilidad técnica

**No se identifica ninguna incompatibilidad técnica real entre las seis decisiones ni contra la arquitectura backend actual.** Los cinco endpoints ya exponen (o pueden exponer sin cambiar su contrato) exactamente lo que este diseño necesita: los dos endpoints RAM (`viajes_activos`, `centro_gps`) son funciones síncronas puras que ya devuelven el dataset completo; `solicitudes` y `programacion` ya aceptan rango de fecha explícito; `viajes_finalizados` ya soporta `?limit=N` y puede generalizarse a "sin tope" para generación completa sin tocar su forma de respuesta.

Las únicas precisiones que 9B debe respetar (documentadas en §5.2) son de **mapeo campo↔parámetro**, no de arquitectura: no todo filtro de fecha sobre `solicitudes`/`programacion` puede empujarse como `desde/hasta` — depende de si el campo filtrado es el mismo que el endpoint ya usa para acotar la consulta.

## 7. Archivos/componentes a crear

Sin implementar todavía — listado de referencia para 9B en adelante:

- `services/reportes/datasetProvider.js` — `obtenerDatasetCompleto(tipoReporte, contexto)`, con el mapeo campo↔parámetro de §5.2 para `solicitudes`/`programacion`.
- `services/reportes/filterEngine.js` — puerto backend de `evaluaCondicion` / `aplicarFiltros` / `fechaCampoYMD` (hoy en `erp/src/modules/configuracion/services/api.ts`).
- `services/reportes/columnResolver.js` — puerto backend de `resolverColumnas` (hoy en `EtapaRevision.tsx`), sin variaciones respecto a §5.6.
- `services/reportes/excelBuilder.js` — con `exceljs` (dependencia nueva a agregar cuando se implemente).
- `services/reportes/htmlBuilder.js` — dos variantes según §5.3.
- `services/reportes/generator.js` — orquesta todo: `generarReporte(reporteRow) → { buffer, filename, mimeType }`.

## 8. Riesgos y decisiones aún pendientes

Los siguientes puntos de la propuesta inicial quedaron resueltos por las decisiones de este cierre: pipeline backend (§5.1), rango de fecha de solicitudes/programación (§5.2), semántica HTML (§5.3), persistencia (§5.4), horas múltiples (§5.5), `columnas=[]` (§5.6).

Sigue abierto, sin bloquear el diseño:

1. **Duplicación TS(frontend)/JS(backend)** del catálogo de campos y de la lógica de filtros — dos implementaciones a mantener sincronizadas (módulo compartido con `allowJs` vs. duplicado con test de consistencia). Pendiente de decisión antes de programar 9B.
2. **Tope de `viajes_finalizados` para generación completa** — quitar el `?limit` de Preview implica potencialmente escanear miles de filas en memoria. Push-down de filtros a PostgREST es una opción a evaluar con datos reales de volumen, no antes.
3. **Límite de adjunto de Resend (~40MB)** — sin Storage (§5.4), un reporte que se acerque al límite no tiene respaldo. Revisar si y cuando el volumen real lo justifique.

## 9. Próximos pasos

Referencia de roadmap, no un compromiso de alcance — cada fase requiere su propia autorización explícita antes de programar:

- **9B** — Dataset Provider + Filter Engine + Column Resolver backend, con pruebas que comparen su salida contra la Preview actual (mismo dataset, mismos filtros, mismas columnas → mismo resultado).
- **9C** — Excel Builder (`exceljs`).
- **9D** — HTML Builder (`html_filas` + `html_columnas`).
- **9E** — punto de entrada manual de prueba (ej. generar bajo demanda un reporte existente) para validar el pipeline completo antes de conectar scheduler y envío.
- **9F** — Scheduler (cálculo de `proxima_ejecucion`, disparo por hora configurada).
- **9G** — Envío (reutilizando `emailChannel`/Resend con adjunto).
