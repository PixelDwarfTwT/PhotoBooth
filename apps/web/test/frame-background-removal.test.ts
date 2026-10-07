import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPhotoWindowCutouts,
  getFrameCoverCrop,
  getFrameCanvasSize,
  getFrameCanvasHeight,
  getVisibleFrameBounds,
  findFramePhotoWindows,
  mapFramePhotoWindowsToCanvas,
  removeFrameBackgroundPixels,
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

test("removes a baked gray checkerboard while keeping colored frame art", () => {
  const width = 40;
  const height = 30;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const isFrameBorder = x < 3 || x >= width - 3;
      const gray = (x + y) % 2 === 0 ? 52 : 105;
      pixels[offset] = isFrameBorder ? 30 : gray;
      pixels[offset + 1] = isFrameBorder ? 110 : gray;
      pixels[offset + 2] = isFrameBorder ? 210 : gray;
      pixels[offset + 3] = 255;
    }
  }

  const result = removeLightNeutralBackgroundPixels(
    pixels,
    width,
    height,
    "gray-checker",
  );

  assert.equal(result.kind, "removed");
  assert.equal(pixels[(15 * width + 20) * 4 + 3], 0);
});

test("configured photo windows become transparent regardless of their fill", () => {
  const width = 100;
  const height = 200;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 250;
    pixels[offset + 1] = 250;
    pixels[offset + 2] = 250;
    pixels[offset + 3] = 255;
  }
  const windows = [
    { x: 0.2, y: 0.1, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.4, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.7, width: 0.6, height: 0.2 },
  ];

  const bounds = applyPhotoWindowCutouts(pixels, width, height, windows);

  assert.deepEqual(bounds, [
    { x: 20, y: 20, width: 60, height: 40 },
    { x: 20, y: 80, width: 60, height: 40 },
    { x: 20, y: 140, width: 60, height: 40 },
  ]);
  assert.equal(pixels[(30 * width + 30) * 4 + 3], 0);
  assert.equal(pixels[(30 * width + 10) * 4 + 3], 255);
});

test("keeps foreground art inside photo windows after background removal", () => {
  const width = 100;
  const height = 200;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 250;
    pixels[offset + 1] = 250;
    pixels[offset + 2] = 250;
    pixels[offset + 3] = 255;
  }
  const artOffset = (30 * width + 30) * 4;
  pixels[artOffset] = 220;
  pixels[artOffset + 1] = 30;
  pixels[artOffset + 2] = 40;
  pixels[artOffset + 3] = 255;
  const windows = [
    { x: 0.2, y: 0.1, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.4, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.7, width: 0.6, height: 0.2 },
  ];

  const backgroundResult = removeLightNeutralBackgroundPixels(
    pixels,
    width,
    height,
  );
  const bounds = applyPhotoWindowCutouts(pixels, width, height, windows, false);

  assert.equal(backgroundResult.kind, "removed");
  assert.equal(bounds.length, 3);
  assert.equal(pixels[artOffset + 3], 255);
  assert.equal(pixels[(40 * width + 40) * 4 + 3], 0);
});

test("removes the white backdrop but preserves enclosed white frame artwork", () => {
  const width = 120;
  const height = 240;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 250;
    pixels[offset + 1] = 250;
    pixels[offset + 2] = 250;
    pixels[offset + 3] = 255;
  }

  const windows = [
    { x: 0.2, y: 0.1, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.4, width: 0.6, height: 0.2 },
    { x: 0.2, y: 0.7, width: 0.6, height: 0.2 },
  ];
  for (const window of windows) {
    const left = Math.round(window.x * width);
    const top = Math.round(window.y * height);
    const right = Math.round((window.x + window.width) * width);
    const bottom = Math.round((window.y + window.height) * height);
    for (let y = top - 2; y < bottom + 2; y += 1) {
      for (let x = left - 2; x < right + 2; x += 1) {
        if (x < left || x >= right || y < top || y >= bottom) {
          const offset = (y * width + x) * 4;
          pixels[offset] = 25;
          pixels[offset + 1] = 25;
          pixels[offset + 2] = 25;
        }
      }
    }
  }

  // The first slot's white backdrop touches the outside through a small frame gap.
  for (let x = 22; x < 24; x += 1) {
    const offset = (30 * width + x) * 4;
    pixels[offset] = 250;
    pixels[offset + 1] = 250;
    pixels[offset + 2] = 250;
  }

  // A white Spider-Man detail enclosed by its dark outline must remain above the photo.
  for (let y = 35; y < 43; y += 1) {
    for (let x = 45; x < 55; x += 1) {
      const offset = (y * width + x) * 4;
      if (x < 47 || x >= 53 || y < 37 || y >= 41) {
        pixels[offset] = 25;
        pixels[offset + 1] = 25;
        pixels[offset + 2] = 25;
      }
    }
  }

  const result = removeFrameBackgroundPixels(pixels, width, height, windows);

  assert.equal(result.kind, "removed");
  assert.equal(pixels[3], 0, "outer white background becomes transparent");
  assert.equal(
    pixels[(15 * width + 30) * 4 + 3],
    0,
    "white photo-window background becomes transparent",
  );
  assert.equal(
    pixels[(38 * width + 50) * 4 + 3],
    255,
    "enclosed white artwork remains opaque",
  );
});

test("removes every edge-connected white region in a photo window while keeping enclosed art", () => {
  const width = 100;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 250;
    pixels[offset + 1] = 250;
    pixels[offset + 2] = 250;
    pixels[offset + 3] = 255;
  }

  // A dark frame isolates the photo opening from the exterior background.
  for (let x = 18; x <= 81; x += 1) {
    for (const y of [18, 81]) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 25;
      pixels[offset + 1] = 25;
      pixels[offset + 2] = 25;
    }
  }
  for (let y = 18; y <= 81; y += 1) {
    for (const x of [18, 81]) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 25;
      pixels[offset + 1] = 25;
      pixels[offset + 2] = 25;
    }
  }

  // The hanging character splits the white backdrop into two edge-connected regions.
  for (let y = 19; y < 81; y += 1) {
    const offset = (y * width + 65) * 4;
    pixels[offset] = 25;
    pixels[offset + 1] = 25;
    pixels[offset + 2] = 25;
  }

  // Enclosed white detail in the character art must remain above the photo.
  for (let y = 40; y <= 47; y += 1) {
    for (let x = 35; x <= 44; x += 1) {
      if (x >= 37 && x <= 42 && y >= 42 && y <= 45) continue;
      const offset = (y * width + x) * 4;
      pixels[offset] = 25;
      pixels[offset + 1] = 25;
      pixels[offset + 2] = 25;
    }
  }

  const result = removeFrameBackgroundPixels(pixels, width, height, [
    { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  ]);

  assert.equal(result.kind, "removed");
  assert.equal(
    pixels[(30 * width + 72) * 4 + 3],
    0,
    "secondary blank region is transparent",
  );
  assert.equal(
    pixels[(43 * width + 39) * 4 + 3],
    255,
    "enclosed white character detail is retained",
  );
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

test("fits tall frame output within the size limits without distorting it", () => {
  assert.deepEqual(
    getFrameCanvasSize({ x: 0, y: 0, width: 400, height: 1600 }, 1000, 2400),
    { width: 600, height: 2400 },
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
