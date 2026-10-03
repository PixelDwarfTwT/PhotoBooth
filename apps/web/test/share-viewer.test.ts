import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidShareToken,
  validateShareImageResponse,
} from "../src/features/share/lib/share-viewer.ts";

test("share tokens are rejected before any request unless they are random-token shaped", () => {
  assert.equal(isValidShareToken("a".repeat(43)), true);
  assert.equal(isValidShareToken("short"), false);
  assert.equal(isValidShareToken("../" + "a".repeat(40)), false);
});

test("private viewer accepts only bounded PNG or JPEG bodies", () => {
  assert.equal(validateShareImageResponse("image/png", 2048), true);
  assert.equal(
    validateShareImageResponse("image/jpeg; charset=binary", 2048),
    true,
  );
  assert.equal(validateShareImageResponse("text/html", 2048), false);
  assert.equal(
    validateShareImageResponse("image/png", 11 * 1024 * 1024),
    false,
  );
});
