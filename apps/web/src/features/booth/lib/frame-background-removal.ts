export interface VisibleFrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PreparedFrameImage =
  | {
      kind: "ready";
      canvas: HTMLCanvasElement;
      bounds: VisibleFrameBounds;
      photoWindows: VisibleFrameBounds[];
    }
  | { kind: "unrecognized" };

interface ColorSample {
  red: number;
  green: number;
  blue: number;
}

const MAX_COLOR_DISTANCE = 46;
const FEATHER_DISTANCE = 34;
const MIN_REMOVED_PIXEL_RATIO = 0.005;
const MAX_PROCESSING_PIXELS = 4_000_000;
const OPAQUE_ALPHA_THRESHOLD = 16;
const MIN_PHOTO_WINDOW_AREA_RATIO = 0.012;
const MIN_PHOTO_WINDOW_WIDTH_RATIO = 0.28;
const MIN_PHOTO_WINDOW_HEIGHT_RATIO = 0.07;

export function getVisibleFrameBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): VisibleFrameBounds | null {
  if (width < 1 || height < 1 || pixels.length !== width * height * 4) {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < OPAQUE_ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function getFrameCoverCrop(
  bounds: VisibleFrameBounds,
  targetWidth: number,
  targetHeight: number,
): VisibleFrameBounds {
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = bounds.width / bounds.height;
  if (sourceRatio > targetRatio) {
    const width = bounds.height * targetRatio;
    return { ...bounds, x: bounds.x + (bounds.width - width) / 2, width };
  }

  const height = bounds.width / targetRatio;
  return { ...bounds, y: bounds.y + (bounds.height - height) / 2, height };
}

export function getFrameCanvasHeight(
  bounds: VisibleFrameBounds,
  targetWidth: number,
  maxHeight: number,
): number {
  if (
    bounds.width < 1 ||
    bounds.height < 1 ||
    targetWidth < 1 ||
    maxHeight < 1
  ) {
    return 1;
  }

  return Math.min(
    maxHeight,
    Math.max(1, Math.round((targetWidth * bounds.height) / bounds.width)),
  );
}

export function mapFramePhotoWindowsToCanvas(
  windows: VisibleFrameBounds[],
  crop: VisibleFrameBounds,
  targetWidth: number,
  targetHeight: number,
): VisibleFrameBounds[] {
  const scaleX = targetWidth / crop.width;
  const scaleY = targetHeight / crop.height;
  return windows.flatMap((window) => {
    const left = Math.max(window.x, crop.x);
    const top = Math.max(window.y, crop.y);
    const right = Math.min(window.x + window.width, crop.x + crop.width);
    const bottom = Math.min(window.y + window.height, crop.y + crop.height);
    if (right <= left || bottom <= top) return [];
    return [
      {
        x: (left - crop.x) * scaleX,
        y: (top - crop.y) * scaleY,
        width: (right - left) * scaleX,
        height: (bottom - top) * scaleY,
      },
    ];
  });
}

export function findFramePhotoWindows(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): VisibleFrameBounds[] {
  const pixelCount = width * height;
  if (
    width < 1 ||
    height < 1 ||
    pixelCount > MAX_PROCESSING_PIXELS ||
    pixels.length !== pixelCount * 4
  ) {
    return [];
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const minimumWindowArea = pixelCount * MIN_PHOTO_WINDOW_AREA_RATIO;
  const windows: VisibleFrameBounds[] = [];
  let head = 0;
  let tail = 0;

  function enqueueTransparent(neighbor: number): void {
    if (visited[neighbor] === 1) return;
    visited[neighbor] = 1;
    if ((pixels[neighbor * 4 + 3] ?? 0) < OPAQUE_ALPHA_THRESHOLD) {
      queue[tail++] = neighbor;
    }
  }

  for (let start = 0; start < pixelCount; start += 1) {
    if (
      visited[start] === 1 ||
      (pixels[start * 4 + 3] ?? 0) >= OPAQUE_ALPHA_THRESHOLD
    ) {
      continue;
    }

    head = 0;
    tail = 0;
    let pixelArea = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let touchesImageEdge = false;
    visited[start] = 1;
    queue[tail++] = start;

    while (head < tail) {
      const pixelIndex = queue[head++] ?? 0;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixelArea += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesImageEdge = true;
      }

      if (x > 0) enqueueTransparent(pixelIndex - 1);
      if (x < width - 1) enqueueTransparent(pixelIndex + 1);
      if (y > 0) enqueueTransparent(pixelIndex - width);
      if (y < height - 1) enqueueTransparent(pixelIndex + width);
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    if (
      !touchesImageEdge &&
      pixelArea >= minimumWindowArea &&
      componentWidth >= width * MIN_PHOTO_WINDOW_WIDTH_RATIO &&
      componentHeight >= height * MIN_PHOTO_WINDOW_HEIGHT_RATIO
    ) {
      windows.push({
        x: minX,
        y: minY,
        width: componentWidth,
        height: componentHeight,
      });
    }
  }

  return windows.sort((left, right) => left.y - right.y || left.x - right.x);
}

function sampleCorner(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
): { color: ColorSample; isTransparent: boolean } {
  const radius = 2;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  let transparentCount = 0;
  let totalCount = 0;

  for (
    let y = Math.max(0, centerY - radius);
    y <= Math.min(height - 1, centerY + radius);
    y += 1
  ) {
    for (
      let x = Math.max(0, centerX - radius);
      x <= Math.min(width - 1, centerX + radius);
      x += 1
    ) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3] ?? 0;
      totalCount += 1;
      if (alpha < 8) {
        transparentCount += 1;
        continue;
      }
      red += pixels[offset] ?? 0;
      green += pixels[offset + 1] ?? 0;
      blue += pixels[offset + 2] ?? 0;
      count += 1;
    }
  }

  return {
    color: {
      red: count ? red / count : 0,
      green: count ? green / count : 0,
      blue: count ? blue / count : 0,
    },
    isTransparent: totalCount > 0 && transparentCount / totalCount >= 0.8,
  };
}

function isLightNeutral(color: ColorSample): boolean {
  const highest = Math.max(color.red, color.green, color.blue);
  const lowest = Math.min(color.red, color.green, color.blue);
  return lowest >= 190 && highest - lowest <= 34;
}

function colorDistance(left: ColorSample, right: ColorSample): number {
  return Math.hypot(
    left.red - right.red,
    left.green - right.green,
    left.blue - right.blue,
  );
}

function getCornerColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): {
  colors: ColorSample[];
  hasTransparency: boolean;
} {
  const insetX = Math.min(Math.max(2, Math.round(width * 0.025)), width - 1);
  const insetY = Math.min(Math.max(2, Math.round(height * 0.025)), height - 1);
  const edgeSamples = [
    sampleCorner(data, width, height, insetX, insetY),
    sampleCorner(data, width, height, width - 1 - insetX, insetY),
    sampleCorner(data, width, height, insetX, height - 1 - insetY),
    sampleCorner(data, width, height, width - 1 - insetX, height - 1 - insetY),
    sampleCorner(data, width, height, Math.round(width * 0.25), insetY),
    sampleCorner(data, width, height, Math.round(width * 0.75), insetY),
    sampleCorner(
      data,
      width,
      height,
      Math.round(width * 0.25),
      height - 1 - insetY,
    ),
    sampleCorner(
      data,
      width,
      height,
      Math.round(width * 0.75),
      height - 1 - insetY,
    ),
    sampleCorner(data, width, height, insetX, Math.round(height * 0.25)),
    sampleCorner(data, width, height, insetX, Math.round(height * 0.75)),
    sampleCorner(
      data,
      width,
      height,
      width - 1 - insetX,
      Math.round(height * 0.25),
    ),
    sampleCorner(
      data,
      width,
      height,
      width - 1 - insetX,
      Math.round(height * 0.75),
    ),
  ];
  const colors: ColorSample[] = [];

  for (const edgeSample of edgeSamples) {
    if (isLightNeutral(edgeSample.color)) {
      const alreadySampled = colors.some(
        (sample) => colorDistance(sample, edgeSample.color) < 8,
      );
      if (!alreadySampled) colors.push(edgeSample.color);
    }
  }

  return {
    colors,
    hasTransparency:
      edgeSamples.filter((sample) => sample.isTransparent).length >= 4,
  };
}

export function removeLightNeutralBackgroundPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
):
  | { kind: "removed"; pixels: Uint8ClampedArray }
  | { kind: "already-transparent" }
  | { kind: "unrecognized" } {
  if (
    pixels.length !== width * height * 4 ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_PROCESSING_PIXELS
  ) {
    return { kind: "unrecognized" };
  }
  const { colors, hasTransparency } = getCornerColors(pixels, width, height);

  if (hasTransparency) return { kind: "already-transparent" };
  if (colors.length === 0) return { kind: "unrecognized" };

  let removedPixels = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3] ?? 0;
    if (alpha === 0) continue;

    const pixel: ColorSample = {
      red: pixels[offset] ?? 0,
      green: pixels[offset + 1] ?? 0,
      blue: pixels[offset + 2] ?? 0,
    };
    const highest = Math.max(pixel.red, pixel.green, pixel.blue);
    const lowest = Math.min(pixel.red, pixel.green, pixel.blue);
    if (lowest < 175 || highest - lowest > 48) continue;

    const distance = Math.min(
      ...colors.map((sample) => colorDistance(pixel, sample)),
    );
    if (distance <= MAX_COLOR_DISTANCE) {
      pixels[offset + 3] = 0;
      removedPixels += 1;
    } else if (distance < MAX_COLOR_DISTANCE + FEATHER_DISTANCE) {
      pixels[offset + 3] = Math.round(
        alpha * ((distance - MAX_COLOR_DISTANCE) / FEATHER_DISTANCE),
      );
    }
  }

  if (removedPixels < width * height * MIN_REMOVED_PIXEL_RATIO) {
    return { kind: "unrecognized" };
  }

  return { kind: "removed", pixels };
}

export function prepareFrameImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  removeBackground: boolean,
): PreparedFrameImage {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas frame tidak dapat dimulai.");

  context.drawImage(source, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  if (removeBackground) {
    const result = removeLightNeutralBackgroundPixels(
      imageData.data,
      width,
      height,
    );
    if (result.kind === "unrecognized") return result;
  }

  const bounds = getVisibleFrameBounds(imageData.data, width, height);
  if (!bounds) return { kind: "unrecognized" };

  context.putImageData(imageData, 0, 0);
  return {
    kind: "ready",
    canvas,
    bounds,
    photoWindows: findFramePhotoWindows(imageData.data, width, height),
  };
}
