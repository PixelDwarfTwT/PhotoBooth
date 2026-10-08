import assert from "node:assert/strict";
import test from "node:test";
import { buildServer } from "../src/server-factory.js";
import { parseApiEnvironment } from "../src/config/env.js";
import { RemoteCameraRegistry } from "../src/services/remote-camera-registry.js";

const environment = parseApiEnvironment({ NODE_ENV: "test" });
const offer = { type: "offer", sdp: "v=0\r\n" };
const answer = { type: "answer", sdp: "v=0\r\n" };

function createApp(registry = new RemoteCameraRegistry()) {
  return buildServer(environment, undefined, registry);
}

test("pairing session responses are no-store and exchange one offer and answer", async () => {
  const app = createApp();
  const created = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.headers["cache-control"], "no-store");
  const expiresInMs =
    Date.parse(created.json().expiresAt as string) - Date.now();
  assert.ok(expiresInMs <= 5 * 60_000 && expiresInMs > 4 * 60_000);
  const sessionId = created.json().sessionId as string;
  assert.match(sessionId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    created.json().phoneUrl,
    `${environment.webOrigin}/remote-camera/${sessionId}`,
  );
  assert.match(created.json().qrCodeDataUrl, /^data:image\/png;base64,/);

  const offerPost = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
    payload: offer,
  });
  assert.equal(offerPost.statusCode, 204);
  assert.equal(offerPost.headers["cache-control"], "no-store");
  const duplicateOffer = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
    payload: offer,
  });
  assert.equal(duplicateOffer.statusCode, 409);

  const offerRead = await app.inject({
    method: "GET",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
  });
  assert.equal(offerRead.statusCode, 200);
  assert.deepEqual(offerRead.json(), offer);
  assert.equal(offerRead.headers["cache-control"], "no-store");

  const answerPost = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/answer`,
    payload: answer,
  });
  assert.equal(answerPost.statusCode, 204);

  const answerRead = await app.inject({
    method: "GET",
    url: `/api/remote-camera/sessions/${sessionId}/answer`,
  });
  assert.equal(answerRead.statusCode, 200);
  assert.deepEqual(answerRead.json(), answer);
  await app.close();
});

test("pairing routes reject malformed, oversized, duplicate, and unknown session requests", async () => {
  const app = createApp();
  const malformed = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
    payload: { offer },
  });
  assert.equal(malformed.statusCode, 400);

  const created = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
  });
  const sessionId = created.json().sessionId as string;
  const wrongType = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
    payload: answer,
  });
  assert.equal(wrongType.statusCode, 400);

  const oversized = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
    payload: { type: "offer", sdp: "x".repeat(24 * 1024) },
  });
  assert.equal(oversized.statusCode, 413);

  const unknown = await app.inject({
    method: "GET",
    url: `/api/remote-camera/sessions/${"A".repeat(43)}/offer`,
  });
  assert.equal(unknown.statusCode, 404);

  const closed = await app.inject({
    method: "DELETE",
    url: `/api/remote-camera/sessions/${sessionId}`,
  });
  assert.equal(closed.statusCode, 204);
  const readClosed = await app.inject({
    method: "GET",
    url: `/api/remote-camera/sessions/${sessionId}/offer`,
  });
  assert.equal(readClosed.statusCode, 404);
  await app.close();
});

test("phone cannot submit an answer until it has received an offer", async () => {
  const app = createApp();
  const created = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
  });
  const sessionId = created.json().sessionId as string;
  const response = await app.inject({
    method: "POST",
    url: `/api/remote-camera/sessions/${sessionId}/answer`,
    payload: answer,
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test("pairing capacity is reported as a retryable service error", async () => {
  const app = createApp(new RemoteCameraRegistry({ maxSessions: 1 }));
  const first = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
  });
  assert.equal(first.statusCode, 201);

  const second = await app.inject({
    method: "POST",
    url: "/api/remote-camera/sessions",
  });
  assert.equal(second.statusCode, 503);
  assert.equal(second.json().error.code, "pairing_capacity");
  await app.close();
});
