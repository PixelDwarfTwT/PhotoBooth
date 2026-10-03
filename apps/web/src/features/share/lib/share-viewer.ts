const MAX_SHARE_BYTES = 10 * 1024 * 1024;

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function validateShareImageResponse(
  contentType: string | null,
  size: number,
): boolean {
  if (!Number.isFinite(size) || size < 1 || size > MAX_SHARE_BYTES)
    return false;
  const mimeType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return mimeType === "image/png" || mimeType === "image/jpeg";
}
