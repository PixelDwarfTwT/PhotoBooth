# Photobooth Stage 4 Catalog and Sharing Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` and complete each task with a test-first cycle. Steps use checkbox syntax.

**Goal:** Ship validated catalog/admin REST APIs and consent-gated temporary S3 sharing with QR, delete, and expiry cleanup.

**Architecture:** Fastify owns catalog access, admin auth, and all S3 operations. The browser sends a final export only after consent; PostgreSQL stores hashes and metadata, and the object bucket remains private.

**Tech Stack:** Fastify 5, Zod 4, Prisma 7/PostgreSQL, AWS SDK S3, Node test runner, QRCode.

**Spec:** `docs/superpowers/specs/2026-10-02-photobooth-stage-4-catalog-sharing-design.md`

## Global Constraints

- Do not upload photos unless the user explicitly accepts the cloud-share notice.
- Keep local capture, edits, and ordinary exports in the browser.
- Store hashes, never raw read/delete/admin tokens; do not log credentials, tokenized URLs, or image bodies.
- Enforce PNG/JPEG magic bytes, a 10 MiB limit, publication windows, closed JSON schemas, and rate limits.
- Keep S3 objects private and delete them on manual revocation or expiry.

## Review Focus

- Invalid/missing consent, MIME mismatch, forged image signatures, and oversized bodies must fail before storage.
- S3 write or database failure must not leave an untracked object; failed delete remains retryable.
- Expired/deleted/malformed share tokens never return object bytes.
- Admin tokens are shown once, hashed in DB, redact from logs, and enforce editor/administrator roles.
- Catalog schedules, hidden themes, and unsafe JSON never leak through public read endpoints.

---

### Task 1: Test harness, contracts, config, and privacy-safe Fastify base

**Files:** `apps/api/package.json`, `apps/api/src/app.ts`, `apps/api/src/config/env.ts`, `apps/api/test/*.test.mjs`, `packages/contracts/src/catalog.ts`, `packages/contracts/src/index.ts`, `.env.example`.

- [x] Add Node's built-in test command and failing tests for consent notice version, config all-or-none S3 settings, safe error response schema, and logger redaction.
- [x] Run `pnpm --filter @photobooth/api test` and confirm the new assertions fail for the missing behavior.
- [x] Add Zod catalog/response schemas and API environment parsing for origins, upload limit, TTL, rate limit, consent version, and optional S3 credentials.
- [x] Configure Fastify CORS for the configured web origin, rate limiting, safe request serializers, stable error responses, and image content-type parsers.
- [x] Run API tests, typecheck, and build.

### Task 2: Public catalog reads and protected catalog writes

**Files:** `packages/contracts/src/catalog.ts`, `apps/api/src/routes/catalog.ts`, `apps/api/src/routes/admin-catalog.ts`, `apps/api/src/lib/admin-auth.ts`, `apps/api/src/scripts/create-admin-token.ts`, API tests.

- [x] Test publication-window filtering, strict frame/filter config validation, credential hashing, and role denial.
- [x] Add `credentialHash` to `AdminUser` and generate an offline migration SQL file with Prisma; do not apply the migration to an unknown database.
- [x] Implement public theme/frame/filter/pose-guide reads and editor-protected create/update/archive endpoints for themes, assets, frames, filters, and pose guides.
- [x] Add administrator-only credential provisioning and one-time credential output; redact auth values in Fastify logs.
- [x] Test route inputs, public filtering, authentication, and role boundaries with Fastify injection and an in-memory repository.

### Task 3: Private object-store adapter and temporary share service

**Files:** `apps/api/src/services/object-store.ts`, `apps/api/src/services/share-service.ts`, `apps/api/src/routes/shares.ts`, `packages/db/prisma/schema.prisma`, API tests.

- [x] Test random-token hashing, valid PNG/JPEG signatures, consent/version/size rejection, expiry, and S3/DB compensation using in-memory adapters.
- [x] Add `deleteTokenHash` to `ShareLink`; generate the migration SQL.
- [x] Implement AWS S3 put/get/delete with private objects and injectable service interfaces.
- [x] Implement bounded upload, hashed read/delete tokens, QR URL generation, bounded share reads (10 MiB maximum), no-store/no-referrer/noindex headers, and explicit deletion.
- [x] Test success and failure paths through Fastify injection without a live bucket or database.

### Task 4: Expiry cleanup, web/editor integration, and docs

**Files:** `apps/api/src/scripts/cleanup-shares.ts`, `apps/web/src/features/booth/components/photo-editor.tsx`, share UI components, `README.md`, root scripts.

- [x] Test cleanup retry behavior: remove DB metadata only after object deletion succeeds.
- [x] Add repeatable expired/deleted share cleanup command and an operator schedule/configuration note.
- [x] Add editor share action with a retention/consent dialog; send the final Blob only after an explicit checkbox and submit action.
- [x] Display share URL, QR, expiry, copy action, and revocation control without putting delete credentials into the URL.
- [x] Document environment configuration, migration commands, bucket lifecycle advice, API responses, and privacy defaults.
- [x] Run full API tests, Prisma validate/generate, typecheck, format check, and production build.

## Self-review

The tasks cover all Stage 4 flows: catalog reads/writes, admin credentials and roles, consent, bounded storage, QR, deletion, and cleanup. Route tests use injected persistence/storage adapters so tests do not depend on Docker or S3. Prisma migration generation remains offline; applying a database migration is intentionally deferred until an explicit local DB exists.

## Completion record

- API suite: 47 tests passed. Share rows are reserved as cleanup-visible tombstones before S3 upload, so ambiguous object writes remain retryable; the bounded cleanup drains all batches and skips failures until the next run. Configuration tests also reject non-HTTP(S) origins and endpoints.
- Workspace typecheck, Prisma schema validation/generation, format check, and production build passed.
- The migration SQL is generated but was not applied because this environment has no provisioned PostgreSQL service. Schedule `pnpm cleanup:shares` at least hourly as documented in `README.md`.
