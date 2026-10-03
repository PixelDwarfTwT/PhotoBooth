import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FILTER_OPTIONS,
  getBoothFilter,
  getFrameLayouts,
  LOCAL_FRAMES,
} from "../src/features/booth/lib/editor-options.ts";

test("built-in frames are original local presets with bounded layout values", () => {
  assert.deepEqual(
    LOCAL_FRAMES.map((frame) => frame.id),
    ["local-pastel", "local-y2k", "local-warm"],
  );
  assert.equal(
    LOCAL_FRAMES.every((frame) => frame.layoutConfig.borderWidth <= 28),
    true,
  );
});

test("fallback filters carry safe default intensity values", () => {
  assert.equal(DEFAULT_FILTER_OPTIONS.length, 4);
  assert.equal(
    DEFAULT_FILTER_OPTIONS.every((option) => option.intensity === 1),
    true,
  );
});

test("filter intensity is clamped and produces only the closed local filter", () => {
  const halfWarm = getBoothFilter("warm", 0.5);
  const clampedWarm = getBoothFilter("warm", 5);

  assert.equal(
    halfWarm.css,
    "saturate(1.07) sepia(0.1) hue-rotate(-8deg) brightness(1.015)",
  );
  assert.equal(clampedWarm.css, getBoothFilter("warm", 1).css);
  assert.equal(getBoothFilter("natural", 0).css, "none");
});

test("frame presets expose only layouts allowed by their closed configuration", () => {
  assert.deepEqual(getFrameLayouts(LOCAL_FRAMES[0]!.layoutConfig), [
    "strip",
    "grid",
  ]);
  assert.deepEqual(
    getFrameLayouts({ ...LOCAL_FRAMES[0]!.layoutConfig, layout: "strip" }),
    ["strip"],
  );
});
