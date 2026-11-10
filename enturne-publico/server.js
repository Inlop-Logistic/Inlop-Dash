/**
 * enturne-publico/server.js — servidor estático del formulario público de
 * Enturne de Vehículos, como servicio Railway INDEPENDIENTE de Inlop-Dash.
 *
 * Este servicio NO tiene lógica de negocio, NO conoce SUPABASE_SERVICE_KEY
 * ni ninguna otra credencial de Supabase, y NO escribe en ninguna tabla —
 * solo sirve enturne.html y, en /config.js, la URL pública del backend que
 * sí hace todo eso (Inlop-Dash, ver routes/enturnes.js en ese repo). El
 * único camino de escritura real sigue siendo POST <INLOP_DASH_API_URL>/api/enturnes,
 * llamado cross-origin desde el navegador del conductor — no desde aquí.
 *
 * INLOP_DASH_API_URL se inyecta en TIEMPO DE EJECUCIÓN vía /config.js, no en
 * build time: así, si el dominio del backend cambia, solo hay que actualizar
 * la variable de entorno de este servicio en Railway, sin volver a construir
 * ni redesplegar enturne.html.
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3200;

const INLOP_DASH_API_URL = (process.env.INLOP_DASH_API_URL || '').trim().replace(/\/+$/, '');
if (!INLOP_DASH_API_URL) {
  console.warn(
    '⚠️  INLOP_DASH_API_URL no configurada. El formulario público se servirá, ' +
    'pero /config.js dejará window.ENTURNE_API_URL vacío — enturne.html lo ' +
    'detecta y bloquea el envío con un mensaje de error, en vez de intentar ' +
    'un POST relativo que iría a este mismo servicio estático (que no tiene ' +
    '/api/enturnes).'
  );
}

// Generado en cada request (no es un archivo estático): así, si la variable
// de entorno cambia en Railway y el servicio se reinicia, el valor nuevo se
// sirve sin tener que tocar ningún archivo del repo.
app.get('/config.js', (_req, res) => {
  res.type('application/javascript');
  res.send(`window.ENTURNE_API_URL = ${JSON.stringify(INLOP_DASH_API_URL)};\n`);
});

// Recursos de marca compartidos desde la carpeta assets/img en la raíz del repositorio.
app.use('/assets/img', express.static(join(__dirname, '..', 'assets', 'img')));
app.use(express.static(__dirname));
app.get('/', (_req, res) => res.sendFile(join(__dirname, 'enturne.html')));

app.listen(PORT, () => {
  console.log(`🚚 Enturne de Vehículos (formulario público) — puerto ${PORT}`);
  console.log(`   Backend configurado: ${INLOP_DASH_API_URL || '(ninguno — ver advertencia arriba)'}`);
});
