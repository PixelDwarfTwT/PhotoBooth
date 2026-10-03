export function createRobotsPolicy(siteOrigin: string) {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
