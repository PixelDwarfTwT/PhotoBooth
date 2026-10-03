import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { S3ObjectStore } from "../src/services/s3-object-store.ts";

test("S3-compatible endpoints do not receive unsupported SSE headers", async () => {
  let serverSideEncryptionHeader: string | undefined;
  const server = createServer((request, response) => {
    const value = request.headers["x-amz-server-side-encryption"];
    serverSideEncryptionHeader = Array.isArray(value) ? value[0] : value;
    response.writeHead(200, {
      "content-length": "0",
      "x-amz-id-2": "test",
      "x-amz-request-id": "test",
    });
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const objectStore = new S3ObjectStore({
    bucket: "private-shares",
    region: "ap-southeast-1",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    endpoint: `http://127.0.0.1:${address.port}/storage/v1/s3`,
  });

  try {
    await objectStore.putObject(
      "shares/test.png",
      new Uint8Array([1, 2, 3]),
      "image/png",
    );
  } finally {
    await objectStore.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  assert.equal(serverSideEncryptionHeader, undefined);
});
