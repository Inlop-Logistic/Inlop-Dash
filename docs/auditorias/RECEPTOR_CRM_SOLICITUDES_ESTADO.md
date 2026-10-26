# Receptor CRM de solicitudes — estado y contrato del adaptador

El módulo `services/crmSolicitudesRouter.js` está montado en `index.js` en la rama de pruebas, pero **no está desplegado ni conectado a la base real**. El servicio Railway actual `Inlop-Dash` ejecuta `npx serve .`, no el backend Express raíz; no cambiar el comando de ese servicio porque podría interrumpir el frontend.

## Endpoint propuesto
- Método/ruta en el código: `POST /api/integraciones/crm/solicitudes`
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
- La migración propuesta ahora permite NULL en `empresa_cliente_id` y `creado_por`, agrega campos CRM, índice único de idempotencia y una función RPC/secuencia para generar códigos `SOL-` atómicos. **No se ha aplicado**.
- El GET de listado y el detalle de solicitud ya priorizan el nombre del maestro ERP y, si no existe, muestran `cliente_nombre_externo`.
- El generador de códigos del endpoint `POST /servicios` se cambió en esta rama para usar la misma función RPC que usará CRM.
- El receptor falla cerrado si falta `CRM_INGESTION_API_KEY` o `SUPABASE_SERVICE_KEY`; el mapa de vehículos solo incluye el valor de prueba aprobado hasta ampliar el catálogo explícitamente.
- El código del backend raíz no está desplegado en el servicio de Desarrollo que actualmente sirve archivos estáticos. No cambiar la configuración de ese servicio.
- GitHub no confirmó un check exitoso para los commits revisados; las pruebas están escritas, pero no hay resultado CI exitoso verificado.
- No aplicar la migración ni enviar solicitudes reales hasta completar la validación del esquema, ejecutar las pruebas y decidir el servicio backend de Desarrollo.

## Pruebas escritas
`tests/crmSolicitudesRouter.test.js` cubre autenticación, payload inválido, creación sin cliente maestro, reintento y vehículo sin mapeo. Estas pruebas están **escritas, no se afirma que hayan sido ejecutadas** en esta etapa.
