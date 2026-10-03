import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedBlob } from "../src/lib/read-bounded-blob.ts";

test("reads a response body up to the limit and preserves its media type", async () => {
  const response = new Response("photo", {
    headers: { "content-type": "image/jpeg" },
  });

  const blob = await readBoundedBlob(response, 5);

  assert.equal(blob?.size, 5);
  assert.equal(blob?.type, "image/jpeg");
});

test("cancels a streamed response as soon as its byte limit is exceeded", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );

  assert.equal(await readBoundedBlob(response, 4), null);
  assert.equal(cancelled, true);
});

test("rejects an oversized content-length before reading the body", async () => {
  let readerRequested = false;
  const response = {
    headers: new Headers({ "content-length": "5" }),
    body: {
      getReader() {
        readerRequested = true;
        throw new Error("Body should not be read.");
      },
    },
  } as unknown as Response;

  assert.equal(await readBoundedBlob(response, 4), null);
  assert.equal(readerRequested, false);
});
