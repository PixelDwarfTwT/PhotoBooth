# Booth camera and sticker reliability implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Keep camera preview and output unmirrored, support TURN-relayed remote camera pairing when configured, and make sticker dragging responsive.

**Architecture:** Remove the mirror behavior from the booth preview and compositor. Add a rate-limited API endpoint that creates temporary Coturn REST credentials from API-only environment values; both WebRTC peers fetch its ICE server response. During sticker drag, update the handle directly and exclude that sticker from the expensive compositor until the final position is committed.

**Tech Stack:** TypeScript, React, Fastify, WebRTC RTCPeerConnection, Node crypto HMAC, CSS modules, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-09-booth-camera-sticker-reliability-design.md`

## Global Constraints

- Do not expose `TURN_SHARED_SECRET` to browser code or tracked environment files.
- If TURN is not configured, retain STUN-only pairing and report the relay limitation on connection failure.
- Preserve the existing SDP polling/signaling flow, photo capture, exports, and keyboard sticker controls.
- Do not add or run automated tests unless requested; use package typechecks and focused source review for this implementation.

## Review Focus

- Partial TURN configuration must fail API startup with a clear environment error.
- TURN URLs must be restricted to `turn:` or `turns:` schemes and malformed entries must fail validation.
- Temporary TURN credentials must expire and must never contain the shared secret.
- Both host and phone must use the same validated API ICE configuration before peer creation.
- Pointer up and cancellation must commit the last normalized sticker location exactly once; a stationary click must not reposition it.

---

### Task 1: Remove camera mirroring

**Files:**
- Modify: `apps/web/src/features/booth/components/booth-session.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.module.css`
- Modify: `apps/web/src/features/booth/components/photo-editor.tsx`
- Modify: `apps/web/src/features/booth/lib/canvas-compositor.ts`

**Interfaces:**
- The editor no longer accepts a `mirror` prop.
- The compositor no longer accepts a mirror option for photo cells.

- [x] Remove mirror state, checkbox, preview transform, and the `PhotoEditor` mirror prop.
- [x] Remove the canvas horizontal-flip branch so captured pixels retain source orientation.
- [x] Run `corepack pnpm --filter @photobooth/web typecheck` and review the booth/editor call sites.
- [x] Commit as `fix: keep booth photos unmirrored`.

### Task 2: Add secure TURN configuration to remote-camera signaling

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/server-factory.ts`
- Modify: `apps/api/src/routes/remote-camera.ts`
- Modify: `apps/web/src/features/booth/lib/remote-camera.ts`
- Modify: `apps/web/src/features/booth/hooks/use-remote-camera-host.ts`
- Modify: `apps/web/src/features/booth/components/remote-camera-page.tsx`
- Modify: `.env.example`
- Modify: `docs/staging-deployment.md`

**Interfaces:**
- API environment provides `turn: { urls: string[]; sharedSecret: string; credentialTtlSeconds: number } | null`.
- Add `GET /api/remote-camera/sessions/:sessionId/ice-servers` returning `{ iceServers: RTCIceServer[]; turnConfigured: boolean }` for an active session.
- Browser helper validates that response before passing `iceServers` to `RTCPeerConnection`.

- [x] Parse `TURN_URLS`, `TURN_SHARED_SECRET`, and `TURN_CREDENTIAL_TTL_SECONDS` with paired-field and scheme validation; default TTL to 900 seconds, range 60–3600.
- [x] Require a high-entropy hex shared secret and reject hierarchical `turn://` URIs.
- [x] Inject the optional TURN settings into the remote-camera route.
- [x] Add the rate-limited active-session ICE endpoint; return Google STUN plus optional expiry-prefixed username and HMAC-SHA1 Coturn password.
- [x] Fetch and validate ICE configuration from both peers before constructing their peer connections; adjust cross-network failure copy based on `turnConfigured`.
- [x] Document variables with empty placeholders only and explain the external Coturn setup/firewall requirement.
- [x] Run API and web package typechecks; review that no shared secret is returned or logged.
- [x] Commit as `feat: support temporary TURN credentials for camera pairing`.

### Task 3: Make sticker drag responsive

**Files:**
- Modify: `apps/web/src/features/booth/components/sticker-layer.tsx`
- Modify: `apps/web/src/features/booth/components/photo-editor.tsx`

**Interfaces:**
- `StickerLayer` adds a drag-state callback; existing `onMove` remains the committed position update.

- [x] Keep active sticker ID, initial position, and latest normalized pointer position in refs.
- [x] Move the active handle with transient CSS transforms during pointer events; do not invoke `onMove` from `pointermove`.
- [x] Tell the editor which sticker is being dragged so composition omits only that sticker until drag completion.
- [x] Commit the final position once on pointer up/cancel and restore the sticker to composition; preserve keyboard handling.
- [x] Run the web package typecheck and review that pointermove has no state update or full-compositor dependency.
- [x] Commit as `fix: keep sticker dragging responsive`.

### Task 4: Final review and integrate

- [x] Review the complete branch diff against the spec and Review Focus.
- [x] Run API and web package typechecks from the complete tree.
- [x] Document that cross-network relay requires a reachable Coturn service and the three TURN variables in local/Vercel API environment.
- [ ] Fast-forward the feature branch into the original workspace branch and remove the temporary worktree.
