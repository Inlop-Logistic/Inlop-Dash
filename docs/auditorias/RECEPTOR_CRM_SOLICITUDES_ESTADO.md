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
