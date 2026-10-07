import assert from "node:assert/strict";
import test from "node:test";
import {
  getMotionFilterCss,
  getStoryPlacement,
} from "../src/features/booth/lib/export-presets.js";

test("motion filter presets cover the requested video looks", () => {
  assert.equal(getMotionFilterCss("normal"), "none");
  assert.equal(getMotionFilterCss("mono"), "grayscale(1)");
  assert.equal(getMotionFilterCss("sepia"), "sepia(1)");
  assert.equal(getMotionFilterCss("negative"), "invert(1)");
  assert.equal(getMotionFilterCss("blur"), "blur(2px)");
});

test("story placement contains portrait photo strips within a 9:16 canvas", () => {
  const placement = getStoryPlacement(1000, 2200);
  assert.equal(placement.width, 821.8181818181818);
  assert.equal(placement.height, 1808);
  assert.equal(placement.x, (1080 - placement.width) / 2);
  assert.equal(placement.y, 56);
});

test("story placement contains wide collages without distortion", () => {
  const placement = getStoryPlacement(1600, 900);
  assert.equal(placement.width, 968);
  assert.equal(placement.height, 544.5);
  assert.equal(placement.y, (1920 - placement.height) / 2);
});

test("invalid source dimensions return a safe empty placement", () => {
  assert.deepEqual(getStoryPlacement(0, 900), {
    x: 540,
    y: 960,
    width: 0,
    height: 0,
  });
});
