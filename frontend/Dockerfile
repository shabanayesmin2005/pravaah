FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=shared --workspace=frontend

COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN npm run build --workspace=frontend

# ── Nginx static server ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
