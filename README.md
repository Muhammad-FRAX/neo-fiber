# Neo-Fiber Network Operations Dashboard

Real-time fiber-cut impact viewer for Zain Sudan. A director gets a WhatsApp
ping about a cut, opens `/map`, and sees the affected region within 30 seconds
— no phone calls required.

**Status:** v1.0 (Phase 9 complete — E2E tests, Dockerfile, offline build)

---

## Quick start (local development)

```bash
# 1. Start the app database (PostGIS)
docker compose -f docker-compose.dev.yaml up -d

# 2. Configure the backend
cp backend/.env.example backend/.env
# Edit backend/.env — fill in JWT_SECRET, set AUTH_LOCAL_ONLY=true for local dev

# 3. Apply migrations
cd backend && npm run migrate && cd ..

# 4. Start backend + frontend dev servers (two terminals)
cd backend && npm run dev        # http://localhost:5000
cd frontend && npm run dev       # http://localhost:3000
```

Navigate to `http://localhost:3000`. Login with a local user (if `AUTH_LOCAL_ONLY=true`).

---

## Offline build & deployment (air-gapped hosts)

Neo-Fiber is designed to run in environments with no internet access. **All
assets — fonts, map tiles, icons — ship inside the Docker image.** No CDN
requests are made at runtime.

### Step 1: Build on a connected machine

```bash
# Clone the repo and build the production image
git clone https://github.com/Muhammad-FRAX/neo-fiber.git
cd neo-fiber

# Build (requires internet to pull base images and install npm packages)
docker compose build

# Tag for versioning
docker tag neo-fiber-app:latest neo-fiber-app:v1.0.0
```

### Step 2: Save to a portable tarball

```bash
# Save and compress (~200-300 MB depending on tile size)
docker save neo-fiber-app:v1.0.0 postgis/postgis:16-3.4-alpine \
  | gzip > neo-fiber-v1.0.0.tar.gz

# Verify the archive is complete
docker save neo-fiber-app:v1.0.0 postgis/postgis:16-3.4-alpine | gzip | wc -c
```

### Step 3: Transfer to the target host

```bash
# SCP to the deployment server (or use USB drive / internal file share)
scp neo-fiber-v1.0.0.tar.gz ops@172.18.207.52:/opt/neo-fiber/
scp docker-compose.yaml ops@172.18.207.52:/opt/neo-fiber/
scp backend/.env ops@172.18.207.52:/opt/neo-fiber/   # Never commit .env
```

### Step 4: Load and start on the target host

```bash
ssh ops@172.18.207.52

cd /opt/neo-fiber

# Load images from tarball (no internet required)
gunzip -c neo-fiber-v1.0.0.tar.gz | docker load

# Copy the env file (must have APP_DB_PASSWORD, DWH_URL, JWT_SECRET filled in)
cp .env.example .env && vi .env   # if not transferred above

# Start services
docker compose up -d

# Check logs
docker compose logs -f app

# Apply database migrations (first deploy only, then on schema changes)
docker compose run --rm app node backend/dist/db/migrate.js up
```

### Step 5: Verify the deployment

```bash
# Health check (should return {"status":"ok","db":"ok","dwh":"ok",...})
curl http://localhost:5000/api/v1/health

# Open in a browser on the target network
open http://172.18.207.52:5000   # or the correct internal IP
```

### Updating to a new version

```bash
# On the connected build machine
git pull && docker compose build && docker tag neo-fiber-app:latest neo-fiber-app:v1.1.0
docker save neo-fiber-app:v1.1.0 | gzip > neo-fiber-v1.1.0.tar.gz

# On the target host
gunzip -c neo-fiber-v1.1.0.tar.gz | docker load
docker compose pull --ignore-pull-failures 2>/dev/null || true
docker compose down app && docker compose up -d app
docker compose run --rm app node backend/dist/db/migrate.js up
```

---

## Running tests

```bash
# Backend (unit + integration — requires Docker for testcontainers)
cd backend && npm test

# Frontend (unit)
cd frontend && npm test

# E2E (Playwright + axe-core — requires frontend dev server)
npm install                        # install Playwright at root
npm run playwright:install         # download Chromium browser
npm run test:e2e                   # run E2E specs
npm run test:e2e:headed            # run with browser visible
```

---

## Key architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Map tiles | PMTiles (self-hosted) | Air-gap requirement — no Mapbox/Google |
| Fonts | Self-hosted woff2 | Air-gap requirement — no Google Fonts |
| Real-time | SSE (EventSource) | No polling from client; server pushes alarms |
| Auth | LDAP + JWT (8h, localStorage) | Existing corporate LDAP; no refresh token complexity |
| Status colors | green / amber / red | Amber = main down but backup up (not RED) |
| DB | Postgres + PostGIS | Single source of truth; no Neo4j |

See [DESIGN.md](DESIGN.md) for the full design specification.

---

## Environment variables

See [`backend/.env.example`](backend/.env.example) for the full list with descriptions.

Required for production:

| Variable | Description |
|---|---|
| `APP_DB_URL` | Connection string for the application Postgres (PostGIS) |
| `DWH_URL` | Read-only connection to the Zain Sudan DWH |
| `JWT_SECRET` | ≥32 character random string — `openssl rand -hex 32` |
| `LDAP_URL` | LDAP server URL (or set `AUTH_LOCAL_ONLY=true`) |
| `FIBER_CUT_ALARM_NAME` | The exact alarm name representing a fiber cut in the DWH |

---

*Neo-Fiber is an internal tool for Zain Sudan. Not for public distribution.*
