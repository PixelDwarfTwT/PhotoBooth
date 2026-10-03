import assert from "node:assert/strict";
import test from "node:test";
import { buildServer } from "../src/app.ts";
import { parseApiEnvironment } from "../src/config/env.ts";
import { registerShareRoutes } from "../src/routes/shares.ts";
import { createShareService } from "../src/services/share-service.ts";
import { ShareCreatedResponseSchema } from "../../../packages/contracts/src/sharing.ts";

const consentVersion = "2026-10-02";
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

function createShareFixture() {
  const records: Array<Record<string, unknown>> = [];
  const objects = new Map<string, Buffer>();
  const repository = {
    async create(input: Record<string, unknown>) {
      const record = { id: "share-1", ...input };
      records.push(record);
      return record;
    },
    async findByTokenHash(tokenHash: string) {
      return records.find((record) => record.tokenHash === tokenHash) ?? null;
    },
    async listForCleanup() {
      return [];
    },
    async markActive(id: string) {
      const record = records.find((item) => item.id === id);
      if (record) record.deletedAt = null;
    },
    async markDeleted(id: string, deletedAt: Date) {
      const record = records.find((item) => item.id === id);
      if (record) record.deletedAt = deletedAt;
    },
    async deleteById() {},
  };
  const objectStore = {
    async putObject(key: string, body: Uint8Array) {
      objects.set(key, Buffer.from(body));
    },
    async getObject(key: string) {
      return objects.get(key) ?? null;
    },
    async deleteObject(key: string) {
      objects.delete(key);
    },
  };
  const service = createShareService({
    repository,
    objectStore,
    consentVersion,
    maxBytes: 1024,
    ttlHours: 72,
    now: () => new Date("2026-10-02T00:00:00.000Z"),
  });
  return { service };
}

async function createServer(
  service: ReturnType<typeof createShareService> | null,
  shareRateLimitMax = 5,
) {
  const environment = parseApiEnvironment({
    NODE_ENV: "test",
    SHARE_RATE_LIMIT_MAX: String(shareRateLimitMax),
  });
  const app = buildServer(environment);
  await app.register(registerShareRoutes, { environment, service });
  await app.ready();
  return app;
}

test("share upload returns a private URL and QR only after a valid explicit-consent header", async () => {
  const { service } = createShareFixture();
  const app = await createServer(service);
  const response = await app.inject({
    method: "POST",
    url: "/api/share",
    headers: {
      "content-type": "image/png",
      "x-share-consent-version": consentVersion,
    },
    payload: png,
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.match(
    body.shareUrl,
    /^http:\/\/localhost:3000\/share\/[A-Za-z0-9_-]{43}$/,
  );
  assert.match(body.qrCodeDataUrl, /^data:image\/png;base64,/);
  assert.equal(body.deleteToken.length, 43);
  assert.equal(body.shareUrl.includes(body.deleteToken), false);
  assert.equal(ShareCreatedResponseSchema.safeParse(body).success, true);
  await app.close();
});

test("share reads bounded no-store bytes with privacy headers", async () => {
  const { service } = createShareFixture();
  const app = await createServer(service);
  const upload = await app.inject({
    method: "POST",
    url: "/api/share",
    headers: {
      "content-type": "image/png",
      "x-share-consent-version": consentVersion,
    },
    payload: png,
  });
  const { shareUrl } = upload.json();
  const token = new URL(shareUrl).pathname.split("/").at(-1);
  const response = await app.inject({
    method: "GET",
    url: `/api/share/${token}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(
    response.headers["x-robots-tag"],
    "noindex, nofollow, noarchive",
  );
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.match(
    String(response.headers["x-share-expires-at"]),
    /^\d{4}-\d{2}-\d{2}T/,
  );
  assert.deepEqual(response.rawPayload, png);
  await app.close();
});

test("cloud sharing stays disabled when no object store is configured", async () => {
  const app = await createServer(null);
  const capabilities = await app.inject({
    method: "GET",
    url: "/api/capabilities",
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/share",
    headers: {
      "content-type": "image/png",
      "x-share-consent-version": consentVersion,
    },
    payload: png,
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "cloud_sharing_unavailable");
  assert.equal(capabilities.json().cloudSharingEnabled, false);
  assert.equal(capabilities.json().shareTtlHours, 72);
  const unavailableRead = await app.inject({
    method: "GET",
    url: `/api/share/${"a".repeat(43)}`,
  });
  assert.equal(unavailableRead.statusCode, 503);
  assert.equal(unavailableRead.headers["cache-control"], "private, no-store");
  assert.equal(
    unavailableRead.headers["x-robots-tag"],
    "noindex, nofollow, noarchive",
  );
  await app.close();
});

test("capabilities report cloud availability and consent version", async () => {
  const { service } = createShareFixture();
  const app = await createServer(service);
  const response = await app.inject({
    method: "GET",
    url: "/api/capabilities",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().cloudSharingEnabled, true);
  assert.equal(response.json().consentVersion, consentVersion);
  await app.close();
});

test("share revocation uses the separate delete token", async () => {
  const { service } = createShareFixture();
  const app = await createServer(service);
  const upload = await app.inject({
    method: "POST",
    url: "/api/share",
    headers: {
      "content-type": "image/png",
      "x-share-consent-version": consentVersion,
    },
    payload: png,
  });
  const { shareUrl, deleteToken } = upload.json();
  const token = new URL(shareUrl).pathname.split("/").at(-1);

  const denied = await app.inject({
    method: "DELETE",
    url: `/api/share/${token}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(denied.statusCode, 403);

  const revoked = await app.inject({
    method: "DELETE",
    url: `/api/share/${token}`,
    headers: { authorization: `Bearer ${deleteToken}` },
  });
  assert.equal(revoked.statusCode, 204);
  await app.close();
});

test("share creation rate limit returns a stable retryable error", async () => {
  const { service } = createShareFixture();
  const app = await createServer(service, 1);
  const request = {
    method: "POST" as const,
    url: "/api/share",
    headers: {
      "content-type": "image/png",
      "x-share-consent-version": consentVersion,
    },
    payload: png,
  };

  assert.equal((await app.inject(request)).statusCode, 201);
  const limited = await app.inject(request);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, "rate_limited");
  await app.close();
});
