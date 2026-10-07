import assert from "node:assert/strict";
import test from "node:test";
import { RemoteCameraRegistry } from "../src/services/remote-camera-registry.js";

const offer = { type: "offer" as const, sdp: "v=0\r\n" };
const answer = { type: "answer" as const, sdp: "v=0\r\n" };

test("creates random pairing sessions that expire after five minutes", () => {
  let now = 1_000;
  const registry = new RemoteCameraRegistry({ now: () => now });

  const session = registry.create()!;

  assert.match(session.sessionId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(session.expiresAt.getTime(), now + 5 * 60_000);
  assert.equal(registry.get(session.sessionId)?.sessionId, session.sessionId);

  now += 5 * 60_000;
  assert.equal(registry.get(session.sessionId), null);
});

test("accepts a single offer and answer and returns defensive copies", () => {
  const registry = new RemoteCameraRegistry();
  const { sessionId } = registry.create()!;

  assert.equal(registry.setOffer(sessionId, offer), "created");
  assert.equal(registry.setOffer(sessionId, offer), "conflict");
  assert.equal(registry.setAnswer(sessionId, answer), "created");
  assert.equal(registry.setAnswer(sessionId, answer), "conflict");

  const stored = registry.get(sessionId);
  assert.deepEqual(stored?.offer, offer);
  assert.deepEqual(stored?.answer, answer);
  if (stored?.offer) stored.offer.sdp = "changed";
  assert.equal(registry.get(sessionId)?.offer?.sdp, offer.sdp);
});

test("does not accept an answer before an offer exists", () => {
  const registry = new RemoteCameraRegistry();
  const { sessionId } = registry.create()!;

  assert.equal(registry.setAnswer(sessionId, answer), "conflict");
});

test("closing a session makes it unavailable for all later operations", () => {
  const registry = new RemoteCameraRegistry();
  const { sessionId } = registry.create()!;

  assert.equal(registry.close(sessionId), true);
  assert.equal(registry.get(sessionId), null);
  assert.equal(registry.setOffer(sessionId, offer), "not-found");
  assert.equal(registry.close(sessionId), false);
});

test("bounds pairing sessions and total stored SDP memory", () => {
  const registry = new RemoteCameraRegistry({
    maxSessions: 1,
    maxSdpBytes: Buffer.byteLength(offer.sdp),
  });
  const { sessionId } = registry.create()!;

  assert.equal(registry.create(), null);
  assert.equal(registry.setOffer(sessionId, offer), "created");
  assert.equal(registry.setAnswer(sessionId, answer), "capacity");
  assert.equal(registry.get(sessionId)?.answer, null);
});

test("periodic cleanup removes expired sessions even when no client revisits them", () => {
  let now = 1_000;
  const registry = new RemoteCameraRegistry({ now: () => now, maxSessions: 1 });
  const { sessionId } = registry.create()!;
  assert.equal(registry.setOffer(sessionId, offer), "created");

  now += 5 * 60_000;
  registry.sweepExpired();

  assert.equal(registry.get(sessionId), null);
  assert.ok(registry.create());
});
