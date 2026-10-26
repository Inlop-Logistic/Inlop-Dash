# Avance de persistencia CRM — 2026-10-25

Rama: `test/integracion-crm-solicitudes`

## Avance confirmado
- Añadido `services/crmSolicitudesPersistence.js`, un adaptador PostgREST inyectable.
- Añadido `tests/crmSolicitudesPersistence.test.js`: consulta por ID estable, inserción con `on_conflict=crm_solicitud_id` y fallo cerrado cuando PostgREST no confirma la operación.
- Las tres pruebas unitarias del adaptador se ejecutaron en un harness Node aislado: **3 pasaron, 0 fallaron**. Esto no equivale a ejecutar la suite completa del repositorio ni a probar contra una base de datos real.
- Ajustada la propuesta de migración para no cambiar la nulabilidad de `empresa_cliente_id` ni `creado_por` sin inspeccionar el esquema real. La documentación del dominio las describe como anulables, pero aún no se consultó el catálogo de la base activa.

## Qué sigue bloqueado
1. La restricción única `crm_solicitud_id` no existe en la base hasta aplicar y verificar la migración.
2. El código de solicitud debe generarse sin carreras. El patrón actual de leer el último `SOL-` y sumarle uno no es seguro bajo concurrencia; aún no se ha reemplazado por un generador atómico aprobado.
3. Falta confirmar restricciones reales de `canal`, `estado`, `tipo_operacion` y `tipo_vehiculo`.
4. Falta verificar cómo los listados existentes mostrarán `cliente_nombre_externo`.
5. El receptor no está montado en el backend y Railway Desarrollo actualmente no ejecuta `index.js` en el servicio estático.
6. No se han ejecutado pruebas de extremo a extremo ni se ha enviado la solicitud real de Dispapeles.

## Seguridad
No aplicar migración, no configurar secretos, no desplegar y no enviar solicitudes reales hasta validar el esquema y resolver los bloqueos anteriores. Producción no se ha modificado.
