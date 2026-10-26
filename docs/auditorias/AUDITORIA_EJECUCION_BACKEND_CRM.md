# Auditoría de ejecución para la integración CRM → ERP

Fecha de revisión: 2026-10-25  
Alcance: solo lectura. No se modificó Railway ni se desplegó nada.

## Hallazgo confirmado en Railway — ambiente Desarrollo

### Servicio `Inlop-Dash`
- Servicio ID: `10d4c68c-6906-4c7a-9f22-c38051e2984a`
- Repositorio: `Inlop-Logistic/Inlop-Dash`
- Rama desplegada: `claude/clever-edison-y3au9r`
- Comando de inicio: `npx serve .`
- Dominio: `https://inlop-dash-desarrollo.up.railway.app`
- Último despliegue consultado: `SUCCESS`, creado el 2026-09-14.

**Conclusión:** este servicio sirve archivos estáticos; no ejecuta el backend Express de `index.js` con la configuración actual. Por tanto, no debe asumirse que las rutas de API definidas en `index.js` estén disponibles en ese dominio.

### Servicio `ERP Inlop`
- Servicio ID: `652bfe7f-c442-42ac-a9a8-b1517fd2dce0`
- Repositorio: `Inlop-Logistic/Inlop-Dash`
- Directorio raíz: `erp`
- Comando de inicio: `npm run start`
- Último despliegue consultado: `SUCCESS`, creado el 2026-09-14.

**Conclusión:** este servicio ejecuta la aplicación del directorio `erp`; no es evidencia de que ejecute el backend raíz `index.js`.

## Consecuencia para la integración

El backend que contiene las rutas y la función `requireInternalApiKey` está en la raíz del repositorio, pero ninguno de los dos servicios de Desarrollo consultados está configurado para iniciarlo: uno ejecuta `npx serve .` y el otro tiene `rootDirectory: erp`.

## Próximos pasos seguros

1. Mantener el trabajo en la rama `test/integracion-crm-solicitudes`.
2. No cambiar el comando de inicio del servicio estático existente, porque eso podría dejar de servir el frontend.
3. Preparar el receptor CRM como backend independiente o acordar explícitamente una reconfiguración aislada de Desarrollo que ejecute `node index.js`.
4. Antes de habilitar escrituras, verificar el esquema real de `solicitudes`, las restricciones de estado/tipo y el mapeo de vehículo.
5. Probar autenticación, validación e idempotencia en un entorno de prueba; no usar la solicitud real de Dispapeles para pruebas automáticas.
6. No aplicar la migración ni desplegar a producción como parte de esta auditoría.

## Estado

- Auditoría de configuración de Railway: confirmada mediante consulta de solo lectura.
- Receptor autenticado: pendiente.
- Esquema real de base de datos y restricciones: pendiente de confirmación.
- Prueba real de idempotencia: pendiente.
- Cambios en Railway y producción: ninguno.
