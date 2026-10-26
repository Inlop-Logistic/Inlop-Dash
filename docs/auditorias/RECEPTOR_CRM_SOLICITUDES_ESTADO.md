# Receptor CRM de solicitudes — auditoría y estado

## Decisiones de producto
- La fuente oficial de identidad de cliente externo es `crm_cliente_id` (ID estable del CRM), no el NIT.
- Si no existe `crm_cliente_id` en `empresas_cliente`, la RPC crea una empresa en estado `prospecto`, inactiva, y registra las tablas satélite básicas del maestro.
- Si existe el ID CRM, reutiliza la empresa vinculada; los cambios de NIT no crean una empresa nueva.
- El creador se resuelve por correo normalizado contra `profiles.email`; cero o varias coincidencias se rechazan.
- `solicitudes.empresa_cliente_id` y `solicitudes.creado_por` siguen siendo obligatorios. No se cambia su nulabilidad.
- Empresa y solicitud se guardan dentro de una RPC PostgreSQL, en una sola transacción.
- El ID de solicitud CRM es clave de idempotencia; reintentos no deben duplicar solicitudes.

## Endpoint propuesto
- `POST /api/integraciones/crm/solicitudes`
- Autenticación mediante `x-crm-api-key`, con `CRM_INGESTION_API_KEY` y `SUPABASE_SERVICE_KEY` configuradas solo en backend.
- El contrato requiere `creador_email`, además de `crm_cliente_id`, `crm_solicitud_id` y datos de la solicitud.
- El mapa de vehículos continúa limitado a `NHR 2.5 toneladas` → `NHR`; cualquier otro valor se rechaza con 422 hasta aprobar el catálogo.

## Canales de entrada y módulo ERP Solicitudes
- `APP` representa solicitudes que crea el cliente desde su Portal de Clientes. El flujo existente es `POST /servicios`, autenticado con el contexto del cliente, y persiste `empresa_cliente_id` y `creado_por` del usuario cliente.
- `CRM` representa solicitudes internas creadas por el equipo comercial en el CRM. El receptor nuevo debe persistir `canal = 'CRM'` y resolver `empresa_cliente_id` por `crm_cliente_id`, y `creado_por` por correo contra `profiles`.
- El módulo Solicitudes del ERP ya tiene una columna `Canal` y un componente `CanalBadge`. Se actualizó para distinguir visualmente `APP` y `CRM`; el detalle/listado enriquecen el creador CRM desde `profiles`, mientras que el creador APP sigue resolviéndose desde `usuarios_cliente`.
- El backend de listado y detalle ya incluye los campos CRM y usa el nombre externo del cliente como respaldo si no hay razón social disponible.
- Para CRM, la agencia se recibe como objeto externo y la RPC guarda el nombre de agencia; no se asigna `agencia_id` del CRM directamente porque su UUID no puede asumirse igual al ID de agencia del ERP. Si el proceso exige asociar agencias maestras, hará falta una correspondencia explícita de agencias.

## Cambios preparados en la rama
Rama: `test/integracion-crm-solicitudes`
- El router delega la operación a `rpc/recibir_solicitud_crm`.
- El adaptador de persistencia llama la RPC transaccional.
- El contrato valida correo del creador y el fixture de pruebas incluye `creador_email`.
- La migración agrega `empresas_cliente.crm_cliente_id` con índice único parcial, conserva las restricciones obligatorias de `solicitudes` y crea la RPC.
- Se corrigió la RPC para tratar los IDs externos como texto, sin exigir formato UUID.

## Riesgos y bloqueos antes de producción
- **No ejecutar todavía la migración en Supabase compartido.** El proyecto actual es compartido entre desarrollo y producción.
- La migración aún debe validarse contra el esquema real y las restricciones actuales de la base. También debe revisarse la inicialización de la secuencia de códigos durante una ventana controlada.
- La aplicación CRM debe enviar `creador_email` con el correo del usuario que creó la solicitud; todavía debe confirmarse y probarse ese contrato extremo a extremo.
- La creación automática genera la empresa en estado `prospecto` e inactiva. No se activa automáticamente ni se aprueban condiciones comerciales; esto es deliberado para evitar autorizar un cliente nuevo sin revisión.
- Los IDs de cliente CRM existentes en la base necesitan una estrategia de backfill si ya hay empresas creadas desde CRM antes de habilitar la integración.
- La rama no está desplegada en Railway. El servicio `Inlop-Dash` actual sirve frontend estático; no cambiar su comando de inicio. Se necesita un servicio backend separado o un plan de despliegue aprobado.
- Las pruebas automatizadas del cambio deben correr en CI. No se ha confirmado todavía una ejecución CI exitosa de estos últimos commits.
- No se ha aplicado ninguna migración a Supabase ni se ha enviado ninguna solicitud real.

## Próximas validaciones
1. Ejecutar CI de la rama y corregir fallos.
2. Confirmar el contrato desde el repositorio del CRM, especialmente `creador_email`.
3. Revisar en el esquema compartido los tipos/FK de `solicitudes.creado_por`, `profiles.id`, columnas de `empresas_cliente` y políticas de seguridad.
4. Preparar respaldo y procedimiento de reversión antes de cualquier migración.
5. Desplegar solo tras aprobar la base de datos, el secreto dedicado y el servicio backend.

## Auditoría comparativa APP vs CRM
| Aspecto | APP | CRM |
|---|---|---|
| Propósito | Canal externo: el cliente solicita desde su portal | Canal interno: comercial crea la solicitud en CRM |
| Entrada | `POST /servicios`, con autenticación de cliente y alcance de empresa/agencia | `POST /api/integraciones/crm/solicitudes`, autenticado con secreto dedicado |
| Cliente | Empresa del usuario autenticado | ID estable del cliente CRM; crea maestro ERP si no existe |
| Creador | `usuarios_cliente` | `profiles`, por correo normalizado |
| Canal almacenado | El handler `POST /servicios` ahora escribe explícitamente `canal = 'APP'`; el fallback de lectura se conserva para históricos | La RPC escribe explícitamente `CRM` |
| Visibilidad ERP | Badge `APP` | Badge `CRM` distinto, con título “Canal interno de solicitudes” |

### Corrección de consistencia APP
Se agregó `canal: 'APP'` explícitamente al objeto que inserta `POST /servicios`. El fallback de lectura (`canal || 'APP'`) se conserva para no alterar la visualización de solicitudes históricas que tengan el canal vacío.
