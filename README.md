# Web Photobooth

A mobile-first browser photobooth built with Next.js, TypeScript, Canvas, Fastify, PostgreSQL, Prisma, and optional S3-compatible storage. There are no end-user accounts. Captures and edits stay in the browser; cloud sharing sends only the final composition after an explicit consent step.

## Workspace

```text
apps/
  web/             Next.js App Router, camera/editor, local exports, public pages
  api/             Fastify REST API, catalog/admin services, optional private S3 shares
packages/
  contracts/       Shared Zod request/response contracts
  db/              Prisma schema, PostgreSQL client, migrations
docs/
  superpowers/     Product design notes and implementation plans
```

The API requires PostgreSQL. S3-compatible storage is optional: without all required S3 settings the API advertises cloud sharing as unavailable, while local capture, editing, and downloads continue to work.

## Local setup

Requirements: Node.js 24.11 or later, Corepack with pnpm 12.8.2 or later, and Docker Compose for the local PostgreSQL service.

```powershell
Copy-Item .env.example .env
corepack pnpm install
docker compose up -d postgres
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://127.0.0.1:4000`. Next.js and the API load the root `.env`. `NEXT_PUBLIC_API_ORIGIN` and `NEXT_PUBLIC_SITE_URL` are embedded during the web build. For a Vercel multi-service deployment, the browser uses same-domain `/api/*` routing; Vercel's deployment or production domain supplies the site origin. Other split-host deployments should set both public origins to HTTPS URLs. The default database credentials are only for local development.

### Use Supabase for PostgreSQL

Docker Compose is only needed for the local PostgreSQL container. To use a hosted Supabase development project instead:

1. In the Supabase Dashboard, open **Connect** and copy the connection string. Use the Session Pooler string (port `5432`) on IPv4-only networks; use the Direct connection when your network supports IPv6. Use the exact host, port, and username shown in the dashboard.
2. Set `DATABASE_URL` in the root `.env` to that connection string. Percent-encode reserved characters in the password and keep this value server-side.
3. Apply this repository's migrations and regenerate Prisma Client:

   ```powershell
   corepack pnpm --filter @photobooth/db exec prisma migrate deploy
   corepack pnpm db:generate
   ```

4. Run `corepack pnpm dev` as usual. Do not run `docker compose up -d postgres` when using the hosted database.

Use a separate Supabase project for development so local migration work cannot alter production data. The API and Prisma CLI both read `DATABASE_URL` from the root `.env`.

### Environment variables

| Variable                                                             | Default                 | Purpose                                                                                       |
| -------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | Local PostgreSQL URL    | API and Prisma database connection; required to start the API                                 |
| `HOST`, `PORT`                                                       | `127.0.0.1`, `4000`     | API bind address and port                                                                     |
| `WEB_ORIGIN`                                                         | `http://localhost:3000` | Allowed browser origin and origin used to form temporary share links; use HTTPS in production |
| `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_SITE_URL`                     | Local web/API URLs      | Public API and canonical site origins; Vercel can route `/api/*` on the same domain           |
| `SHARE_CONSENT_VERSION`                                              | `2026-10-02`            | Consent version the API expects from an upload                                                |
| `SHARE_TTL_HOURS`                                                    | `72`                    | Temporary share lifetime, from 1 to 720 hours                                                 |
| `SHARE_MAX_BYTES`                                                    | `10485760`              | Upload size cap, from 1 KiB to 10 MiB                                                         |
| `SHARE_RATE_LIMIT_MAX`                                               | `5`                     | Share upload requests per minute from one client                                              |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Empty                   | Configure all four to enable private cloud sharing                                            |
| `S3_ENDPOINT`                                                        | Empty                   | Optional HTTPS endpoint for an S3-compatible provider                                         |
| `ASSET_PUBLIC_BASE_URL`                                              | Empty                   | Optional public HTTPS base for catalog frame assets                                           |

Published catalog pages start empty until themes and related records are added. The editor includes local frame and filter choices as a fallback. Catalog asset files are hosted separately and referenced by metadata; the API does not provide an asset upload endpoint or a visual admin CMS.

## Vercel deployment

The repository root [vercel.json](vercel.json) configures the `web` and `api` services, routes `/api/*` to Fastify, and uses a private service binding for server-rendered catalog requests. Keep the Vercel project root at the repository root. Setup and environment details are in [docs/staging-deployment.md](docs/staging-deployment.md).

### Admin credentials

Create or rotate a credential after the database migration:

```powershell
corepack pnpm --filter @photobooth/api run admin:create-token --email owner@example.com --role ADMINISTRATOR
```

Copy the printed token immediately; the plaintext is shown once and is not recoverable from the database. Catalog write routes accept an administrator bearer token with the `EDITOR` or `ADMINISTRATOR` role. User/credential management requires `ADMINISTRATOR`. Keep the token in an approved secret manager; do not put it in frontend configuration.

## Development checks

```powershell
corepack pnpm test
corepack pnpm typecheck
corepack pnpm format:check
corepack pnpm build
corepack pnpm --filter @photobooth/db exec prisma validate --schema prisma/schema.prisma
```

API tests use in-memory repositories and object-store adapters, and web tests cover browser-independent helpers. The real camera, device chooser, Web Share sheet, and MediaRecorder codec behavior should also be checked in target browsers over HTTPS or localhost.

## Privacy and browser behavior

- Camera access starts only after the visitor activates it. Captures, stickers, filters, Canvas composition, PNG/JPG downloads, GIF generation, and motion recording are local.
- Native file sharing uses Web Share where file sharing is supported; otherwise the browser downloads a PNG. GIF export is local. Motion video uses the browser's supported WebM or MP4 MediaRecorder format, when available.
- Cloud sharing is off unless S3 is configured. The user sees a consent notice and must select the consent checkbox and submit before only the final PNG/JPG composition is uploaded. Each share gets separate random read/delete tokens; only their hashes and file metadata are stored in PostgreSQL. The object is stored privately with server-side encryption.
- Shared files are limited to 10 MiB by default (the cap can be lowered), expire after 72 hours by default (configurable up to 720 hours), and cannot be opened after expiry even if physical cleanup has not run yet. The delete credential is kept only in page memory and is not part of the share URL.
- `/booth` and `/share/[token]` are marked no-index. Share responses use no-store and no-referrer headers. No analytics or third-party trackers are included.
- Camera access requires a secure context: HTTPS in deployment or localhost during local development. If camera, Canvas, Web Share, GIF, or MediaRecorder support is unavailable, the UI reports the failure and retains supported local export options.

## Optional cloud sharing

Configure all four S3 values in `.env` to enable cloud shares: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. `S3_ENDPOINT` is optional for S3-compatible services. Production API origins and custom S3 endpoints must use HTTPS. Use a dedicated private bucket and do not expose it through `ASSET_PUBLIC_BASE_URL`.

Supabase Storage can provide the S3-compatible bucket: enable its S3 protocol, create a private bucket, then copy the endpoint, region, and generated S3 access keys from Storage settings into these variables. Supabase S3 access keys have broad server-side access, so keep them only in the API environment and never in `NEXT_PUBLIC_*` variables. When a custom `S3_ENDPOINT` is configured, this API omits the `ServerSideEncryption` request header because not all S3-compatible providers support it; the storage provider must supply its own encryption-at-rest guarantees.

The API does not run a background cleanup worker. Schedule this command at least hourly on a trusted deployment worker with access to the same database and bucket:

```powershell
corepack pnpm cleanup:shares
```

It removes expired or revoked objects and then their database rows; failed deletions stay recorded for a later retry. A bucket lifecycle rule on the `shares/` prefix is a useful safety net; set its age longer than the maximum configured share TTL plus the cleanup interval (for the 720-hour maximum, at least 32 days is a reasonable buffer).

## Catalog assets

Set `ASSET_PUBLIC_BASE_URL` to an HTTPS CDN/origin when catalog frame assets are hosted. Frame metadata can then reference same-origin paths under that base URL. Host only public, licensed catalog artwork there, allow the web origin through CORS for Canvas use, and keep user share files in the separate private bucket/prefix. Catalog raster frames accept PNG, JPEG, or WebP and are bounded by the editor before local composition; unavailable or invalid art falls back to local frame motifs.

## REST API outline

All routes are served by the Fastify API. Catalog reads are public and include only published records. Admin catalog writes require a bearer token.

| Route                                                                               | Purpose                                                                                       |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/health`                                                                   | Process health                                                                                |
| `GET /api/capabilities`                                                             | Share availability, consent version, TTL, and upload limit                                    |
| `GET /api/themes`, `/api/assets`, `/api/frames`, `/api/filters`, `/api/pose-guides` | Published catalog                                                                             |
| `/api/admin/catalog/:collection`                                                    | List/create catalog records; update/archive with `/:id`                                       |
| `/api/admin/users`                                                                  | Administrator-only credential management                                                      |
| `POST /api/share`                                                                   | Consent-gated PNG/JPEG upload; returns temporary URL, QR, expiry, and a separate delete token |
| `GET /api/share/:token`                                                             | Read an active shared image without caching                                                   |
| `DELETE /api/share/:token`                                                          | Revoke using `Authorization: Bearer <delete-token>`                                           |

Request/response schemas are shared through `@photobooth/contracts`. The database migration is in `packages/db/prisma/migrations`; local development applies it with `corepack pnpm db:migrate`. For an already provisioned deployment, apply committed migrations with `corepack pnpm --filter @photobooth/db exec prisma migrate deploy`.

## Artwork and branding

Use original artwork or assets for which you have permission. The sample visual direction is inspired by playful pastel and Y2K aesthetics; the project is not affiliated with Sanrio or any other character brand.
