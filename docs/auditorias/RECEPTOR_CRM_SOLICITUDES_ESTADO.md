# Receptor CRM de solicitudes — estado y contrato del adaptador

El módulo `services/crmSolicitudesRouter.js` está preparado en la rama de pruebas, pero **no está montado en `index.js` ni desplegado**. Esto es intencional: el servicio Railway actual `Inlop-Dash` ejecuta `npx serve .`, no el backend Express raíz.

## Endpoint propuesto
- Método/ruta al montarlo: `POST /crm/solicitudes`
- Autenticación: header `x-crm-api-key`, comparado con un secreto dedicado `CRM_INGESTION_API_KEY` que debe inyectarse por configuración; nunca aceptar el secreto en el body o query string.
- Contrato: `services/crmSolicitudContractValidator.js`.
- El módulo no crea clientes maestros ni usa `resolveCustomer`.
- Si no hay mapeo aprobado de vehículo, responde `422` y no escribe.
- Solicitud repetida: devuelve la fila existente; ante una carrera, depende de que `insertIfAbsent` implemente inserción atómica contra la clave única y se vuelve a consultar el ID de origen.

## Funciones de persistencia que debe inyectar el backend
1. `findByCrmSolicitudId(id)`: consulta `solicitudes.crm_solicitud_id` y devuelve `{id,codigo_solicitud}` o null.
2. `insertIfAbsent(row)`: operación atómica de inserción contra la restricción única de `crm_solicitud_id`; debe devolver la fila insertada o null si perdió el conflicto. No basta con consultar y luego insertar sin restricción única.
3. `createCodigoSolicitud()`: generador seguro de `codigo_solicitud`. El patrón actual que lee el último código y suma uno puede colisionar bajo concurrencia; no debe reutilizarse sin resolver esa condición.
4. `mapTipoVehiculo(valor)`: lista explícita aprobada que convierte los valores CRM al catálogo real de ERP.

## Bloqueos antes de conectar a la base real
- Confirmar el esquema real de `public.solicitudes`, incluyendo si `empresa_cliente_id` y `creado_por` permiten NULL, el tipo de `canal` y los CHECK de estado/tipo.
- Confirmar cómo se muestra `cliente_nombre_externo` en las consultas/listados existentes; el GET actual no se ha actualizado en esta fase.
- Acordar la ubicación de ejecución del backend. No cambiar el comando del servicio estático existente para evitar interrumpir el frontend.
- Crear un secreto dedicado solo en Desarrollo; no reutilizar `INTERNAL_API_KEY` ni el token legado.
- Ejecutar las pruebas automatizadas en un entorno que tenga instaladas las dependencias del proyecto y registrar el resultado real.
- No aplicar la migración ni enviar solicitudes reales hasta completar esas verificaciones.

## Pruebas escritas
`tests/crmSolicitudesRouter.test.js` cubre autenticación, payload inválido, creación sin cliente maestro, reintento y vehículo sin mapeo. Estas pruebas están **escritas, no se afirma que hayan sido ejecutadas** en esta etapa.
