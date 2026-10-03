import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repositoryEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.env",
);

config({ path: repositoryEnvPath });

const optionalEnvironmentString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);
const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL must use HTTP or HTTPS.");
const optionalEnvironmentUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  httpUrlSchema.optional(),
);
const optionalDatabaseUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    }, "DATABASE_URL must use a PostgreSQL protocol.")
    .optional(),
);

const RawApiEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: httpUrlSchema.default("http://localhost:3000"),
  DATABASE_URL: optionalDatabaseUrl,
  SHARE_CONSENT_VERSION: z.string().trim().min(1).max(50).default("2026-10-02"),
  SHARE_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  SHARE_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  SHARE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
  S3_BUCKET: optionalEnvironmentString,
  S3_REGION: optionalEnvironmentString,
  S3_ACCESS_KEY_ID: optionalEnvironmentString,
  S3_SECRET_ACCESS_KEY: optionalEnvironmentString,
  S3_ENDPOINT: optionalEnvironmentUrl,
  ASSET_PUBLIC_BASE_URL: optionalEnvironmentUrl,
});

export interface ApiEnvironment {
  environment: "development" | "test" | "production";
  host: string;
  port: number;
  webOrigin: string;
  databaseUrl?: string;
  consentVersion: string;
  shareTtlHours: number;
  shareMaxBytes: number;
  shareRateLimitMax: number;
  s3: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  } | null;
  assetPublicBaseUrl?: string;
}

export function parseApiEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnvironment {
  const parsed = RawApiEnvironmentSchema.safeParse(source);

  if (!parsed.success) {
    const reasons = parsed.error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join("; ");
    throw new Error("Invalid API configuration. " + reasons);
  }

  const raw = parsed.data;
  const s3Fields = [
    raw.S3_BUCKET,
    raw.S3_REGION,
    raw.S3_ACCESS_KEY_ID,
    raw.S3_SECRET_ACCESS_KEY,
  ];
  const configuredS3Fields = s3Fields.filter(Boolean).length;
  const hasAnyS3Config = configuredS3Fields > 0 || Boolean(raw.S3_ENDPOINT);
  if (hasAnyS3Config && configuredS3Fields !== s3Fields.length) {
    throw new Error(
      "Invalid API configuration. S3 configuration must include bucket, region, access key, and secret key.",
    );
  }

  const webOrigin = new URL(raw.WEB_ORIGIN).origin;
  if (
    raw.NODE_ENV === "production" &&
    new URL(webOrigin).protocol !== "https:"
  ) {
    throw new Error(
      "Invalid API configuration. Production WEB_ORIGIN must use HTTPS.",
    );
  }

  if (raw.NODE_ENV === "production" && !source["WEB_ORIGIN"]) {
    throw new Error(
      "Invalid API configuration. Production WEB_ORIGIN must be configured explicitly.",
    );
  }

  const assetBaseUrl = raw.ASSET_PUBLIC_BASE_URL
    ? new URL(raw.ASSET_PUBLIC_BASE_URL).toString().replace(/\/$/, "")
    : undefined;
  if (
    raw.NODE_ENV === "production" &&
    assetBaseUrl &&
    !assetBaseUrl.startsWith("https://")
  ) {
    throw new Error(
      "Invalid API configuration. Production ASSET_PUBLIC_BASE_URL must use HTTPS.",
    );
  }
  if (
    raw.NODE_ENV === "production" &&
    raw.S3_ENDPOINT &&
    new URL(raw.S3_ENDPOINT).protocol !== "https:"
  ) {
    throw new Error(
      "Invalid API configuration. Production S3_ENDPOINT must use HTTPS.",
    );
  }

  return {
    environment: raw.NODE_ENV,
    host: raw.HOST,
    port: raw.PORT,
    webOrigin,
    ...(raw.DATABASE_URL ? { databaseUrl: raw.DATABASE_URL } : {}),
    consentVersion: raw.SHARE_CONSENT_VERSION,
    shareTtlHours: raw.SHARE_TTL_HOURS,
    shareMaxBytes: raw.SHARE_MAX_BYTES,
    shareRateLimitMax: raw.SHARE_RATE_LIMIT_MAX,
    s3:
      configuredS3Fields === s3Fields.length
        ? {
            bucket: raw.S3_BUCKET!,
            region: raw.S3_REGION!,
            accessKeyId: raw.S3_ACCESS_KEY_ID!,
            secretAccessKey: raw.S3_SECRET_ACCESS_KEY!,
            ...(raw.S3_ENDPOINT ? { endpoint: raw.S3_ENDPOINT } : {}),
          }
        : null,
    ...(assetBaseUrl ? { assetPublicBaseUrl: assetBaseUrl } : {}),
  };
}

export function loadApiEnvironment(): ApiEnvironment {
  try {
    return parseApiEnvironment();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Invalid API configuration.");
  }
}
