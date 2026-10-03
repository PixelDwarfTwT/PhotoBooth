import assert from "node:assert/strict";
import test from "node:test";
import {
  readFilterCatalog,
  readFrameCatalog,
  readPoseGuideCatalog,
} from "../src/features/booth/lib/catalog-client.ts";

const frameId = "11111111-1111-4111-8111-111111111111";
const themeId = "22222222-2222-4222-8222-222222222222";

test("accepts safe published frame metadata and maps it to editor options", () => {
  const frames = readFrameCatalog({
    items: [
      {
        id: frameId,
        themeId,
        themeSlug: "pastel",
        name: "Pastel star",
        assetUrl: "https://assets.example.test/pastel-frame.png",
        altText: "Original star frame",
        layoutConfig: { backgroundColor: "#fff2f7" },
        isLimited: false,
      },
    ],
  });

  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.id, frameId);
  assert.equal(frames[0]?.layoutConfig.borderColor, "#f5c6d8");
  assert.equal(
    frames[0]?.assetUrl,
    "https://assets.example.test/pastel-frame.png",
  );
});

test("drops catalog frames with unsafe or unrecognized renderer config", () => {
  assert.deepEqual(
    readFrameCatalog({
      items: [
        {
          id: frameId,
          themeId,
          themeSlug: "pastel",
          name: "Unsafe",
          assetUrl: null,
          altText: "Frame",
          layoutConfig: {
            backgroundColor: "url(https://attacker.invalid/a.svg)",
          },
        },
      ],
    }),
    [],
  );
});

test("accepts only known local filter keys and bounded intensity", () => {
  assert.deepEqual(
    readFilterCatalog({
      items: [
        {
          id: frameId,
          name: "Soft",
          filterKey: "soft",
          config: { intensity: 0.5 },
        },
        {
          id: themeId,
          name: "Inject",
          filterKey: "javascript",
          config: { css: "url(...)" },
        },
      ],
    }),
    [{ key: "soft", label: "Soft", intensity: 0.5 }],
  );
});

test("pose guide metadata is parsed before displaying catalog instructions", () => {
  assert.deepEqual(
    readPoseGuideCatalog({
      items: [
        {
          id: frameId,
          themeId: null,
          title: "Candid",
          instruction: "Put your hands up and smile.",
          assetUrl: null,
          altText: null,
        },
        {
          id: themeId,
          themeId: null,
          title: "Bad URL",
          instruction: "Text is safe.",
          assetUrl: "javascript:alert(1)",
          altText: null,
        },
      ],
    }),
    [
      {
        title: "Candid",
        instruction: "Put your hands up and smile.",
        assetUrl: null,
        altText: null,
      },
    ],
  );
});
