export interface PublicOriginEnvironment {
  NODE_ENV?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_API_ORIGIN?: string;
}

export function validateProductionPublicOrigins(
  environment: PublicOriginEnvironment = process.env,
): void {
  if (environment.NODE_ENV !== "production") return;

  for (const name of [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_API_ORIGIN",
  ] as const) {
    const value = environment[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required for a production build.`);
    }

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
