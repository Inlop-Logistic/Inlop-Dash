# Seguimiento GPS — INLOP (Fase 10C)

Experiencia web externa, Mobile First, para que un destinatario **externo**
autorizado de un Reporte Automático de Gestión Logística vea el estado GPS
de los vehículos incluidos en ese reporte — sin cuenta, sin acceso al ERP,
solo lectura. Construida sobre la infraestructura segura de la Fase 10B
(`services/gps/*`, `routes/gpsSeguimiento.js`).

No es parte del ERP (`erp/`): es un proyecto Vite **independiente** a
propósito (ver `docs/REPORTES_SEGUIMIENTO_GPS_ARQUITECTURA.md`, Fase 10A,
§7.3) — un visitante sin sesión nunca debe descargar el bundle completo del
ERP para ver 2-3 vehículos.

## Flujo

```
/t/<token> → validar enlace → correo → OTP → sesión → mapa + lista de vehículos
```

Cada paso llama exactamente a la API pública de 10B — este proyecto nunca
decide autorización por su cuenta, nunca vuelve a calcular qué placas puede
ver, y nunca envía `placa`/`reporte_id` como parámetro (ver `src/api.ts`).

## Correr en desarrollo

```bash
npm install
npm run dev
```

Necesita el backend (`node index.js` en la raíz del repo) corriendo en
`http://localhost:3000` (proxy configurado en `vite.config.ts`), o una
`VITE_API_URL` apuntando a otro backend.

## Build y tests

```bash
npm run build   # tsc -b && vite build — igual que erp/
npm test        # node --experimental-strip-types --test 'src/**/*.test.ts'
```

Los tests cubren solo lógica pura (`session.ts`, `vehiculos.ts`, `api.ts`)
— igual criterio que el resto del proyecto (backend con `node --test`,
componentes React verificados por `tsc -b && vite build`, sin runner de
componentes nuevo).

## Decisiones de esta fase

- **Sin localStorage** para token/OTP/sesión — decisión cerrada de 10C. Se
  usa `sessionStorage` (se borra al cerrar la pestaña; sobrevive a un
  refresh) con fallback en memoria si el navegador lo bloquea (modo
  privado agresivo de Safari/iOS) — ver `src/session.ts`.
- **Reutilización real, no reimplementación**: los design tokens
  (`erp/src/styles/tokens.css`, `typography.css`) y el estándar de fechas
  TMS (`erp/src/utils/parseFecha.ts` — `parseFechaTMS`/`gpsRelativo`/
  `fmtTms`) se importan por **ruta relativa** desde este proyecto, nunca se
  copian — ver `src/index.css` y `src/fecha.ts`. La lógica GPS en sí
  (`transformarCentroGps`, `derivarEstadoGps`) nunca se toca ni se
  reimplementa: vive únicamente en el backend (Fase 9B/10B).
- **Sin react-router**: una sola pantalla real (`/t/<token>`), leída
  directo de `window.location.pathname` en `App.tsx` — una librería de
  ruteo sería peso sin beneficio para un solo path.
- **Sin `leaflet.markercluster`**: el conjunto de vehículos de un enlace es
  siempre el de un solo reporte — pequeño por construcción — no hace falta
  la complejidad de clustering que sí usa Centro GPS en el ERP (que
  muestra toda la flota).
- **`server.js`** (Express estático + fallback SPA) existe para poder
  construir y previsualizar el build de producción localmente — el
  despliegue real como servicio de Railway (`Dockerfile` + `railway.json`,
  mismo patrón que `erp/`) se agregó en Fase 10E, ver más abajo.

## Pendiente / fuera de alcance de esta fase

- **Teléfono de contacto**: `ContactoAcciones.tsx` (botones Llamar/
  WhatsApp) ya está implementado y listo, pero **10B no expone
  `telefono`** en `proyectarVehiculoPublico()` — es una decisión de
  política pendiente (¿número del conductor? ¿de despacho?), no tomada
  silenciosamente en esta fase. Los botones simplemente no se renderizan
  hasta que ese campo exista en la respuesta pública.
- **Conteo de placas autorizadas vs. reportando**: `/vehiculos` de 10B
  devuelve solo los vehículos que SÍ tienen un viaje monitoreable ahora
  mismo — no el total de placas autorizadas del enlace. Esta fase cubre
  "cero vehículos GPS" (array vacío) y "vehículo sin señal" (item con
  lat/lon nulos) con los datos ya disponibles, sin pedir cambios a 10B.
- **Integración con Reportes Automáticos** (botón "Seguimiento GPS" en el
  ERP, enlace en el correo del reporte): implementada en Fase 10D — ver
  `services/reportes/enlaceGps.js`.

## Despliegue en Railway (Fase 10E)

Servicio propio, independiente del backend y de `erp/` — mismo patrón que
`erp/` (`Dockerfile` con builder `DOCKERFILE`, ver `railway.json`).

**Variable de build (Railway → Settings → Variables del servicio):**

| Variable       | Valor                                                        |
|----------------|---------------------------------------------------------------|
| `VITE_API_URL` | URL pública del backend (`Inlop-Dash`), ej. `https://api.inlop.com.co` — sin ella el cliente llama a rutas relativas a su propio dominio, que no existen ahí. |

No necesita ninguna otra variable — esta app no habla con Supabase ni
firma nada con `INTERNAL_API_KEY`; toda su autorización pasa por el token
del enlace/OTP/sesión contra la API pública de 10B.

**Requisito en el backend (`Inlop-Dash`, no en este proyecto):** el dominio
donde quede publicado este servicio debe agregarse a la variable
`ALLOWED_ORIGINS` del backend (CORS, ver `index.js`). Sin esto, el
navegador bloquea toda llamada de esta app a `/api/seguimiento-gps/*` por
CORS — el enlace del correo cargaría pero la pantalla de verificación de
correo nunca podría enviar el OTP. `ALLOWED_ORIGINS` ya existe como
mecanismo (comparte variable con `CLIENT_PORTAL_URL`); esto es agregar un
valor a una lista existente, no una variable nueva.
