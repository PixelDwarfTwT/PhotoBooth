import assert from "node:assert/strict";
import test from "node:test";
import { getApiOrigin, normalizeApiOrigin } from "../src/lib/api-origin.ts";

test("API origins remove paths and allow only HTTP protocols without credentials", () => {
  assert.equal(
    normalizeApiOrigin("https://api.example.test/v1/"),
    "https://api.example.test",
  );
  assert.equal(normalizeApiOrigin("ftp://api.example.test"), null);
  assert.equal(
    normalizeApiOrigin("https://user:secret@api.example.test"),
    null,
  );
});

test("an unset API origin uses localhost only during development", () => {
  assert.equal(getApiOrigin(undefined, "development"), "http://127.0.0.1:4000");
  assert.equal(getApiOrigin(undefined, "production"), null);
  assert.equal(
    getApiOrigin("https://api.example.test", "development"),
    "https://api.example.test",
  );
});
