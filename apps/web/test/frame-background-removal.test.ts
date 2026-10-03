import assert from "node:assert/strict";
import test from "node:test";
import {
  getFrameCoverCrop,
  getFrameCanvasHeight,
  getVisibleFrameBounds,
  findFramePhotoWindows,
  mapFramePhotoWindowsToCanvas,
  removeLightNeutralBackgroundPixels,
} from "../src/features/booth/lib/frame-background-removal.ts";

function createCheckerFrame(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const isFrameBorder = x < 3 || x >= width - 3;
      const value = (x + y) % 2 === 0 ? 242 : 220;
      pixels[offset] = isFrameBorder ? 32 : value;
      pixels[offset + 1] = isFrameBorder ? 24 : value;
      pixels[offset + 2] = isFrameBorder ? 28 : value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

test("removes a baked light checker background while keeping the dark frame", () => {
  const width = 40;
  const height = 30;
  const pixels = createCheckerFrame(width, height);

  const result = removeLightNeutralBackgroundPixels(pixels, width, height);

  assert.equal(result.kind, "removed");
  if (result.kind !== "removed") return;
  assert.equal(result.pixels[(15 * width + 20) * 4 + 3], 0);
  assert.equal(result.pixels[(15 * width + 1) * 4 + 3], 255);
});

test("keeps a frame that has no recognizable light background", () => {
  const pixels = new Uint8ClampedArray(20 * 20 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 40;
    pixels[offset + 1] = 70;
    pixels[offset + 2] = 90;
    pixels[offset + 3] = 255;
  }

  assert.equal(
    removeLightNeutralBackgroundPixels(pixels, 20, 20).kind,
    "unrecognized",
  );
});

test("does not process a frame that is already transparent", () => {
  const pixels = new Uint8ClampedArray(20 * 20 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset + 3] = 0;
  }

  assert.equal(
    removeLightNeutralBackgroundPixels(pixels, 20, 20).kind,
    "already-transparent",
  );
});

test("does not mistake an isolated transparent pixel for a transparent frame", () => {
  const pixels = createCheckerFrame(40, 30);
  pixels[3] = 0;

  assert.equal(
    removeLightNeutralBackgroundPixels(pixels, 40, 30).kind,
    "removed",
  );
});

test("finds visible frame bounds without treating photo windows as outer margins", () => {
  const width = 12;
  const height = 12;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 1; y <= 10; y += 1) {
    for (let x = 2; x <= 9; x += 1) {
      if (x >= 4 && x <= 7 && y >= 4 && y <= 7) continue;
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }

  assert.deepEqual(getVisibleFrameBounds(pixels, width, height), {
    x: 2,
    y: 1,
    width: 8,
    height: 10,
  });
});

test("cover-crops the fitted frame to the photo strip ratio without stretching", () => {
  assert.deepEqual(
    getFrameCoverCrop({ x: 10, y: 20, width: 100, height: 200 }, 100, 100),
    { x: 10, y: 70, width: 100, height: 100 },
  );
});

test("sizes the canvas to preserve the complete photo-frame aspect ratio", () => {
  assert.equal(
    getFrameCanvasHeight({ x: 20, y: 10, width: 200, height: 400 }, 1000, 2400),
    2000,
  );
});

test("returns no visible frame bounds when all pixels are transparent", () => {
  assert.equal(
    getVisibleFrameBounds(new Uint8ClampedArray(8 * 8 * 4), 8, 8),
    null,
  );
});

test("detects four large photo windows and ignores small transparent perforations", () => {
  const width = 100;
  const height = 200;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset + 3] = 255;
  }
  for (const top of [10, 55, 100, 145]) {
    for (let y = top; y < top + 25; y += 1) {
      for (let x = 30; x < 70; x += 1) {
        pixels[(y * width + x) * 4 + 3] = 0;
      }
    }
    for (let y = top + 5; y < top + 11; y += 1) {
      for (let x = 10; x < 17; x += 1) {
        pixels[(y * width + x) * 4 + 3] = 0;
      }
    }
  }

  assert.deepEqual(findFramePhotoWindows(pixels, width, height), [
    { x: 30, y: 10, width: 40, height: 25 },
    { x: 30, y: 55, width: 40, height: 25 },
    { x: 30, y: 100, width: 40, height: 25 },
    { x: 30, y: 145, width: 40, height: 25 },
  ]);
});

test("maps template photo windows into the fitted composition", () => {
  assert.deepEqual(
    mapFramePhotoWindowsToCanvas(
      [{ x: 30, y: 10, width: 40, height: 25 }],
      { x: 0, y: 0, width: 100, height: 200 },
      1000,
      2000,
    ),
    [{ x: 300, y: 100, width: 400, height: 250 }],
  );
});
