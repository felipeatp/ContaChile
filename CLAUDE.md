# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **ContaChile**, a planning and knowledge repository for a Chilean accounting and tax SaaS (competitor to Nubox/Defontana). It is currently a **documentation-only repo** — there is no active codebase, build system, or tests here. All files are Markdown planning documents.

The project targets Chilean tax compliance: DTE (electronic invoicing), F29/F22 declarations, payroll, and AI-powered automation via Claude agents.

## Repository Structure

```
plan/          — Strategic documents (vision, roadmap, business model, tech stack)
agentes/       — AI agent architecture and specifications (Claude tool-use agents)
legal/         — SII certification process and tax regulation references
dev/           — Development setup guide and Claude workflow recommendations
```

Key files to read for context:
- `plan/04-stack-tecnologico.md` — Tech stack decisions, multi-tenant architecture (schema-per-tenant in PostgreSQL), planned monorepo layout (Turborepo), DTE flow, and AI agent orchestration pattern.
- `agentes/00-arquitectura-ia.md` — Agent inventory (transaction classifier, F29 assistant, tax consultant RAG, auditor, OCR), tool-use implementation pattern with Anthropic SDK, and cost estimates.
- `legal/certificacion-sii.md` — DTE XML structure, certification steps with SII, test server (maullin.sii.cl), and validation checklist.
- `dev/setup.md` — Planned development environment (Node 20, pnpm, Prisma, Fastify, Next.js 14) and monorepo commands.
- `dev/claude-workflows.md` — Recommended Claude usage patterns for this project, including prompt templates by area (DTE/XML, tax calculations, agents, database).

## Architecture (Planned)

### Multi-tenancy
Schema-per-tenant in PostgreSQL. Public schema holds `users`, `companies` (the tenant), and `subscriptions`. Each company gets its own schema (`tenant_{company_id}`) for isolated accounting data.

### Monorepo Layout (Future)
```
apps/web       — Next.js 14 dashboard
apps/api       — Fastify REST API
packages/dte   — DTE XML generation, digital signing, SII envelope (critical)
packages/db    — Prisma schema + shared client
packages/ai-agents — Claude agents with tool use
packages/validators — Shared Zod schemas
```

### DTE Flow
Form → Zod validation → `packages/dte` generates XML (ISO-8859-1) → xmldsig signing → EnvioDTE envelope → POST to SII (maullin for testing, api.sii.cl for prod) → Cloudflare R2 storage → DB update → email via Resend.

### AI Agents
All agents use the same tool-use loop with Anthropic SDK (`claude-haiku-4-5` for high-volume tasks, `claude-sonnet-4-6` for complex reasoning). The orchestrator lives in `packages/ai-agents`. Agents interact with DB, SII APIs, and Fintoc via typed tool definitions.

## Development Commands (When Code Exists)

The planned commands (from `dev/setup.md`) for when the monorepo is initialized:

```bash
# Root monorepo commands
pnpm dev          # Start all services
pnpm build        # Production build
pnpm test         # Run all package tests
pnpm lint         # Lint entire project

# Per-app/package
pnpm --filter web dev
pnpm --filter api dev
pnpm --filter @contachile/dte test
```

Currently, this repo has no `package.json` or build system. Changes here are Markdown edits only.

## Critical Domain Constraints

- **RUT validation**: Chilean tax ID uses modulo 11 algorithm.
- **IVA calculation**: 19% of net amount, rounded down to integer.
- **DTE encoding**: XML must be ISO-8859-1, not UTF-8.
- **SII certification**: Mandatory for legal DTE issuance. Process takes 30-120 days via maullin.sii.cl. A bridge provider (Acepta.com recommended) is planned for the MVP to avoid blocking on certification.
- **Digital certificates**: Stored AES-256 encrypted; encryption key must be separate from the certificate (AWS KMS or Cloudflare KV planned).

## Working in This Repo

- This is documentation, not implementation. Prefer editing and refining Markdown over generating code.
- When the user asks to "implement" something, check whether they mean updating the plan documents or creating actual code. The planned source locations are specified in `dev/setup.md` and `plan/04-stack-tecnologico.md`.
- Tax calculations (IVA, PPM, retentions) and DTE XML generation must be validated against SII XSDs and official examples. Reference `legal/certificacion-sii.md` for the validation checklist.
