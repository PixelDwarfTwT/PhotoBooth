import assert from "node:assert/strict";
import test from "node:test";
import { collectBoundedObjectBody } from "../src/services/bounded-object-body.js";

async function* chunks(...values: Uint8Array[]) {
  for (const value of values) yield value;
}

test("S3 response collection returns bytes within the configured limit", async () => {
  const result = await collectBoundedObjectBody(
    chunks(Buffer.from("ab"), Buffer.from("cd")),
    4,
  );
  assert.equal(result.toString(), "abcd");
});

test("S3 response collection stops as soon as stored bytes exceed the limit", async () => {
  await assert.rejects(
    collectBoundedObjectBody(chunks(Buffer.from("ab"), Buffer.from("cd")), 3),
    /configured maximum/,
  );
});
