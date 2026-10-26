# Receptor CRM de solicitudes — estado y contrato del adaptador

El módulo `services/crmSolicitudesRouter.js` está montado en `index.js` en la rama de pruebas, pero **no está desplegado ni conectado a la base real**. El servicio Railway actual `Inlop-Dash` ejecuta `npx serve .`, no el backend Express raíz; no cambiar el comando de ese servicio porque podría interrumpir el frontend.

## Endpoint propuesto
- Método/ruta en el código: `POST /api/integraciones/crm/solicitudes`
- Autenticación: header `x-crm-api-key`, comparado con un secreto dedicado `CRM_INGESTION_API_KEY` que debe inyectarse por configuración; nunca aceptar el secreto en el body o query string.
- Contrato: `services/crmSolicitudContractValidator.js`.
- El módulo no crea clientes maestros ni usa `resolveCustomer`.
- Si no hay mapeo aprobado de vehículo, responde `422` y no escribe.
- Solicitud repetida: devuelve la fila existente; ante una carrera, depende de que `insertIfAbsent` implemente inserción atómica contra la clave única y se vuelve a consultar el ID de origen.

## Funciones de persistencia montadas en la rama
1. `findByCrmSolicitudId(id)`: consulta por el identificador estable de CRM.
2. `insertIfAbsent(row)`: usa conflicto atómico en PostgREST y requiere el índice único de `crm_solicitud_id` creado por la migración.
3. `createCodigoSolicitud()`: llama la función RPC `generar_codigo_solicitud`; requiere que la migración esté aplicada y que el backend use `SUPABASE_SERVICE_KEY`.
4. `mapTipoVehiculo(valor)`: por ahora solo mapea `NHR 2.5 toneladas` a `NHR`; el catálogo real debe validarse antes de ampliar.

## Bloqueos antes de conectar a la base real
- La migración propuesta ahora permite NULL en `empresa_cliente_id` y `creado_por`, agrega campos CRM, índice único de idempotencia y una función RPC/secuencia para generar códigos `SOL-` atómicos. **No se ha aplicado**.
- El GET de listado y el detalle de solicitud ya priorizan el nombre del maestro ERP y, si no existe, muestran `cliente_nombre_externo`.
- El generador de códigos del endpoint `POST /servicios` se cambió en esta rama para usar la misma función RPC que usará CRM.
- El receptor falla cerrado si falta `CRM_INGESTION_API_KEY` o `SUPABASE_SERVICE_KEY`; el mapa de vehículos solo incluye el valor de prueba aprobado hasta ampliar el catálogo explícitamente.
- El código del backend raíz no está desplegado en el servicio de Desarrollo que actualmente sirve archivos estáticos. No cambiar la configuración de ese servicio.
- GitHub Actions: ejecución `40257053008` completada con `success`; los pasos de instalación y pruebas de contrato/router/persistencia pasaron. [Ver ejecución](https://github.com/Inlop-Logistic/Inlop-Dash/actions/runs/40257053008).
- El proyecto Railway de Desarrollo no tiene actualmente un servicio que ejecute el backend raíz en esta rama. No cambiar el servicio estático existente.
- Bloqueo restante: aplicar la migración en Supabase de Desarrollo y disponer de un secreto `CRM_INGESTION_API_KEY` más la `SUPABASE_SERVICE_KEY` de ese entorno. No desplegar ni enviar la solicitud real antes de ello.

## Pruebas escritas
`tests/crmSolicitudesRouter.test.js`, `tests/crmSolicitudContractValidator.test.js` y `tests/crmSolicitudesPersistence.test.js` se ejecutaron en GitHub Actions y pasaron en la ejecución 40257053008. Esto valida pruebas automatizadas, no una inserción contra la base real.
