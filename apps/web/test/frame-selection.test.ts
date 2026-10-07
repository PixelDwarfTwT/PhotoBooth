import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultFrameId,
  prioritizeRemoteFrames,
} from "../src/features/booth/lib/frame-selection.ts";

test("uses the first published Supabase frame as the editor default", () => {
  assert.equal(
    getDefaultFrameId(
      [{ id: "supabase-frame" }, { id: "another-frame" }],
      "local-frame",
    ),
    "supabase-frame",
  );
});

test("keeps a local default when the remote catalog is empty", () => {
  assert.equal(getDefaultFrameId([], "local-frame"), "local-frame");
});

test("shows published Supabase frames before local presets", () => {
  assert.deepEqual(
    prioritizeRemoteFrames(
      [{ id: "remote-1" }, { id: "remote-2" }],
      [{ id: "local-1" }, { id: "local-2" }],
    ),
    [
      { id: "remote-1" },
      { id: "remote-2" },
      { id: "local-1" },
      { id: "local-2" },
    ],
  );
});
