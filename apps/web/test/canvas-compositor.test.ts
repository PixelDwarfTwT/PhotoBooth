import assert from "node:assert/strict";
import test from "node:test";
import { getCoverSourceCrop } from "../src/features/booth/lib/canvas-compositor.ts";

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
