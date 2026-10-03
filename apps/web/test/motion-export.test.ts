import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRecorderBlob,
  getLoopScale,
  getSupportedRecorderMimeType,
  supportsMotionRecording,
} from "../src/features/booth/lib/motion-export.ts";

class FakeRecorder {
  state = "inactive";
  mimeType = "video/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  failOnStart = false;

  start() {
    if (this.failOnStart) throw new Error("start failed");
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["clip"]) } as BlobEvent);
    this.state = "inactive";
    this.onstop?.(new Event("stop"));
  }

  stop() {
    this.state = "inactive";
    this.onstop?.(new Event("stop"));
  }
}

test("recorder MIME selection prefers broadly supported codecs", () => {
  assert.equal(
    getSupportedRecorderMimeType((type) => type === "video/webm;codecs=vp8"),
    "video/webm;codecs=vp8",
  );
  assert.equal(
    getSupportedRecorderMimeType(() => false),
    undefined,
  );
  assert.equal(supportsMotionRecording(true, true), true);
  assert.equal(supportsMotionRecording(true, false), false);
});

test("loop scale is smooth, bounded, and returns to its starting scale", () => {
  assert.equal(getLoopScale(0, 8), 1);
  assert.equal(getLoopScale(8, 8), 1);
  assert.ok(getLoopScale(4, 8) > getLoopScale(0, 8));
  assert.ok(getLoopScale(4, 8) <= 1.03);
});

test("recorder output stops every media track after successful recording", async () => {
  const recorder = new FakeRecorder();
  let stoppedTracks = 0;
  const blob = await collectRecorderBlob(recorder, {
    getTracks: () => [{ stop: () => (stoppedTracks += 1) }],
  });
  assert.equal(blob.type, "video/webm");
  assert.equal(blob.size, 4);
  assert.equal(stoppedTracks, 1);
});

test("recorder construction and oversized output failures still stop every track", async () => {
  const recorder = new FakeRecorder();
  recorder.failOnStart = true;
  let stoppedTracks = 0;
  await assert.rejects(
    collectRecorderBlob(recorder, {
      getTracks: () => [{ stop: () => (stoppedTracks += 1) }],
    }),
    /start failed/,
  );
  assert.equal(stoppedTracks, 1);

  const largeRecorder = new FakeRecorder();
  let largeTracksStopped = 0;
  await assert.rejects(
    collectRecorderBlob(
      largeRecorder,
      { getTracks: () => [{ stop: () => (largeTracksStopped += 1) }] },
      { maxBytes: 1 },
    ),
    /batas/,
  );
  assert.equal(largeTracksStopped, 1);
});
