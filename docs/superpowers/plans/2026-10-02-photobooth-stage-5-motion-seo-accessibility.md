# Photobooth Stage 5 Motion and Web Experience Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` and complete each task with a test-first cycle. Steps use checkbox syntax.

**Goal:** Complete local looping export, native sharing, temporary share viewing, and accessible SEO pages.

**Architecture:** All capture/motion work stays in browser Canvas and MediaRecorder APIs. Cloud share pages read only temporary API objects and stay no-index; public theme pages remain server-rendered and indexable.

**Tech Stack:** Next.js App Router, React, TypeScript, Canvas, MediaRecorder, Web Share, Node tests.

**Spec:** `docs/superpowers/specs/2026-10-02-photobooth-stage-5-motion-seo-accessibility-design.md`

## Global Constraints

- Never start media recording without an explicit user action; stop tracks on all exit paths.
- Keep GIF/loop optional and retain ordinary image downloads as fallback.
- Mark `/booth` and `/share/[token]` no-index; exclude private tokens/session data from metadata and analytics.
- Public landing/theme/help pages remain indexable, responsive, keyboard usable, and reduced-motion aware.
- Add no analytics or third-party trackers.

## Review Focus

- Missing or partially supported MediaRecorder/canvas stream APIs leave the photo sequence and static export usable.
- Recorder errors, cancellation, and unmount stop every media track and do not drop photos.
- Web Share cancellation/unsupported file sharing does not lose the generated Blob or editor state.
- Invalid/expired share links show a useful no-index error page and never cache a private result.
- Keyboard focus, live announcements, alt text, reduced motion, and mobile controls stay usable after new controls are added.

---

### Task 1: Local looping recorder

**Files:** `apps/web/src/features/booth/lib/motion-export.ts`, `apps/web/src/features/booth/components/photo-editor.tsx`, `apps/web/src/features/booth/components/booth-session.module.css`, web tests.

- [x] Add failing tests for MIME selection priority, unsupported capability fallback, and recorder cleanup behavior.
- [x] Implement `getSupportedRecorderMimeType`, `recordPhotoLoop`, and bounded local Blob export using the composed photos; release canvas tracks on resolve/reject/abort.
- [x] Add explicit “Buat klip loop” control and polite status/error messages; keep PNG/JPG actions available.
- [x] Run motion tests and web typecheck/build.

### Task 2: Native file share and private share viewer

**Files:** `apps/web/src/features/booth/components/photo-editor.tsx`, `apps/web/src/app/share/[token]/page.tsx`, share viewer client/CSS, API share tests.

- [x] Test Web Share capability decision and static-download fallback for unsupported/cancelled cases.
- [x] Implement local Web Share with `navigator.canShare`, explicit download fallback, and cancellation handling.
- [x] Implement no-index temporary share viewer, bounded image fetch, download, copy-link, and separate-token revocation; never persist credentials in URLs or local storage.
- [x] Test no-index metadata and error states for expired/deleted shares; run web build.

### Task 3: Public catalog pages, SEO, and accessibility pass

**Files:** `apps/web/src/app/page.tsx`, `apps/web/src/app/themes/**`, `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`, shared navigation/styles, `README.md`.

- [x] Add tests/source assertions for public metadata, no-index private routes, keyboard labels/status, and tracker-free output.
- [x] Add indexable theme catalog/detail pages with explicit empty/API-unavailable states and metadata/sitemap from published catalog only.
- [x] Add clear navigation to themes, use guide, privacy, and help; tune focus, contrast, reduced motion, and narrow-screen controls.
- [x] Run full tests, typecheck, format check, and production build; record browser-only manual verification limits.

## Self-review

The tasks cover motion recording, unsupported-browser fallback, native sharing, temporary share viewing/deletion, public catalog SEO, and accessibility. Device-specific APIs receive deterministic helper tests and remain guarded by runtime feature detection; production Next build covers server/client module boundaries.

## Completion record

- Web suite: 28 tests passed, including motion recorder cleanup, streamed response byte limits, Web Share fallback contracts, private share metadata, crawler policy, and production HTTPS origin validation.
- Full workspace: 75 tests passed; `pnpm typecheck`, `pnpm format:check`, Prisma validation, and `pnpm build` passed. The production route table includes the public pages, `/booth`, and dynamic `/share/[token]` and `/themes/[slug]` routes.
- Camera permissions, real-device switching, native share sheets, and actual browser MediaRecorder codecs still require hands-on verification in target browsers over HTTPS or localhost.
- The generated Prisma migration was not applied. No live PostgreSQL service is available in the current environment.
