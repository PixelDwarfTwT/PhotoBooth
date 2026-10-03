import { HttpApiError } from "../lib/api-error.js";

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const maximumImageSide = 8000;
const maximumImagePixels = 16_000_000;
const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function dimensionsAreSafe(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= maximumImageSide &&
    height <= maximumImageSide &&
    width * height <= maximumImagePixels
  );
}

function jpegDimensions(
  body: Buffer,
): { width: number; height: number } | null {
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < body.length) {
    if (body[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (body[offset] === 0xff) offset += 1;
    const marker = body[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;
    if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd8)
    )
      continue;
    if (offset + 2 > body.length) return null;

    const segmentLength = body.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > body.length) return null;
    if (jpegStartOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      const height = body.readUInt16BE(offset + 3);
      const width = body.readUInt16BE(offset + 5);
      return dimensionsAreSafe(width, height) ? { width, height } : null;
    }

    offset += segmentLength;
  }

  return null;
}

export interface ShareUploadInput {
  body: Uint8Array;
  mimeType: string | undefined;
  consentVersion: string | undefined;
  expectedConsentVersion: string;
  maxBytes: number;
}

export interface ValidatedShareUpload {
  mimeType: "image/png" | "image/jpeg";
  fileSizeBytes: number;
}

export function validateShareUpload(
  input: ShareUploadInput,
): ValidatedShareUpload {
  if (input.consentVersion !== input.expectedConsentVersion) {
    throw new HttpApiError(
      400,
      "consent_required",
      "Setujui pemberitahuan penyimpanan cloud sebelum mengunggah foto.",
    );
  }

  if (input.body.byteLength === 0) {
    throw new HttpApiError(400, "empty_image", "Berkas gambar kosong.");
  }
  if (input.body.byteLength > input.maxBytes) {
    throw new HttpApiError(
      413,
      "file_too_large",
      "Ukuran berkas melewati batas 10 MiB.",
    );
  }

  const declaredMimeType = input.mimeType?.split(";")[0]?.trim().toLowerCase();
  const body = Buffer.from(
    input.body.buffer,
    input.body.byteOffset,
    input.body.byteLength,
  );
  const hasPngSignature =
    declaredMimeType === "image/png" &&
    body.length >= 24 &&
    body.subarray(0, pngSignature.length).equals(pngSignature) &&
    body.toString("ascii", 12, 16) === "IHDR" &&
    dimensionsAreSafe(body.readUInt32BE(16), body.readUInt32BE(20));
  const hasJpegSignature =
    declaredMimeType === "image/jpeg" && jpegDimensions(body) !== null;

  if (hasPngSignature) {
    return { mimeType: "image/png", fileSizeBytes: body.length };
  }
  if (hasJpegSignature) {
    return { mimeType: "image/jpeg", fileSizeBytes: body.length };
  }
  if (declaredMimeType !== "image/png" && declaredMimeType !== "image/jpeg") {
    throw new HttpApiError(
      415,
      "unsupported_media_type",
      "Gunakan gambar PNG atau JPG.",
    );
  }

  throw new HttpApiError(
    400,
    "invalid_image",
    "Isi berkas tidak cocok dengan tipe gambar.",
  );
}
