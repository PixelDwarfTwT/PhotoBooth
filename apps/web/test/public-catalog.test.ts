import assert from "node:assert/strict";
import test from "node:test";
import { readThemeCatalog } from "../src/lib/public-catalog.ts";

const validTheme = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Pastel",
  slug: "pastel",
  description: "Pastel frame collection",
  thumbnailUrl: null,
  startsAt: null,
  endsAt: null,
};

test("public themes keep only schema-valid HTTP(S) catalog metadata", () => {
  assert.deepEqual(readThemeCatalog({ items: [validTheme] }), [validTheme]);
  assert.deepEqual(
    readThemeCatalog({
      items: [{ ...validTheme, thumbnailUrl: "javascript:alert(1)" }],
    }),
    [],
  );
});

test("malformed and unavailable theme payloads become an empty public catalog", () => {
  assert.deepEqual(readThemeCatalog({ items: null }), []);
  assert.deepEqual(readThemeCatalog(null), []);
});
