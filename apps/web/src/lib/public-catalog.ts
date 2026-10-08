import {
  ThemeCatalogItemSchema,
  type ThemeCatalogItem,
} from "@photobooth/contracts";
import { API_ORIGIN, normalizeApiOrigin } from "./api-origin";

export function readThemeCatalog(value: unknown): ThemeCatalogItem[] {
  if (!value || typeof value !== "object" || !("items" in value)) return [];
  if (!Array.isArray(value.items)) return [];
  return value.items.flatMap((item) => {
    const parsed = ThemeCatalogItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function getPublishedThemes(
  apiOrigin?: string | null,
  request: typeof fetch = fetch,
): Promise<ThemeCatalogItem[]> {
  const resolvedApiOrigin =
    (apiOrigin === undefined
      ? (normalizeApiOrigin(process.env.API_SERVICE_URL) ?? API_ORIGIN)
      : apiOrigin) ?? null;
  if (!resolvedApiOrigin) return [];
  try {
    const response = await request(
      new URL("/api/themes", `${resolvedApiOrigin}/`).toString(),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) return [];
    return readThemeCatalog(await response.json());
  } catch {
    return [];
  }
}

const vercelSiteHost =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : process.env.VERCEL_URL;

export const SITE_ORIGIN =
  normalizeApiOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeApiOrigin(
    vercelSiteHost ? `https://${vercelSiteHost}` : undefined,
  ) ??
  "http://localhost:3000";
