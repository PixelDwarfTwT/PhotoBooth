export interface PublicOriginEnvironment {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_API_ORIGIN?: string;
}

export function validateProductionPublicOrigins(
  environment: PublicOriginEnvironment = process.env,
): void {
  if (environment.NODE_ENV !== "production") return;

  const configuredApiOrigin =
    environment.VERCEL === "1"
      ? undefined
      : environment.NEXT_PUBLIC_API_ORIGIN?.trim();
  const configuredSiteOrigin = environment.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost =
    environment.VERCEL_ENV === "production"
      ? environment.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
        environment.VERCEL_URL?.trim()
      : environment.VERCEL_URL?.trim();
  const vercelOrigin = vercelHost ? `https://${vercelHost}` : undefined;
  const siteOrigin = configuredSiteOrigin ?? vercelOrigin;

  if (!siteOrigin) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL or VERCEL_URL is required for a production build.",
    );
  }
  if (!configuredApiOrigin && !vercelOrigin) {
    throw new Error(
      "NEXT_PUBLIC_API_ORIGIN is required unless same-origin Vercel routing is available.",
    );
  }

  const origins = [
    ["NEXT_PUBLIC_SITE_URL", siteOrigin],
    ...(configuredApiOrigin
      ? [["NEXT_PUBLIC_API_ORIGIN", configuredApiOrigin] as const]
      : []),
  ] as const;

  for (const [name, value] of origins) {
    let origin: URL;
    try {
      origin = new URL(value);
    } catch {
      throw new Error(`${name} must be a valid HTTPS origin.`);
    }
    if (origin.protocol !== "https:") {
      throw new Error(`${name} must use HTTPS.`);
    }
    if (origin.username.length > 0 || origin.password.length > 0) {
      throw new Error(
        `${name} must be a valid HTTPS origin without credentials.`,
      );
    }
  }
}
