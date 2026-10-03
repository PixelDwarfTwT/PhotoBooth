import type { CapturedPhoto } from "../types";

const MAX_CAPTURE_DIMENSION = 1600;
let fallbackId = 0;

function createPhotoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  fallbackId += 1;
  return `photo-${Date.now()}-${fallbackId}`;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      reject(new Error("Browser ini tidak mendukung ekspor foto."));
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Foto tidak dapat disiapkan. Coba lagi."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export async function capturePhoto(
  video: HTMLVideoElement,
): Promise<CapturedPhoto> {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth < 1
  ) {
    throw new Error(
      "Pratinjau kamera belum siap. Tunggu sebentar lalu coba lagi.",
    );
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const scale = Math.min(
    1,
    MAX_CAPTURE_DIMENSION / sourceWidth,
    MAX_CAPTURE_DIMENSION / sourceHeight,
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas foto tidak dapat dimulai. Coba lagi.");

  context.drawImage(video, 0, 0, width, height);
  const blob = await canvasToJpeg(canvas);

  return { id: createPhotoId(), blob, width, height };
}
