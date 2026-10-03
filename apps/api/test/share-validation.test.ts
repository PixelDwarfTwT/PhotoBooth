import assert from "node:assert/strict";
import test from "node:test";
import { HttpApiError } from "../src/lib/api-error.ts";
import { validateShareUpload } from "../src/services/share-validation.ts";

const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

test("accepts a bounded PNG only after the active consent notice", () => {
  assert.deepEqual(
    validateShareUpload({
      body: pngHeader,
      mimeType: "image/png",
      consentVersion: "2026-10-02",
      expectedConsentVersion: "2026-10-02",
      maxBytes: 1024,
    }),
    { mimeType: "image/png", fileSizeBytes: pngHeader.length },
  );
});

test("rejects a missing or stale consent notice", () => {
  assert.throws(
    () =>
      validateShareUpload({
        body: pngHeader,
        mimeType: "image/png",
        consentVersion: undefined,
        expectedConsentVersion: "2026-10-02",
        maxBytes: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpApiError && error.code === "consent_required",
  );
});

test("rejects a file whose declared type does not match its bytes", () => {
  assert.throws(
    () =>
      validateShareUpload({
        body: pngHeader,
        mimeType: "image/jpeg",
        consentVersion: "2026-10-02",
        expectedConsentVersion: "2026-10-02",
        maxBytes: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpApiError && error.code === "invalid_image",
  );
});

test("rejects an oversized image before it reaches object storage", () => {
  assert.throws(
    () =>
      validateShareUpload({
        body: pngHeader,
        mimeType: "image/png",
        consentVersion: "2026-10-02",
        expectedConsentVersion: "2026-10-02",
        maxBytes: 16,
      }),
    (error: unknown) =>
      error instanceof HttpApiError && error.statusCode === 413,
  );
});

test("rejects dimensions large enough to exhaust image decoders", () => {
  const jpegWithLargeFrame = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x1f, 0x40, 0x1f, 0x40, 0x01,
    0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);

  assert.throws(
    () =>
      validateShareUpload({
        body: jpegWithLargeFrame,
        mimeType: "image/jpeg",
        consentVersion: "2026-10-02",
        expectedConsentVersion: "2026-10-02",
        maxBytes: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpApiError && error.code === "invalid_image",
  );
});
