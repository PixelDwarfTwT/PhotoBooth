import assert from "node:assert/strict";
import test from "node:test";
import {
  AssetCatalogItemSchema,
  AssetMutationSchema,
  FrameLayoutConfigSchema,
  ThemeMutationSchema,
} from "../../../packages/contracts/src/catalog.ts";

test("fills safe defaults for a frame layout", () => {
  assert.deepEqual(
    FrameLayoutConfigSchema.parse({ backgroundColor: "#fff2f7" }),
    {
      backgroundColor: "#fff2f7",
      borderColor: "#f5c6d8",
      accentColor: "#bf3d6b",
      borderWidth: 8,
      photoGap: 12,
      layout: "both",
      caption: "",
      motif: "none",
    },
  );
});

test("rejects remote CSS values and unrecognized layout fields", () => {
  assert.equal(
    FrameLayoutConfigSchema.safeParse({
      backgroundColor: "url(https://attacker.invalid/image.svg)",
      customCss: "background-image:url(...)",
    }).success,
    false,
  );
});

test("rejects asset storage traversal and missing license metadata", () => {
  const result = AssetMutationSchema.safeParse({
    assetType: "FRAME",
    storageKey: "../private/frame.svg",
    mimeType: "image/svg+xml",
    width: 400,
    height: 800,
    fileSizeBytes: 1024,
    altText: "Frame",
    licenseNote: "",
  });

  assert.equal(result.success, false);
});

test("rejects a theme whose publication window is reversed", () => {
  assert.equal(
    ThemeMutationSchema.safeParse({
      name: "Pastel",
      slug: "pastel",
      startsAt: "2026-10-03T00:00:00.000Z",
      endsAt: "2026-10-02T00:00:00.000Z",
      status: "SCHEDULED",
    }).success,
    false,
  );
});

test("public asset metadata never includes private storage keys", () => {
  assert.equal(
    AssetCatalogItemSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      themeId: null,
      assetType: "FRAME",
      assetUrl: null,
      mimeType: "image/svg+xml",
      width: 400,
      height: 800,
      fileSizeBytes: 1200,
      altText: "Bingkai pastel",
      licenseNote: "Karya orisinal",
      sortOrder: 0,
      storageKey: "private/shares/secret.png",
    }).success,
    false,
  );
});
