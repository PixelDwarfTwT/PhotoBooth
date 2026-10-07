import { canvasToBlob } from "./canvas-compositor";
import { getStoryPlacement } from "./export-presets";

export async function createStoryBlob(
  source: HTMLCanvasElement,
): Promise<Blob> {
  if (source.width < 1 || source.height < 1) {
    throw new Error("Photo strip belum siap untuk format Story.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas Story tidak dapat dimulai.");

  context.fillStyle = "#fffaf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const placement = getStoryPlacement(source.width, source.height);
  context.drawImage(
    source,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  );
  return canvasToBlob(canvas, "png");
}
