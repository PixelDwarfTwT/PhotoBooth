# Photobooth Stage 4: Catalog, Admin API, and Consent-Gated Sharing

## Goal

Add a validated public catalog API and a private, optional cloud-share flow while preserving local-only processing as the default. Add internal catalog management endpoints protected by per-admin high-entropy credentials.

## Architecture

- Fastify exposes public reads for published themes, frames, filters, and pose guides, with publication-window checks and Zod response contracts.
- Admin routes provide CRUD for catalog metadata. Each administrator receives a random 256-bit bearer token once; only its SHA-256 hash and role are stored in PostgreSQL. Editors manage catalog content; administrators also manage admin credentials through an explicit provisioning command.
- A user must open the cloud-share dialog and accept the displayed retention notice before the browser sends the final PNG/JPG. Fastify enforces a 10 MiB limit, PNG/JPEG signatures, configured consent notice version, and per-IP rate limits before writing to a private S3-compatible bucket.
- Share URLs contain a random read token; the database stores only its SHA-256 hash. A second random delete token is returned once and stored only as a hash, so a recipient cannot delete a user's share merely by receiving its read link.
- Fastify serves bounded valid share bodies with no-store/no-referrer/no-index headers. Manual deletion removes the S3 object and marks metadata deleted. A repeatable cleanup command deletes expired objects and then their metadata; failed object deletion leaves the row for retry.
- The API produces a QR data URL for the returned share page URL. No image, camera stream, or editor state reaches the server in the default photo flow.
- Catalog frames use a closed, validated layout JSON (palette, border, spacing, caption, and supported layout) so the browser can render original design motifs in Canvas without executing remote code. Optional asset metadata remains URL-free until the API resolves a trusted configured storage base.

## Interfaces

- `GET /api/themes`, `/api/frames`, `/api/filters`, and `/api/pose-guides` return only published content and safe asset metadata.
- `POST /api/share` accepts a raw PNG/JPEG body and an `x-share-consent-version` header; it returns a read URL, one-time delete token, expiry, and QR image.
- `GET /api/share/:token` returns the bounded final image only while the hash matches an active, unexpired row.
- `DELETE /api/share/:token` requires the separate delete token in an authorization header.
- `/api/admin/*` supports authenticated catalog CRUD with role checks and closed Zod input schemas.
- `pnpm --filter @photobooth/api admin:create-token -- --email ... --role ...` provisions a credential and prints it once. `pnpm cleanup:shares` removes expired/deleted S3 objects and metadata.

## Data and dependencies

- Add `credential_hash` to `AdminUser` and `delete_token_hash` to `ShareLink`; generate a PostgreSQL migration without applying it to an unspecified database.
- Add Fastify CORS and rate-limit plugins, multipart-free raw image parsing, AWS SDK S3 client, and QR generation.
- Cloud sharing is unavailable when S3 configuration is absent; public local photo capture/editor remains usable. Partial S3 configuration fails startup with a readable error.
- Production requires explicit `WEB_ORIGIN`, consent version, bucket, region, and S3 credentials. Never log authorization headers, share tokens, upload bytes, or photo URLs containing tokens.

## Validation and failure behavior

- Reject missing/incorrect consent versions, empty or oversized files, unsupported MIME types, mismatched file signatures, malformed tokens, expired/deleted shares, and unauthenticated admin mutations with stable error codes.
- Create a cleanup-visible tombstone before uploading the object; activate the share record only after upload succeeds. Ambiguous S3 or database failures therefore leave metadata that the scheduled cleanup can use to remove any private object.
- Catalog JSON is validated before persistence and again when read for rendering. Scheduled themes are visible only during their publication window.
- Unit tests use real services with in-memory repository/object-store adapters; Fastify injection tests cover route status, headers, and body validation. Prisma schema validation and TypeScript builds cover generated DB integration.

## Out of scope

The public catalog API does not include a visual CMS dashboard or asset binary editor. Operators manage catalog metadata via protected REST endpoints and can publish assets through the configured static/CDN object workflow. No end-user accounts, analytics, cloud auto-sync, or server-side image editing are added.
