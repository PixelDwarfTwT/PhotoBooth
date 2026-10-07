# Booth Workflow Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax.

**Goal:** Add private phone-camera pairing, motion-video filters, and a local results/export experience based on the supplied screenshots.

**Architecture:** Fastify stores only ephemeral WebRTC signaling for a random, expiring session and returns a QR for the same-origin phone route. Phone video travels directly to the booth browser. Canvas adds independent motion filters and a 9:16 story export; existing share consent is reused for the result QR.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Fastify 5, WebRTC, Canvas API, existing QRCode and gifenc packages.

**Spec:** `docs/superpowers/specs/2026-10-07-funcam-booth-workflow-design.md`

## Global Constraints

- Photos and video frames stay in the browser; WebRTC media is peer-to-peer.
- API signaling is no-store, rate-limited, bounded, random, and expires in five minutes.
- Keep three-photo capture, current still filters, and explicit cloud-share consent intact.
- Use App Router async route params and keep browser-only APIs in Client Components.
- Camera access on a phone requires HTTPS outside localhost; do not imply local desktop localhost is phone-accessible.

## Review Focus

- Expired, unknown, or closed session IDs must not expose or accept SDP.
- Oversized/malformed SDP must be rejected before storage.
- User denial, missing camera, unsupported WebRTC, and failed ICE must stop tracks and give retry guidance.
- Motion filters must not alter the still-photo filter choice or mutate the source canvas.
- Story and print must work without cloud storage or photo upload.

---

### Task 1: Ephemeral WebRTC signaling API

**Files:**

- Create: `apps/api/src/services/remote-camera-registry.ts`
- Create: `apps/api/src/routes/remote-camera.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/remote-camera-registry.test.ts`
- Test: `apps/api/test/remote-camera-routes.test.ts`

**Interfaces:** registry create/get/setOffer/setAnswer/close operations keyed by a random session ID; HTTP create returns `{ sessionId, expiresAt, phoneUrl, qrCodeDataUrl }`.

- [x] Write tests for five-minute expiry, one offer/answer pair, close behavior, malformed payloads, and no-store responses.
- [x] Run the new tests and confirm they fail because the registry/routes do not exist.
- [x] Implement a Map-backed registry and rate-limited POST/GET/DELETE routes with bounded descriptions.
- [x] Run the API tests and typecheck.

### Task 2: Phone pairing and booth stream input

**Files:**

- Create: `apps/web/src/features/booth/hooks/use-remote-camera-host.ts`
- Create: `apps/web/src/features/booth/components/remote-camera-pairing.tsx`
- Create: `apps/web/src/features/booth/components/remote-camera-page.tsx`
- Create: `apps/web/src/app/remote-camera/[sessionId]/page.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.module.css`
- Test: `apps/web/test/remote-camera.test.ts`

**Interfaces:** host hook returns `{ state, stream, qrCodeUrl, error, start, stop }`; remote page accepts `sessionId` and has waiting, permission, connected, and error states.

- [x] Write tests for supported/unsupported secure context and validated session IDs/API response handling.
- [x] Run new tests and confirm they fail before implementation.
- [x] Implement host and phone WebRTC peers, full-ICE description polling, QR pairing, and cleanup.
- [x] Attach either local or remote stream to the existing preview/capture video element.
- [x] Run web tests and typecheck.

### Task 3: Motion filters and Story export

**Files:**

- Create: `apps/web/src/features/booth/lib/export-presets.ts`
- Create: `apps/web/src/features/booth/lib/story-export.ts`
- Modify: `apps/web/src/features/booth/lib/motion-export.ts`
- Modify: `apps/web/src/features/booth/components/photo-editor.tsx`
- Test: `apps/web/test/export-presets.test.ts`
- Test: `apps/web/test/story-export.test.ts`
- Test: `apps/web/test/motion-export.test.ts`

**Interfaces:** `MotionFilterKey = "normal" | "mono" | "sepia" | "negative" | "blur"`; `createStoryBlob(source)` returns a PNG Blob at 9:16; motion exporters accept an optional validated filter key.

- [x] Add failing tests for the closed filter set, CSS values, and story dimensions/layout.
- [x] Verify the tests fail before implementation.
- [x] Apply the motion filter to export canvases only; generate Story PNG from the composed photo canvas.
- [x] Run relevant web tests and typecheck.

### Task 4: Result, print, and take-again actions

**Files:**

- Modify: `apps/web/src/features/booth/components/photo-editor.tsx`
- Test: `apps/web/test/story-export.test.ts`

- [x] Write a failing test that Story output stays client-side and uses the 9:16 export geometry.
- [x] Verify the test fails before implementation.
- [x] Add accessible format previews and local download/print actions; reuse existing cloud-consent QR sharing and reset callback.
- [x] Run the complete test suite, typecheck, and production build.
- [x] Verify `/booth` and the phone route return HTTP 200; cover pairing API error and capacity paths in tests.
- [ ] Inspect the printed/story layout in a visual browser preview.
