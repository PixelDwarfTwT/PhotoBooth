import assert from "node:assert/strict";
import test from "node:test";
import {
  readApiCapabilities,
  readCreatedShare,
  supportsFileSharing,
} from "../src/features/booth/lib/sharing-client.ts";

test("capabilities and share responses are accepted only when their contracts match", () => {
  assert.equal(
    readApiCapabilities({
      cloudSharingEnabled: true,
      consentVersion: "2026-10-02",
      shareTtlHours: 72,
      shareMaxBytes: 10 * 1024 * 1024,
    })?.cloudSharingEnabled,
    true,
  );
  assert.equal(readApiCapabilities({ cloudSharingEnabled: true }), null);
  assert.equal(
    readCreatedShare({
      shareUrl: "https://photo.example.test/share/abc",
      qrCodeDataUrl: null,
      deleteToken: "a".repeat(43),
      expiresAt: "2026-10-05T12:00:00.000Z",
      mimeType: "image/png",
      fileSizeBytes: 123,
    })?.mimeType,
    "image/png",
  );
  assert.equal(readCreatedShare({ shareUrl: "javascript:alert(1)" }), null);
});

test("native sharing requires file support and falls back for unsupported browsers", () => {
  const file = { type: "image/png" };
  assert.equal(supportsFileSharing(undefined, [file]), false);
  assert.equal(supportsFileSharing({ share: () => undefined }, [file]), false);
  assert.equal(
    supportsFileSharing(
      {
        share: () => undefined,
        canShare: ({ files }) => files[0] === file,
      },
      [file],
    ),
    true,
  );
});
