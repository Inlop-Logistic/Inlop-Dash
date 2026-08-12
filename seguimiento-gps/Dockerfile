FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ─── VARIABLE DE BUILD PARA VITE ───────────────────────────────────────────
# Vite sustituye import.meta.env.VITE_* en tiempo de compilación (vite
# build), no en tiempo de ejecución — mismo criterio que erp/Dockerfile.
# Railway inyecta las variables del dashboard como Docker build args cuando
# el builder es DOCKERFILE; deben declararse como ARG para recibirlas en
# este paso y exponerse como ENV para que estén disponibles durante
# `RUN npm run build`. Esta app SOLO lee VITE_API_URL (ver src/api.ts) — a
# diferencia de erp/, no necesita variables de Supabase ni de API interna.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

ENV PORT=3100
EXPOSE 3100

CMD ["node", "server.js"]
