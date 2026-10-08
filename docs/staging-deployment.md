# Deploy the PhotoBooth services to Vercel

The repository root `vercel.json` defines one Vercel project with two services:

- `api`: Fastify, public under `/api/*`.
- `web`: Next.js, public for all remaining paths.

The `web` service binds to `api` as `API_SERVICE_URL` for server-rendered catalog requests. Browser requests use the public same-domain `/api/*` rewrite. Vercel Services are currently in beta; confirm the feature is available for the Vercel account before creating the project.

## 1. Prepare Supabase

1. Use the intended Supabase project and copy its PostgreSQL connection string from **Connect**. Keep it server-side; do not prefix it with `NEXT_PUBLIC_`.
2. Apply the repository migrations to that database from the project root before deploying the API:

   ```powershell
   $env:DATABASE_URL = "<connection-string>"
   corepack pnpm --filter @photobooth/db exec prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   ```

   Check the project ref in the connection string before running the migration command.

## 2. Create the Vercel project

1. Import the GitHub repository `PixelDwarfTwT/PhotoBooth` into Vercel.
2. Keep **Root Directory** set to the repository root (`.`). The service roots and build commands are already configured in `vercel.json`; do not create separate Vercel projects for `apps/web` and `apps/api`.
3. Enable Vercel **System Environment Variables** so the runtime and build receive `VERCEL` and `VERCEL_URL`.
4. Add the server environment variables for Preview and Production as needed:

   ```text
   DATABASE_URL=<Supabase PostgreSQL connection string>
   ```

   Optional API values include `SHARE_CONSENT_VERSION`, `SHARE_TTL_HOURS`, `SHARE_MAX_BYTES`, and `SHARE_RATE_LIMIT_MAX`. To keep cloud sharing disabled, leave all S3 variables unset. To enable it later, add the complete S3 credentials to the API service environment only.

5. Do not create `API_SERVICE_URL` yourself. The web service binding injects it at runtime; it is not available during builds or in browser code.
6. `NEXT_PUBLIC_SITE_URL` is optional on Vercel. Set it to the chosen HTTPS canonical origin if you use a custom domain. Otherwise the site uses Vercel's generated deployment URL. `NEXT_PUBLIC_API_ORIGIN` is not needed for this single-domain setup; only set it when deliberately pointing the web client at a separate API origin.
7. `WEB_ORIGIN` is also optional on Vercel. If unset, the API builds share and phone-camera links from the deployment's `VERCEL_URL`. Set it only when links should use a specific HTTPS origin; scope a production custom domain value to Production so Preview links remain on their preview deployment.

## 3. Deploy and check routes

Deploy from the Vercel dashboard or Git push after reviewing the environment scopes. Confirm these URLs on the assigned project domain:

- `/` loads the PhotoBooth web service.
- `/api/health` returns a healthy API response.
- `/api/capabilities` reports cloud sharing disabled while S3 is unset.
- `/booth` can load frame and filter catalog data from Supabase.
- `/themes` can load published themes through the web-to-API service binding.

Public frame assets still need a public HTTPS URL and compatible CORS headers for Canvas export. The API does not upload catalog images to Supabase Storage.

## Deployment limits to account for

Remote camera signaling is stored in the shared `remote_camera_sessions` PostgreSQL table. The API migration must be applied before deployment; each session expires after five minutes and expired rows are removed as new sessions are created.

The API allows uploads up to 10 MiB by default. Confirm Vercel's current Function request-body limits before relying on large cloud-share uploads; local exports do not use the API.
