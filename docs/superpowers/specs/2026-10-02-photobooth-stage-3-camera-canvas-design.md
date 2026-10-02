# Photobooth Stage 3: Camera and Canvas Editor

## Purpose

Implement the first browser-only photo session for the photobooth. The user can grant camera access explicitly, take a configurable sequence of photos (default four, with a three-second countdown), review and retake photos, arrange them as a strip or collage, apply a filter, place decorative stickers, and export a PNG or JPG locally.

This stage extends the Stage 1 public landing page and workspace. It does not add catalog API calls, cloud storage, QR links, user accounts, GIF recording, or third-party character artwork.

## Product and privacy constraints

- Do not request or enumerate camera access while the route loads. Explain the permission request and call `getUserMedia` only after a user action.
- Require a secure context (`https:` or `localhost`) and feature-detect `navigator.mediaDevices.getUserMedia`.
- Default to four photos and a three-second countdown. Let the user choose 2, 3, 4, 5, or 6 photos and a 3, 5, or 10 second countdown before starting.
- Support available camera selection after permission, front/rear facing mode where supported, and a mirror setting. The selected mirror setting applies consistently to preview and final composition.
- Capture photo blobs and composition state in memory only. Never send a frame, photo, sticker placement, or export to the backend.
- Stop every media track after the capture sequence, when the user ends the session, when a retake operation ends, and when the component unmounts. Retake must require an explicit user action before the camera restarts.
- Mark `/booth` as `noindex, nofollow`; do not put session data in metadata or URLs.
- Use original, generic decorative symbols for initial stickers. Do not use or imply licensed Sanrio characters or branding.
- Keep the flow mobile-first and keyboard accessible. Announce countdown/capture progress through a concise polite status region. Sticker movement must support pointer and keyboard input.
- On camera, permission, capture, or export failure, explain the issue and preserve recoverable in-memory photos so the user can retry.

## User flow

1. The landing-page primary action opens `/booth`.
2. The setup view explains why camera access is needed and offers photo-count, countdown, camera, and mirror controls. No camera request occurs yet.
3. After the user presses **Aktifkan kamera**, the browser stream is opened and the preview starts. Camera names are populated only after permission is granted. A user can switch cameras or stop the preview.
4. Pressing **Mulai sesi** runs the selected countdown before each photo. Captured photos appear in numbered review slots. When the sequence completes, the stream stops and the user enters the editor.
5. The editor offers strip and 2×2 collage layouts, four local filters, reorder and single-photo retake controls, local decorative stickers, and reset/end actions.
6. The compositor draws the current photos, layout, filter, mirror mode, and stickers to a local canvas. PNG and JPG downloads are created with `toBlob` and object URLs; object URLs are revoked when replaced or on unmount.
7. If a user retakes one photo, the app requests the camera only after that retake action, captures its replacement after the countdown, stops the stream, and returns to the editor.

## Architecture and module boundaries

- `apps/web/src/app/booth/page.tsx` is a server route containing only page metadata (`robots: noindex, nofollow`) and the client session component.
- `apps/web/src/features/booth/hooks/use-camera.ts` owns camera startup, device enumeration/selection, stream replacement, track cleanup, and typed camera errors.
- `apps/web/src/features/booth/hooks/use-capture-sequence.ts` owns the countdown, ordered captures, single-photo retake, cancellation, and capture status. It receives the active video element and returns Blob-backed photos.
- `apps/web/src/features/booth/lib/canvas-compositor.ts` is a pure browser utility that lays out local photo blobs, applies supported color filters and mirroring, draws stickers, and exports PNG/JPG blobs.
- Client UI components own setup, camera preview, review, and editor controls; they do not import `@photobooth/db` or call the API.
- `apps/web/src/app/page.tsx` links into the session but remains server rendered and indexable.

Data flow:

`user action → MediaStream → countdown → local photo Blobs → review/editor state → Canvas → local download`

There is no network edge in the session data flow.

## Behavior and fallbacks

- Map `NotAllowedError` to permission guidance, `NotFoundError` to a no-camera message, `NotReadableError`/`TrackStartError` to a camera-in-use message, and unavailable/insecure APIs to HTTPS/browser guidance. Provide a retry action after recoverable errors.
- Keep the sequence cancellable. Ending or leaving the page clears timers and stops all tracks. A late capture must not update an ended session.
- If a selected camera fails to start, show the specific error and keep the setup controls available to retry another device.
- If a canvas context, image decode, filter, or `toBlob` export fails, preserve the source Blob photos and offer retry. Do not clear the editor or imply a server backup.
- Use CSS filtering for the live preview and Canvas 2D filtering during composition. If Canvas filter support is unavailable, show a clear notice and let the user export without a filter.
- Use `pointer` events for touch and mouse sticker placement, with arrow keys for fine movement and Delete/Backspace to remove the focused sticker.

## Initial local assets and output policy

- Layouts: `strip` (portrait-oriented cells in one vertical canvas) and `grid` (two columns with enough rows for the configured count; four photos produce a 2×2 grid). An odd grid count leaves its final cell blank.
- Filters: `natural`, `warm`, `soft`, and `mono`; filter definitions are closed, local constants rather than arbitrary CSS or API input.
- Stickers: a small set of generic Unicode decorative symbols with editable position and size. No external images or fonts are required.
- Export dimensions are fixed and bounded for mobile performance: a 1000-pixel canvas width, with a maximum 2400-pixel height. JPG uses a light background for transparent/empty areas.

## Out of scope

Dynamic frame/theme/sticker/filter/pose catalogs, API endpoints, S3 upload or consent, QR code/link sharing, admin tools, GIF/video capture, worker-based image processing, and production cross-browser device QA belong to later stages. These local layouts, filters, and symbols are placeholders that can later be replaced by validated catalog data without moving photo bytes to the server.

## Implementation verification boundary

The source will be reviewed for the requirements above. No test or build commands will be run in this task unless the user explicitly requests them.
