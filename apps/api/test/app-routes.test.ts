import assert from "node:assert/strict";
import test from "node:test";
import { buildServer } from "../src/app.ts";
import { parseApiEnvironment } from "../src/config/env.ts";

test("buildServer mounts catalog, admin, and sharing endpoints", async () => {
  const adminCredentials = {
    async findByCredentialHash() {
      return null;
    },
  };
  const adminUsers = {
    async list() {
      return [];
    },
    async create() {
      throw new Error("Unexpected admin user create call.");
    },
    async findById() {
      return null;
    },
    async rotateCredential() {},
    async deleteIfAllowed() {
      return "not-found" as const;
    },
  };
  const catalogRepository = {
    async listPublished() {
      return [];
    },
    async listForAdmin() {
      return [];
    },
    async create() {
      return {};
    },
    async update() {
      return {};
    },
    async archive() {},
  };
  const environment = parseApiEnvironment({ NODE_ENV: "test" });
  const app = buildServer(environment, {
    catalog: { repository: catalogRepository, adminCredentials },
    adminUsers: {
      credentialRepository: adminCredentials,
      userRepository: adminUsers,
    },
    shareService: null,
  });

  try {
    const capabilities = await app.inject({
      method: "GET",
      url: "/api/capabilities",
    });
    assert.equal(capabilities.statusCode, 200);
    assert.deepEqual(capabilities.json(), {
      cloudSharingEnabled: false,
      consentVersion: "2026-10-02",
      shareTtlHours: 72,
      shareMaxBytes: 10 * 1024 * 1024,
    });

    const themes = await app.inject({ method: "GET", url: "/api/themes" });
    assert.equal(themes.statusCode, 200);
    assert.deepEqual(themes.json(), { items: [] });

    const adminUsersResponse = await app.inject({
      method: "GET",
      url: "/api/admin/users",
    });
    assert.equal(adminUsersResponse.statusCode, 401);
  } finally {
    await app.close();
  }
});
