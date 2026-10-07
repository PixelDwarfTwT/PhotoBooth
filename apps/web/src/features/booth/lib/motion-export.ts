import type {
  GIFEncoder as GifEncoderFactory,
  applyPalette,
  quantize,
} from "gifenc";
import { getMotionFilterCss, type MotionFilter } from "./export-presets";

const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
] as const;
const MOTION_FRAME_RATE = 12;
const DEFAULT_VIDEO_DURATION_MS = 3600;
const MAX_VIDEO_BYTES = 18 * 1024 * 1024;
const GIF_WIDTH = 360;
const GIF_MAX_HEIGHT = 900;
const GIF_FRAME_COUNT = 8;
const GIF_FRAME_DELAY_MS = 260;
const MAX_GIF_BYTES = 12 * 1024 * 1024;

export interface RecorderAdapter {
  state: string;
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null;
  onstop: ((event: Event) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface StreamAdapter {
  getTracks(): Array<{ stop(): void }>;
}

export function getSupportedRecorderMimeType(
  isTypeSupported: ((mimeType: string) => boolean) | undefined,
): string | undefined {
  if (!isTypeSupported) return undefined;
  return RECORDER_MIME_CANDIDATES.find((mimeType) => {
    try {
      return isTypeSupported(mimeType);
    } catch {
      return false;
    }
  });
}

export function supportsMotionRecording(
  mediaRecorderAvailable: boolean,
  captureStreamAvailable: boolean,
): boolean {
  return mediaRecorderAvailable && captureStreamAvailable;
}

export function getLoopScale(frameIndex: number, frameCount: number): number {
  if (
    !Number.isFinite(frameIndex) ||
    !Number.isFinite(frameCount) ||
    frameCount < 1
  ) {
    return 1;
  }
  const phase = ((frameIndex % frameCount) + frameCount) % frameCount;
  return 1 + 0.025 * (1 - Math.cos((Math.PI * 2 * phase) / frameCount)) * 0.5;
}

export function collectRecorderBlob(
  recorder: RecorderAdapter,
  stream: StreamAdapter,
  options: { maxBytes?: number; signal?: AbortSignal } = {},
): Promise<Blob> {
  const maxBytes = options.maxBytes ?? MAX_VIDEO_BYTES;
  const chunks: Blob[] = [];
  let totalBytes = 0;
  let settled = false;
  let tracksStopped = false;

  return new Promise((resolve, reject) => {
    const stopTracks = () => {
      if (tracksStopped) return;
      tracksStopped = true;
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Continue releasing the other tracks if a browser track throws.
        }
      }
    };

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
      stopTracks();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // Tracks are already stopped; retain the original recording error.
      }
      reject(error);
    };

    const onAbort = () =>
      fail(new DOMException("Perekaman dibatalkan.", "AbortError"));

    recorder.ondataavailable = (event) => {
      if (settled || event.data.size === 0) return;
      totalBytes += event.data.size;
      if (totalBytes > maxBytes) {
        fail(new Error("Ukuran klip melebihi batas unduhan lokal."));
        return;
      }
      chunks.push(event.data);
    };
    recorder.onerror = () =>
      fail(
        new Error(
          "Perekaman klip gagal. Foto dan ekspor gambar tetap tersedia.",
        ),
      );
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (chunks.length === 0) {
        reject(
          new Error(
            "Browser tidak menghasilkan data klip. Coba unduh PNG atau JPG.",
          ),
        );
        return;
      }
      resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    };

    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      recorder.start(250);
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error("Browser tidak dapat memulai perekaman."),
      );
    }
  });
}

export async function createLoopGif(
  source: HTMLCanvasElement,
  options: { filter?: MotionFilter } = {},
): Promise<Blob> {
  if (source.width < 1 || source.height < 1) {
    throw new Error("Photo strip belum siap untuk dibuat menjadi GIF.");
  }

  let encoder: typeof GifEncoderFactory;
  let paletteQuantize: typeof quantize;
  let paletteApply: typeof applyPalette;
  try {
    ({
      GIFEncoder: encoder,
      quantize: paletteQuantize,
      applyPalette: paletteApply,
    } = await import("gifenc"));
  } catch {
    throw new Error(
      "Pembuat GIF tidak tersedia. Unduh hasil sebagai PNG atau JPG.",
    );
  }

  const scale = Math.min(
    GIF_WIDTH / source.width,
    GIF_MAX_HEIGHT / source.height,
    1,
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = width;
  frameCanvas.height = height;
  const context = frameCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas tidak dapat menyiapkan frame GIF.");

  const frames: Uint8ClampedArray[] = [];
  let totalPixelBytes = 0;
  try {
    for (let frameIndex = 0; frameIndex < GIF_FRAME_COUNT; frameIndex += 1) {
      context.fillStyle = "#fffaf7";
      context.fillRect(0, 0, width, height);
      const frameScale = getLoopScale(frameIndex, GIF_FRAME_COUNT);
      const drawWidth = width * frameScale;
      const drawHeight = height * frameScale;
      context.filter = getMotionFilterCss(options.filter ?? "normal");
      context.drawImage(
        source,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      context.filter = "none";
      const pixels = context.getImageData(0, 0, width, height).data;
      totalPixelBytes += pixels.byteLength;
      if (totalPixelBytes > 40 * 1024 * 1024) {
        throw new Error(
          "Photo strip terlalu besar untuk diproses sebagai GIF di perangkat ini.",
        );
      }
      frames.push(pixels);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("GIF")) throw error;
    throw new Error(
      "Canvas gagal membaca frame GIF. Foto tetap tersedia untuk diekspor sebagai PNG atau JPG.",
    );
  }

  const paletteInput = new Uint8Array(totalPixelBytes);
  let paletteOffset = 0;
  for (const frame of frames) {
    paletteInput.set(frame, paletteOffset);
    paletteOffset += frame.byteLength;
  }

  try {
    const palette = paletteQuantize(paletteInput, 256, { format: "rgb565" });
    const gif = encoder();
    frames.forEach((frame, frameIndex) => {
      const indexed = paletteApply(frame, palette, "rgb565");
      gif.writeFrame(indexed, width, height, {
        ...(frameIndex === 0 ? { palette, repeat: 0 } : {}),
        delay: GIF_FRAME_DELAY_MS,
      });
    });
    gif.finish();
    const bytes = gif.bytes();
    if (bytes.byteLength > MAX_GIF_BYTES) {
      throw new Error(
        "GIF melebihi batas 12 MiB. Coba tata letak kolase atau simpan sebagai JPG.",
      );
    }
    const output = bytes.slice().buffer as ArrayBuffer;
    return new Blob([output], { type: "image/gif" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("GIF")) throw error;
    throw new Error(
      "GIF gagal dibuat. Foto dan ekspor PNG/JPG tetap tersedia.",
    );
  }
}

export async function recordPhotoLoop(
  source: HTMLCanvasElement,
  options: {
    durationMs?: number;
    signal?: AbortSignal;
    filter?: MotionFilter;
  } = {},
): Promise<Blob> {
  if (source.width < 1 || source.height < 1) {
    throw new Error("Photo strip belum siap untuk direkam.");
  }
  if (
    typeof MediaRecorder === "undefined" ||
    typeof source.captureStream !== "function"
  ) {
    throw new Error(
      "Browser ini belum mendukung klip loop. GIF, PNG, dan JPG tetap tersedia.",
    );
  }
  if (options.signal?.aborted) {
    throw new DOMException("Perekaman dibatalkan.", "AbortError");
  }

  const outputScale = Math.min(720 / source.width, 1728 / source.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * outputScale));
  canvas.height = Math.max(1, Math.round(source.height * outputScale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas klip tidak dapat dimulai.");

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(MOTION_FRAME_RATE);
  } catch {
    throw new Error(
      "Browser tidak dapat membaca Canvas untuk perekaman. GIF atau PNG tetap tersedia.",
    );
  }
  const mimeType =
    typeof MediaRecorder.isTypeSupported === "function"
      ? getSupportedRecorderMimeType(
          MediaRecorder.isTypeSupported.bind(MediaRecorder),
        )
      : undefined;
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch {
    for (const track of stream.getTracks()) track.stop();
    throw new Error(
      "Format klip tidak didukung browser ini. GIF, PNG, dan JPG tetap tersedia.",
    );
  }

  const durationMs = Math.min(
    8000,
    Math.max(1500, options.durationMs ?? DEFAULT_VIDEO_DURATION_MS),
  );
  const completion = collectRecorderBlob(recorder, stream, {
    maxBytes: MAX_VIDEO_BYTES,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const startedAt = performance.now();
  let animationFrame = 0;
  let stopped = false;
  const stopRecorder = () => {
    if (stopped) return;
    stopped = true;
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      // The recorder's error handler will report failures to the caller.
    }
  };

  const draw = (now: number) => {
    if (options.signal?.aborted) {
      stopRecorder();
      return;
    }
    const elapsed = now - startedAt;
    const phase = Math.min(1, elapsed / durationMs);
    const zoom = getLoopScale(phase * 8, 8);
    const drawWidth = canvas.width * zoom;
    const drawHeight = canvas.height * zoom;
    context.fillStyle = "#fffaf7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = getMotionFilterCss(options.filter ?? "normal");
    context.drawImage(
      source,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    context.filter = "none";
    if (elapsed >= durationMs) {
      stopRecorder();
      return;
    }
    animationFrame = requestAnimationFrame(draw);
  };

  const durationTimer = window.setTimeout(stopRecorder, durationMs + 1500);
  animationFrame = requestAnimationFrame(draw);
  try {
    return await completion;
  } finally {
    window.clearTimeout(durationTimer);
    cancelAnimationFrame(animationFrame);
    for (const track of stream.getTracks()) track.stop();
  }
}
