# Photobooth Foundation and Catalog Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Create the Stage 1 monorepo foundation and the Stage 2 Prisma/PostgreSQL schema for the browser photobooth.

**Architecture:** A pnpm monorepo contains a Next.js public web app, a Fastify REST app, shared Zod contracts, and a server-only Prisma package. The browser owns photo capture and editing; server persistence is limited to catalog metadata and metadata for consent-gated cloud shares.

**Tech Stack:** Node.js 24.11+, pnpm 12, Next.js App Router, React, TypeScript, Fastify 5, Zod 4, PostgreSQL, Prisma ORM 7, Docker Compose.

**Spec:** docs/superpowers/specs/2026-10-02-photobooth-foundation-design.md

## Global Constraints

- Keep photo capture, camera state, editing, and default exports in the browser.
- No photo is sent to or stored by the backend unless the user explicitly chooses cloud sharing.
- Use strict TypeScript and the Next.js App Router.
- Use Prisma ORM 7's prisma-client generator, prisma7.config.ts, and PostgreSQL adapter.
- Use UUID primary keys, PostgreSQL enums, mapped snake_case names, and the seven PRD models.
- Never store a raw share token, raw image, permanent public object URL, or unnecessary device identifier.
- Public landing metadata is indexable; a future camera/session route must be no-index.
- Theme and asset artwork must be original or licensed; do not imply official Sanrio affiliation.

## Review Focus

- Malformed explicitly supplied API configuration must fail with a readable startup error; absent HOST/PORT use safe local defaults as specified in Task 2.
- Health response JSON must match the shared contract; owned by Task 2.
- Prisma client and generated database code must stay server-only and out of the Next.js client bundle; owned by Tasks 3 and 4.
- Catalog JSON and publication windows require application validation before they are used; schema constraints are described in Task 4 and application enforcement is deferred to catalog API work.
- Share metadata must contain only a token hash, private object key, consent version, and retention fields; owned by Task 4.

---

### Task 1: Workspace and local development foundation

**Files:**

- Create: package.json
- Create: pnpm-workspace.yaml
- Create: tsconfig.base.json
- Create: .node-version
- Create: .gitignore
- Create: .env.example
- Create: docker-compose.yml
- Create: README.md

**Interfaces:**

- Consumes: None.
- Produces: A pnpm workspace with apps/web, apps/api, packages/contracts, and packages/db; root scripts for dev, build, typecheck, and database commands; a local PostgreSQL service; and documented environment setup.

- [x] Create the root package manifest with pinned pnpm 12.8.2, Node.js 24.11+, common TypeScript/formatting tooling, and scripts that build shared/database prerequisites before apps.
- [x] Define the four workspace package globs in pnpm-workspace.yaml.
- [x] Define shared strict TypeScript compiler options in tsconfig.base.json.
- [x] Ignore environment files, dependencies, build output, and generated Prisma client; allow .env.example.
- [x] Add a local-only PostgreSQL Compose service with a readiness check and matching example connection string.
- [x] Document Windows-compatible setup, database generation/migration commands, app ports, and the local-only credentials.
- [x] Commit the workspace foundation.

### Task 2: Shared API contract and Fastify health service

**Files:**

- Create: packages/contracts/package.json
- Create: packages/contracts/tsconfig.json
- Create: packages/contracts/src/health.ts
- Create: packages/contracts/src/index.ts
- Create: apps/api/package.json
- Create: apps/api/tsconfig.json
- Create: apps/api/src/config/env.ts
- Create: apps/api/src/app.ts
- Create: apps/api/src/main.ts
- Create: apps/api/src/routes/health.ts

**Interfaces:**

- Consumes: Workspace scripts from Task 1.
- Produces: HealthResponseSchema and HealthResponse from @photobooth/contracts; buildServer(): FastifyInstance; and a GET /api/health route returning the shared response shape.

- [x] Implement the health response Zod schema and inferred TypeScript type.
- [x] Configure the contracts package to emit ESM JavaScript and declaration files.
- [x] Parse PORT and HOST with Zod and produce a concise startup error for invalid values.
- [x] Build a Fastify app factory and register GET /api/health with a response validated by the shared schema.
- [x] Start Fastify on 0.0.0.0 only when the configured HOST requests it; use a safe local default.
- [x] Commit the contract and API scaffold.

### Task 3: Next.js public landing shell

**Files:**

- Create: apps/web/package.json
- Create: apps/web/tsconfig.json
- Create: apps/web/next-env.d.ts
- Create: apps/web/next.config.ts
- Create: apps/web/src/app/layout.tsx
- Create: apps/web/src/app/page.tsx
- Create: apps/web/src/app/globals.css

**Interfaces:**

- Consumes: Workspace scripts from Task 1 and the public product constraints in the spec.
- Produces: A responsive Indonesian landing shell with descriptive public-page metadata, semantic navigation/content, and no camera, photo, account, or cloud behavior in the client.

- [x] Configure Next.js App Router, React, CSS Modules/global CSS, and strict TypeScript.
- [x] Add Indonesian document language and indexable title/description metadata.
- [x] Add a mobile-first landing shell that explains local photo processing and optional cloud sharing without implying an implemented camera flow.
- [x] Commit the web shell.

### Task 4: Prisma 7 catalog and sharing metadata schema

**Files:**

- Create: packages/db/package.json
- Create: packages/db/tsconfig.json
- Create: packages/db/prisma7.config.ts
- Create: packages/db/prisma/schema.prisma
- Create: packages/db/src/client.ts
- Create: packages/db/src/index.ts
- Create: packages/db/src/browser-error.ts

**Interfaces:**

- Consumes: Workspace scripts and environment contract from Task 1.
- Produces: Prisma models Theme, Asset, Frame, Filter, PoseGuide, ShareLink, and AdminUser; server-only Prisma client exported from @photobooth/db; and scripts for client generation, local migration, and Prisma Studio.

- [x] Configure Prisma 7 ESM client generation into the database package, PostgreSQL datasource configuration, and local root .env loading.
- [x] Define lifecycle, asset-type, and admin-role enums.
- [x] Define all seven models with UUID keys, PRD fields, named relations, mapped table/column names, timestamps, and indexes.
- [x] Use JSON columns for frame layouts and filter parameters; document that API code must validate these values before persistence or rendering.
- [x] Store a fixed-width SHA-256 token hash rather than the raw share token; store only the private object key, content metadata, consent version, and retention timestamps.
- [x] Export a development-safe singleton Prisma client using the PostgreSQL adapter; fail clearly if DATABASE_URL is absent when the runtime client is imported.
- [x] Add package scripts for prisma generate, prisma migrate dev, and prisma studio; do not apply a migration against an assumed database.
- [x] Commit the database package and schema.

## Execution Constraints

The original Stage 1/2 scaffold task did not include tests or verification. In a later request, the user authorized implementation of the remaining stages plus independent tests and builds. The integrated workspace verification is recorded in the Stage 5 completion record; no live database migration was applied.
