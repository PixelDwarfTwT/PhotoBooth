import type { MetadataRoute } from "next";
import { getPublishedThemes, SITE_ORIGIN } from "@/lib/public-catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicRoutes = ["", "/themes", "/guide", "/privacy", "/help"];
  const staticEntries = publicRoutes.map((route) => ({
    url: `${SITE_ORIGIN}${route}`,
    changeFrequency: route === "" ? ("weekly" as const) : ("monthly" as const),
  }));
  const themes = await getPublishedThemes();
  return [
    ...staticEntries,
    ...themes.map((theme) => ({
      url: `${SITE_ORIGIN}/themes/${encodeURIComponent(theme.slug)}`,
      changeFrequency: "weekly" as const,
    })),
  ];
}
