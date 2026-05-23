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

# Generate Prisma client (must run before any package that depends on @contachile/db)
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
