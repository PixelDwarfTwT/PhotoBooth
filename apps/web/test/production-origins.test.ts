import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionPublicOrigins } from "../src/lib/production-origins.ts";

test("local development does not require deployment origins", () => {
  assert.doesNotThrow(() =>
    validateProductionPublicOrigins({ NODE_ENV: "development" }),
  );
});

test("production requires HTTPS site and API origins", () => {
  assert.throws(
    () => validateProductionPublicOrigins({ NODE_ENV: "production" }),
    /NEXT_PUBLIC_SITE_URL is required/i,
  );
  assert.throws(
    () =>
      validateProductionPublicOrigins({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://photo.example.test",
        NEXT_PUBLIC_API_ORIGIN: "https://api.example.test",
      }),
    /NEXT_PUBLIC_SITE_URL must use HTTPS/i,
  );
  assert.throws(
    () =>
      validateProductionPublicOrigins({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://photo.example.test",
        NEXT_PUBLIC_API_ORIGIN: "http://api.example.test",
      }),
    /NEXT_PUBLIC_API_ORIGIN must use HTTPS/i,
  );
});

test("production accepts explicit HTTPS origins without credentials", () => {
  assert.doesNotThrow(() =>
    validateProductionPublicOrigins({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://photo.example.test",
      NEXT_PUBLIC_API_ORIGIN: "https://api.example.test",
    }),
  );
  assert.throws(
    () =>
      validateProductionPublicOrigins({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://user:secret@photo.example.test",
        NEXT_PUBLIC_API_ORIGIN: "https://api.example.test",
      }),
    /NEXT_PUBLIC_SITE_URL must be a valid HTTPS origin/i,
  );
});
