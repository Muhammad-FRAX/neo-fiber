# =============================================================================
# Neo-Fiber — Production multi-stage Dockerfile
# DESIGN.md §28 Phase 9 / §13 distribution
#
# Build on a connected machine, then ship the image offline:
#   docker compose build
#   docker save neo-fiber-app:latest | gzip > neo-fiber.tar.gz
#   scp neo-fiber.tar.gz ops@target-host:
#   ssh ops@target-host "gunzip -c neo-fiber.tar.gz | docker load && docker compose up -d"
#
# Stages:
#   1. frontend-build  — Vite production build → /build/frontend/dist
#   2. backend-build   — TypeScript compile → /build/backend/dist
#   3. runtime         — slim node:20-alpine, non-root, no build tools
#
# PMTiles is the very last COPY so code-only rebuilds skip the 80 MB layer (D2).
# =============================================================================

# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /build/frontend

# Install deps first (separate layer — only re-runs when package files change)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Compile backend TypeScript ─────────────────────────────────────
FROM node:20-alpine AS backend-build

WORKDIR /build/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
# Compile TypeScript → dist/
RUN npx tsc


# ── Stage 3: Runtime (slim, non-root) ────────────────────────────────────────
FROM node:20-alpine AS runtime

# Minimal runtime packages only
RUN apk add --no-cache tini

WORKDIR /app

# Backend compiled output
COPY --from=backend-build /build/backend/dist ./backend/dist

# Production-only node_modules (installed fresh, no dev deps, no npm cache)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force

# Frontend compiled assets — served by Express in production (NODE_ENV=production)
# Express.static serves these; SPA fallback in app.ts sends index.html for any
# non-API route.
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# ── PMTiles: LAST COPY per D2 ────────────────────────────────────────────────
# Placing tiles at the final layer means code-only rebuilds skip re-shipping
# the 80 MB tile file. The tiles change rarely; code changes daily.
COPY backend/public/tiles ./backend/public/tiles

# Run as the non-root node user that ships with node:20-alpine
USER node

ENV NODE_ENV=production \
    PORT=5000

EXPOSE 5000

# tini as PID 1 for proper signal handling + zombie reaping
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/server.js"]
