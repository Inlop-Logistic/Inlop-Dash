/**
 * server.js — Servidor estático de producción para Seguimiento GPS (Fase 10C).
 *
 * Mismo patrón que erp/server.js: sirve el build de Vite (`dist/`) con
 * fallback SPA (necesario porque esta app resuelve su propia "ruta"
 * /t/<token> en el cliente — ver src/App.tsx, sin react-router — así que
 * cualquier path debe devolver index.html, no un 404 del servidor).
 *
 * No hay ninguna configuración de Railway en este archivo ni en el repo
 * todavía — desplegar esto como su propio servicio es una decisión
 * explícita de Fase 10E, no de esta fase.
 */
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3100;
const DIST = join(__dirname, "dist");

app.use(express.static(DIST));
app.get("/*splat", (_req, res) => res.sendFile(join(DIST, "index.html")));
app.listen(PORT, () => console.log(`Seguimiento GPS INLOP → http://localhost:${PORT}`));
