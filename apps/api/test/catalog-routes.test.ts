import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { ApiEnvironment } from "../src/config/env.ts";
import { parseApiEnvironment } from "../src/config/env.ts";
import { isThemeCurrentlyPublished } from "../src/services/catalog-service.ts";
import { registerCatalogRoutes } from "../src/routes/catalog.ts";

const testEnvironment: ApiEnvironment = parseApiEnvironment({
  NODE_ENV: "test",
});

function createRepository() {
  const writes: unknown[] = [];
  return {
    writes,
    async listPublished(collection: string) {
      return collection === "themes"
        ? [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Pastel",
              slug: "pastel",
              description: "Tema pastel",
              thumbnailUrl: null,
              startsAt: null,
              endsAt: null,
            },
          ]
        : [];
    },
    async listForAdmin() {
      return [];
    },
    async create(collection: string, input: unknown) {
      writes.push({ collection, input });
      return { id: "created" };
    },
    async update() {
      return { id: "updated" };
    },
    async archive() {},
  };
}

async function createServer() {
  const app = Fastify({ logger: false });
  const repository = createRepository();
  const adminCredentials = {
    async findByCredentialHash() {
      return {
        id: "admin",
        email: "editor@example.test",
        role: "EDITOR" as const,
      };
    },
  };
  await app.register(registerCatalogRoutes, {
    environment: testEnvironment,
    repository,
    adminCredentials,
  });
  await app.ready();
  return { app, repository };
}

test("public catalog route returns a validated theme list", async () => {
  const { app } = await createServer();
  const response = await app.inject({ method: "GET", url: "/api/themes" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items[0].slug, "pastel");
  await app.close();
});

test("admin catalog rejects unsafe frame layout config before persistence", async () => {
  const { app, repository } = await createServer();
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/catalog/frames",
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
    payload: {
      themeId: "11111111-1111-4111-8111-111111111111",
      name: "Frame",
      assetId: "22222222-2222-4222-8222-222222222222",
      layoutConfig: { backgroundColor: "url(https://attacker.invalid/a.svg)" },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(repository.writes.length, 0);
  await app.close();
});

test("publication windows include start and exclude end boundaries", () => {
  const start = new Date("2026-10-02T00:00:00.000Z");
  const end = new Date("2026-10-03T00:00:00.000Z");

  assert.equal(
    isThemeCurrentlyPublished(
      { status: "PUBLISHED", startsAt: start, endsAt: end },
      start,
    ),
    true,
  );
  assert.equal(
    isThemeCurrentlyPublished(
      { status: "PUBLISHED", startsAt: start, endsAt: end },
      end,
    ),
    false,
  );
});
