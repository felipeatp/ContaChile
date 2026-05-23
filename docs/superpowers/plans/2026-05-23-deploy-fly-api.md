# Deploy apps/api to Fly.io Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Fastify API (`apps/api`) to Fly.io with BullMQ workers running persistently, Redis via Upstash, and a GitHub Actions CD pipeline.

**Architecture:** The API runs as a single Node.js process that includes both the Fastify HTTP server and BullMQ workers (dte-polling + daily alerts). They share in-process — no separate worker dyno needed. Upstash Redis provides the BullMQ backend via TLS URL (`rediss://`). The Dockerfile builds the entire monorepo and copies artifacts to a lean runner image.

**Tech Stack:** Node.js 20, Fastify 4, BullMQ 5, ioredis 5, Prisma 5 (driverAdapters), pnpm 8 monorepo, Fly.io (region: scl), Upstash Redis, GitHub Actions.

---

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/auth/package.json` | Modify | Fix `main` to point to compiled `dist/` so Node.js can load it at runtime |
| `apps/api/src/lib/redis.ts` | Create | Shared Redis client factory — supports `REDIS_URL` (Upstash TLS) and `REDIS_HOST`/`REDIS_PORT` (local) |
| `apps/api/src/queues/dte.ts` | Modify | Use shared `createRedisClient()` instead of inline connection object |
| `apps/api/src/workers/dte-polling.ts` | Modify | Use shared `createRedisClient()` |
| `apps/api/src/workers/alerts.ts` | Modify | Use shared `createRedisClient()` |
| `apps/api/Dockerfile` | Modify | Add missing package builds (auth, ai-agents, fintoc-client); move `prisma generate` to builder; remove `npx` from runner |
| `fly.toml` | Create | Fly.io app config — region scl, port 3001, health check |
| `apps/api/.env.fly.example` | Create | All production secrets documented |
| `.github/workflows/deploy-api.yml` | Create | CD: push to main → `fly deploy` |

---

## Task 1: Fix `packages/auth` — point `main` to compiled output

**Problem:** `packages/auth/package.json` has `"main": "./src/index.ts"`. Node.js (v20) cannot execute `.ts` files. At runtime in Docker, `require('@contachile/auth')` will crash. TypeScript uses the `types` field for type-checking, so we only need to fix `main`.

**Files:**
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Update `packages/auth/package.json`**

Change `"main"` to point to compiled output. `types` stays as `./src/index.ts` so TypeScript resolution is unaffected.

```json
{
  "name": "@contachile/auth",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@contachile/db": "workspace:*",
    "better-auth": "^1.6.11"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Verify the auth package compiles**

```bash
pnpm --filter @contachile/auth build
```

Expected: creates `packages/auth/dist/index.js` with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/package.json packages/auth/dist
git commit -m "fix(auth): point main to dist/index.js for Node.js runtime compatibility"
```

---

## Task 2: Shared Redis client — support Upstash TLS URL

**Problem:** `queues/dte.ts` and both workers each define their own `redisConnection = { host, port }`. Upstash Redis uses a `rediss://` URL with TLS auth — that format won't work with a plain host/port object. Create a single shared factory.

**Files:**
- Create: `apps/api/src/lib/redis.ts`
- Modify: `apps/api/src/queues/dte.ts`
- Modify: `apps/api/src/workers/dte-polling.ts`
- Modify: `apps/api/src/workers/alerts.ts`

- [ ] **Step 1: Create `apps/api/src/lib/redis.ts`**

```typescript
import Redis from 'ioredis'

// BullMQ requires maxRetriesPerRequest: null on the shared connection.
// enableReadyCheck: false is required for Upstash TLS connections.
const BULLMQ_OPTS = { maxRetriesPerRequest: null, enableReadyCheck: false } as const

export function createRedisClient(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, BULLMQ_OPTS)
  }
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...BULLMQ_OPTS,
  })
}

export async function probeRedis(): Promise<boolean> {
  const opts = process.env.REDIS_URL
    ? { connectTimeout: 2000, lazyConnect: true }
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: 2000,
        lazyConnect: true,
      }
  const probe = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, opts)
    : new Redis(opts as any)
  probe.on('error', () => {})
  try {
    await probe.connect()
    await probe.disconnect()
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Update `apps/api/src/queues/dte.ts`**

Replace the inline `redisConnection` object and Redis probe with the shared helpers:

```typescript
import { Queue } from 'bullmq'
import { createRedisClient, probeRedis } from '../lib/redis'

let dteQueue: Queue | null = null

async function initQueue(): Promise<void> {
  if (!(await probeRedis())) return

  dteQueue = new Queue('dte-polling', {
    connection: createRedisClient(),
    defaultJobOptions: {
      attempts: 24,
      backoff: {
        type: 'fixed',
        delay: 5 * 60 * 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  })
}

void initQueue()

export interface PollJobData {
  documentId: string
  trackId: string
  source: 'sii' | 'acepta'
}

export async function enqueuePollJob(data: PollJobData): Promise<void> {
  if (!dteQueue) {
    return
  }
  await dteQueue.add('poll-status', data)
}
```

- [ ] **Step 3: Update `apps/api/src/workers/dte-polling.ts`**

Replace the inline `redisConnection` block and probe block with the shared helpers. The worker logic stays the same — only the connection setup changes:

```typescript
import { Worker } from 'bullmq'
import { prisma } from '@contachile/db'
import { SIIClient } from '@contachile/transport-sii'
import { AceptaClient } from '@contachile/transport-acepta'
import { PollJobData } from '../queues/dte'
import { createEmailService } from '../lib/email'
import { createRedisClient, probeRedis } from '../lib/redis'

const emailService = createEmailService()

const SIMULATE_DTE_STATUS = process.env.SIMULATE_DTE_STATUS === 'true'
const SIMULATED_ATTEMPTS = parseInt(process.env.SIMULATED_ATTEMPTS || '3', 10)

const siiClient = new SIIClient({
  baseURL: process.env.SII_BASE_URL || 'https://maullin.sii.cl',
  env: (process.env.SII_ENV as 'test' | 'production') || 'test',
})

const aceptaClient = new AceptaClient({
  apiKey: process.env.ACEPTA_API_KEY || 'test-key',
  baseURL: process.env.ACEPTA_BASE_URL,
})

async function initWorker(): Promise<void> {
  if (!(await probeRedis())) return

  new Worker<PollJobData>(
    'dte-polling',
    async (job) => {
      const { documentId, trackId, source } = job.data
      const attempt = job.attemptsMade + 1

      if (SIMULATE_DTE_STATUS) {
        if (attempt < SIMULATED_ATTEMPTS) {
          if (process.env.NODE_ENV !== 'production') console.log(`[dte-worker] Simulating PENDING for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)
          throw new Error(`Simulated PENDING for ${documentId}`)
        }

        if (process.env.NODE_ENV !== 'production') console.log(`[dte-worker] Simulating ACCEPTED for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)

        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        })

        const doc = await prisma.document.findUnique({ where: { id: documentId } })
        if (doc?.receiverEmail) {
          await emailService.sendDocumentAccepted({
            documentId: doc.id,
            folio: doc.folio,
            type: doc.type,
            receiverName: doc.receiverName,
            receiverEmail: doc.receiverEmail,
          })
        }

        await prisma.auditLog.create({
          data: { documentId, action: 'ACCEPTED', payload: { source, simulated: true } },
        })

        return { documentId, status: 'ACCEPTED', simulated: true }
      }

      const statusResult =
        source === 'sii'
          ? await siiClient.queryStatus(trackId)
          : await aceptaClient.queryStatus(trackId)

      if (statusResult.status === 'PENDING') {
        throw new Error(`Document ${documentId} still pending`)
      }

      const newStatus = statusResult.status

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: newStatus,
          ...(newStatus === 'ACCEPTED'
            ? { acceptedAt: new Date() }
            : newStatus === 'REJECTED'
              ? { rejectedAt: new Date(), rejectionReason: statusResult.detail }
              : {}),
        },
      })

      if (newStatus === 'ACCEPTED') {
        const doc = await prisma.document.findUnique({ where: { id: documentId } })
        if (doc?.receiverEmail) {
          await emailService.sendDocumentAccepted({
            documentId: doc.id,
            folio: doc.folio,
            type: doc.type,
            receiverName: doc.receiverName,
            receiverEmail: doc.receiverEmail,
          })
        }
      }

      await prisma.auditLog.create({
        data: { documentId, action: newStatus, payload: { source, detail: statusResult.detail } },
      })

      return { documentId, status: newStatus }
    },
    { connection: createRedisClient() }
  )
}

void initWorker()
```

- [ ] **Step 4: Update `apps/api/src/workers/alerts.ts`**

Replace inline `redisConnection` with shared helpers:

```typescript
import { Worker, Queue, JobsOptions } from 'bullmq'
import { prisma } from '@contachile/db'
import { findUpcomingDueDates } from '@contachile/validators'
import { createEmailService } from '../lib/email'
import { createRedisClient, probeRedis } from '../lib/redis'

const emailService = createEmailService()

const ALERT_DAYS_BEFORE = [5, 1]
const QUEUE_NAME = 'alerts-daily'
const JOB_NAME = 'send-due-alerts'

export async function processDailyAlerts(now: Date = new Date()): Promise<{
  companies: number
  emailsSent: number
  alertsRegistered: number
  skipped: number
  errors: number
}> {
  const stats = { companies: 0, emailsSent: 0, alertsRegistered: 0, skipped: 0, errors: 0 }
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, email: true },
  })

  stats.companies = companies.length

  for (const company of companies) {
    const upcoming = findUpcomingDueDates(now)

    for (const alert of upcoming) {
      if (!ALERT_DAYS_BEFORE.includes(alert.daysUntil)) continue

      try {
        const already = await prisma.alertSent.findUnique({
          where: {
            companyId_alertCode_dueDate_daysBefore: {
              companyId: company.id,
              alertCode: alert.code,
              dueDate: alert.dueDate,
              daysBefore: alert.daysUntil,
            },
          },
        })
        if (already) {
          stats.skipped++
          continue
        }

        if (company.email) {
          await emailService.sendDueAlert({
            recipientEmail: company.email,
            recipientName: company.name,
            label: alert.label,
            description: alert.description,
            dueDate: alert.dueDate,
            daysUntil: alert.daysUntil,
            link: alert.link,
          })
          stats.emailsSent++
        }

        await prisma.alertSent.create({
          data: {
            companyId: company.id,
            alertCode: alert.code,
            dueDate: alert.dueDate,
            daysBefore: alert.daysUntil,
          },
        })
        stats.alertsRegistered++
      } catch {
        stats.errors++
      }
    }
  }

  return stats
}

async function initWorker(): Promise<void> {
  if (!(await probeRedis())) return

  new Worker(
    QUEUE_NAME,
    async () => {
      const stats = await processDailyAlerts()
      return stats
    },
    { connection: createRedisClient() }
  )

  const queue = new Queue(QUEUE_NAME, {
    connection: createRedisClient(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 50,
    },
  })

  const repeatOptions: JobsOptions = {
    repeat: {
      pattern: '0 8 * * *',
      tz: 'America/Santiago',
    },
  }
  await queue.add(JOB_NAME, {}, repeatOptions)
}

void initWorker()
```

- [ ] **Step 5: Build the API to verify TypeScript compiles**

```bash
pnpm --filter @contachile/api build
```

Expected: no TypeScript errors. `apps/api/dist/` is updated.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/redis.ts apps/api/src/queues/dte.ts apps/api/src/workers/dte-polling.ts apps/api/src/workers/alerts.ts
git commit -m "feat(api): add shared Redis client with Upstash TLS URL support"
```

---

## Task 3: Fix Dockerfile — complete build chain

**Problem:** The current Dockerfile is missing builds for `@contachile/auth`, `@contachile/ai-agents`, and `@contachile/fintoc-client`. Also `prisma generate` runs in the runner stage via `npx` (wrong Prisma version risk); it should run in the builder stage.

**Files:**
- Modify: `apps/api/Dockerfile`

- [ ] **Step 1: Replace `apps/api/Dockerfile`**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client (must happen before building packages that depend on @contachile/db)
RUN pnpm --filter @contachile/db db:generate

# Build workspace packages in dependency order
RUN pnpm --filter @contachile/validators build
RUN pnpm --filter @contachile/db build
RUN pnpm --filter @contachile/auth build
RUN pnpm --filter @contachile/dte build
RUN pnpm --filter @contachile/transport-sii build
RUN pnpm --filter @contachile/transport-acepta build
RUN pnpm --filter @contachile/fintoc-client build
RUN pnpm --filter @contachile/ai-agents build
RUN pnpm --filter @contachile/api build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy only necessary files from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
```

Key changes vs original:
- Added `db:generate` step in builder (uses project's Prisma 5.22.0, not `npx`)
- Added builds for `@contachile/auth`, `@contachile/fintoc-client`, `@contachile/ai-agents`
- Removed `npx prisma generate` from runner stage

- [ ] **Step 2: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "fix(api): complete Docker build chain — add missing packages and move prisma generate to builder"
```

---

## Task 4: Create `fly.toml`

**Files:**
- Create: `fly.toml` (repo root — build context must be the monorepo root)

- [ ] **Step 1: Create `fly.toml` at repo root**

```toml
app = "contachile-api"
primary_region = "scl"

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  PORT = "3001"
  NODE_ENV = "production"
  SIMULATE_DTE_STATUS = "false"
  SII_ENV = "test"
  SII_BASE_URL = "https://maullin.sii.cl"
  FINTOC_USE_REAL = "false"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

Notes:
- `min_machines_running = 1` — keeps one machine up so BullMQ cron (daily alerts at 08:00) fires reliably. 1 machine × 720 h/month is within Fly.io free tier (2,160 h/month included per shared-cpu-1x VM).
- `primary_region = "scl"` — Santiago, Chile (closest to target users).
- Secrets (DATABASE_URL, REDIS_URL, etc.) are set via `fly secrets set` — never in fly.toml.

- [ ] **Step 2: Commit**

```bash
git add fly.toml
git commit -m "chore: add fly.toml for contachile-api deployment (Fly.io scl)"
```

---

## Task 5: Create `.env.fly.example` and CD workflow

**Files:**
- Create: `apps/api/.env.fly.example`
- Create: `.github/workflows/deploy-api.yml`

- [ ] **Step 1: Create `apps/api/.env.fly.example`**

```bash
# ── Core ──────────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...@...neon.tech/contachile?sslmode=require
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://contachile-api.fly.dev
WEB_URL=https://contachile-web.pages.dev
CORS_ORIGINS=https://contachile-web.pages.dev,https://contachile.cl

# ── Redis (Upstash) ───────────────────────────────────────────────────────────
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
APP_URL=https://contachile-web.pages.dev

# ── SII ───────────────────────────────────────────────────────────────────────
SII_ENV=test
SII_BASE_URL=https://maullin.sii.cl
# When certified: SII_ENV=production, SII_BASE_URL=https://palena.sii.cl

# ── Acepta.com (bridge DTE) ───────────────────────────────────────────────────
ACEPTA_API_KEY=<from acepta.com>

# ── Fintoc (open banking) ─────────────────────────────────────────────────────
FINTOC_SECRET_KEY=<from fintoc.com>
FINTOC_BASE_URL=https://api.fintoc.com/v1
FINTOC_USE_REAL=false

# ── AI (Anthropic) ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── OAuth (passed through for Better Auth token exchange) ─────────────────────
GOOGLE_CLIENT_ID=<same as web>
GOOGLE_CLIENT_SECRET=<same as web>
MICROSOFT_CLIENT_ID=<same as web>
MICROSOFT_CLIENT_SECRET=<same as web>
```

- [ ] **Step 2: Create `.github/workflows/deploy-api.yml`**

```yaml
name: Deploy API to Fly.io

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - 'fly.toml'
      - 'pnpm-lock.yaml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: []
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

`--remote-only` tells Fly.io to build the Docker image on their side using the Dockerfile and the repo context — no local Docker needed in CI.

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.fly.example .github/workflows/deploy-api.yml
git commit -m "chore(api): add .env.fly.example and Fly.io CD workflow"
```

---

## Task 6: First deploy — manual steps (user runs these)

These commands are run **once** to bootstrap the Fly.io app. After that, pushes to `main` trigger the CD workflow automatically.

**Prerequisites:** Fly.io account created at fly.io. Upstash Redis free account at upstash.com.

- [ ] **Step 1: Install flyctl**

```bash
# macOS/Linux:
curl -L https://fly.io/install.sh | sh
# Windows (PowerShell):
iwr https://fly.io/install.ps1 -useb | iex
```

- [ ] **Step 2: Login to Fly.io**

```bash
fly auth login
```

Opens browser — log in with your Fly.io account.

- [ ] **Step 3: Create the app (first time only)**

Run from the repo root (where `fly.toml` lives):

```bash
fly apps create contachile-api --org personal
```

- [ ] **Step 4: Create Upstash Redis**

Go to [console.upstash.com](https://console.upstash.com) → Create Database:
- Name: `contachile-redis`
- Region: South America (São Paulo or the closest option)
- Type: Regional

Copy the **REST URL** → NOT needed. Copy the **ioredis URL** (starts with `rediss://`).

- [ ] **Step 5: Set production secrets**

Replace each `<value>` with your real credentials:

```bash
fly secrets set \
  DATABASE_URL="<neon postgresql url>" \
  REDIS_URL="rediss://default:<password>@<host>.upstash.io:6379" \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  BETTER_AUTH_URL="https://contachile-api.fly.dev" \
  WEB_URL="https://contachile-web.pages.dev" \
  CORS_ORIGINS="https://contachile-web.pages.dev" \
  RESEND_API_KEY="<resend key>" \
  APP_URL="https://contachile-web.pages.dev" \
  ACEPTA_API_KEY="<acepta key>" \
  ANTHROPIC_API_KEY="<anthropic key>" \
  FINTOC_SECRET_KEY="<fintoc key>" \
  GOOGLE_CLIENT_ID="<google client id>" \
  GOOGLE_CLIENT_SECRET="<google client secret>" \
  MICROSOFT_CLIENT_ID="<microsoft client id>" \
  MICROSOFT_CLIENT_SECRET="<microsoft client secret>"
```

- [ ] **Step 6: First deploy**

```bash
fly deploy
```

This builds the Docker image remotely on Fly.io's infrastructure (avoids uploading the whole monorepo context locally). Takes ~5 minutes on first run.

Expected output ends with:
```
==> Monitoring deployment
 1 desired, 1 placed, 1 healthy, 0 unhealthy [health checks: 1 total, 1 passing]
--> v1 deployed successfully
```

- [ ] **Step 7: Smoke test**

```bash
fly status
curl https://contachile-api.fly.dev/health
```

Expected from curl: `{"status":"ok"}`

- [ ] **Step 8: Add `FLY_API_TOKEN` to GitHub secrets**

```bash
fly tokens create deploy -x 999999h
```

Copy the token. In GitHub → repo Settings → Secrets and variables → Actions → New repository secret:
- Name: `FLY_API_TOKEN`
- Value: the token from above

- [ ] **Step 9: Update `NEXT_PUBLIC_API_URL` in Cloudflare**

In Cloudflare Pages dashboard → ContaChile Web → Settings → Environment variables:

Set for **Production**:
```
NEXT_PUBLIC_API_URL = https://contachile-api.fly.dev
```

Trigger a new deployment of the web app (or push any change to `main` that touches `apps/web`).

- [ ] **Step 10: Verify end-to-end**

Open the PWA at your Cloudflare Pages URL. Log in. The API calls should now reach Fly.io and return real data.

---

## Self-Review Checklist

- [x] Auth package `main` field fixed → Node.js can load it at runtime
- [x] All 5 packages missing from Dockerfile added
- [x] `prisma generate` moved to builder stage (uses pinned Prisma 5.22.0)
- [x] `REDIS_URL` support added — Upstash TLS works
- [x] `fly.toml` with `min_machines_running = 1` → BullMQ cron fires reliably
- [x] CD workflow only triggers on relevant path changes (no wasted builds)
- [x] `--remote-only` in CD → no Docker needed in CI runner
- [x] All secrets listed in `.env.fly.example` with comments
- [x] Manual bootstrap steps include Upstash setup, GitHub secret, and Cloudflare update
