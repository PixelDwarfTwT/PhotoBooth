import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateBearerToken,
  createAdminCredential,
  sha256Token,
} from "../src/lib/admin-auth.ts";

test("creates high-entropy admin tokens and stores only their hash", () => {
  const credential = createAdminCredential();

  assert.match(credential.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(credential.hash, /^[a-f0-9]{64}$/);
  assert.notEqual(credential.hash, credential.token);
  assert.equal(credential.hash, sha256Token(credential.token));
});

test("authenticates only a well-formed bearer token by its hash", async () => {
  const credential = createAdminCredential();
  const requestedHashes: string[] = [];
  const user = {
    id: "admin-id",
    email: "admin@example.test",
    role: "ADMINISTRATOR" as const,
  };
  const repository = {
    async findByCredentialHash(hash: string) {
      requestedHashes.push(hash);
      return hash === credential.hash ? user : null;
    },
  };

  assert.deepEqual(
    await authenticateBearerToken(`Bearer ${credential.token}`, repository),
    user,
  );
  assert.equal(
    await authenticateBearerToken("Bearer not-a-random-token", repository),
    null,
  );
  assert.deepEqual(requestedHashes, [credential.hash]);
});
