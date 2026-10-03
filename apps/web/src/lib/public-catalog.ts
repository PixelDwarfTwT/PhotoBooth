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
  apiOrigin = API_ORIGIN,
  request: typeof fetch = fetch,
): Promise<ThemeCatalogItem[]> {
  if (!apiOrigin) return [];
  try {
    const response = await request(`${apiOrigin}/api/themes`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    return readThemeCatalog(await response.json());
  } catch {
    return [];
  }
}

export const SITE_ORIGIN =
  normalizeApiOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  "http://localhost:3000";
