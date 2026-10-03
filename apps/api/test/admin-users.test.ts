import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerAdminUserRoutes } from "../src/routes/admin-users.ts";
import { sha256Token } from "../src/lib/admin-auth.ts";

function createFixture(role: "EDITOR" | "ADMINISTRATOR") {
  const users = [
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "root@example.test",
      role: "ADMINISTRATOR" as const,
    },
  ];
  const credentials: Array<{ email: string; role: string; hash: string }> = [];
  const credentialRepository = {
    async findByCredentialHash() {
      return {
        id: "00000000-0000-4000-8000-000000000001",
        email: "current@example.test",
        role,
      };
    },
  };
  const userRepository = {
    async list() {
      return users;
    },
    async create(
      email: string,
      userRole: "EDITOR" | "ADMINISTRATOR",
      hash: string,
    ) {
      credentials.push({ email, role: userRole, hash });
      const user = { id: `user-${users.length + 1}`, email, role: userRole };
      users.push(user);
      return user;
    },
    async findById(id: string) {
      return users.find((user) => user.id === id) ?? null;
    },
    async rotateCredential() {},
    async deleteIfAllowed(id: string, currentId: string) {
      if (id === currentId) return "self" as const;
      const target = users.find((user) => user.id === id);
      if (!target) return "not-found" as const;
      if (
        target.role === "ADMINISTRATOR" &&
        users.filter((user) => user.role === "ADMINISTRATOR").length <= 1
      ) {
        return "last-administrator" as const;
      }
      const index = users.findIndex((user) => user.id === id);
      if (index >= 0) users.splice(index, 1);
      return "deleted" as const;
    },
  };
  return { users, credentials, credentialRepository, userRepository };
}

async function createServer(role: "EDITOR" | "ADMINISTRATOR") {
  const fixture = createFixture(role);
  const app = Fastify({ logger: false });
  await app.register(registerAdminUserRoutes, {
    credentialRepository: fixture.credentialRepository,
    userRepository: fixture.userRepository,
  });
  await app.ready();
  return { app, fixture };
}

test("only administrators can provision API credentials", async () => {
  const { app, fixture } = await createServer("EDITOR");
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
    payload: { email: "new@example.test", role: "EDITOR" },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(fixture.credentials.length, 0);
  await app.close();
});

test("admin creation normalizes email and returns a one-time token while storing its hash", async () => {
  const { app, fixture } = await createServer("ADMINISTRATOR");
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
    payload: { email: "  Editor@Example.Test ", role: "EDITOR" },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.user.email, "editor@example.test");
  assert.match(body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(fixture.credentials[0]?.hash, sha256Token(body.token));
  await app.close();
});

test("an administrator cannot remove their own access or the last administrator", async () => {
  const { app } = await createServer("ADMINISTRATOR");
  const selfDelete = await app.inject({
    method: "DELETE",
    url: "/api/admin/users/00000000-0000-4000-8000-000000000001",
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
  });
  const lastAdminDelete = await app.inject({
    method: "DELETE",
    url: "/api/admin/users/00000000-0000-4000-8000-000000000002",
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
  });

  assert.equal(selfDelete.statusCode, 409);
  assert.equal(lastAdminDelete.statusCode, 409);
  await app.close();
});
