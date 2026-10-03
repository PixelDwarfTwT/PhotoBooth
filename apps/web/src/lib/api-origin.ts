export function normalizeApiOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getApiOrigin(
  configured: string | undefined,
  environment: string | undefined,
): string | null {
  const normalized = normalizeApiOrigin(configured);
  if (normalized) return normalized;
  return environment === "development" ? "http://127.0.0.1:4000" : null;
}

export const API_ORIGIN = getApiOrigin(
  process.env.NEXT_PUBLIC_API_ORIGIN,
  process.env.NODE_ENV,
);
