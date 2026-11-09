FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all deps
RUN npm ci --workspace=shared --workspace=backend

# Build shared types first
COPY shared/ ./shared/
RUN npm run build --workspace=shared

# Build backend
COPY backend/ ./backend/
RUN npm run build --workspace=backend

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --workspace=shared --workspace=backend --omit=dev

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Static snapshots dir
RUN mkdir -p backend/public/snapshots backend/exports

EXPOSE 4000

CMD ["node", "backend/dist/app.js"]
