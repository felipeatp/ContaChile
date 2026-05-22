# Deploy apps/web — Cloudflare Pages (OpenNext) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegar `apps/web` (Next.js 14) en Cloudflare Pages usando `@opennextjs/cloudflare`, con Prisma adaptado para Workers y un pipeline CI/CD en GitHub Actions.

**Architecture:** Se usa `@opennextjs/cloudflare` como adapter (no `@cloudflare/next-on-pages`) porque soporta Node.js runtime vía `nodejs_compat`, lo que permite que Prisma funcione sin binarios nativos usando `@prisma/adapter-pg`. Las rutas API en `apps/web` son proxies a Fastify — son puro `fetch()`, compatible con Workers. El único código que usa Prisma directamente en el contexto web es Better Auth (ruta `/api/auth/[...all]`); al hacer edge-compatible `packages/db`, queda resuelto sin cambiar `packages/auth`.

**Tech Stack:** `@opennextjs/cloudflare@latest`, `wrangler@latest`, `@prisma/adapter-pg`, `pg`, GitHub Actions `wrangler-action`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `packages/db/prisma/schema.prisma` | Modificar | Activar `driverAdapters` preview feature |
| `packages/db/package.json` | Modificar | Agregar `pg`, `@prisma/adapter-pg`, `@types/pg` |
| `packages/db/src/index.ts` | Modificar | Crear Prisma client con `PrismaPg` adapter |
| `apps/web/package.json` | Modificar | Agregar `@opennextjs/cloudflare`, `wrangler`; quitar `@vercel/analytics` |
| `apps/web/open-next.config.ts` | Crear | Configuración OpenNext para Cloudflare |
| `apps/web/wrangler.jsonc` | Crear | Configuración del Worker (nombre, flags, assets) |
| `apps/web/.dev.vars` | Crear | Variables de entorno para `wrangler dev` local |
| `apps/web/next.config.js` | Modificar | Agregar `initOpenNextCloudflareForDev()` para dev local |
| `apps/web/app/layout.tsx` | Modificar | Eliminar `@vercel/analytics` |
| `.gitignore` | Modificar | Agregar `.open-next/` |
| `.github/workflows/deploy-web.yml` | Crear | CD: build + deploy a Cloudflare Pages en cada push a `main` |
| `.github/workflows/ci.yml` | Modificar | Quitar `CLERK_SECRET_KEY` (Clerk fue eliminado) |

---

## Task 1: Hacer `packages/db` compatible con Edge (Cloudflare Workers)

**Por qué:** Cloudflare Workers no soporta binarios nativos (`.node` files). El query engine de Prisma es nativo. Con `driverAdapters` + `@prisma/adapter-pg`, Prisma usa un query engine JavaScript puro que sí funciona en Workers con `nodejs_compat`.

**Files:**
- Modify: `packages/db/prisma/schema.prisma:1-4`
- Modify: `packages/db/package.json`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1.1: Agregar `previewFeatures = ["driverAdapters"]` al schema de Prisma**

En `packages/db/prisma/schema.prisma`, cambiar el bloque `generator client`:

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/client"
  previewFeatures = ["driverAdapters"]
}
```

- [ ] **Step 1.2: Agregar dependencias pg + adapter**

```bash
pnpm --filter @contachile/db add pg @prisma/adapter-pg
pnpm --filter @contachile/db add -D @types/pg
```

Expected: `pg`, `@prisma/adapter-pg` aparecen en `packages/db/package.json` bajo `dependencies`.

- [ ] **Step 1.3: Actualizar `packages/db/src/index.ts` para usar `PrismaPg`**

```typescript
import { PrismaClient } from '../generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({ adapter })
export * from '../generated/client'
```

- [ ] **Step 1.4: Regenerar Prisma Client**

```bash
pnpm --filter @contachile/db exec prisma generate
```

Expected: Sin errores. El cliente se regenera en `packages/db/generated/client/`.

- [ ] **Step 1.5: Verificar que el build del paquete sigue pasando**

```bash
pnpm --filter @contachile/db build
```

Expected: `dist/index.js` generado sin errores TypeScript.

- [ ] **Step 1.6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/package.json packages/db/src/index.ts pnpm-lock.yaml
git commit -m "feat(db): use @prisma/adapter-pg for edge/workers compatibility"
```

---

## Task 2: Limpiar dependencias Vercel de `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 2.1: Desinstalar `@vercel/analytics`**

```bash
pnpm --filter @contachile/web remove @vercel/analytics
```

Expected: `@vercel/analytics` desaparece de `apps/web/package.json`.

- [ ] **Step 2.2: Eliminar `<Analytics />` de `apps/web/app/layout.tsx`**

Quitar la línea de import y el componente:

```typescript
// Eliminar esta línea:
import { Analytics } from "@vercel/analytics/next"

// Eliminar esta línea del JSX:
<Analytics />
```

El `layout.tsx` queda así en el `<body>`:

```typescript
<body className="font-sans antialiased">
  <WebVitals />
  <JsonLd data={organizationSchema} />
  <Providers>{children}</Providers>
</body>
```

- [ ] **Step 2.3: Verificar que `apps/web` compila**

```bash
pnpm --filter @contachile/web build
```

Expected: Build exitoso, sin referencia a `@vercel/analytics`.

- [ ] **Step 2.4: Commit**

```bash
git add apps/web/package.json apps/web/app/layout.tsx pnpm-lock.yaml
git commit -m "chore(web): remove @vercel/analytics, replace with PostHog later"
```

---

## Task 3: Instalar y configurar `@opennextjs/cloudflare`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/wrangler.jsonc`
- Modify: `apps/web/next.config.js`
- Modify: `.gitignore`

- [ ] **Step 3.1: Instalar `@opennextjs/cloudflare` y `wrangler`**

```bash
pnpm --filter @contachile/web add -D @opennextjs/cloudflare wrangler
```

Expected: Ambos paquetes en `devDependencies` de `apps/web/package.json`.

- [ ] **Step 3.2: Actualizar scripts en `apps/web/package.json`**

Agregar estos scripts al objeto `"scripts"` existente:

```json
"build:cf": "opennextjs-cloudflare build",
"preview:cf": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy:cf": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
```

- [ ] **Step 3.3: Crear `apps/web/open-next.config.ts`**

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare"

export default defineCloudflareConfig({})
```

> Nota: Sin `r2IncrementalCache` por ahora — lo agregamos cuando conectemos R2 en una fase posterior.

- [ ] **Step 3.4: Crear `apps/web/wrangler.jsonc`**

```jsonc
{
  // Nombre del Worker en Cloudflare (debe ser único en tu cuenta)
  "name": "contachile-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "contachile-web"
    }
  ]
}
```

- [ ] **Step 3.5: Actualizar `apps/web/next.config.js` para dev local con OpenNext**

Agregar la llamada a `initOpenNextCloudflareForDev()` al inicio del archivo. El archivo completo queda:

```javascript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
const withPWA = require('@ducanh2912/next-pwa').default

initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
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

> Nota: `initOpenNextCloudflareForDev()` solo actúa cuando `NODE_ENV === 'development'` y hay Wrangler corriendo — no afecta el build de producción.

- [ ] **Step 3.6: Agregar `.open-next/` al `.gitignore` raíz**

En el `.gitignore` del repo, agregar:

```
# OpenNext Cloudflare build output
apps/web/.open-next/
```

- [ ] **Step 3.7: Commit**

```bash
git add apps/web/package.json apps/web/open-next.config.ts apps/web/wrangler.jsonc apps/web/next.config.js .gitignore pnpm-lock.yaml
git commit -m "feat(web): add @opennextjs/cloudflare config and wrangler setup"
```

---

## Task 4: Variables de entorno — `.dev.vars` y Cloudflare Dashboard

**Files:**
- Create: `apps/web/.dev.vars` (no se commitea — agregar a `.gitignore`)

- [ ] **Step 4.1: Crear `apps/web/.dev.vars`**

Este archivo es el equivalente de `.env.local` para `wrangler dev`:

```
# Requerido por @opennextjs/cloudflare en dev
NEXTJS_ENV=development

# Better Auth
BETTER_AUTH_SECRET=<tu_secret_local>
BETTER_AUTH_URL=http://localhost:3000
WEB_URL=http://localhost:3000

# OAuth
GOOGLE_CLIENT_ID=<tu_google_client_id>
GOOGLE_CLIENT_SECRET=<tu_google_client_secret>

# Base de datos (Neon)
DATABASE_URL=<tu_neon_connection_string>

# API Fastify
NEXT_PUBLIC_API_URL=http://localhost:3001

# Anthropic (para agente IA)
ANTHROPIC_API_KEY=<tu_anthropic_key>
```

- [ ] **Step 4.2: Agregar `.dev.vars` al `.gitignore`**

```
# Wrangler local secrets
apps/web/.dev.vars
```

- [ ] **Step 4.3: Configurar variables en Cloudflare Dashboard (producción)**

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages
2. Abrir el proyecto `contachile-web` (se crea en el Task 5)
3. Settings → Variables and Secrets → agregar:

| Variable | Tipo |
|----------|------|
| `BETTER_AUTH_SECRET` | Secret |
| `BETTER_AUTH_URL` | Variable (`https://contachile.cl`) |
| `WEB_URL` | Variable (`https://contachile.cl`) |
| `GOOGLE_CLIENT_ID` | Variable |
| `GOOGLE_CLIENT_SECRET` | Secret |
| `MICROSOFT_CLIENT_ID` | Variable (opcional) |
| `MICROSOFT_CLIENT_SECRET` | Secret (opcional) |
| `DATABASE_URL` | Secret (Neon connection string) |
| `NEXT_PUBLIC_API_URL` | Variable (URL de `apps/api` en Fly.io) |
| `ANTHROPIC_API_KEY` | Secret |

> `NEXT_PUBLIC_*` variables deben agregarse también en Build Variables, no solo en Runtime Variables.

---

## Task 5: Primer build local y verificación

- [ ] **Step 5.1: Instalar dependencias actualizadas**

Desde la raíz del monorepo:

```bash
pnpm install
```

- [ ] **Step 5.2: Regenerar Prisma Client (para asegurar que todos los cambios del Task 1 están activos)**

```bash
pnpm --filter @contachile/db exec prisma generate
```

- [ ] **Step 5.3: Build de la web con OpenNext**

```bash
cd apps/web && pnpm build:cf
```

Expected: El proceso hace `next build` seguido por `opennextjs-cloudflare build`. Termina con algo como:
```
✓ OpenNext build completed
Output directory: .open-next
```

Si hay errores de TypeScript, arreglarlos antes de continuar.

- [ ] **Step 5.4: Preview local (opcional pero recomendado)**

```bash
cd apps/web && pnpm preview:cf
```

Expected: Wrangler inicia en `http://localhost:8787`. Navegar y verificar que el login carga, las rutas del dashboard responden.

- [ ] **Step 5.5: Commit de `.dev.vars` placeholder (sin valores reales)**

```bash
git add apps/web/.dev.vars.example  # solo si decides crear un .example
git commit -m "docs(web): add .dev.vars.example for Cloudflare local dev"
```

---

## Task 6: GitHub Actions — Pipeline CD

**Files:**
- Create: `.github/workflows/deploy-web.yml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 6.1: Crear `.github/workflows/deploy-web.yml`**

```yaml
name: Deploy Web → Cloudflare Pages

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/db/**'
      - 'packages/auth/**'
      - 'packages/validators/**'
      - 'pnpm-lock.yaml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Build & Deploy to Cloudflare

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 8.15.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm --filter @contachile/db exec prisma generate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Build packages
        run: pnpm --filter @contachile/validators build && pnpm --filter @contachile/auth build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}

      - name: Build web with OpenNext
        run: pnpm --filter @contachile/web build:cf
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
          BETTER_AUTH_URL: ${{ vars.BETTER_AUTH_URL }}
          WEB_URL: ${{ vars.WEB_URL }}
          GOOGLE_CLIENT_ID: ${{ vars.GOOGLE_CLIENT_ID }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}

      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/web
          command: deploy
```

- [ ] **Step 6.2: Agregar secrets en GitHub**

En el repo de GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Token de Cloudflare con permisos `Workers:Edit` y `Workers Scripts:Edit` |
| `DATABASE_URL` | Neon connection string |
| `BETTER_AUTH_SECRET` | El secret de Better Auth |
| `GOOGLE_CLIENT_SECRET` | Secret de Google OAuth |

Variables (no secretas):

| Variable | Valor |
|----------|-------|
| `BETTER_AUTH_URL` | `https://contachile.cl` |
| `WEB_URL` | `https://contachile.cl` |
| `NEXT_PUBLIC_API_URL` | URL de la API en Fly.io (configurar después del deploy de API) |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth |

- [ ] **Step 6.3: Generar el Cloudflare API Token**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → My Profile → API Tokens → Create Token
2. Usar template "Edit Cloudflare Workers"
3. Scope: Account → Workers Scripts → Edit, Account → Workers KV Storage → Edit
4. Copiar el token y guardarlo como `CLOUDFLARE_API_TOKEN` en GitHub Secrets

- [ ] **Step 6.4: Limpiar `ci.yml` — quitar referencias a Clerk**

En `.github/workflows/ci.yml`, cambiar:

```yaml
# Eliminar estas dos líneas donde aparezcan:
CLERK_SECRET_KEY: test-key
```

Quedan solo:

```yaml
env:
  DATABASE_URL: postgresql://contachile:contachile@localhost:5432/contachile
  REDIS_HOST: localhost
  REDIS_PORT: 6379
  SII_BASE_URL: https://maullin.sii.cl
  SII_ENV: test
  ACEPTA_API_KEY: test-key
```

- [ ] **Step 6.5: Commit**

```bash
git add .github/workflows/deploy-web.yml .github/workflows/ci.yml
git commit -m "ci: add Cloudflare Pages deploy workflow, remove stale Clerk env"
```

---

## Task 7: Primer deploy real y verificación

- [ ] **Step 7.1: Push a `main` y observar el workflow**

```bash
git push origin main
```

Ir a GitHub → Actions → "Deploy Web → Cloudflare Pages". Verificar que todos los pasos pasen.

Expected: Último step "Deploy to Cloudflare" termina con:
```
✅ Deployed to https://contachile-web.<tu-cuenta>.workers.dev
```

- [ ] **Step 7.2: Verificar la URL de preview de Workers**

Abrir `https://contachile-web.<tu-cuenta>.workers.dev` en el navegador.
- La landing page debe cargar sin errores JS en consola
- `/login` debe mostrar los botones de Google y Microsoft

- [ ] **Step 7.3: Configurar dominio personalizado (opcional en esta fase)**

En Cloudflare Dashboard → Workers & Pages → `contachile-web` → Custom Domains → Add:
- `contachile.cl` (o el dominio que tengas)
- Cloudflare gestiona automáticamente el SSL/TLS

- [ ] **Step 7.4: Actualizar `BETTER_AUTH_URL` y `trustedOrigins` si se activa dominio propio**

En `packages/auth/src/index.ts`, el `BETTER_AUTH_URL` env var ya está configurado para leer de env. Solo actualizar la variable en Cloudflare Dashboard y GitHub Actions.

- [ ] **Step 7.5: Smoke test del flujo de auth**

1. Abrir la URL de producción → `/login`
2. Intentar login con Google OAuth
3. Verificar que la sesión persiste y el dashboard carga
4. Verificar que `/api/f29` devuelve 401 si no hay sesión (no 500)

---

## Notas de troubleshooting

**Error: `Cannot find module 'pg'` en Workers**
→ Verificar que `nodejs_compat` está en `compatibility_flags` del `wrangler.jsonc`

**Error: Prisma binary not found**
→ Verificar que `previewFeatures = ["driverAdapters"]` está en `schema.prisma` y que se hizo `prisma generate` después del cambio.

**Error: `WORKER_SELF_REFERENCE` binding not found**
→ El Worker aún no existe en Cloudflare. Hacer el primer deploy manual con `cd apps/web && npx wrangler deploy` antes de que el workflow lo cree.

**PWA Service Worker no registra**
→ Normal en `wrangler dev`. La PWA solo funciona en producción (HTTPS). Verificar en la URL de Workers.dev.

**OAuth redirect URI mismatch**
→ Agregar `https://contachile-web.<cuenta>.workers.dev` y `https://contachile.cl` a los "Authorized redirect URIs" en Google Cloud Console.

---

Sources:
- [OpenNext Cloudflare — Get Started](https://opennext.js.org/cloudflare/get-started)
- [Cloudflare — Next.js Workers Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Prisma — Neon + driverAdapters](https://www.prisma.io/docs/orm/v6/overview/databases/neon)
- [Wrangler Action — GitHub](https://github.com/cloudflare/wrangler-action)
