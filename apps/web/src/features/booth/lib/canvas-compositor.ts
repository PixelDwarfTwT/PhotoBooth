import { getBoothFilter } from "./editor-options";
import type { FrameLayoutConfig } from "@photobooth/contracts";
import { readBoundedBlob } from "@/lib/read-bounded-blob";
import {
  getFrameCanvasSize,
  getFrameCoverCrop,
  mapFramePhotoWindowsToCanvas,
  prepareFrameImage,
  type VisibleFrameBounds,
} from "./frame-background-removal";
import type {
  BoothFilter,
  BoothLayout,
  CapturedPhoto,
  StickerPlacement,
} from "../types";

const CANVAS_WIDTH = 1000;
const MAX_CANVAS_HEIGHT = 2400;
const OUTER_PADDING = 36;
const FOOTER_HEIGHT = 108;
const STRIP_CELL_HEIGHT = 530;
const PHOTO_BACKGROUND = "#fffaf7";
const CANVAS_BACKGROUND = "#fff2f7";
const INK = "#594656";

interface CanvasPhoto extends CapturedPhoto {
  source: CanvasImageSource;
  dispose: () => void;
}

interface FrameOverlay {
  source: CanvasImageSource;
  bounds: VisibleFrameBounds;
  photoWindows: VisibleFrameBounds[];
  dispose: () => void;
}

interface DecodedFrameImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export interface CompositionInput {
  photos: CapturedPhoto[];
  layout: BoothLayout;
  filter: BoothFilter;
  filterIntensity: number;
  stickers: StickerPlacement[];
  frame: FrameLayoutConfig;
  frameAssetUrl: string | null;
  removeFrameBackground: boolean;
  onFrameBackgroundRemovalFailure?: () => void;
  isCurrent?: () => boolean;
}

interface PhotoCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverSourceCrop {
  sourceX: number;
  sourceY: number;
  cropWidth: number;
  cropHeight: number;
}

export function getCoverSourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  verticalPositionY = 0.5,
): CoverSourceCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const destinationRatio = destinationWidth / destinationHeight;
  const verticalAnchor = Math.min(1, Math.max(0, verticalPositionY));
  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > destinationRatio) {
    cropWidth = sourceHeight * destinationRatio;
    sourceX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / destinationRatio;
    sourceY = (sourceHeight - cropHeight) * verticalAnchor;
  }

  return { sourceX, sourceY, cropWidth, cropHeight };
}

async function loadPhoto(photo: CapturedPhoto): Promise<CanvasPhoto> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(photo.blob);
    return { ...photo, source: bitmap, dispose: () => bitmap.close() };
  }

  const objectUrl = URL.createObjectURL(photo.blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return {
      ...photo,
      source: image,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function decodeFrameImage(blob: Blob): Promise<DecodedFrameImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function loadFrameOverlay(
  assetUrl: string | null,
  frame: FrameLayoutConfig,
  removeBackground: boolean,
  onRemovalFailure?: () => void,
): Promise<FrameOverlay | null> {
  if (!assetUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(assetUrl, {
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const mimeType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.toLowerCase();
    if (
      mimeType !== "image/png" &&
      mimeType !== "image/jpeg" &&
      mimeType !== "image/webp"
    ) {
      return null;
    }
    const blob = await readBoundedBlob(response, 8 * 1024 * 1024);
    if (!blob) return null;

    const decoded = await decodeFrameImage(blob);
    if (
      decoded.width > 10000 ||
      decoded.height > 10000 ||
      decoded.width * decoded.height > 16_000_000
    ) {
      decoded.dispose();
      return null;
    }
    try {
      const result = prepareFrameImage(
        decoded.source,
        decoded.width,
        decoded.height,
        removeBackground,
        frame.backgroundRemoval,
        frame.photoWindows,
      );
      decoded.dispose();
      if (result.kind === "unrecognized") {
        onRemovalFailure?.();
        return null;
      }
      return {
        source: result.canvas,
        bounds: result.bounds,
        photoWindows: result.photoWindows,
        dispose: () => {},
      };
    } catch {
      decoded.dispose();
      onRemovalFailure?.();
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getPhotoCells(
  layout: BoothLayout,
  count: number,
  height: number,
  cellGap: number,
  canvasWidth = CANVAS_WIDTH,
): PhotoCell[] {
  if (layout === "strip") {
    const availableCellHeight = Math.floor(
      (height - OUTER_PADDING * 2 - FOOTER_HEIGHT - cellGap * (count - 1)) /
        count,
    );
    const cellHeight = Math.min(STRIP_CELL_HEIGHT, availableCellHeight);
    const cellWidth = canvasWidth - OUTER_PADDING * 2;

    return Array.from({ length: count }, (_, index) => ({
      x: OUTER_PADDING,
      y: OUTER_PADDING + index * (cellHeight + cellGap),
      width: cellWidth,
      height: cellHeight,
    }));
  }

  const columns = 2;
  const cellWidth =
    (canvasWidth - OUTER_PADDING * 2 - cellGap * (columns - 1)) / columns;
  const cellHeight = Math.min(360, Math.round(cellWidth * 0.72));

  return Array.from({ length: count }, (_, index) => ({
    x: OUTER_PADDING + (index % columns) * (cellWidth + cellGap),
    y: OUTER_PADDING + Math.floor(index / columns) * (cellHeight + cellGap),
    width: cellWidth,
    height: cellHeight,
  }));
}

function getCanvasHeight(
  layout: BoothLayout,
  count: number,
  cellGap: number,
  canvasWidth = CANVAS_WIDTH,
): number {
  if (layout === "strip") {
    const cellHeight = STRIP_CELL_HEIGHT;
    return (
      OUTER_PADDING * 2 +
      count * cellHeight +
      cellGap * Math.max(0, count - 1) +
      FOOTER_HEIGHT
    );
  }

  const rows = Math.ceil(count / 2);
  const cellWidth = (canvasWidth - OUTER_PADDING * 2 - cellGap) / 2;
  const cellHeight = Math.min(360, Math.round(cellWidth * 0.72));
  return (
    OUTER_PADDING * 2 +
    rows * cellHeight +
    cellGap * Math.max(0, rows - 1) +
    FOOTER_HEIGHT
  );
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  cell: PhotoCell,
  verticalPositionY: number,
): void {
  const crop = getCoverSourceCrop(
    sourceWidth,
    sourceHeight,
    cell.width,
    cell.height,
    verticalPositionY,
  );

  context.save();
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.cropWidth,
    crop.cropHeight,
    cell.x,
    cell.y,
    cell.width,
    cell.height,
  );
  context.restore();
}

function drawSticker(
  context: CanvasRenderingContext2D,
  sticker: StickerPlacement,
  canvasWidth: number,
): void {
  const scale = canvasWidth / CANVAS_WIDTH;
  context.save();
  context.font = `${sticker.fontSize * scale}px "Segoe UI Symbol", "Apple Symbols", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgb(52 40 59 / 24%)";
  context.shadowBlur = 10 * scale;
  context.shadowOffsetY = 3 * scale;
  context.fillStyle = "#fff";
  context.fillText(
    sticker.symbol,
    sticker.x * canvasWidth,
    sticker.y * context.canvas.height,
  );
  context.restore();
}

function drawFrameMotif(
  context: CanvasRenderingContext2D,
  config: FrameLayoutConfig,
  height: number,
  canvasWidth: number,
): void {
  const scale = canvasWidth / CANVAS_WIDTH;
  context.save();
  context.fillStyle = config.accentColor;

  if (config.motif === "dots") {
    for (let index = 0; index < 8; index += 1) {
      const x = (42 + index * 130) * scale;
      context.beginPath();
      context.arc(x, 18 * scale, 4 * scale, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(x, height - 18 * scale, 4 * scale, 0, Math.PI * 2);
      context.fill();
    }
  } else if (config.motif === "checker") {
    const squareSize = 13 * scale;
    for (let index = 0; index < 12; index += 1) {
      if (index % 2 === 0) {
        context.fillRect(index * squareSize, 0, squareSize, squareSize);
        context.fillRect(
          canvasWidth - (index + 1) * squareSize,
          height - squareSize,
          squareSize,
          squareSize,
        );
      }
    }
  } else if (config.motif === "sparkles") {
    context.font = `${24 * scale}px "Segoe UI Symbol", "Apple Symbols", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("✦", 18 * scale, 18 * scale);
    context.fillText("✦", canvasWidth - 18 * scale, height - 18 * scale);
  }

  context.restore();
}

export async function renderComposition(
  canvas: HTMLCanvasElement,
  input: CompositionInput,
): Promise<boolean> {
  if (input.photos.length === 0) {
    throw new Error("Belum ada foto untuk disusun.");
  }

  const photos: CanvasPhoto[] = [];
  let frameOverlay: FrameOverlay | null = null;
  try {
    for (const photo of input.photos) {
      photos.push(await loadPhoto(photo));
    }

    if (input.isCurrent && !input.isCurrent()) return false;

    frameOverlay = await loadFrameOverlay(
      input.frameAssetUrl,
      input.frame,
      input.removeFrameBackground,
      input.onFrameBackgroundRemovalFailure,
    );
    if (input.isCurrent && !input.isCurrent()) return false;

    const hasMatchingFrameWindows =
      input.layout === "strip" &&
      frameOverlay?.photoWindows.length === photos.length;
    const frameCanvasSize =
      frameOverlay && hasMatchingFrameWindows
        ? getFrameCanvasSize(
            frameOverlay.bounds,
            CANVAS_WIDTH,
            MAX_CANVAS_HEIGHT,
          )
        : null;
    const canvasWidth = frameCanvasSize?.width ?? CANVAS_WIDTH;
    const height =
      frameCanvasSize?.height ??
      getCanvasHeight(input.layout, photos.length, input.frame.photoGap);
    const stagingCanvas = document.createElement("canvas");
    stagingCanvas.width = canvasWidth;
    stagingCanvas.height = height;
    const context = stagingCanvas.getContext("2d");
    if (!context) throw new Error("Canvas editor tidak dapat dimulai.");

    context.fillStyle = input.frame.backgroundColor || CANVAS_BACKGROUND;
    context.fillRect(0, 0, canvasWidth, height);
    const frameCrop = frameOverlay
      ? hasMatchingFrameWindows
        ? frameOverlay.bounds
        : getFrameCoverCrop(frameOverlay.bounds, canvasWidth, height)
      : null;
    const mappedFrameWindows =
      frameCrop && frameOverlay
        ? mapFramePhotoWindowsToCanvas(
            frameOverlay.photoWindows,
            frameCrop,
            canvasWidth,
            height,
          )
        : [];
    const useFramePhotoWindows =
      hasMatchingFrameWindows && mappedFrameWindows.length === photos.length;
    if (!useFramePhotoWindows)
      drawFrameMotif(context, input.frame, height, canvasWidth);

    const cells = useFramePhotoWindows
      ? mappedFrameWindows
      : getPhotoCells(
          input.layout,
          photos.length,
          height,
          input.frame.photoGap,
          canvasWidth,
        );
    const requestedFilter = getBoothFilter(input.filter, input.filterIntensity);
    const filterSupported = "filter" in context;
    const appliedFilter =
      input.filter === "natural" || filterSupported
        ? requestedFilter.css
        : "none";

    photos.forEach((photo, index) => {
      const cell = cells[index];
      if (!cell) return;

      if (!useFramePhotoWindows) {
        const borderWidth = input.frame.borderWidth;
        context.fillStyle = input.frame.borderColor || PHOTO_BACKGROUND;
        context.fillRect(
          cell.x - borderWidth,
          cell.y - borderWidth,
          cell.width + borderWidth * 2,
          cell.height + borderWidth * 2,
        );
      }
      context.save();
      context.beginPath();
      context.rect(cell.x, cell.y, cell.width, cell.height);
      context.clip();
      if (filterSupported) context.filter = appliedFilter;
      drawCover(
        context,
        photo.source,
        photo.width,
        photo.height,
        cell,
        input.frame.photoCropPositionY ?? 0.5,
      );
      if (filterSupported) context.filter = "none";
      context.restore();
    });

    if (!useFramePhotoWindows) {
      context.fillStyle = input.frame.accentColor || INK;
      context.font = "600 30px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        input.frame.caption.trim() || "good times",
        canvasWidth / 2,
        height - FOOTER_HEIGHT / 2,
      );

      if (input.frame.borderWidth > 0) {
        context.strokeStyle = input.frame.borderColor;
        context.lineWidth = input.frame.borderWidth;
        context.strokeRect(
          input.frame.borderWidth / 2,
          input.frame.borderWidth / 2,
          canvasWidth - input.frame.borderWidth,
          height - input.frame.borderWidth,
        );
      }
    }

    if (frameOverlay) {
      const crop = frameCrop ?? frameOverlay.bounds;
      context.drawImage(
        frameOverlay.source,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvasWidth,
        height,
      );
    }

    for (const sticker of input.stickers)
      drawSticker(context, sticker, canvasWidth);

    if (input.isCurrent && !input.isCurrent()) return false;
    canvas.width = canvasWidth;
    canvas.height = height;
    const targetContext = canvas.getContext("2d");
    if (!targetContext)
      throw new Error("Pratinjau photo strip tidak dapat ditampilkan.");
    targetContext.clearRect(0, 0, canvas.width, canvas.height);
    targetContext.drawImage(stagingCanvas, 0, 0);

    return input.filter === "natural" || filterSupported;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(
      "Foto tidak dapat disusun. Foto asli tetap tersimpan di sesi.",
    );
  } finally {
    photos.forEach((photo) => photo.dispose());
    frameOverlay?.dispose();
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "png" | "jpg",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (canvas.width === 0 || canvas.height === 0) {
      reject(new Error("Photo strip belum siap untuk diekspor."));
      return;
    }
    if (typeof canvas.toBlob !== "function") {
      reject(
        new Error(
          "Browser ini tidak mendukung ekspor gambar. Coba browser lain.",
        ),
      );
      return;
    }

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Gambar tidak dapat diekspor. Foto tetap tersedia untuk dicoba lagi.",
            ),
          );
          return;
        }
        resolve(blob);
      },
      mimeType,
      format === "jpg" ? 0.92 : undefined,
    );
  });
}
