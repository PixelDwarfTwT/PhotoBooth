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

test("accepts explicit photo window geometry and checkerboard removal metadata", () => {
  const result = FrameLayoutConfigSchema.safeParse({
    layout: "strip",
    photoCropPositionY: 0,
    photoWindows: [
      { x: 0.3, y: 0.1, width: 0.4, height: 0.2 },
      { x: 0.3, y: 0.4, width: 0.4, height: 0.2 },
      { x: 0.3, y: 0.7, width: 0.4, height: 0.2 },
    ],
    backgroundRemoval: "gray-checker",
  });

  assert.equal(result.success, true);
});

test("rejects frame crop metadata that changes the template aspect ratio", () => {
  assert.equal(
    FrameLayoutConfigSchema.safeParse({
      frameBounds: { x: 0.275, y: 0.03, width: 0.455, height: 0.86 },
    }).success,
    false,
  );
});

test("rejects photo crop positions outside the image", () => {
  assert.equal(
    FrameLayoutConfigSchema.safeParse({ photoCropPositionY: 1.1 }).success,
    false,
  );
});

test("rejects photo windows outside the frame image", () => {
  assert.equal(
    FrameLayoutConfigSchema.safeParse({
      photoWindows: [
        { x: 0.8, y: 0.1, width: 0.4, height: 0.2 },
        { x: 0.3, y: 0.4, width: 0.4, height: 0.2 },
        { x: 0.3, y: 0.7, width: 0.4, height: 0.2 },
      ],
    }).success,
    false,
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

test("accepts a Supabase object filename with spaces and parentheses", () => {
  const result = AssetMutationSchema.safeParse({
    assetType: "FRAME",
    storageKey: "frames/download (5).png",
    mimeType: "image/png",
    width: 1152,
    height: 2048,
    fileSizeBytes: 1691031,
    altText: "Bingkai foto tiga pose",
    licenseNote: "Uploaded to the public catalog by the project owner.",
  });

  assert.equal(result.success, true);
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
