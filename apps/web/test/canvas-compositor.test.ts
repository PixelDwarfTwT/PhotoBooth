import assert from "node:assert/strict";
import test from "node:test";
import {
  getCoverSourceCrop,
  moveCoverCropPosition,
} from "../src/features/booth/lib/canvas-compositor.ts";

test("positions a wide 4:3 photo crop at the top of the Spider-Man window", () => {
  const crop = getCoverSourceCrop(640, 480, 526, 345, 0);

  assert.equal(crop.sourceY, 0);
  assert.equal(crop.sourceX, 0);
  assert.equal(crop.cropWidth, 640);
  assert.equal(crop.cropHeight, 640 / (526 / 345));
});

test("keeps centered vertical cropping as the default", () => {
  const crop = getCoverSourceCrop(640, 480, 526, 345);

  assert.equal(crop.sourceY, (480 - crop.cropHeight) / 2);
});

test("positions a wide photo crop independently on the horizontal axis", () => {
  const crop = getCoverSourceCrop(1600, 900, 526, 345, 0.5, 1);

  assert.equal(crop.sourceX, 1600 - crop.cropWidth);
  assert.equal(crop.sourceY, 0);
});

test("clamps independent crop positions to the image edges", () => {
  const crop = getCoverSourceCrop(1600, 900, 526, 345, -1, 2);

  assert.equal(crop.sourceX, 1600 - crop.cropWidth);
  assert.equal(crop.sourceY, 0);
});

test("moves a photo crop with pointer deltas while keeping it inside the image", () => {
  const next = moveCoverCropPosition(
    { x: 0.5, y: 0.5 },
    1600,
    900,
    526,
    345,
    120,
    0,
  );

  assert.ok(next.x < 0.5);
  assert.equal(next.y, 0.5);
});

test("moves a tall photo crop independently on the vertical axis", () => {
  const next = moveCoverCropPosition(
    { x: 0.5, y: 0.5 },
    900,
    1600,
    526,
    345,
    0,
    100,
  );

  assert.equal(next.x, 0.5);
  assert.ok(next.y < 0.5);
});

test("clamps a dragged crop at the image boundary", () => {
  const next = moveCoverCropPosition(
    { x: 0, y: 0.5 },
    1600,
    900,
    526,
    345,
    500,
    0,
  );

  assert.equal(next.x, 0);
});
