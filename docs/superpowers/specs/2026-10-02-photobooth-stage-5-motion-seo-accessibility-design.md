# Photobooth Stage 5: Motion Export, Sharing, SEO, and Accessibility

## Goal

Finish optional motion and sharing affordances and public-site quality without weakening the private browser-only photo flow.

## Design

- Export a short looping WebM or MP4 from a canvas rendered locally from the captured photo sequence. Feature-detect `canvas.captureStream`, `MediaRecorder`, and supported MIME types; stop every stream track and recorder on completion, error, or unmount. If the browser lacks support, explain the limitation and leave the PNG/JPG/photo sequence available.
- Add Web Share file sharing when `navigator.canShare({ files })` allows it. On unsupported browsers or user cancellation, preserve the local download path and show concise guidance.
- Add a no-index `/share/[token]` viewer that loads the temporary image from the API with `no-store` semantics and offers download and revoke using the separate delete credential returned at share creation. Set no-referrer and avoid token analytics.
- Add public `/themes` and `/themes/[slug]` pages with canonical metadata, structured titles/descriptions, sitemap, and robots policy. Camera and share routes remain no-index; no session values appear in metadata.
- Keep interaction keyboard and touch usable, preserve visible focus, reduced-motion behavior, polite capture/export/share status announcements, meaningful labels/alt text, and readable contrast.
- No analytics or third-party trackers are introduced.

## Compatibility and testing

- Unit-test supported MIME selection, capability fallback, and recorder cleanup with Node tests around small pure helpers.
- Verify React/Next production builds and TypeScript. Use API-contract tests for share payloads and source-level checks for no-index metadata and no analytics imports.
- Manual camera, Web Share, and MediaRecorder verification remains browser/device dependent; unsupported devices must retain PNG/JPG download.

## Out of scope

Direct Instagram/TikTok publishing, background camera recording, server-side motion conversion, and collection of behavioral analytics.
