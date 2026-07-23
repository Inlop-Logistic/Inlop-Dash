# CONSTITUCIÓN DEL DOMINIO — GESTIÓN COMERCIAL
## ERP INLOP · Versión 1.0 · Julio 2026

**Clasificación:** Interno — Documento de Arquitectura Oficial  
**Estado:** Base oficial para implementación  
**Precede a:** Todo módulo, tabla, API o componente del dominio Gestión Comercial

> Este documento es la Constitución del dominio Gestión Comercial.  
> Ninguna decisión de diseño, tabla, endpoint o componente puede contradecir lo aquí establecido.  
> Si una situación nueva no está cubierta, se actualiza este documento antes de implementar.

---

## Índice

1. [Principio Fundamental](#1-principio-fundamental)
2. [Estado Actual del ERP](#2-estado-actual-del-erp)
3. [Dominio Gestión Comercial](#3-dominio-gestión-comercial)
4. [Entidad: Cliente](#4-entidad-cliente)
5. [Entidad: Contacto Comercial](#5-entidad-contacto-comercial)
6. [Entidad: Lista de Precios](#6-entidad-lista-de-precios)
7. [Entidad: Convenio Comercial](#7-entidad-convenio-comercial)
8. [Entidad: Cotización](#8-entidad-cotización)
9. [Entidad: Pedido](#9-entidad-pedido)
10. [Entidad Compartida: Solicitud](#10-entidad-compartida-solicitud)
11. [Cadena de Negocio Completa](#11-cadena-de-negocio-completa)
12. [Reglas de Negocio](#12-reglas-de-negocio)
13. [Eventos del Dominio](#13-eventos-del-dominio)
14. [Entidades Evaluadas y Descartadas](#14-entidades-evaluadas-y-descartadas)
15. [Benchmark ERP/TMS](#15-benchmark-erptms)
16. [Tabla de Decisiones Arquitectónicas](#16-tabla-de-decisiones-arquitectónicas)
17. [Nuevos Campos en Entidades Existentes](#17-nuevos-campos-en-entidades-existentes)

---

## 1. Principio Fundamental

### 1.1 Las entidades NO pertenecen a módulos. Los módulos administran entidades.

El ERP INLOP no está compuesto de módulos aislados que tienen sus propias versiones de los datos.  
El ERP está compuesto de **entidades compartidas** que distintos módulos administran según su responsabilidad.

Una `Solicitud` no es "una solicitud comercial" ni "una solicitud operativa".  
Es una sola entidad con un solo ciclo de vida, administrada en distintos momentos por distintos módulos:

| Módulo | Relación con Solicitud |
|--------|------------------------|
| Portal Cliente | La crea (canal: APP) |
| Gestión Comercial | La origina desde Cotización o Pedido |
| Programación | La vincula con un viaje TMS |
| Operaciones | La ejecuta y controla |
| Cumplidos | Registra su expediente documental |
| Facturación | La factura |
| Cartera | Controla su cobro |

### 1.2 Propiedad del dato

El principio rector de propiedad de datos es:

**Un campo pertenece a exactamente una entidad. Si el mismo dato existe en dos lugares, uno de los dos está mal.**

La única excepción permitida es el snapshot de `tarifa_pactada` en Solicitud, justificada explícitamente en la sección correspondiente.

### 1.3 Responsabilidad de Gestión Comercial

El dominio Gestión Comercial es responsable del ciclo comercial completo:  
desde el primer contacto con el cliente hasta la emisión de la Solicitud operacional.

Gestión Comercial **no ejecuta viajes**. Gestión Comercial **origina solicitudes**.

---

## 2. Estado Actual del ERP

Antes de diseñar, se inventarió lo que ya existe. Estas entidades **ya están en producción** y el dominio Gestión Comercial debe integrarlas, no duplicarlas.

### 2.1 Tablas Supabase existentes relevantes

| Tabla | Propósito actual | Campos conocidos |
|-------|-----------------|------------------|
| `empresas_cliente` | Empresa contratante del servicio | id, razon_social, nombre_controlt, activa |
| `agencias_cliente` | Sedes/sucursales de la empresa cliente | id, nombre, ciudad, empresa_cliente_id, activa |
| `usuarios_cliente` | Usuarios del Portal Cliente | id, nombre, empresa_cliente_id, agencias[], rol, activo |
| `solicitudes` | Solicitudes de servicio | ver §10 |
| `cumplidos` | Expediente documental de viajes cumplidos | id, estado_cumplido, tiene_soporte, cliente, empresa_cliente_id |
| `notificaciones_cliente` | Canal de notificaciones push al portal | id, tipo, payload, usuario_id |

### 2.2 Módulos ERP implementados

| Módulo | Vista | Estado |
|--------|-------|--------|
| Solicitudes | solicitudes | Implementado |
| Programación | programacion | Implementado |
| Viajes | viajes | Implementado |
| Cumplidos | cumplidos | Implementado |
| Mapa GPS | mapa | Implementado |
| GPS Flota | gps | Implementado |
| Clientes | clientes | Planificado (ModuloId definido) |
| Conductores | conductores | Planificado |
| Facturación | facturacion | Planificado |

### 2.3 Entidades de Gestión Comercial que NO existen aún

Las siguientes entidades son **nuevas** y pertenecen exclusivamente al dominio Gestión Comercial:

- Contacto Comercial
- Lista de Precios (y TarifaItem)
- Convenio Comercial
- Cotización
- Pedido

---

## 3. Dominio Gestión Comercial

### 3.1 Propósito del dominio

Gestión Comercial administra la relación económica entre INLOP y sus clientes.  
Responde a las preguntas:

- ¿Quién es el cliente y qué acordamos con él?
- ¿A qué precio le ofrecemos el servicio?
- ¿Cuántos viajes nos solicitó y cuántos hemos cumplido?
- ¿Cómo pasamos de un acuerdo comercial a una Solicitud operacional?

### 3.2 Límites del dominio

**Gestión Comercial administra:**
- Clientes (enriquecimiento del perfil comercial)
- Contactos Comerciales
- Listas de Precios
- Convenios Comerciales
- Cotizaciones
- Pedidos

**Gestión Comercial NO administra:**
- La ejecución del viaje (Operaciones)
- La asignación de conductor/vehículo (Programación)
- El estado en ruta (Viajes/GPS)
- El expediente documental (Cumplidos)
- La factura (Facturación)

**Gestión Comercial usa pero no administra:**
- Solicitud (la origina, pero el ciclo operacional lo gestiona Operaciones)

### 3.3 Mapa de entidades del dominio

```
CLIENTE ──────────────────────────── tiene ──────────► CONTACTO COMERCIAL
   │
   ├── vinculado a ──────────────────────────────────► CONVENIO COMERCIAL
   │                                                        │
   │                                                        └── referencia ──► LISTA DE PRECIOS
   │                                                                                  │
   │                                                                                  └─ contiene ─► TARIFA ITEM
   │
   ├── origina ───────────────────────────────────────► COTIZACIÓN
   │                                                        │
   │                                                        └── convierte en ──────────────────────► SOLICITUD (compartida)
   │
   └── agrupa en ─────────────────────────────────────► PEDIDO
                                                            │
                                                            └── genera N ───────────────────────────► SOLICITUD (compartida)
```

---

## 4. Entidad: Cliente

### 4.1 Propósito

Representa a la empresa que contrata los servicios de transporte de INLOP.  
Es la entidad raíz de toda la cadena comercial.

### 4.2 Responsabilidad

Ser la fuente única de verdad sobre la identidad y configuración comercial de cada empresa contratante.

### 4.3 Estado actual

La tabla `empresas_cliente` ya existe en Supabase con campos básicos.  
Gestión Comercial la **enriquece** con campos comerciales adicionales.  
**No se crea una tabla nueva.** Se extiende la existente.

### 4.4 Campos actuales (ya en producción)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `razon_social` | string | Razón social oficial |
| `nombre_controlt` | string \| null | Alias histórico del sistema externo (solo lectura) |
| `activa` | boolean | Estado operativo |

### 4.5 Campos nuevos propuestos por Gestión Comercial

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nit` | string \| null | NIT con dígito de verificación |
| `tipo_cliente` | enum | `recurrente` \| `nuevo` \| `eventual` |
| `sector` | string \| null | Sector económico (ej. "retail", "manufactura") |
| `ciudad_principal` | string \| null | Ciudad sede principal |
| `canal_preferido` | enum | `APP` \| `ERP` \| `ambos` — canal por defecto para nuevas solicitudes |
| `credito_habilitado` | boolean | Si tiene crédito habilitado (para Facturación) |
| `dias_credito` | int \| null | Plazo de pago por defecto (días) |
| `notas_comerciales` | text \| null | Notas internas del área comercial |
| `convenio_activo_id` | uuid \| null | FK → convenios (desnormalización controlada, read-only) |

> **Nota sobre convenio_activo_id:** Es el único caso de desnormalización permitida. Se mantiene sincronizado por el backend cuando un Convenio cambia de estado. Evita un JOIN en cada consulta de solicitud.

### 4.6 Dueño del dato

**Gestión Comercial** es propietario del perfil comercial del cliente.  
Operaciones y Portal solo leen.

### 4.7 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear cliente | `ejecutivo_comercial`, `gerente_comercial` |
| Modificar perfil comercial | `ejecutivo_comercial`, `gerente_comercial` |
| Activar / desactivar | `gerente_comercial` |
| Consultar | Todos los roles del ERP |
| Vincularse desde Portal | Solo el sistema (auto-provisioning al registrar empresa) |

### 4.8 Estados

| Estado | Descripción | Transición |
|--------|-------------|------------|
| `activo` | Puede recibir solicitudes | — |
| `inactivo` | Bloqueado comercialmente | Manual por gerente |
| `en_revision` | Se están verificando sus datos | Temporal |

### 4.9 Eventos

| Evento | Disparador |
|--------|-----------|
| `CLIENTE_CREADO` | Alta en el sistema |
| `CLIENTE_ACTUALIZADO` | Modificación de cualquier campo |
| `CLIENTE_DESACTIVADO` | Cambio a estado inactivo |
| `CONVENIO_VINCULADO` | Se activa un Convenio para este cliente |
| `CONVENIO_DESVINCULADO` | Un Convenio vence, suspende o cancela |

### 4.10 Relaciones

- **1 Cliente → 0..N Agencias** (`agencias_cliente.empresa_cliente_id`)
- **1 Cliente → 0..N Contactos Comerciales**
- **1 Cliente → 0..1 Convenio activo**
- **1 Cliente → 0..N Cotizaciones**
- **1 Cliente → 0..N Pedidos**
- **1 Cliente → 0..N Solicitudes**
- **1 Cliente → 0..N Usuarios Portal** (`usuarios_cliente.empresa_cliente_id`)

### 4.11 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración completa |
| Portal Cliente | Lectura de datos propios |
| Programación | Resolución nombre cliente en ViajeResumen |
| Solicitudes | Enriquecimiento del campo `cliente` |
| Cumplidos | Trazabilidad cliente → expediente |
| Facturación | Datos fiscales, condiciones de pago |

---

## 5. Entidad: Contacto Comercial

### 5.1 Propósito

Representa a la persona física en la empresa cliente que INLOP contacta para asuntos comerciales: recibir cotizaciones, negociar precios, autorizar pedidos, firmar convenios.

### 5.2 Por qué es una entidad separada de `usuarios_cliente`

Esta distinción es crítica y no debe ignorarse:

| Dimensión | `usuarios_cliente` | `Contacto Comercial` |
|-----------|-------------------|---------------------|
| Propósito | Acceso al Portal Cliente | Relación comercial con INLOP |
| Quién lo crea | El propio usuario al registrarse | El ejecutivo comercial de INLOP |
| Tiene contraseña | Sí (Supabase Auth) | No necesariamente |
| Canal | Portal (web/app) | Email, teléfono, reuniones |
| Scope | Operativo (rastrea solicitudes) | Comercial (negocia, aprueba) |
| Puede estar en múltiples agencias | Sí | Vinculado al cliente, no a agencia |

Un Contacto Comercial puede o no tener acceso al Portal. Si lo tiene, puede existir en ambas tablas. Si no, solo en `contactos_comerciales`.

### 5.3 Responsabilidad

Ser el punto de contacto de INLOP con el cliente para todas las comunicaciones comerciales.

### 5.4 Dueño del dato

**Gestión Comercial** es el único escritor. Los contactos son propiedad del área comercial de INLOP.

### 5.5 Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `empresa_cliente_id` | uuid | FK → empresas_cliente |
| `nombre` | string | Nombre completo |
| `cargo` | string \| null | Cargo en la empresa cliente |
| `email` | string \| null | Email principal |
| `telefono` | string \| null | Teléfono directo |
| `es_decisor` | boolean | Si tiene autoridad para aprobar cotizaciones |
| `activo` | boolean | Estado del contacto |
| `notas` | text \| null | Observaciones del ejecutivo comercial |
| `usuario_cliente_id` | uuid \| null | FK → usuarios_cliente (si tiene portal) |

### 5.6 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear | `ejecutivo_comercial`, `gerente_comercial` |
| Modificar | `ejecutivo_comercial`, `gerente_comercial` |
| Desactivar | `gerente_comercial` |
| Consultar | Todos los roles de Gestión Comercial |

### 5.7 Estados

El Contacto Comercial no tiene un ciclo de vida complejo. Solo: `activo` / `inactivo`.

### 5.8 Eventos

| Evento | Disparador |
|--------|-----------|
| `CONTACTO_CREADO` | Alta por ejecutivo comercial |
| `CONTACTO_ACTUALIZADO` | Modificación de datos |
| `CONTACTO_DESACTIVADO` | El contacto ya no pertenece a la empresa |

### 5.9 Relaciones

- **N Contactos → 1 Cliente**
- **0..1 Contacto ↔ 0..1 Usuario Portal** (vínculo opcional)
- **0..N Contactos ↔ N Cotizaciones** (destinatario de la cotización)

### 5.10 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración y uso en cotizaciones |
| Facturación | Destinatario de facturas y estados de cuenta |

---

## 6. Entidad: Lista de Precios

### 6.1 Propósito

Es el catálogo oficial de tarifas de INLOP. Define cuánto cobra la empresa por un servicio de transporte dado, según la ruta, tipo de vehículo, tipo de operación y período de vigencia.

### 6.2 Responsabilidad

Ser la fuente única de verdad sobre las tarifas base del servicio. Cualquier precio que aparezca en una Cotización o Solicitud debe poder trazarse a esta entidad.

### 6.3 Por qué es versionada

Las tarifas cambian por período (trimestre, año, temporada). Un cambio de tarifa no debe afectar retroactivamente a Cotizaciones ya emitidas ni a Solicitudes ya creadas. La versión garantiza que cada documento comercial apunte al catálogo que estaba vigente cuando se emitió.

Este es el **patrón Odoo Pricelist** adaptado: versiones con ventanas de vigencia, una sola versión activa simultáneamente.

### 6.4 Estructura: Lista de Precios (cabecera)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `nombre` | string | Ej. "Tarifa Nacional 2024-Q3" |
| `version` | string | Ej. "2024-Q3" — identificador del período |
| `vigencia_inicio` | date | Desde cuándo aplica |
| `vigencia_fin` | date \| null | Hasta cuándo aplica (null = sin vencimiento) |
| `estado` | enum | `borrador` \| `activa` \| `archivada` |
| `creado_por` | string | Usuario ERP que la creó |
| `activada_en` | timestamp \| null | Cuándo fue activada (auditoría) |
| `notas` | text \| null | Observaciones internas |

### 6.5 Estructura: Ítem de Tarifa (TarifaItem — sub-entidad)

Los ítems pertenecen a su lista. No existen independientemente. No se comparten entre listas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `lista_precios_id` | uuid | FK → listas_precios |
| `origen` | string | Ciudad o zona de origen |
| `destino` | string | Ciudad o zona de destino |
| `tipo_vehiculo` | string | Debe coincidir con vocabulario TMS |
| `tipo_operacion` | enum | `urbana` \| `nacional` |
| `tarifa_base` | decimal | Valor en COP |
| `tipo_tarifa` | enum | `fijo` \| `por_km` \| `mixto` |
| `km_incluidos` | int \| null | Solo para `mixto` |
| `tarifa_km_adicional` | decimal \| null | Solo para `mixto` y `por_km` |
| `aplica_recargo_nocturno` | boolean | Habilita recargo configurable |
| `aplica_recargo_festivo` | boolean | Habilita recargo configurable |
| `empresa_cliente_id` | uuid \| null | Si es excepción específica para un cliente |

> **Sobre empresa_cliente_id en TarifaItem:** Implementa el concepto de excepción por cliente del patrón Oracle OTM. Si un ítem tiene empresa_cliente_id, tiene prioridad absoluta sobre los ítems generales para ese cliente en esa ruta/vehículo.

### 6.6 Prioridad de lookup (orden de evaluación)

Cuando el sistema debe sugerir una tarifa para una Cotización o Solicitud directa:

| Prioridad | Tipo | Condición |
|-----------|------|-----------|
| 1 | Excepción específica del cliente | TarifaItem.empresa_cliente_id = cliente + lista del convenio activo |
| 2 | Tarifa del Convenio (descuento aplicado) | TarifaItem general de la lista del convenio × (1 − convenio.descuento_pct) |
| 3 | Tarifa general de la lista activa | TarifaItem.empresa_cliente_id IS NULL, lista activa vigente |
| 4 | Sin tarifa sugerida | Comercial define manualmente en la Cotización |

### 6.7 Dueño del dato

**Gestión Comercial — Gerencia Comercial** es el único escritor de listas y tarifas.  
Ningún otro módulo puede modificar tarifas.

### 6.8 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear lista en borrador | `gerente_comercial` |
| Agregar/editar ítems (en borrador) | `gerente_comercial`, `ejecutivo_comercial` |
| Activar lista | `gerente_comercial` |
| Archivar lista | `gerente_comercial` |
| Consultar lista activa y precios | Todos los roles del ERP |
| Consultar listas archivadas | `gerente_comercial`, auditoría |

### 6.9 Estados de la Lista de Precios

```
[borrador] ──activar──► [activa] ──nueva versión activada──► [archivada]
    │
    └──eliminar──► (sin estado: eliminación física solo posible en borrador sin ítems usados)
```

| Estado | Descripción | Restricciones |
|--------|-------------|---------------|
| `borrador` | En construcción, no visible para cotizaciones | No se usa para sugerir tarifas |
| `activa` | Lista vigente, única en este estado | Solo una simultáneamente |
| `archivada` | Histórica, solo lectura | Las Cotizaciones y Solicitudes que la usaron mantienen la referencia |

**Regla de activación:** Activar una lista archiva automáticamente la anterior. La transición es atómica.

### 6.10 Eventos

| Evento | Disparador |
|--------|-----------|
| `LISTA_CREADA` | Nueva lista en borrador |
| `LISTA_ACTIVADA` | Activación (archiva la anterior) |
| `LISTA_ARCHIVADA` | Archivado manual o por activación de nueva |
| `TARIFA_ITEM_CREADO` | Nuevo ítem en lista en borrador |
| `TARIFA_ITEM_MODIFICADO` | Modificación de ítem en borrador |

### 6.11 Relaciones

- **1 Lista → N TarifaItem** (composición: items son parte de la lista)
- **N Listas ↔ N Convenios** (un convenio referencia la lista que aplica a ese cliente)
- **N Listas ↔ N Cotizaciones** (la cotización registra con qué lista sugirió la tarifa)

### 6.12 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración y consulta para Cotizaciones |
| Gestión Comercial — Convenios | Vincular lista al convenio |
| Facturación | Referencia histórica del precio facturado |

---

## 7. Entidad: Convenio Comercial

### 7.1 Propósito

Formaliza el acuerdo marco entre INLOP y un cliente recurrente. Define las condiciones económicas y operativas pactadas: qué lista de precios aplica, qué descuento obtiene, en qué plazo paga, y si puede operar directamente sin cotización.

### 7.2 Responsabilidad

Ser el contrato de referencia para clientes recurrentes. Su campo más determinante es `requiere_cotizacion`: define si el cliente puede emitir Solicitudes directamente o si debe pasar por el ciclo de cotización para cada nuevo servicio.

### 7.3 Regla de cobertura (patrón SAP TM — Agreement Coverage)

Un Convenio puede definir explícitamente qué rutas y tipos de vehículo cubre.  
Si se define cobertura, el sistema debe verificar que cada nueva Solicitud bajo el convenio esté dentro de la cobertura.  
Si no se define cobertura, el convenio aplica a cualquier ruta y vehículo.

### 7.4 Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `codigo_convenio` | string | Ej. "CONV-2024-0001" — generado automáticamente |
| `empresa_cliente_id` | uuid | FK → empresas_cliente |
| `lista_precios_id` | uuid | FK → listas_precios — lista que aplica a este cliente |
| `requiere_cotizacion` | **boolean** | **Campo clave**: false = cliente puede crear solicitudes directo |
| `descuento_pct` | decimal | Descuento sobre tarifa base (0–100) |
| `condiciones_pago` | string \| null | Ej. "30 días", "contado" |
| `vigencia_inicio` | date | Inicio de vigencia del convenio |
| `vigencia_fin` | date \| null | Fin de vigencia (null = indefinido) |
| `estado` | enum | Ver §7.6 |
| `cobertura` | jsonb \| null | Array de rutas/vehículos cubiertos (opcional) |
| `motivo_suspension` | text \| null | Obligatorio si se suspende |
| `motivo_cancelacion` | text \| null | Obligatorio si se cancela |
| `creado_por` | string | Usuario ERP |
| `aprobado_por` | string \| null | Quién autorizó el convenio |

### 7.5 Sobre `requiere_cotizacion`

| Valor | Significado | Flujo del cliente |
|-------|-------------|-------------------|
| `false` | Cliente recurrente de confianza. No necesita cotización. | Crea Solicitudes o Pedidos directamente. La tarifa se calcula automáticamente. |
| `true` | El cliente tiene convenio pero cada nuevo servicio requiere cotización explícita. | Debe tener una Cotización aprobada antes de crear la Solicitud. |

### 7.6 Estados del Convenio

```
[en_negociacion] ──aprobar──► [activo] ──vence (automático)──► [vencido]
                                  │
                                  ├── suspender ──► [suspendido] ──reactivar──► [activo]
                                  │
                                  └── cancelar ──► [cancelado]  ← terminal
```

| Estado | Efectos | Transiciones posibles |
|--------|---------|----------------------|
| `en_negociacion` | No aplica tarifas ni condiciones | → activo |
| `activo` | Aplica todas las condiciones | → vencido, suspendido, cancelado |
| `vencido` | Automático cuando vigencia_fin < hoy. Solicitudes existentes no se afectan. | No hay transición salida (crear nuevo convenio) |
| `suspendido` | Manual. Cliente tratado como sin convenio para nuevas solicitudes. | → activo (reactivar), → cancelado |
| `cancelado` | Terminal. No hay retorno. | — |

### 7.7 Efectos sobre cada flujo cuando el Convenio está activo

| Entidad | Sin convenio | Con convenio activo |
|---------|--------------|---------------------|
| Cotizaciones | Obligatorias | Opcionales (si `requiere_cotizacion=false`). La tarifa_sugerida se auto-llena con la lista del convenio + descuento. |
| Pedidos | No pueden referenciar convenio | Heredan: lista de precios, descuento, condiciones de pago |
| Solicitudes directas | Solo desde Portal | Desde Portal con tarifa calculada automáticamente por el sistema |
| Tarifas | Lista activa general, sin descuento | Lista del convenio, con descuento_pct aplicado |

### 7.8 Dueño del dato

**Gestión Comercial — Gerencia Comercial.** Es el único emisor y administrador de convenios.

### 7.9 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear convenio | `gerente_comercial` |
| Editar convenio en negociación | `gerente_comercial`, `ejecutivo_comercial` |
| Aprobar / Activar | `gerente_comercial` |
| Suspender | `gerente_comercial` |
| Reactivar | `gerente_comercial` |
| Cancelar | `gerente_comercial` |
| Consultar convenio activo | Todos los roles del ERP |
| Consultar histórico convenios | `gerente_comercial`, auditoría |

### 7.10 Eventos

| Evento | Disparador |
|--------|-----------|
| `CONVENIO_CREADO` | Alta en sistema |
| `CONVENIO_ACTIVADO` | Aprobación y activación |
| `CONVENIO_SUSPENDIDO` | Suspensión manual con motivo |
| `CONVENIO_REACTIVADO` | Reactivación desde suspendido |
| `CONVENIO_VENCIDO` | Automático cuando vigencia_fin < hoy |
| `CONVENIO_CANCELADO` | Cancelación manual con motivo |

### 7.11 Relaciones

- **N Convenios → 1 Cliente** (un cliente puede tener histórico de convenios, solo 1 activo)
- **N Convenios → 1 Lista de Precios** (qué lista aplica)
- **1 Convenio → N Pedidos** (pedidos bajo este convenio)
- **1 Convenio → N Solicitudes** (solicitudes que se crearon bajo este convenio)

### 7.12 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración |
| Portal Cliente | Verificar si puede crear solicitudes directo o requiere cotización |
| Facturación | Condiciones de pago del convenio |

---

## 8. Entidad: Cotización

### 8.1 Propósito

Representa la oferta económica formal que INLOP emite a un cliente para un servicio de transporte específico. Contiene el ciclo completo de negociación: desde la oferta inicial hasta la aprobación del cliente.

### 8.2 Responsabilidad

Ser el registro oficial del proceso de negociación comercial. Toda ronda de negociación, contraoferta y aprobación vive en la Cotización. Solo cuando el cliente aprueba, Comercial puede convertirla en Solicitud.

### 8.3 Cuándo se requiere una Cotización

| Tipo de cliente | Situación | ¿Requiere Cotización? |
|-----------------|-----------|----------------------|
| Nuevo (sin convenio) | Cualquier servicio | **Siempre** |
| Recurrente (convenio activo, requiere_cotizacion=false) | Ruta y vehículo dentro del convenio | No |
| Recurrente (convenio activo, requiere_cotizacion=false) | Ruta fuera de la cobertura del convenio | **Sí** |
| Recurrente (convenio activo, requiere_cotizacion=true) | Cualquier servicio | **Siempre** |
| Recurrente (convenio suspendido) | Cualquier servicio | **Siempre** |

### 8.4 Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `codigo_cotizacion` | string | Ej. "COT-2024-0001" — generado automáticamente |
| `empresa_cliente_id` | uuid | FK → empresas_cliente |
| `contacto_id` | uuid \| null | FK → contactos_comerciales — destinatario |
| `lista_precios_id` | uuid \| null | FK → listas_precios — lista usada para sugerir |
| `convenio_id` | uuid \| null | FK → convenios — si aplica convenio |
| `origen` | string | Ciudad de origen del servicio |
| `destino` | string | Ciudad de destino del servicio |
| `tipo_vehiculo` | string | Tipo de vehículo requerido |
| `tipo_operacion` | enum | `urbana` \| `nacional` |
| `fecha_requerida` | date \| null | Cuándo el cliente necesita el servicio |
| `tarifa_sugerida` | decimal \| null | Tarifa calculada desde lista (lectura) |
| `tarifa_ofertada` | decimal | Tarifa que INLOP ofrece al cliente (negociable) |
| `validez_hasta` | date | Fecha de vencimiento de la oferta |
| `estado` | enum | Ver §8.5 |
| `solicitud_generada_id` | uuid \| null | FK → solicitudes (se llena al convertir) |
| `rondas_negociacion` | int | Contador de rondas (auto) |
| `notas_comerciales` | text \| null | Notas internas de Comercial |
| `notas_cliente` | text \| null | Respuesta o comentario del cliente |
| `creado_por` | string | Usuario ERP |
| `aprobado_por` | string \| null | Quién ejecutó la conversión |
| `convertida_en` | timestamp \| null | Cuándo se convirtió |

### 8.5 Ciclo de vida

```
[borrador] ──enviar──► [enviada] ──contraoferta──► [en_negociacion] ──aceptar──► [aprobada] ──convertir──► [convertida]
              │                │                          │
              │                ├──────── rechazar ────────┴──────────────────────────────────────► [rechazada]
              │                │
              │                └──────── vencer (auto) ──────────────────────────────────────────► [vencida]
              │
              └────────────── aceptar sin cambios ──────────────────────────────────────────────► [aprobada]
```

| Estado | Descripción | Acciones disponibles |
|--------|-------------|---------------------|
| `borrador` | En construcción, no enviada al cliente | Editar, Eliminar, Enviar |
| `enviada` | Entregada al cliente, esperando respuesta | — (Comercial registra respuesta) |
| `en_negociacion` | Cliente contraofertó, en rondas | Actualizar tarifa_ofertada, Aprobar, Rechazar |
| `aprobada` | Cliente aceptó el precio ofertado | Convertir en Solicitud |
| `convertida` | Solicitud creada. Lock permanente. | Solo lectura |
| `rechazada` | Cliente rechazó definitivamente | Solo lectura |
| `vencida` | validez_hasta < hoy (automático) | Solo lectura |

### 8.6 Estado "convertida" — regla crítica

El estado `convertida` es un **lock permanente e irreversible**.

- No existe transición de retorno desde `convertida`.
- Si la Solicitud resultante se cancela operacionalmente, la Cotización **permanece** en `convertida`.
- La trazabilidad de la conversión nunca se borra.
- Si se necesita re-cotizar el mismo servicio, se crea una **Cotización nueva**.
- `solicitud_generada_id` registra qué Solicitud generó. Este campo no puede modificarse.

### 8.7 Conversión Cotización → Solicitud (transacción atómica)

La conversión es una operación atómica. O completa en su totalidad o no ocurre (rollback).

| Paso | Validación previa | Efecto |
|------|------------------|--------|
| 1 | `estado === "aprobada"` AND `validez_hasta >= hoy` | Si falla → error, no se crea nada |
| 2 | `empresa_cliente_id` válido, campos de ruta completos | INSERT solicitud con campos heredados |
| 3 | — | UPDATE cotización: `estado = "convertida"`, `solicitud_generada_id = nueva_solicitud.id`, `convertida_en = now()`, `aprobado_por = usuario_actual` |
| 4 | — | INSERT auditoría: actor, timestamp, cotizacion_id, solicitud_id |
| 5 | — | Nueva Solicitud aparece en módulo Solicitudes con `canal = "COTIZACION"` |

**Campos que se heredan de Cotización → Solicitud:**

| Campo Cotización | Campo Solicitud | Tipo de transferencia |
|-----------------|-----------------|----------------------|
| `empresa_cliente_id` | `empresa_cliente_id` | Copia FK |
| `tipo_operacion` | `tipo_operacion` | Copia |
| `tipo_vehiculo` | `tipo_vehiculo` | Copia |
| `origen` | `origen` | Copia |
| `destino` | `destino` | Copia |
| `fecha_requerida` | `fecha_requerida` | Copia |
| `tarifa_ofertada` | `tarifa_pactada` | **Snapshot inmutable** |
| `id` | `cotizacion_id` | FK trazabilidad |
| — | `estado` | Siempre "pendiente" (estado inicial) |
| — | `canal` | Siempre "COTIZACION" |
| `notas_comerciales` | — | No pasa (información interna de Comercial) |
| `validez_hasta` | — | No pasa (ya no aplica) |
| historial de negociación | — | No pasa (queda en Cotización) |

### 8.8 Dueño del dato

**Gestión Comercial** es el propietario. El equipo comercial crea, negocia y convierte cotizaciones.

### 8.9 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear cotización | `ejecutivo_comercial`, `gerente_comercial` |
| Editar (en borrador) | `ejecutivo_comercial`, `gerente_comercial` |
| Enviar al cliente | `ejecutivo_comercial`, `gerente_comercial` |
| Registrar respuesta/negociar | `ejecutivo_comercial`, `gerente_comercial` |
| Aprobar (registrar aprobación del cliente) | `ejecutivo_comercial`, `gerente_comercial` |
| Rechazar | `ejecutivo_comercial`, `gerente_comercial` |
| Convertir en Solicitud | `ejecutivo_comercial`, `gerente_comercial` |
| Consultar cotizaciones propias | `ejecutivo_comercial` |
| Consultar todas | `gerente_comercial` |

### 8.10 Eventos

| Evento | Disparador |
|--------|-----------|
| `COTIZACION_CREADA` | Alta en sistema |
| `COTIZACION_ENVIADA` | Cambio a estado enviada |
| `COTIZACION_CONTRAOFERTADA` | Nueva ronda de negociación (tarifa_ofertada cambia) |
| `COTIZACION_APROBADA` | Cliente acepta la oferta |
| `COTIZACION_RECHAZADA` | Cliente rechaza definitivamente |
| `COTIZACION_VENCIDA` | Automático: validez_hasta < hoy |
| `COTIZACION_CONVERTIDA` | Conversión exitosa a Solicitud |

### 8.11 Relaciones

- **N Cotizaciones → 1 Cliente**
- **N Cotizaciones → 0..1 Lista de Precios** (usada para sugerir tarifa)
- **N Cotizaciones → 0..1 Convenio** (si cliente tiene convenio)
- **1 Cotización → 0..1 Solicitud** (exactamente una, al convertir)
- **N Cotizaciones → 0..1 Contacto Comercial** (destinatario)

### 8.12 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración completa |
| Solicitudes | Trazabilidad: saber si la solicitud vino de una cotización |
| Facturación | Referencia del precio pactado |

---

## 9. Entidad: Pedido

### 9.1 Propósito

Agrupa N Solicitudes de un cliente para un conjunto de servicios planificados como un lote. Permite a INLOP y al cliente acordar un volumen de viajes y hacer seguimiento a la ejecución de ese volumen.

### 9.2 Responsabilidad

Ser el coordinador de N viajes para un mismo cliente. No replica la información de las Solicitudes — solo registra cuántas se planificaron y cuántas se materializaron.

### 9.3 Cuándo se usa un Pedido

- El cliente solicita múltiples viajes para un período (ej. "necesito 20 camiones este mes")
- INLOP quiere agrupar solicitudes relacionadas para facturación conjunta
- El convenio con el cliente prevé órdenes de servicio en lote
- Una Cotización aprobada cubre múltiples viajes (la Cotización genera el Pedido; el Pedido genera las N Solicitudes)

### 9.4 Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `codigo_pedido` | string | Ej. "PED-2024-0001" — generado automáticamente |
| `empresa_cliente_id` | uuid | FK → empresas_cliente |
| `convenio_id` | uuid \| null | FK → convenios — si aplica |
| `cotizacion_id` | uuid \| null | FK → cotizaciones — si originó desde una cotización |
| `solicitudes_planeadas` | int | Cantidad de viajes acordados con el cliente |
| `solicitudes_creadas` | int | Contador auto-incrementado al crear cada Solicitud |
| `solicitudes_canceladas` | int | Contador de Solicitudes canceladas bajo este Pedido |
| `estado` | enum | Ver §9.5 |
| `descripcion` | text \| null | Descripción general del pedido |
| `fecha_inicio_estimada` | date \| null | Cuándo se espera iniciar los primeros viajes |
| `fecha_fin_estimada` | date \| null | Cuándo se espera completar todos los viajes |
| `motivo_cancelacion` | text \| null | Obligatorio si se cancela |
| `motivo_extension` | text \| null | Obligatorio si se extiende solicitudes_planeadas |
| `creado_por` | string | Usuario ERP |
| `cerrado_en` | timestamp \| null | Cuándo se completó o canceló |

### 9.5 Ciclo de vida del Pedido

```
[abierto] ──primera Solicitud creada──► [en_proceso] ──creadas == planeadas (auto)──► [completado]
    │                                        │
    └── cancelar (manual) ──────────────────┴─────────────────────────────────────► [cancelado]
```

| Estado | Disparador | Descripción |
|--------|-----------|-------------|
| `abierto` | Creación del Pedido | Sin Solicitudes creadas aún |
| `en_proceso` | Primera Solicitud creada bajo el Pedido | En ejecución parcial |
| `completado` | `solicitudes_creadas === solicitudes_planeadas` (automático) | Todas las solicitudes emitidas |
| `cancelado` | Cancelación manual con motivo | Solicitudes existentes mantienen su propio ciclo |

### 9.6 KPIs del Pedido

| KPI | Fórmula | Tipo |
|-----|---------|------|
| `solicitudes_planeadas` | Definido al crear (extensible) | Campo |
| `solicitudes_creadas` | Contador auto | Campo |
| `solicitudes_canceladas` | Contador auto | Campo |
| `solicitudes_pendientes` | `planeadas − creadas` | Derivado |
| `solicitudes_ejecutadas` | `COUNT(Solicitudes con estado IN [en_ruta, completado])` | Derivado (query) |
| `progreso_pct` | `creadas / planeadas × 100` | Derivado |

### 9.7 Reglas de cierre

| Situación | Acción | Estado resultante |
|-----------|--------|-------------------|
| `solicitudes_creadas === solicitudes_planeadas` | Cierre automático (backend) | `completado` |
| Comercial cancela el Pedido | Requiere `motivo_cancelacion` | `cancelado` |
| Cliente pide más viajes de los planeados | Extender `solicitudes_planeadas` con `motivo_extension` | Permanece `en_proceso` |
| Cancelar el Pedido | No cancela las Solicitudes hijas | Solicitudes mantienen su ciclo propio |

### 9.8 Solicitudes con y sin fecha

Un Pedido puede contener Solicitudes con o sin `fecha_requerida`:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| Con fecha | El cliente especificó cuándo necesita el viaje | "camión el 15 de julio" |
| Sin fecha | El cliente los agrupa pero aún no tiene fechas | "me entregarán las fechas conforme avancen" |

Ambos tipos son válidos. La fecha es opcional en la Solicitud; el Pedido no la impone.

### 9.9 Dueño del dato

**Gestión Comercial** es el propietario. Los Pedidos los crea y gestiona el área comercial.

### 9.10 Roles

| Acción | Rol requerido |
|--------|--------------|
| Crear Pedido | `ejecutivo_comercial`, `gerente_comercial` |
| Agregar Solicitud al Pedido | `ejecutivo_comercial`, `gerente_comercial`, `coordinador_operaciones` |
| Cancelar Pedido | `gerente_comercial` |
| Extender solicitudes_planeadas | `gerente_comercial` |
| Consultar Pedidos del cliente | `ejecutivo_comercial`, `gerente_comercial` |
| Consultar todos los Pedidos | `gerente_comercial` |
| Ver Pedido vinculado a una Solicitud | Todos los roles ERP |

### 9.11 Eventos

| Evento | Disparador |
|--------|-----------|
| `PEDIDO_CREADO` | Alta en sistema |
| `PEDIDO_SOLICITUD_AGREGADA` | Cada vez que se crea una Solicitud bajo el Pedido |
| `PEDIDO_SOLICITUD_CANCELADA` | Una Solicitud bajo el Pedido se cancela |
| `PEDIDO_COMPLETADO` | Automático cuando creadas == planeadas |
| `PEDIDO_EXTENDIDO` | solicitudes_planeadas aumenta con motivo |
| `PEDIDO_CANCELADO` | Cancelación manual con motivo |

### 9.12 Relaciones

- **N Pedidos → 1 Cliente**
- **N Pedidos → 0..1 Convenio**
- **N Pedidos → 0..1 Cotización** (si el Pedido originó desde una cotización multi-viaje)
- **1 Pedido → N Solicitudes** (cada una = 1 viaje)

### 9.13 Módulos consumidores

| Módulo | Uso |
|--------|-----|
| Gestión Comercial | Administración completa |
| Solicitudes | Ver pedido vinculado a cada solicitud |
| Facturación | Facturar el Pedido completo o por Solicitudes |

---

## 10. Entidad Compartida: Solicitud

La Solicitud **no pertenece al dominio Gestión Comercial**.  
Es una entidad compartida del ERP, administrada por distintos módulos en distintos momentos.  
Gestión Comercial la **origina** pero no posee su ciclo de vida operacional.

### 10.1 Estado actual

La entidad Solicitud ya está en producción con los siguientes campos:

| Campo | Tipo | Estado |
|-------|------|--------|
| `id` | uuid | Existente |
| `codigo_solicitud` | string | Existente |
| `external_ref` | string \| null | Existente |
| `canal` | string | Existente |
| `creado_en` | timestamp | Existente |
| `creado_por` | uuid \| null | Existente |
| `empresa_cliente_id` | uuid \| null | Existente |
| `agencia_id` | uuid \| null | Existente |
| `agencia_nombre` | string \| null | Existente |
| `controlt_trip_number` | string \| null | Existente |
| `solicitante` | string \| null | Existente |
| `tipo_vehiculo` | string | Existente |
| `tipo_operacion` | enum | Existente |
| `origen` | string | Existente |
| `destino` | string | Existente |
| `fecha_requerida` | string | Existente |
| `estado` | enum | Existente |
| conductor/vehículo | varios | Existente (en SolicitudDetalle) |
| historial | array | Existente |

### 10.2 Nuevos campos aportados por Gestión Comercial

Gestión Comercial aporta tres campos nuevos a la Solicitud. Son additive — nulos por defecto — y no rompen las Solicitudes existentes.

| Campo | Tipo | Descripción | Propietario |
|-------|------|-------------|-------------|
| `pedido_id` | uuid \| null | FK → pedidos | Gestión Comercial |
| `cotizacion_id` | uuid \| null | FK → cotizaciones | Gestión Comercial |
| `tarifa_pactada` | decimal \| null | Snapshot inmutable del precio acordado | Gestión Comercial |

> **Sobre tarifa_pactada:** Es el único campo duplicado justificado del sistema. El precio acordado en una Cotización o Convenio debe quedar congelado en el momento en que se crea la Solicitud. Si la Lista de Precios cambia después, el precio de esta Solicitud no debe cambiar. No es una FK a TarifaItem porque TarifaItem podría modificarse o archivarse. Es una copia inmutable del valor numérico en el momento del acuerdo.

### 10.3 Valores de `canal` que crea Gestión Comercial

Los valores existentes de `canal` se preservan. Gestión Comercial agrega:

| Valor | Origen |
|-------|--------|
| `APP` | Portal Cliente (ya existe) |
| `ERP` | Creación directa por ejecutivo en el ERP (ya existe) |
| `COTIZACION` | Conversión desde una Cotización aprobada (nuevo) |
| `PEDIDO` | Creación bajo un Pedido sin cotización previa (nuevo) |
| `API` | Canal futuro |

### 10.4 Ciclo de vida de Solicitud — sin cambios

El ciclo de vida de la Solicitud no cambia. Se preserva exactamente como existe hoy:

```
[pendiente] ──aprobado──► [aprobado] ──en_ruta──► [en_ruta] ──completado──► [completado]
     │                        │                       │
     └────────────────────── cancelar ────────────────┘─────────────────────► [cancelado]
```

### 10.5 Compatibilidad con Solicitudes existentes

Las Solicitudes creadas antes de la implementación de Gestión Comercial:
- Tendrán `pedido_id = null` y `cotizacion_id = null` — válido.
- Tendrán `tarifa_pactada = null` — válido.
- No requieren migración.
- Continúan funcionando exactamente igual.

---

## 11. Cadena de Negocio Completa

### 11.1 Flujo: Cliente recurrente sin cotización

```
CLIENTE (convenio activo, requiere_cotizacion=false)
    │
    ├── Opción A: Solicitud directa
    │       └── Canal APP o ERP → Solicitud (tarifa calculada desde convenio)
    │
    └── Opción B: Pedido de N viajes
            ├── Comercial crea Pedido (con convenio_id)
            ├── Por cada viaje: crea Solicitud con pedido_id
            └── Cuando solicitudes_creadas == planeadas → Pedido: completado
                        │
                        ▼
              Programación → Viajes → Monitoreo → Cumplidos → Facturación → Cartera
```

### 11.2 Flujo: Cliente nuevo o servicio fuera de convenio

```
CLIENTE (sin convenio, o con requiere_cotizacion=true)
    │
    └── Comercial crea Cotización
            ├── Sistema sugiere tarifa (lookup por prioridad)
            ├── Comercial define tarifa_ofertada
            ├── Cotización → enviada → negociación → aprobada
            └── Comercial ejecuta "Convertir en Solicitud" (atómico)
                    ├── Solicitud creada (canal: COTIZACION, tarifa_pactada: snapshot)
                    └── Cotización: estado = convertida (lock permanente)
                                │
                                ▼
                      Programación → Viajes → Monitoreo → Cumplidos → Facturación → Cartera
```

### 11.3 Flujo: Cotización para múltiples viajes

```
CLIENTE solicita N viajes
    │
    └── Comercial crea Cotización (por el lote) → aprobada
            └── Comercial ejecuta "Convertir en Pedido"
                    ├── Pedido creado (con cotizacion_id)
                    ├── Por cada viaje: Solicitud creada (pedido_id + cotizacion_id + tarifa_pactada)
                    └── Cuando todas creadas → Pedido: completado
```

### 11.4 Cadena de trazabilidad completa

Cualquier registro del sistema puede trazarse hasta su origen:

```
Solicitud
  │── cotizacion_id ──► Cotización
  │                         │── empresa_cliente_id ──► Cliente
  │                         │── lista_precios_id ──────► Lista de Precios
  │                         └── convenio_id ────────────► Convenio
  │── pedido_id ──────► Pedido
  │                         │── empresa_cliente_id ──► Cliente
  │                         └── convenio_id ────────────► Convenio
  └── empresa_cliente_id ──► Cliente
```

---

## 12. Reglas de Negocio

### RN-01: Una Solicitud = un viaje

Una Solicitud representa exactamente un viaje. No puede representar múltiples viajes, rutas parciales ni servicios compuestos.

### RN-02: Un Pedido puede generar múltiples Solicitudes

Un Pedido contiene N Solicitudes. Cada Solicitud es un viaje independiente. Cada una consume exactamente una unidad del Pedido (`solicitudes_planeadas`).

### RN-03: Una Cotización genera exactamente una Solicitud

La conversión de Cotización produce exactamente una Solicitud. Si se necesitan N Solicitudes de la misma cotización, el flujo correcto es: Cotización → Pedido → N Solicitudes.

### RN-04: El estado "convertida" en Cotización es permanente

No existe transición de retorno desde el estado `convertida`. Si la Solicitud resultante se cancela, la Cotización permanece `convertida`. Para re-cotizar, se crea una Cotización nueva.

### RN-05: tarifa_pactada es inmutable

Una vez escrita en la Solicitud, `tarifa_pactada` no puede modificarse. Representa el precio acordado en el momento del contrato.

### RN-06: Solo una Lista de Precios activa simultáneamente

El sistema no puede tener dos Listas en estado `activa` al mismo tiempo. Activar una nueva lista archiva automáticamente la anterior en una sola transacción atómica.

### RN-07: Cancelar un Pedido no cancela sus Solicitudes

Las Solicitudes hijas de un Pedido cancelado mantienen su propio ciclo de vida. No se cancelan automáticamente. La coordinación de cada viaje es responsabilidad de Operaciones.

### RN-08: Solicitudes existentes son compatibles sin migración

Las Solicitudes creadas antes del módulo Gestión Comercial son válidas con `pedido_id = null`, `cotizacion_id = null`, `tarifa_pactada = null`. No requieren migración retroactiva.

### RN-09: El Convenio es del cliente, no de la agencia

Un Convenio se firma con la empresa cliente (`empresa_cliente_id`). Las agencias individuales del cliente heredan las condiciones del convenio. No existen convenios por agencia.

### RN-10: Cotizaciones vencidas no son reactivas

Una Cotización con `validez_hasta < hoy` pasa automáticamente a `vencida`. No existe mecanismo de reactivación extendiendo la fecha. Se crea una nueva Cotización.

### RN-11: El Convenio suspendido equivale a sin convenio para nuevas solicitudes

Mientras un Convenio esté en estado `suspendido`, el cliente es tratado como si no tuviera convenio. Se requiere Cotización para cualquier nuevo servicio.

### RN-12: La conversión Cotización → Solicitud es atómica

O ambas operaciones (crear Solicitud + marcar Cotización como convertida) ocurren juntas, o no ocurre ninguna. No existe estado intermedio.

---

## 13. Eventos del Dominio

Todos los cambios de estado en entidades del dominio Gestión Comercial deben emitir un evento de auditoría con estructura uniforme.

### 13.1 Estructura del evento de auditoría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `entidad` | string | Tipo: `cotizacion` \| `pedido` \| `convenio` \| `lista_precios` \| `cliente` |
| `entidad_id` | uuid | ID de la entidad afectada |
| `campo` | string \| null | Campo que cambió (null si es creación) |
| `valor_anterior` | jsonb \| null | Valor antes del cambio |
| `valor_nuevo` | jsonb \| null | Valor después del cambio |
| `actor` | uuid | ID del usuario ERP que ejecutó la acción |
| `origen` | enum | `erp` \| `sistema` (cambios automáticos) |
| `timestamp` | timestamp | ISO 8601 UTC |
| `motivo` | text \| null | Obligatorio en rechazos y cancelaciones |

### 13.2 Catálogo completo de eventos

| Evento | Entidad | Disparador |
|--------|---------|-----------|
| `CLIENTE_CREADO` | Cliente | Alta |
| `CLIENTE_ACTUALIZADO` | Cliente | Modificación |
| `CLIENTE_DESACTIVADO` | Cliente | Estado inactivo |
| `CONTACTO_CREADO` | ContactoComercial | Alta |
| `CONTACTO_ACTUALIZADO` | ContactoComercial | Modificación |
| `CONTACTO_DESACTIVADO` | ContactoComercial | Baja |
| `LISTA_CREADA` | ListaPrecios | Alta |
| `LISTA_ACTIVADA` | ListaPrecios | Activación |
| `LISTA_ARCHIVADA` | ListaPrecios | Archivado |
| `CONVENIO_CREADO` | ConvenioComercial | Alta |
| `CONVENIO_ACTIVADO` | ConvenioComercial | Aprobación |
| `CONVENIO_SUSPENDIDO` | ConvenioComercial | Suspensión manual |
| `CONVENIO_REACTIVADO` | ConvenioComercial | Reactivación |
| `CONVENIO_VENCIDO` | ConvenioComercial | Automático (vigencia_fin < hoy) |
| `CONVENIO_CANCELADO` | ConvenioComercial | Cancelación definitiva |
| `COTIZACION_CREADA` | Cotización | Alta |
| `COTIZACION_ENVIADA` | Cotización | Envío al cliente |
| `COTIZACION_CONTRAOFERTADA` | Cotización | Nueva ronda negociación |
| `COTIZACION_APROBADA` | Cotización | Cliente acepta |
| `COTIZACION_RECHAZADA` | Cotización | Cliente rechaza |
| `COTIZACION_VENCIDA` | Cotización | Automático |
| `COTIZACION_CONVERTIDA` | Cotización | Conversión exitosa → Solicitud |
| `PEDIDO_CREADO` | Pedido | Alta |
| `PEDIDO_SOLICITUD_AGREGADA` | Pedido | Solicitud creada bajo Pedido |
| `PEDIDO_SOLICITUD_CANCELADA` | Pedido | Solicitud bajo Pedido cancelada |
| `PEDIDO_COMPLETADO` | Pedido | Automático (creadas == planeadas) |
| `PEDIDO_EXTENDIDO` | Pedido | planeadas aumentado con motivo |
| `PEDIDO_CANCELADO` | Pedido | Cancelación manual |

---

## 14. Entidades Evaluadas y Descartadas

Durante el análisis, se identificaron entidades adicionales presentes en ERP/TMS modernos. Cada una fue evaluada antes de decidir si incorporarla.

### 14.1 Línea de Crédito

**Qué es:** Entidad separada que registra el límite de crédito aprobado para un cliente, el saldo utilizado y el disponible.

**Qué problema resuelve:** Evitar que un cliente con deudas vencidas pueda solicitar más servicios. Bloquea nuevas solicitudes si se supera el límite.

**Evaluación INLOP:** Los campos `credito_habilitado` y `dias_credito` en Cliente son suficientes para la fase actual. Una entidad separada de Línea de Crédito requiere integración con Cartera para calcular el saldo en tiempo real.

**Decisión:** **Diferido.** No se implementa en esta versión. Se retoma cuando Facturación y Cartera estén activos y la necesidad de bloqueo automático por crédito sea operativa.

### 14.2 Contrato Marco

**Qué es:** Documento legal formal que ampara múltiples Convenios o Pedidos. Es el padre contractual de los Convenios.

**Qué problema resuelve:** En empresas con múltiples convenios activos por segmento o región, el Contrato Marco los agrupa.

**Evaluación INLOP:** El Convenio Comercial ya cumple esta función para la escala actual de INLOP. Un cliente tiene un Convenio activo a la vez. No hay múltiples segmentos ni regiones que requieran contratos separados bajo un marco.

**Decisión:** **Descartado** para la escala actual. Si INLOP crece a múltiples regiones o estructuras tarifarias paralelas, se retoma.

### 14.3 Zona Comercial / Región

**Qué es:** División geográfica o comercial que agrupa clientes bajo un mismo ejecutivo o política tarifaria.

**Qué problema resuelve:** Asignación de ejecutivos comerciales por zona, reportes por región.

**Evaluación INLOP:** El campo `sector` en Cliente y el reporte por `ciudad_principal` resuelven la necesidad actual. Una entidad Zona requeriría mantenimiento de la estructura geográfica y asignación automática de ejecutivos.

**Decisión:** **Diferido.** Se implementa si INLOP estructura su fuerza de ventas por zonas geográficas formales.

### 14.4 Oportunidad de Venta / Pipeline Comercial

**Qué es:** Entidad que representa una oportunidad de negocio antes de que exista una Cotización. Es el CRM clásico.

**Qué problema resuelve:** Trazabilidad de prospectos, seguimiento de ciclo de ventas, predicciones de ingreso.

**Evaluación INLOP:** INLOP es un operador de transporte, no una empresa de ventas complejas. El ciclo comercial comienza cuando ya hay un cliente identificado y un servicio concreto a cotizar. El prospecting y pipeline de ventas están fuera del alcance actual del ERP.

**Decisión:** **Fuera de alcance.** El ERP de INLOP no es un CRM. Si se necesita pipeline comercial, se integra un CRM especializado.

---

## 15. Benchmark ERP/TMS

El análisis comparativo tuvo un solo objetivo: identificar **patrones arquitectónicos** aplicables al ERP INLOP. No se analizan interfaces, modelos de datos específicos ni terminología.

### 15.1 SAP Transportation Management (TM)

**Entidades equivalentes:** Transportation Agreement → Rate Table → Freight Order

**Patrón 1: Agreement Coverage** ✓ Adoptado

SAP TM define dentro de un Transportation Agreement qué rutas, vehículos y ventanas de tiempo cubre el acuerdo. Una orden fuera de esa cobertura no puede ampararse en el acuerdo.

INLOP adopta: el campo `cobertura` en Convenio Comercial (opcional). Cuando se define, el sistema verifica que cada Solicitud bajo el convenio esté dentro de la cobertura.

**Patrón 2: Rate Master completo** ✗ Rechazado

SAP TM tiene un Rate Master con: charge types (flete, combustible, seguro), base conditions, surcharges por evento (demora, maniobra), y rate tables para carrier tendering (negociar con terceros).

INLOP rechaza: el Rate Master está diseñado para operadores que tercerizan el transporte a múltiples carriers. INLOP opera su propia flota. La complejidad de un Rate Master con charge types es innecesaria. La estructura `tarifa_base` + `tipo_tarifa` (fijo/por_km/mixto) + `aplica_recargo_*` es suficiente.

**Patrón 3: Versioned Rate Tables** ✓ Adoptado parcialmente

SAP mantiene versiones de Rate Tables con fechas de vigencia. Cuando una nueva tabla entra en vigor, la anterior no desaparece; las órdenes existentes mantienen su referencia histórica.

INLOP adopta: el versionado de Lista de Precios con vigencia_inicio/vigencia_fin y el modelo de archivado (no borrado).

---

### 15.2 Oracle Transportation Management (OTM)

**Entidades equivalentes:** Rate Record + Condition Base Sets

**Patrón 1: Rate Lookup Priority Hierarchy** ✓ Adoptado

OTM evalúa tarifas en orden de especificidad: Rate Record específico para el transportista y cliente > Rate Record por contrato > Rate Record general > Rate sin contrato.

INLOP adopta: la jerarquía de prioridad de tarifas definida en §6.6 (excepción cliente > convenio con descuento > lista activa general > manual).

**Patrón 2: Condition Base Sets** ✗ Rechazado

OTM permite definir Condition Bases (conjuntos de condiciones lógicas) que determinan cuándo aplica un Rate Record. Una condición puede ser: "si el peso > 5000 kg", "si la ruta cruza zona X", "si es festivo". Los conjuntos pueden anidarse.

INLOP rechaza: la complejidad de Condition Bases está diseñada para tarifas de mercado donde las variables son muchas y cambiantes. INLOP conoce sus tarifas de antemano; los pocos casos de variación (nocturno, festivo) se manejan con los flags booleanos `aplica_recargo_*` en TarifaItem.

---

### 15.3 Microsoft Dynamics 365 (D365)

**Entidades equivalentes:** Sales Quotation → Sales Order

**Patrón 1: Conversión atómica con lock** ✓ Adoptado

D365 convierte una Sales Quotation en Sales Order mediante una acción explícita. La Quotation queda en estado "closed/won" y no puede re-convertirse. La Order hereda los precios tal como fueron en la Quotation (snapshot).

INLOP adopta completamente: la conversión atómica Cotización → Solicitud, el estado "convertida" como lock permanente, y el snapshot de precio en `tarifa_pactada`.

**Patrón 2: Multi-moneda y multi-compañía** ✗ Rechazado

D365 soporta múltiples monedas, tipos de cambio, y compañías separadas dentro de la misma instancia.

INLOP rechaza: INLOP opera en COP en Colombia. La complejidad de multi-moneda y multi-empresa no aporta ningún valor y sería pura deuda técnica.

**Patrón 3: Quote line → Order line** ✗ Rechazado

D365 mantiene las líneas de la cotización en la orden, permitiendo modificar ítems después de convertir.

INLOP rechaza: una Solicitud = un viaje. No hay "líneas". La herencia de campos es plana (origen, destino, vehículo) y el precio queda en un solo campo (`tarifa_pactada`). No se necesita el concepto de línea.

---

### 15.4 Odoo

**Entidades equivalentes:** Pricelist + Sale Quotation + Purchase Order

**Patrón 1: Pricelist versionada con ventanas de vigencia** ✓ Adoptado

Odoo mantiene Pricelists con fecha de inicio y fin. Al crear una Quotation, el sistema aplica la Pricelist vigente en esa fecha. Pricelists anteriores se conservan (no se borran) para trazabilidad histórica.

INLOP adopta: el modelo de Lista de Precios con `vigencia_inicio`/`vigencia_fin`, estados (borrador/activa/archivada) y la regla de que las Cotizaciones y Solicitudes existentes mantienen referencia a la lista que usaron.

**Patrón 2: Pricelists múltiples por segmento de cliente** ✗ Rechazado

Odoo permite asignar Pricelists distintas a distintos segmentos de clientes de forma simultánea (uno puede tener "Pricelist Premium", otro "Pricelist Standard", otro "Pricelist Export").

INLOP rechaza: el Convenio Comercial ya maneja la diferenciación por cliente mediante `descuento_pct` sobre la lista general. Tener múltiples listas activas simultáneas para distintos segmentos introduce complejidad de mantenimiento sin beneficio: cuando el precio base de una ruta cambia, habría que actualizar N listas. Con el modelo de INLOP (1 lista activa + descuento en convenio), el cambio de precio se hace una sola vez.

**Patrón 3: Item sequence priority** ✓ Adoptado parcialmente

Odoo usa un número de secuencia en cada ítem de Pricelist para determinar qué regla aplica cuando múltiples reglas coinciden.

INLOP adopta el concepto (la jerarquía de lookup) pero no el número de secuencia arbitrario. La prioridad está determinada por la especificidad: excepción-cliente > convenio > general. No se necesita un campo de secuencia manual.

---

### 15.5 Síntesis: modelo híbrido adoptado por INLOP

| Fuente | Patrón | Aplicación en INLOP |
|--------|--------|---------------------|
| Odoo | Pricelist versionada con vigencias | Lista de Precios: versiones, archivado, referencia histórica |
| D365 | Conversión atómica + lock + snapshot | Cotización → Solicitud: atómica, convertida irrev., tarifa_pactada |
| SAP TM | Agreement Coverage | Convenio: cobertura opcional de rutas y vehículos |
| Oracle OTM | Rate lookup priority hierarchy | Lookup de tarifa: excepción > convenio > general > manual |

**Complejidad rechazada de todos:**
- Rate Master de SAP (para 3PL con múltiples carriers)
- Condition Bases de OTM (para tarifas de mercado variable)
- Multi-moneda de D365 (fuera de scope Colombia/COP)
- Pricelists múltiples de Odoo (el Convenio ya maneja la diferenciación)

---

## 16. Tabla de Decisiones Arquitectónicas

| ID | Decisión | Opción adoptada | Opción descartada | Motivo |
|----|----------|----------------|-------------------|--------|
| DA-01 | Cotización → cuántas Solicitudes | 1 Cotización → 1 Solicitud. Para N viajes: Pedido. | 1 Cotización → N Solicitudes directas | Una Solicitud = un viaje es regla de negocio declarada. El Pedido es el coordinador de N viajes. |
| DA-02 | Precio en Solicitud | Snapshot inmutable (`tarifa_pactada`) | FK a TarifaItem (dinámico) | El precio acordado es un contrato. No cambia si la lista cambia después. |
| DA-03 | Diferenciación de precio por cliente | 1 lista activa + descuento en Convenio + excepción por cliente en TarifaItem | Múltiples listas activas por segmento | Cambio de precio en un solo lugar. Menor complejidad de mantenimiento. |
| DA-04 | Cotización vencida | Estado terminal. No se reactiva. Nueva Cotización. | Permitir extender validez_hasta | La integridad de auditoría requiere que el historial de vigencia sea inmutable. |
| DA-05 | Solicitudes sin origen comercial | Válidas con pedido_id=null y cotizacion_id=null | Forzar migración retroactiva | Compatibilidad. Las Solicitudes del Portal nunca pasarán por Cotización. |
| DA-06 | Contacto Comercial vs usuarios_cliente | Entidades separadas con vínculo opcional | Reusar usuarios_cliente para contactos comerciales | Propósitos distintos: portal vs. relación comercial. No deben acoplarse. |
| DA-07 | Cobertura del Convenio | Campo `cobertura` opcional en Convenio | Entidad separada de cobertura | La cobertura es un atributo del convenio, no una entidad independiente. Solo si INLOP la necesita. |
| DA-08 | Pedido cancelado | No cancela sus Solicitudes | Cancelación en cascada | Operaciones ya tiene la Solicitud en proceso. La cancelación es decisión de Operaciones, no Comercial. |
| DA-09 | Convenio suspendido | Cliente tratado como sin convenio para nuevas solicitudes | Bloqueo total (no puede ni crear Solicitudes desde portal) | Las Solicitudes operativas no deben bloquearse por una suspensión comercial. |
| DA-10 | `convenio_activo_id` en Cliente | Desnormalización controlada (read-only, mantenida por backend) | JOIN en cada consulta | Evita JOIN costoso en la consulta de Solicitudes más frecuente. Riesgo controlado: solo el backend la actualiza. |

---

## 17. Nuevos Campos en Entidades Existentes

Este documento define los siguientes cambios a entidades ya existentes en Supabase. Son todos **aditivos** (nuevas columnas, sin eliminar existentes) y **retrocompatibles** (columnas nullables por defecto).

### 17.1 Tabla `empresas_cliente`

| Campo nuevo | Tipo | Nullable | Default |
|-------------|------|----------|---------|
| `nit` | varchar | sí | null |
| `tipo_cliente` | varchar | sí | 'nuevo' |
| `sector` | varchar | sí | null |
| `ciudad_principal` | varchar | sí | null |
| `canal_preferido` | varchar | sí | 'APP' |
| `credito_habilitado` | boolean | sí | false |
| `dias_credito` | int | sí | null |
| `notas_comerciales` | text | sí | null |
| `convenio_activo_id` | uuid | sí | null |

### 17.2 Tabla `solicitudes`

| Campo nuevo | Tipo | Nullable | Default |
|-------------|------|----------|---------|
| `pedido_id` | uuid | sí | null |
| `cotizacion_id` | uuid | sí | null |
| `tarifa_pactada` | decimal(12,2) | sí | null |

### 17.3 Nuevas tablas requeridas

| Tabla | Corresponde a |
|-------|--------------|
| `contactos_comerciales` | §5 Contacto Comercial |
| `listas_precios` | §6 Lista de Precios (cabecera) |
| `tarifas_items` | §6 TarifaItem (sub-entidad) |
| `convenios_comerciales` | §7 Convenio Comercial |
| `cotizaciones` | §8 Cotización |
| `pedidos` | §9 Pedido |
| `auditoria_comercial` | §13 Eventos del dominio |

---

## Apéndice A: Módulos planificados en Navigation Engine

El Navigation Engine ya tiene definidos los ModuloId futuros relevantes para Gestión Comercial:

| ModuloId | Estado actual | Corresponde a |
|----------|--------------|---------------|
| `clientes` | Planificado | Módulo administración de Clientes |
| `facturacion` | Planificado | Módulo Facturación |
| `conductores` | Planificado | Módulo Conductores (fuera del dominio Comercial) |

Los módulos de Gestión Comercial (Cotizaciones, Pedidos, Lista de Precios, Convenios) deberán agregarse al Navigation Engine como nuevos ModuloId cuando se implementen.

---

## Apéndice B: Glosario

| Término | Definición en el contexto de INLOP |
|---------|-------------------------------------|
| **Canal** | Origen de la Solicitud: APP, ERP, COTIZACION, PEDIDO, API |
| **Cobertura** | Conjunto de rutas y tipos de vehículo cubiertos por un Convenio |
| **Convertida** | Estado terminal de Cotización que indica que fue convertida en Solicitud |
| **Snapshot** | Copia inmutable del valor de un campo en un momento específico |
| **TarifaItem** | Ítem de una Lista de Precios: tarifa para una ruta/vehículo/período específico |
| **Versión** | Instancia temporal de una Lista de Precios con vigencia definida |
| **requiere_cotizacion** | Boolean en Convenio que determina si el cliente puede crear Solicitudes directamente |
| **tarifa_pactada** | Snapshot del precio acordado en el momento de crear la Solicitud. Inmutable. |
| **Lock** | Estado terminal que impide modificaciones futuras (ej: "convertida" en Cotización) |
| **Atómico** | Operación que ocurre completa o no ocurre. Sin estados intermedios. |
