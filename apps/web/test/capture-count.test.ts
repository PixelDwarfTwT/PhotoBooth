import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_PHOTO_COUNT,
  getCapturePhotoIndices,
} from "../src/features/booth/lib/capture-count.ts";

test("a new photo session always captures exactly three photos", () => {
  assert.equal(CAPTURE_PHOTO_COUNT, 3);
  assert.deepEqual(getCapturePhotoIndices(), [0, 1, 2]);
});

test("resuming a partial session captures only its remaining photo slots", () => {
  assert.deepEqual(getCapturePhotoIndices(2), [2]);
});

test("a completed session cannot capture additional photos", () => {
  assert.deepEqual(getCapturePhotoIndices(3), []);
  assert.deepEqual(getCapturePhotoIndices(4), []);
});
