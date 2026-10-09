# Metered TURN Integration and Deployment Plan

> **For agentic workers:** Implement inline. Keep Metered credentials server-side and avoid exposing them to browser bundles or logs.

**Goal:** Enable remote camera connections across different networks through Metered Open Relay and deploy the updated app to Vercel.

**Architecture:** The API optionally fetches Metered's credential-scoped ICE server list and returns the validated list through the existing session ICE endpoint. Existing Coturn REST credentials remain supported as an alternative; configure only one TURN provider.

**Tech Stack:** TypeScript, Fastify, Zod, native Fetch, Vercel multi-service deployment.

**Spec:** User selected the free Metered Open Relay option and authorized deployment. Metered account/API key is an external prerequisite and is not yet available.

## Global Constraints

- Metered API key stays in API-only environment configuration and never reaches client code or logs.
- Existing signaling and session URLs remain unchanged.
- TURN must report active only when a valid TURN ICE server is returned.
- Do not run or add tests unless the user asks; use typechecks and production deployment build as verification.

## Review Focus

- Partial Metered configuration must fail startup with a safe message.
- Coturn and Metered configuration must not be enabled together.
- Provider errors or malformed ICE responses must not leak credentials or silently claim TURN is active.
- STUN-only behavior remains available when no TURN provider is configured.
- Vercel production deployment must use the linked project and provide a reviewable URL.

---

### Task 1: Add Metered configuration and server-side ICE retrieval

**Files:** `apps/api/src/config/env.ts`, `apps/api/src/routes/remote-camera.ts`, `apps/api/src/server-factory.ts`

- [x] Add validated Metered app name/API key configuration and reject conflicting Coturn configuration.
- [x] Fetch and validate Metered's ICE server list in the existing session ICE endpoint.
- [x] Keep secret values out of logs and return a safe unavailable error on provider failure.

### Task 2: Document and deploy

**Files:** `.env.example`, API/deployment documentation

- [x] Document Metered account setup and API-only Vercel environment variables.
- [x] Typecheck API and web; local production build completed with temporary HTTPS origin values.
- [ ] Deploy the production services through Vercel CLI.
- [ ] Confirm the production URL and explain the remaining API-key activation step.
