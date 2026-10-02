# Photobooth Stage 3 Camera and Canvas Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Add a private, browser-only photo session with camera capture, a local Canvas editor, stickers, filters, and PNG/JPG download.

**Architecture:** A no-index `/booth` server route hosts a client session. Focused camera and capture hooks own browser media resources; a Canvas compositor renders Blob-backed photos and editor state without API calls or server persistence.

**Tech Stack:** Next.js App Router, React 19, TypeScript, MediaDevices/getUserMedia, HTML video/canvas, CSS Modules, browser Blob/object URLs.

**Spec:** `docs/superpowers/specs/2026-10-02-photobooth-stage-3-camera-canvas-design.md`

## Global Constraints

- Ask for camera permission only after an explicit user action; require HTTPS or localhost.
- Default to four photos and three seconds; provide counts 2–6 and timers 3/5/10 seconds.
- Keep capture/export data in memory and on-device. Add no API, DB, storage, analytics, or account calls.
- Stop camera tracks after capture, on user stop, on cancellation, and on unmount.
- `/booth` must be `noindex, nofollow`; session data must not enter metadata or URLs.
- Use only generic original Unicode stickers and closed local filter constants.
- Add accessible labels, keyboard-operable editor controls, polite status announcements, and reduced-motion handling.
- No test or build commands will be run for this task. Use source/diff inspection only.

## Review Focus

- Permission is never requested during render or page load; owned by Task 1.
- All tracks stop on each terminal/session transition and camera changes; owned by Tasks 1–2.
- Countdown cancellation or camera loss cannot append a stale/partial capture; owned by Task 2.
- Blob URLs and ImageBitmap resources are revoked/closed; owned by Tasks 2–3.
- Export errors preserve the source photos and editor state; owned by Task 3.
- Session route metadata is private/noindex while the landing page remains indexable; owned by Task 4.

---

### Task 1: Private booth route and camera controller

**Files:**
- Create: `apps/web/src/app/booth/page.tsx`
- Create: `apps/web/src/features/booth/types.ts`
- Create: `apps/web/src/features/booth/lib/camera-errors.ts`
- Create: `apps/web/src/features/booth/hooks/use-camera.ts`
- Create: `apps/web/src/features/booth/components/booth-session.tsx`
- Create: `apps/web/src/features/booth/components/booth-session.module.css`

**Interfaces:**
- `CameraFacingMode = "user" | "environment"`.
- `CameraController` exposes `stream`, `devices`, `selectedDeviceId`, `facingMode`, `status`, `error`, `startCamera(): Promise<boolean>`, `selectCamera(deviceId)`, and `stopCamera()`.
- `useCamera()` performs no media call on mount. `startCamera` requires the explicit setup action, checks secure context and API support, opens a video-only stream, then enumerates devices.
- `BoothSession` is a client component. The route page is a server component and exports only no-index metadata.

- [x] Add the `/booth` route with `robots: { index: false, follow: false }` and no session-specific metadata.
- [x] Implement typed camera errors for insecure context, unsupported API, denied permission, missing camera, and camera-in-use cases.
- [x] Implement camera startup, device enumeration after permission, camera replacement, and idempotent track cleanup.
- [x] Build the setup and preview UI with accessible camera permission explanation, explicit activation, camera selector after permission, mirror toggle, and stop control.
- [x] Add source/diff inspection notes to the execution ledger; do not run tests or build.
- [x] Commit Task 1.

### Task 2: Countdown capture, review, and retakes

**Files:**
- Create: `apps/web/src/features/booth/hooks/use-capture-sequence.ts`
- Create: `apps/web/src/features/booth/lib/capture-photo.ts`
- Modify: `apps/web/src/features/booth/types.ts`
- Modify: `apps/web/src/features/booth/components/booth-session.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.module.css`

**Interfaces:**
- `CapturedPhoto` contains `id`, `blob`, `width`, and `height`; photo bytes stay in browser memory.
- `useCaptureSequence()` exposes `photos`, `phase`, `currentPhotoIndex`, `countdownValue`, `announcement`, `error`, `startSequence(video, count, seconds): Promise<boolean>`, `resumeSequence(video, count, seconds): Promise<boolean>`, `retakePhoto(video, index, seconds): Promise<boolean>`, `cancelSequence()`, `resetSequence()`, and `movePhoto(fromIndex, toIndex)`.
- `capturePhoto(video)` draws the current unfiltered video frame to a bounded offscreen canvas and returns a Blob-backed photo.

- [x] Add photo-count choices 2/3/4/5/6 and countdown choices 3/5/10 with defaults 4/3.
- [x] Implement an abortable one-second countdown before every capture and a concise `role="status"` announcement.
- [x] Capture sequential Blob photos; on sequence completion stop the stream and show numbered review slots.
- [x] Add order controls and single-photo retake that restarts the camera only after the retake button is pressed.
- [x] Handle capture failure without discarding completed photos; stop tracks and clear timers for cancel, end, or unmount.
- [x] Inspect source/diff for resource cleanup and no network photo path; do not run tests or build.
- [x] Commit Task 2.

### Task 3: Canvas composition, filters, stickers, and downloads

**Files:**
- Create: `apps/web/src/features/booth/lib/canvas-compositor.ts`
- Create: `apps/web/src/features/booth/lib/editor-options.ts`
- Create: `apps/web/src/features/booth/components/photo-editor.tsx`
- Create: `apps/web/src/features/booth/components/sticker-layer.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.tsx`
- Modify: `apps/web/src/features/booth/components/booth-session.module.css`

**Interfaces:**
- `BoothLayout = "strip" | "grid"`; grid uses two columns and enough rows for the photo count.
- `BoothFilter = "natural" | "warm" | "soft" | "mono"`; all CSS/Canvas filter values come from a closed constant map.
- `StickerPlacement` contains a stable ID, generic symbol, normalized `x`/`y`, and bounded font size.
- `renderComposition(canvas, input)` redraws the complete local composition and reports whether the requested Canvas filter was applied.
- `canvasToBlob(canvas, format)` resolves a PNG/JPG Blob or throws a user-displayable export error.

- [x] Implement bounded 1000px-wide strip and responsive-row grid layouts with local Blob decoding, mirror output, and filter rendering.
- [x] Add strip/grid selection and four filter presets with matching CSS-filtered camera preview and Canvas output.
- [x] Add a generic sticker palette and pointer/keyboard sticker positioning, resizing, and deletion controls.
- [x] Render accessible HTML sticker handles over the Canvas and draw the same placements into the exported composition.
- [x] Add PNG/JPG downloads with revocable object URLs; on failure, keep the photo/editor state and show retry guidance.
- [x] Add a clear no-filter fallback when Canvas filters are unsupported.
- [x] Inspect source/diff for local-only data flow and URL/resource cleanup; do not run tests or build.
- [x] Commit Task 3.

### Task 4: Landing integration and final static review

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/globals.css` only if shared focus/reduced-motion tokens are needed.
- Modify: `README.md`

**Interfaces:**
- The primary landing action links to `/booth`; landing metadata remains indexable.
- README documents HTTPS/localhost camera requirements, the local-only flow, and current static layouts/stickers.

- [x] Link the landing-page primary action to `/booth` and preserve public-page metadata.
- [x] Review layout at narrow/wide CSS breakpoints, focus visibility, labels, keyboard sticker controls, countdown status, and reduced-motion rules by source inspection.
- [x] Update setup/usage docs and explicitly describe the no-upload default.
- [x] Review the complete branch diff against the Stage 3 spec and record findings/rulings.
- [x] Commit Task 4.

## Execution Boundary

Do not add or run tests, build, typecheck, browser sessions, or migrations unless the user explicitly requests verification. No migration or backend change is part of this stage.
