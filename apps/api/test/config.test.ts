import assert from "node:assert/strict";
import test from "node:test";
import { parseApiEnvironment } from "../src/config/env.ts";
import { mapApiError } from "../src/lib/api-error.ts";
import { privacySafeRequestSerializer } from "../src/lib/request-logging.ts";

test("allows local development without enabling cloud storage", () => {
  const config = parseApiEnvironment({ NODE_ENV: "test" });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4000);
  assert.equal(config.webOrigin, "http://localhost:3000");
  assert.equal(config.s3, null);
});

test("accepts a PostgreSQL connection string for the server database", () => {
  const databaseUrl =
    "postgresql://photobooth:secret@db.example.test:5432/photobooth?sslmode=require";
  const config = parseApiEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
  });

  assert.equal(config.databaseUrl, databaseUrl);
});

test("treats blank optional cloud values from .env.example as unset", () => {
  const config = parseApiEnvironment({
    NODE_ENV: "test",
    S3_BUCKET: "",
    S3_REGION: "",
    S3_ACCESS_KEY_ID: "",
    S3_SECRET_ACCESS_KEY: "",
    S3_ENDPOINT: "",
    ASSET_PUBLIC_BASE_URL: "",
  });

  assert.equal(config.s3, null);
  assert.equal(config.assetPublicBaseUrl, undefined);
});

test("rejects partially configured S3 credentials", () => {
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "test",
        S3_BUCKET: "private-photos",
        S3_REGION: "ap-southeast-1",
      }),
    /S3 configuration must include bucket, region, access key, and secret key/i,
  );
});

test("rejects an endpoint without complete S3 credentials", () => {
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "test",
        S3_ENDPOINT: "http://localhost:9000",
      }),
    /S3 configuration must include bucket, region, access key, and secret key/i,
  );
});

test("requires HTTPS for the configured production web origin", () => {
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "production",
        WEB_ORIGIN: "http://photobooth.example",
      }),
    /production WEB_ORIGIN must use https/i,
  );
});

test("accepts only HTTP(S) browser, asset, and S3 endpoint URLs", () => {
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "test",
        WEB_ORIGIN: "ftp://web.example.test",
      }),
    /HTTP or HTTPS/i,
  );
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "test",
        ASSET_PUBLIC_BASE_URL: "ftp://cdn.example.test",
      }),
    /HTTP or HTTPS/i,
  );
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "test",
        S3_BUCKET: "private-photos",
        S3_REGION: "ap-southeast-1",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_ENDPOINT: "ftp://storage.example.test",
      }),
    /HTTP or HTTPS/i,
  );
});

test("requires HTTPS for a configured production S3 endpoint", () => {
  assert.throws(
    () =>
      parseApiEnvironment({
        NODE_ENV: "production",
        WEB_ORIGIN: "https://photobooth.example",
        S3_BUCKET: "private-photos",
        S3_REGION: "ap-southeast-1",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_ENDPOINT: "http://storage.example",
      }),
    /production S3_ENDPOINT must use HTTPS/i,
  );
});

test("preserves the configured asset CDN path prefix", () => {
  const config = parseApiEnvironment({
    NODE_ENV: "test",
    ASSET_PUBLIC_BASE_URL: "https://cdn.example.test/photobooth/assets/",
  });

  assert.equal(
    config.assetPublicBaseUrl,
    "https://cdn.example.test/photobooth/assets",
  );
});

test("serializes route templates without leaking tokens from request URLs", () => {
  const serialized = privacySafeRequestSerializer({
    method: "GET",
    routeOptions: { url: "/api/share/:token" },
  });

  assert.deepEqual(serialized, { method: "GET", route: "/api/share/:token" });
  assert.equal(
    JSON.stringify(serialized).includes("secret-share-token"),
    false,
  );
});

test("maps oversized uploads to a stable public error without leaking internals", () => {
  assert.deepEqual(
    mapApiError(
      Object.assign(new Error("body too large"), { statusCode: 413 }),
    ),
    {
      statusCode: 413,
      body: {
        error: {
          code: "file_too_large",
          message: "Ukuran berkas melewati batas yang diizinkan.",
        },
      },
    },
  );
});

test("maps rate limits to a stable retry message", () => {
  assert.deepEqual(
    mapApiError(
      Object.assign(new Error("limit exceeded"), { statusCode: 429 }),
    ),
    {
      statusCode: 429,
      body: {
        error: {
          code: "rate_limited",
          message: "Terlalu banyak permintaan. Coba lagi sebentar.",
        },
      },
    },
  );
});
