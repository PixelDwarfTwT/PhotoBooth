import assert from "node:assert/strict";
import test from "node:test";
import { HttpApiError } from "../src/lib/api-error.ts";
import { sha256Token } from "../src/lib/admin-auth.ts";
import { createShareService } from "../src/services/share-service.ts";

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

function createMemoryAdapters(options?: {
  failCreate?: boolean;
  failDelete?: boolean;
  failPutAfterStore?: boolean;
}) {
  const records: Array<Record<string, unknown>> = [];
  const objects = new Map<string, Buffer>();
  const deletedObjects: string[] = [];
  const repository = {
    records,
    async create(input: Record<string, unknown>) {
      if (options?.failCreate) throw new Error("database unavailable");
      const record = { id: `share-${records.length + 1}`, ...input };
      records.push(record);
      return record;
    },
    async findByTokenHash(tokenHash: string) {
      return records.find((record) => record.tokenHash === tokenHash) ?? null;
    },
    async findById(id: string) {
      return records.find((record) => record.id === id) ?? null;
    },
    async listForCleanup(
      now: Date,
      limit: number,
      excludedIds: readonly string[] = [],
    ) {
      return records
        .filter(
          (record) =>
            !excludedIds.includes(String(record.id)) &&
            ((record.deletedAt instanceof Date && record.deletedAt !== null) ||
              (record.expiresAt instanceof Date && record.expiresAt <= now)),
        )
        .slice(0, limit);
    },
    async markDeleted(id: string, deletedAt: Date) {
      const record = records.find((item) => item.id === id);
      if (record) record.deletedAt = deletedAt;
    },
    async deleteById(id: string) {
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
    },
    async markActive(id: string) {
      const record = records.find((item) => item.id === id);
      if (record) record.deletedAt = null;
    },
  };
  const objectStore = {
    objects,
    deletedObjects,
    async putObject(key: string, body: Uint8Array) {
      objects.set(key, Buffer.from(body));
      if (options?.failPutAfterStore)
        throw new Error("upload response was lost");
    },
    async getObject(key: string) {
      return objects.get(key) ?? null;
    },
    async deleteObject(key: string) {
      if (options?.failDelete) throw new Error("object store unavailable");
      deletedObjects.push(key);
      objects.delete(key);
    },
  };

  return { repository, objectStore };
}

function createService(
  adapters: ReturnType<typeof createMemoryAdapters>,
  now = new Date("2026-10-02T00:00:00.000Z"),
) {
  return createShareService({
    repository: adapters.repository,
    objectStore: adapters.objectStore,
    consentVersion: "2026-10-02",
    maxBytes: 1024,
    ttlHours: 24,
    now: () => now,
  });
}

async function createShare(service: ReturnType<typeof createService>) {
  return service.create({
    body: png,
    mimeType: "image/png",
    consentVersion: "2026-10-02",
  });
}

test("stores only token hashes and keeps uploaded objects on private random keys", async () => {
  const adapters = createMemoryAdapters();
  const service = createService(adapters);
  const created = await createShare(service);
  const record = adapters.repository.records[0];

  assert.ok(record);
  assert.equal(record.tokenHash, sha256Token(created.token));
  assert.equal(record.deleteTokenHash, sha256Token(created.deleteToken));
  assert.equal(record.storageKey?.toString().startsWith("shares/"), true);
  assert.equal(record.storageKey?.toString().includes(created.token), false);
  assert.equal(adapters.objectStore.objects.size, 1);
  assert.equal(
    new Date(String(record.expiresAt)).toISOString(),
    "2026-10-03T00:00:00.000Z",
  );
});

test("a read token returns an active image and stops working after expiry", async () => {
  const adapters = createMemoryAdapters();
  const firstNow = new Date("2026-10-02T00:00:00.000Z");
  const service = createService(adapters, firstNow);
  const created = await createShare(service);

  assert.deepEqual((await service.read(created.token))?.body, png);

  const expiredService = createService(
    adapters,
    new Date("2026-10-03T00:00:00.000Z"),
  );
  assert.equal(await expiredService.read(created.token), null);
});

test("revocation requires its separate delete token and blocks reads before object deletion", async () => {
  const adapters = createMemoryAdapters();
  const service = createService(adapters);
  const created = await createShare(service);

  await assert.rejects(
    () => service.revoke(created.token, "x".repeat(43)),
    (error: unknown) =>
      error instanceof HttpApiError && error.statusCode === 403,
  );
  await service.revoke(created.token, created.deleteToken);

  assert.equal(adapters.repository.records[0]?.deletedAt instanceof Date, true);
  assert.equal(await service.read(created.token), null);
  assert.equal(adapters.objectStore.objects.size, 0);
});

test("cleanup leaves metadata for retry when object deletion fails", async () => {
  const adapters = createMemoryAdapters();
  const service = createService(adapters);
  const created = await createShare(service);
  await service.revoke(created.token, created.deleteToken);

  const failingService = createShareService({
    repository: adapters.repository,
    objectStore: {
      ...adapters.objectStore,
      async deleteObject() {
        throw new Error("object store unavailable");
      },
    },
    consentVersion: "2026-10-02",
    maxBytes: 1024,
    ttlHours: 24,
    now: () => new Date("2026-10-02T00:00:00.000Z"),
  });

  const result = await failingService.cleanupExpired();
  assert.deepEqual(result, { removed: 0, retriable: 1 });
  assert.equal(adapters.repository.records.length, 1);
});

test("cleanup drains multiple batches and retries failed objects on the next run", async () => {
  const adapters = createMemoryAdapters();
  const service = createService(adapters);
  await Promise.all(Array.from({ length: 105 }, () => createShare(service)));
  const firstStorageKey = String(adapters.repository.records[0]?.storageKey);
  const originalDelete = adapters.objectStore.deleteObject;
  adapters.objectStore.deleteObject = async (key: string) => {
    if (key === firstStorageKey)
      throw new Error("temporary object store failure");
    await originalDelete(key);
  };

  const cleanupService = createShareService({
    repository: adapters.repository,
    objectStore: adapters.objectStore,
    consentVersion: "2026-10-02",
    maxBytes: 1024,
    ttlHours: 24,
    now: () => new Date("2026-10-04T00:00:00.000Z"),
  });
  const result = await cleanupService.cleanupExpired();

  assert.deepEqual(result, { removed: 104, retriable: 1 });
  assert.equal(adapters.repository.records.length, 1);
});

test("does not upload an object when the database reservation fails", async () => {
  const adapters = createMemoryAdapters({ failCreate: true });
  const service = createService(adapters);

  await assert.rejects(() => createShare(service), /database unavailable/);
  assert.equal(adapters.objectStore.objects.size, 0);
  assert.equal(adapters.objectStore.deletedObjects.length, 0);
});

test("keeps a durable cleanup record after an ambiguous object upload failure", async () => {
  const adapters = createMemoryAdapters({ failPutAfterStore: true });
  const service = createService(adapters);

  await assert.rejects(() => createShare(service), /upload response was lost/);
  assert.equal(adapters.repository.records.length, 1);
  assert.equal(adapters.repository.records[0]?.deletedAt instanceof Date, true);
  assert.equal(adapters.objectStore.objects.size, 1);

  const cleanup = await service.cleanupExpired();
  assert.deepEqual(cleanup, { removed: 1, retriable: 0 });
  assert.equal(adapters.repository.records.length, 0);
  assert.equal(adapters.objectStore.objects.size, 0);
});
