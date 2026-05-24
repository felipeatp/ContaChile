# ContaChile — Deploy Self-Hosted en VPS (Ubuntu + Docker + Nginx) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar ContaChile de Cloudflare Workers (Error 1102 — límite de recursos) a un VPS Ubuntu con Docker Compose, Nginx y SSL Let's Encrypt. Sin límites de CPU, sin dependencias de plataformas externas.

**Architecture:** Docker Compose levanta 4 servicios: `postgres`, `redis`, `api` (Fastify), `web` (Next.js standalone). Nginx actúa como reverse proxy con SSL terminado en el host. Web llama a la API internamente via red Docker (`http://api:3001`) — esto elimina los 403 por mismatch de `BETTER_AUTH_SECRET` que existían en el deploy CF.

**Tech Stack:** Docker 24+, Docker Compose v2, Nginx, Certbot (Let's Encrypt), Node 20-alpine, Next.js standalone output, pnpm monorepo.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `apps/web/next.config.js` | Modificar | Agregar `output: "standalone"` cuando NO es build CF |
| `apps/web/Dockerfile` | Crear | Multi-stage build con Next.js standalone output |
| `docker-compose.prod.yml` | Crear | Stack completo: postgres, redis, api, web |
| `nginx/contachile.conf` | Crear | Reverse proxy HTTP→HTTPS, web (:80/:443), api (/api-internal si se necesita) |
| `.env.production.example` | Crear | Plantilla de todos los secrets necesarios |
| `scripts/deploy.sh` | Crear | Script de deploy en el VPS (git pull + rebuild + up) |
| `scripts/setup-vps.sh` | Crear | Script de setup inicial del VPS (Docker, Nginx, Certbot) |

---

## Task 1: Agregar `output: "standalone"` a next.config.js

**Por qué:** El Dockerfile del web usa Next.js standalone output — genera un servidor Node.js autocontenido en `.next/standalone/` que no necesita `node_modules`. Sin esto, el Dockerfile no puede usar `node apps/web/server.js`. La detección es por variable de entorno para no romper el build de CF (`build:cf`).

**Files:**
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: Actualizar next.config.js**

```js
const withPWA = require('@ducanh2912/next-pwa').default

// Only load CF dev integration when NOT building for Docker/standalone
const isCfBuild = process.env.OPEN_NEXT_CF_BUILD === '1'
if (!isCfBuild) {
  try {
    const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare')
    initOpenNextCloudflareForDev()
  } catch {
    // not available outside CF build context
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for Docker self-hosted deploy.
  // Disabled for CF Workers build (OpenNext handles bundling itself).
  output: isCfBuild ? undefined : 'standalone',
  transpilePackages: ['@contachile/validators', '@contachile/auth'],
  poweredByHeader: false,
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: '/(app)/camera',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self)' },
        ],
      },
    ]
  },
}

module.exports = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
```

- [ ] **Step 2: Actualizar build:cf en package.json para pasar OPEN_NEXT_CF_BUILD=1**

En `apps/web/package.json`, actualizar los scripts CF:
```json
"build:cf": "cross-env OPEN_NEXT_CF_BUILD=1 opennextjs-cloudflare build && node scripts/patch-cf-handler.mjs",
"preview:cf": "cross-env OPEN_NEXT_CF_BUILD=1 opennextjs-cloudflare build && node scripts/patch-cf-handler.mjs && opennextjs-cloudflare preview",
"deploy:cf": "cross-env OPEN_NEXT_CF_BUILD=1 opennextjs-cloudflare build && node scripts/patch-cf-handler.mjs && opennextjs-cloudflare deploy"
```

- [ ] **Step 3: Instalar cross-env (para Windows dev)**

```bash
cd apps/web
pnpm add -D cross-env
```

- [ ] **Step 4: Verificar que `pnpm build` (sin CF) genera `.next/standalone/`**

```bash
cd apps/web
pnpm build
ls .next/standalone
```

Expected: Directorio existe con `apps/web/server.js` y `node_modules/` mínimos.

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.js apps/web/package.json
git commit -m "feat(web): output standalone para Docker, mantener CF build con env flag"
```

---

## Task 2: Crear `apps/web/Dockerfile`

**Por qué:** Next.js standalone output requiere copiar solo 3 cosas: `.next/standalone/`, `.next/static/`, y `public/`. El resultado es una imagen de ~150MB vs ~2GB completa.

**Files:**
- Create: `apps/web/Dockerfile`

- [ ] **Step 1: Crear el Dockerfile**

```dockerfile
# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @contachile/validators build

# Build Next.js with standalone output (OPEN_NEXT_CF_BUILD not set → output: standalone)
RUN pnpm --filter @contachile/web build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output includes its own node_modules — no pnpm install needed
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 2: Verificar build local del Dockerfile**

```bash
# Desde la raíz del monorepo
docker build -f apps/web/Dockerfile -t contachile/web:test .
docker run --rm -p 3000:3000 -e BETTER_AUTH_SECRET=test contachile/web:test
```

Expected: servidor escucha en 3000, curl http://localhost:3000 responde.

- [ ] **Step 3: Commit**

```bash
git add apps/web/Dockerfile
git commit -m "feat(web): Dockerfile con Next.js standalone output para VPS"
```

---

## Task 3: Crear `docker-compose.prod.yml`

**Por qué:** El `docker-compose.yml` actual solo tiene postgres y redis (para dev). El prod necesita agregar `api` y `web`, bind solo a 127.0.0.1 (Nginx se encarga del tráfico externo), y leer secrets desde `.env.production`.

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Crear docker-compose.prod.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: contachile-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: contachile-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    image: contachile/api:latest
    container_name: contachile-api
    env_file: .env.production
    ports:
      - "127.0.0.1:3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    image: contachile/web:latest
    container_name: contachile-web
    env_file: .env.production
    environment:
      # Llamadas server-side van directo al API via red Docker interna
      API_BASE_URL: http://api:3001
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
```

**Nota clave:** `API_BASE_URL: http://api:3001` hace que el web container llame al API via la red interna Docker. Esto elimina los 403 porque ambos comparten el mismo `BETTER_AUTH_SECRET` del `.env.production`.

- [ ] **Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat(infra): docker-compose.prod.yml con stack completo para VPS"
```

---

## Task 4: Crear `.env.production.example`

**Por qué:** Documentar todos los secrets requeridos para que el servidor sepa qué configurar.

**Files:**
- Create: `.env.production.example`

- [ ] **Step 1: Crear el archivo**

```bash
# ── PostgreSQL ────────────────────────────────────────────────────────────────
POSTGRES_USER=contachile
POSTGRES_PASSWORD=CAMBIAR_POR_CONTRASEÑA_SEGURA
POSTGRES_DB=contachile
DATABASE_URL=postgresql://contachile:CAMBIAR_POR_CONTRASEÑA_SEGURA@postgres:5432/contachile

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=CAMBIAR_POR_CONTRASEÑA_REDIS
REDIS_URL=redis://:CAMBIAR_POR_CONTRASEÑA_REDIS@redis:6379

# ── Better Auth ───────────────────────────────────────────────────────────────
# Mismo secret en web y api — crítico para que las sesiones funcionen
BETTER_AUTH_SECRET=CAMBIAR_POR_SECRET_32_CHARS_MINIMO
BETTER_AUTH_URL=https://TU_DOMINIO.cl

# ── Next.js / Web ─────────────────────────────────────────────────────────────
NEXTAUTH_URL=https://TU_DOMINIO.cl
NEXT_PUBLIC_APP_URL=https://TU_DOMINIO.cl
# API_BASE_URL se setea en docker-compose.prod.yml como http://api:3001

# ── OAuth (Google) ────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── OAuth (Microsoft) ─────────────────────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common

# ── Anthropic (IA) ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=

# ── Resend (email) ────────────────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM=noreply@TU_DOMINIO.cl

# ── Fintoc (banca) ────────────────────────────────────────────────────────────
FINTOC_SECRET_KEY=

# ── Storage ───────────────────────────────────────────────────────────────────
# Opción A: Cloudflare R2 (recomendado para DTE XML)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=contachile-dte

# Opción B: MinIO self-hosted (agregar servicio minio al docker-compose si se prefiere)
# S3_ENDPOINT=http://minio:9000
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
# S3_BUCKET=contachile-dte
```

- [ ] **Step 2: Agregar .env.production al .gitignore**

```bash
echo ".env.production" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add .env.production.example .gitignore
git commit -m "feat(infra): plantilla .env.production con todos los secrets requeridos"
```

---

## Task 5: Crear configuración Nginx

**Por qué:** Nginx termina SSL, redirige HTTP→HTTPS, y hace reverse proxy al web container (puerto 3000) en el host. El API no se expone directamente al exterior — el web lo llama internamente.

**Files:**
- Create: `nginx/contachile.conf`

- [ ] **Step 1: Crear nginx/contachile.conf**

Reemplazar `TU_DOMINIO.cl` con el dominio real:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name TU_DOMINIO.cl www.TU_DOMINIO.cl;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name TU_DOMINIO.cl www.TU_DOMINIO.cl;

    ssl_certificate /etc/letsencrypt/live/TU_DOMINIO.cl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/TU_DOMINIO.cl/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy al web container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 50M;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add nginx/
git commit -m "feat(infra): configuración Nginx reverse proxy con SSL"
```

---

## Task 6: Crear scripts de deploy y setup del VPS

**Por qué:** El setup del VPS (Docker, Nginx, Certbot) se hace una sola vez. El deploy se ejecuta cada vez que hay cambios.

**Files:**
- Create: `scripts/setup-vps.sh`
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Crear scripts/setup-vps.sh**

```bash
#!/bin/bash
# Ejecutar una vez en el VPS fresco (Ubuntu 22.04+)
set -e

echo "=== Instalando Docker ==="
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker

echo "=== Instalando Nginx ==="
sudo apt-get update
sudo apt-get install -y nginx

echo "=== Instalando Certbot ==="
sudo apt-get install -y certbot python3-certbot-nginx

echo "=== Clonando repo ==="
read -p "URL del repositorio git: " REPO_URL
git clone "$REPO_URL" /opt/contachile
cd /opt/contachile

echo "=== Configurando .env.production ==="
cp .env.production.example .env.production
echo "⚠️  Edita /opt/contachile/.env.production con tus secrets antes de continuar"
echo "   Luego ejecuta: scripts/deploy.sh"
```

- [ ] **Step 2: Crear scripts/deploy.sh**

```bash
#!/bin/bash
# Deploy / redeploy. Ejecutar desde /opt/contachile en el VPS.
set -e

cd /opt/contachile

echo "=== Pull últimos cambios ==="
git pull origin main

echo "=== Construyendo imágenes ==="
docker compose -f docker-compose.prod.yml build --no-cache

echo "=== Levantando servicios ==="
docker compose -f docker-compose.prod.yml up -d

echo "=== Ejecutando migraciones Prisma ==="
docker compose -f docker-compose.prod.yml exec api pnpm --filter @contachile/db db:migrate:deploy

echo "=== Estado de servicios ==="
docker compose -f docker-compose.prod.yml ps

echo "✅ Deploy completo"
```

- [ ] **Step 3: Crear scripts/setup-ssl.sh**

```bash
#!/bin/bash
# Obtener certificado SSL con Let's Encrypt. Ejecutar después de apuntar el dominio al VPS.
set -e

read -p "Dominio (ej: contachile.cl): " DOMAIN
read -p "Email para notificaciones SSL: " EMAIL

# Asegurarse que Nginx esté levantado sirviendo HTTP
sudo systemctl start nginx

sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email

echo "✅ SSL configurado para $DOMAIN"
echo "   Renovación automática via cron de certbot"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/
chmod +x scripts/*.sh
git commit -m "feat(infra): scripts de setup VPS y deploy"
```

---

## Task 7: Verificar y corregir `api-server.ts` para que use `API_BASE_URL` del env

**Por qué:** El web container usa `API_BASE_URL=http://api:3001` (red Docker interna). Hay que verificar que `apps/web/lib/api-server.ts` use esta variable correctamente y no tenga un fallback a `localhost` que rompa en producción.

**Files:**
- Verify/Modify: `apps/web/lib/api-server.ts`

- [ ] **Step 1: Leer api-server.ts y verificar API_BASE_URL**

```bash
cat apps/web/lib/api-server.ts | grep -A2 "API_BASE_URL\|BASE_URL\|localhost"
```

- [ ] **Step 2: Asegurar que el fallback de desarrollo no rompe producción**

El archivo debe tener algo similar a:
```typescript
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'
```

En producción Docker, `API_BASE_URL=http://api:3001` se inyecta desde docker-compose.prod.yml. En desarrollo, cae al `localhost:3001`. Esto es correcto — no cambiar.

- [ ] **Step 3: Si usa variable diferente, actualizar docker-compose.prod.yml**

Si `api-server.ts` usa `NEXT_PUBLIC_API_URL` u otra variable, actualizar el bloque `environment` del servicio `web` en `docker-compose.prod.yml` para usar el nombre correcto.

---

## Task 8: Guía de despliegue en el VPS (README del proceso)

**Por qué:** Documentar los pasos exactos para reproducir el deploy en el futuro.

**Files:**
- Create: `docs/deploy-vps.md`

- [ ] **Step 1: Crear la guía**

```markdown
# Deploy ContaChile en VPS Ubuntu

## Prerrequisitos
- VPS Ubuntu 22.04+ con IP pública
- Dominio apuntando al IP del VPS (DNS A record)
- Acceso SSH

## 1. Setup inicial (solo una vez)

```bash
ssh usuario@IP_DEL_VPS
bash <(curl -s https://raw.githubusercontent.com/TU_REPO/main/scripts/setup-vps.sh)
```

## 2. Configurar secrets

```bash
nano /opt/contachile/.env.production
# Completar todos los valores del ejemplo
```

## 3. Configurar Nginx

```bash
sudo cp /opt/contachile/nginx/contachile.conf /etc/nginx/sites-available/contachile
# Editar TU_DOMINIO.cl con el dominio real
sudo nano /etc/nginx/sites-available/contachile
sudo ln -s /etc/nginx/sites-available/contachile /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Obtener SSL

```bash
bash /opt/contachile/scripts/setup-ssl.sh
```

## 5. Primer deploy

```bash
cd /opt/contachile
bash scripts/deploy.sh
```

## Redeploy (actualizaciones)

```bash
cd /opt/contachile
bash scripts/deploy.sh
```

## Ver logs

```bash
# Logs del API
docker compose -f docker-compose.prod.yml logs -f api

# Logs del Web
docker compose -f docker-compose.prod.yml logs -f web

# Estado de todos los servicios
docker compose -f docker-compose.prod.yml ps
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy-vps.md
git commit -m "docs: guía de deploy en VPS Ubuntu"
```

---

## Verificación final

Después del deploy, verificar que todo funciona:

- [ ] `https://TU_DOMINIO.cl` abre sin errores
- [ ] Login con Google/Microsoft funciona
- [ ] Navegar todas las páginas sin errores en consola
- [ ] No hay errores 403 (web y API comparten BETTER_AUTH_SECRET via .env.production)
- [ ] `docker compose -f docker-compose.prod.yml ps` muestra todos los servicios `healthy`

---

## Beneficios vs Cloudflare Workers

| | CF Workers (antes) | VPS self-hosted (ahora) |
|---|---|---|
| Límite CPU | 10ms/request (Error 1102) | Sin límite |
| Límite memoria | 128MB | RAM del VPS |
| Sesiones API | 403 (secret mismatch) | ✅ Mismo .env.production |
| Costo | $5/mes CF Workers Paid | Costo del VPS |
| Control | Bajo | Total |
| Logs | Solo CF dashboard | `docker logs` en tiempo real |
