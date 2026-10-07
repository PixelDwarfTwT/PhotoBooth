import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultFrameId } from "../src/features/booth/lib/frame-selection.ts";

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
