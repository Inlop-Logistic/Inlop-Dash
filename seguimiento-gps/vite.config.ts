import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Proyecto Vite independiente del ERP (erp/) a propósito — Fase 10A/10C:
// la experiencia externa de Seguimiento GPS no debe cargar el bundle del
// ERP (rutas, auth de staff, módulos operativos) para un visitante externo
// sin sesión. Comparte identidad visual reutilizando erp/src/styles/
// tokens.css por ruta relativa (ver src/index.css) — nunca copiándolo, para
// no arriesgar que ambos diverjan.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      proxy: env.VITE_API_URL
        ? undefined
        : {
            // En desarrollo sin VITE_API_URL configurada, asume el backend
            // corriendo localmente en el puerto por defecto de index.js.
            "/api/seguimiento-gps": "http://localhost:3000",
          },
    },
  };
});
