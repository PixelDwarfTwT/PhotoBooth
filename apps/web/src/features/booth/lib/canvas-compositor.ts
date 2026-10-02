import { getBoothFilter } from "./editor-options.js";
import type {
  BoothFilter,
  BoothLayout,
  CapturedPhoto,
  StickerPlacement,
} from "../types.js";

const CANVAS_WIDTH = 1000;
const MAX_CANVAS_HEIGHT = 2400;
const OUTER_PADDING = 36;
const CELL_GAP = 18;
const FOOTER_HEIGHT = 108;
const STRIP_CELL_HEIGHT = 530;
const PHOTO_BACKGROUND = "#fffaf7";
const CANVAS_BACKGROUND = "#fff2f7";
const INK = "#594656";

interface CanvasPhoto extends CapturedPhoto {
  source: CanvasImageSource;
  dispose: () => void;
}

export interface CompositionInput {
  photos: CapturedPhoto[];
  layout: BoothLayout;
  filter: BoothFilter;
  mirror: boolean;
  stickers: StickerPlacement[];
  isCurrent?: () => boolean;
}

interface PhotoCell {
  x: number;
  y: number;
  width: number;
  height: number;
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

function getPhotoCells(
  layout: BoothLayout,
  count: number,
  height: number,
): PhotoCell[] {
  if (layout === "strip") {
    const availableCellHeight = Math.floor(
      (height - OUTER_PADDING * 2 - FOOTER_HEIGHT - CELL_GAP * (count - 1)) /
        count,
    );
    const cellHeight = Math.min(STRIP_CELL_HEIGHT, availableCellHeight);
    const cellWidth = CANVAS_WIDTH - OUTER_PADDING * 2;

    return Array.from({ length: count }, (_, index) => ({
      x: OUTER_PADDING,
      y: OUTER_PADDING + index * (cellHeight + CELL_GAP),
      width: cellWidth,
      height: cellHeight,
    }));
  }

  const columns = 2;
  const cellWidth =
    (CANVAS_WIDTH - OUTER_PADDING * 2 - CELL_GAP * (columns - 1)) / columns;
  const cellHeight = Math.min(360, Math.round(cellWidth * 0.72));

  return Array.from({ length: count }, (_, index) => ({
    x: OUTER_PADDING + (index % columns) * (cellWidth + CELL_GAP),
    y: OUTER_PADDING + Math.floor(index / columns) * (cellHeight + CELL_GAP),
    width: cellWidth,
    height: cellHeight,
  }));
}

function getCanvasHeight(layout: BoothLayout, count: number): number {
  if (layout === "strip") {
    const maxCellHeight = Math.floor(
      (MAX_CANVAS_HEIGHT - OUTER_PADDING * 2 - FOOTER_HEIGHT - CELL_GAP * (count - 1)) /
        count,
    );
    const cellHeight = Math.min(STRIP_CELL_HEIGHT, maxCellHeight);
    return (
      OUTER_PADDING * 2 +
      count * cellHeight +
      CELL_GAP * Math.max(0, count - 1) +
      FOOTER_HEIGHT
    );
  }

  const rows = Math.ceil(count / 2);
  const cellWidth =
    (CANVAS_WIDTH - OUTER_PADDING * 2 - CELL_GAP) / 2;
  const cellHeight = Math.min(360, Math.round(cellWidth * 0.72));
  return (
    OUTER_PADDING * 2 +
    rows * cellHeight +
    CELL_GAP * Math.max(0, rows - 1) +
    FOOTER_HEIGHT
  );
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  cell: PhotoCell,
  mirror: boolean,
): void {
  const sourceRatio = sourceWidth / sourceHeight;
  const destinationRatio = cell.width / cell.height;
  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > destinationRatio) {
    cropWidth = sourceHeight * destinationRatio;
    sourceX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / destinationRatio;
    sourceY = (sourceHeight - cropHeight) / 2;
  }

  context.save();
  if (mirror) {
    context.translate(cell.x * 2 + cell.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
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
): void {
  context.save();
  context.font = `${sticker.fontSize}px "Segoe UI Symbol", "Apple Symbols", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgb(52 40 59 / 24%)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 3;
  context.fillStyle = "#fff";
  context.fillText(sticker.symbol, sticker.x * CANVAS_WIDTH, sticker.y * context.canvas.height);
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
  try {
    for (const photo of input.photos) {
      photos.push(await loadPhoto(photo));
    }

    if (input.isCurrent && !input.isCurrent()) return false;

    const height = getCanvasHeight(input.layout, photos.length);
    const stagingCanvas = document.createElement("canvas");
    stagingCanvas.width = CANVAS_WIDTH;
    stagingCanvas.height = height;
    const context = stagingCanvas.getContext("2d");
    if (!context) throw new Error("Canvas editor tidak dapat dimulai.");

    context.fillStyle = CANVAS_BACKGROUND;
    context.fillRect(0, 0, CANVAS_WIDTH, height);

    const cells = getPhotoCells(input.layout, photos.length, height);
    const requestedFilter = getBoothFilter(input.filter);
    const filterSupported = "filter" in context;
    const appliedFilter =
      input.filter === "natural" || filterSupported
        ? requestedFilter.css
        : "none";

    photos.forEach((photo, index) => {
      const cell = cells[index];
      if (!cell) return;

      context.fillStyle = PHOTO_BACKGROUND;
      context.fillRect(cell.x - 5, cell.y - 5, cell.width + 10, cell.height + 10);
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
        input.mirror,
      );
      if (filterSupported) context.filter = "none";
      context.restore();
    });

    context.fillStyle = INK;
    context.font = "600 30px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("good times", CANVAS_WIDTH / 2, height - FOOTER_HEIGHT / 2);

    for (const sticker of input.stickers) drawSticker(context, sticker);

    if (input.isCurrent && !input.isCurrent()) return false;
    canvas.width = CANVAS_WIDTH;
    canvas.height = height;
    const targetContext = canvas.getContext("2d");
    if (!targetContext) throw new Error("Pratinjau photo strip tidak dapat ditampilkan.");
    targetContext.clearRect(0, 0, canvas.width, canvas.height);
    targetContext.drawImage(stagingCanvas, 0, 0);

    return input.filter === "natural" || filterSupported;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Foto tidak dapat disusun. Foto asli tetap tersimpan di sesi.");
  } finally {
    photos.forEach((photo) => photo.dispose());
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
      reject(new Error("Browser ini tidak mendukung ekspor gambar. Coba browser lain."));
      return;
    }

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gambar tidak dapat diekspor. Foto tetap tersedia untuk dicoba lagi."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      format === "jpg" ? 0.92 : undefined,
    );
  });
}
