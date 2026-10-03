import assert from "node:assert/strict";
import test from "node:test";
import { HttpApiError } from "../src/lib/api-error.ts";
import { mapPrismaCatalogError } from "../src/lib/prisma-errors.ts";

test("maps unique catalog conflicts to a readable 409 response", () => {
  const mapped = mapPrismaCatalogError(
    Object.assign(new Error("unique constraint"), { code: "P2002" }),
  );

  assert.ok(mapped instanceof HttpApiError);
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "catalog_conflict");
});

test("maps deleted catalog records to a stable 404 response", () => {
  const mapped = mapPrismaCatalogError(
    Object.assign(new Error("missing"), { code: "P2025" }),
  );

  assert.ok(mapped instanceof HttpApiError);
  assert.equal(mapped.statusCode, 404);
  assert.equal(mapped.code, "catalog_record_not_found");
});

test("leaves unknown database failures unchanged for generic server handling", () => {
  const failure = new Error("connection lost");
  assert.equal(mapPrismaCatalogError(failure), failure);
});
