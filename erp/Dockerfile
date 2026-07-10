FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ─── VARIABLES DE BUILD PARA VITE ──────────────────────────────────────────
# Vite sustituye import.meta.env.VITE_* en tiempo de compilación (vite build),
# no en tiempo de ejecución. Railway inyecta las variables del dashboard como
# Docker build args — deben declararse como ARG para recibirlas en este paso,
# y exponerse como ENV para que estén disponibles durante RUN npm run build.
# Configurar en Railway como variables de entorno normales; Railway las pasa
# automáticamente como --build-arg cuando el builder es DOCKERFILE.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_INTERNAL_API_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_INTERNAL_API_KEY=$VITE_INTERNAL_API_KEY

RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
