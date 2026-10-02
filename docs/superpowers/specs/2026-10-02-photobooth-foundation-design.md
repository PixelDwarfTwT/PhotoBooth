# Photobooth Foundation and Catalog Data Design

## Purpose

Build the first two delivery stages for a browser-based photobooth: a maintainable web/API workspace and a PostgreSQL catalog schema. Users must be able to use the eventual photo flow without an account. Camera access and image editing stay in the browser; a photo must not reach the server unless the user explicitly accepts cloud sharing.

This design is intentionally limited to project foundation and catalog/share metadata. Camera capture, Canvas composition, catalog CRUD, S3 upload, QR generation, admin authentication, and motion export are later stages.

## Product constraints

- Landing, theme catalog, and help content are public and indexable; camera/session pages must be no-index and contain no personal session metadata.
- Request camera access only after an explicit user action. Stop the stream when a session ends.
- The default photo flow will use four photos and a three-second countdown, while allowing session configuration.
- Photos and camera/session state remain client-side by default. PostgreSQL stores catalog metadata and temporary share metadata only.
- Cloud upload requires explicit consent, an unpredictable token, an expiry, size/type checks, rate limiting, and a deletion path.
- Themes, assets, frames, filters, and pose guides are catalog content. Theme/asset artwork must be original or licensed; “Sanrio-inspired” must not imply official affiliation.
- Public pages must support SEO; private share routes and camera pages must not be indexed.
- Use responsive, accessible controls and clear fallback/error states in the later camera/editor stages.

## Chosen architecture

Use a pnpm workspace monorepo with:

- apps/web: Next.js App Router. Public routes render on the server for SEO. Browser-only camera, Canvas, drag/drop, and media APIs will be isolated to client components in later stages.
- apps/api: Fastify REST API. It owns catalog reads/writes, admin endpoints, and consent-gated share operations as those stages are implemented.
- packages/contracts: shared runtime validation schemas and API types; no Prisma model is exposed directly to the browser.
- packages/db: Prisma data model, migrations, and server-only database client.
- PostgreSQL: themes, assets, frames, filters, pose guides, admin users, and temporary share metadata.
- S3-compatible object storage: only final exports explicitly uploaded by users; the database keeps an object key, never a permanent public object URL.

The web client processes camera frames and exports locally with getUserMedia, Canvas, Blob, and download/Web Share APIs. The browser requests catalog data from the API. A cloud-share flow will be a separate explicit action: show the purpose/retention notice, collect consent, upload a bounded final export, store only a hash of a random share token, and let expiry/manual deletion remove the object and metadata. No raw photo, camera stream, device identity, or photo analytics is sent to the API by the default flow.

## Technology choices

- Frontend: Next.js App Router, React, TypeScript, CSS Modules, browser Canvas/media APIs.
- Backend: Node.js and Fastify REST with TypeScript.
- Data: PostgreSQL and Prisma ORM 7 with its ESM prisma-client generator and PostgreSQL driver adapter.
- Shared validation: Zod.
- Workspace: pnpm.
- Local database: Docker Compose for PostgreSQL.

Prisma ORM 7 is selected for the first schema because the official release status on 2026-10-02 identifies Prisma ORM 8 as a release candidate and Prisma ORM 7 as the generally available supported line. Keep the schema in the Prisma 7 format so the foundation uses a stable migration workflow.

## Repository structure

~~~text
apps/
  api/
    src/
      app.ts
      main.ts
      routes/health.ts
    package.json
    tsconfig.json
  web/
    src/app/
      globals.css
      layout.tsx
      page.tsx
    next.config.ts
    package.json
    tsconfig.json
packages/
  contracts/
    src/health.ts
    src/index.ts
    package.json
    tsconfig.json
  db/
    prisma/schema.prisma
    prisma7.config.ts
    src/client.ts
    src/index.ts
    package.json
    tsconfig.json
docs/superpowers/
  specs/
  plans/
docker-compose.yml
.env.example
.gitignore
.node-version
package.json
pnpm-workspace.yaml
tsconfig.base.json
README.md
~~~

The workspace avoids a second independently versioned API contract. The contract package builds to ESM declarations and JavaScript, and both apps consume that package rather than importing from one another.

## Data model

Use UUID primary keys and PostgreSQL enums for lifecycle states.

| Model | Purpose and key fields |
| --- | --- |
| Theme | name, unique slug, description, optional thumbnail asset, optional start/end dates, DRAFT/SCHEDULED/PUBLISHED/ARCHIVED, timestamps. |
| Asset | Optional theme, FRAME/STICKER/THUMBNAIL/POSE_ILLUSTRATION, storage key, MIME type, dimensions, byte size, alt text, license note, sort order, status. The database stores a storage reference, not binary data. |
| Frame | Theme, reusable asset, name, JSON layout configuration, limited-edition flag, status, sort order. |
| Filter | Name, unique internal key, validated JSON configuration, optional preview asset, status, sort order. |
| PoseGuide | Optional theme and asset, title, short instruction, status, sort order. |
| ShareLink | SHA-256 token hash (never the raw token), private object key, MIME type, byte size, creation/expiry/deletion times, consent notice version. |
| AdminUser | Unique normalized email, EDITOR/ADMINISTRATOR role, creation and last-login timestamps. |

Indexes support theme slug/status scheduling, asset theme/type/status, catalog ordering, unique filter keys, unique object keys, unique token hashes, expiry cleanup, and admin email lookup. Catalog JSON is untrusted input: the API must validate layout/filter config against closed schemas before persistence or rendering. Theme publication must check both status and any configured publication window.

Store no end-user account, photo session, raw token, raw image, public object URL, or unnecessary device identifier. Expired/deleted share records and objects are removed by a later cleanup job.

## Stage 1 and 2 deliverables

Stage 1 creates workspace/package configs, strict TypeScript configuration, an SEO landing-page shell, a Fastify app with a health endpoint, shared health response validation, environment examples, and a local PostgreSQL Compose service.

Stage 2 creates the Prisma 7 schema/config/client package for all seven catalog/admin/share models above. It does not create upload endpoints or store a photo. The first migration is generated and applied by the developer against a local PostgreSQL instance, because this setup does not assume a database server is already available.

## Error and security boundaries

- The API validates configuration and environment variables at process startup and reports a clear startup error rather than listening with invalid values.
- The API health endpoint is the only Stage 1 route. Future API routes must validate input, return stable error codes, enforce rate/size limits, and avoid logging image data or raw tokens.
- The database package is server-only and is never imported by the Next.js client bundle.
- Share-token generation, hashing, retention, and object deletion are not implemented in these stages; the schema stores only fields required for that future flow.
- Public pages use descriptive metadata. A future camera route must use noindex and must not put session details in metadata.

## Deferred work

1. Camera permission flow, device selection, mirror mode, countdown, sequential captures, and stream cleanup.
2. Canvas photo-strip/collage renderer, filter preview and export, stickers, frame editing, and retry of individual captures.
3. Catalog REST reads and admin content management.
4. Consent UI, private S3 upload, random share tokens/hash lookup, QR display, deletion, and expiry cleanup.
5. GIF/loop capture with compatibility fallback, accessibility/browser QA, SEO refinements, analytics consent, and operational monitoring.
