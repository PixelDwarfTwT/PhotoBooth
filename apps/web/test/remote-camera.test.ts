import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseRemoteCameraHost,
  getPhoneCameraErrorMessage,
  isRemoteCameraSessionId,
  isTerminalRemoteCameraStatus,
  preferRemoteCameraStream,
  readRemoteCameraDescription,
  readRemoteCameraSessionInfo,
  shouldKeepRemoteCameraOnDismiss,
} from "../src/features/booth/lib/remote-camera.js";

test("the booth prefers the paired phone camera and falls back to local camera", () => {
  const local = { id: "local" };
  const remote = { id: "phone" };
  assert.equal(preferRemoteCameraStream(remote, local), remote);
  assert.equal(preferRemoteCameraStream(null, local), local);
  assert.equal(preferRemoteCameraStream(null, null), null);
});

test("phone pairing requires secure context, media devices, WebRTC, and a reachable host name", () => {
  const supported = {
    secureContext: true,
    mediaDevicesAvailable: true,
    peerConnectionAvailable: true,
    hostname: "photobooth.example",
  };

  assert.equal(canUseRemoteCameraHost(supported), true);
  assert.equal(
    canUseRemoteCameraHost({ ...supported, secureContext: false }),
    false,
  );
  assert.equal(
    canUseRemoteCameraHost({ ...supported, mediaDevicesAvailable: false }),
    false,
  );
  assert.equal(
    canUseRemoteCameraHost({ ...supported, peerConnectionAvailable: false }),
    false,
  );
  assert.equal(
    canUseRemoteCameraHost({ ...supported, hostname: "localhost" }),
    false,
  );
});

test("accepts only high-entropy base64url pairing session IDs", () => {
  assert.equal(isRemoteCameraSessionId("a".repeat(43)), true);
  assert.equal(isRemoteCameraSessionId("short"), false);
  assert.equal(isRemoteCameraSessionId("a".repeat(42) + "!"), false);
});

test("reads a valid no-store pairing response and rejects unsafe URLs", () => {
  const id = "a".repeat(43);
  const response = {
    sessionId: id,
    expiresAt: "2026-10-07T12:05:00.000Z",
    phoneUrl: `https://photobooth.example/remote-camera/${id}`,
    qrCodeDataUrl: "data:image/png;base64,aGVsbG8=",
  };

  assert.deepEqual(readRemoteCameraSessionInfo(response), response);
  assert.equal(
    readRemoteCameraSessionInfo({
      ...response,
      phoneUrl: `javascript:alert(1)`,
    }),
    null,
  );
  assert.equal(
    readRemoteCameraSessionInfo({ ...response, sessionId: "bad" }),
    null,
  );
});

test("accepts only bounded WebRTC offer and answer descriptions", () => {
  assert.deepEqual(
    readRemoteCameraDescription({ type: "offer", sdp: "v=0\r\n" }, "offer"),
    { type: "offer", sdp: "v=0\r\n" },
  );
  assert.equal(
    readRemoteCameraDescription({ type: "answer", sdp: "v=0\r\n" }, "offer"),
    null,
  );
  assert.equal(
    readRemoteCameraDescription(
      { type: "offer", sdp: "x".repeat(21_000) },
      "offer",
    ),
    null,
  );
});

test("expired and consumed pairing sessions cannot be retried with the same QR", () => {
  assert.equal(isTerminalRemoteCameraStatus(404), true);
  assert.equal(isTerminalRemoteCameraStatus(409), true);
  assert.equal(isTerminalRemoteCameraStatus(500), false);
  assert.equal(isTerminalRemoteCameraStatus(0), false);
});

test("maps denied and unavailable phone cameras to clear Indonesian guidance", () => {
  assert.match(
    getPhoneCameraErrorMessage({ name: "NotAllowedError" }),
    /izin kamera/i,
  );
  assert.match(
    getPhoneCameraErrorMessage({ name: "NotFoundError" }),
    /kamera tidak ditemukan/i,
  );
  assert.equal(
    getPhoneCameraErrorMessage(new Error("network error")),
    "network error",
  );
});

test("dismissing a connected pairing keeps the camera stream available", () => {
  assert.equal(shouldKeepRemoteCameraOnDismiss("connected"), true);
  assert.equal(shouldKeepRemoteCameraOnDismiss("waiting"), false);
  assert.equal(shouldKeepRemoteCameraOnDismiss("error"), false);
});
