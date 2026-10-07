import assert from "node:assert/strict";
import test from "node:test";
import { createStoryBlob } from "../src/features/booth/lib/story-export.js";

test("story export creates a local 1080x1920 PNG and contains the photo strip", async () => {
  const drawCalls: number[][] = [];
  let outputWidth = 0;
  let outputHeight = 0;
  const context = {
    fillStyle: "",
    fillRect: () => undefined,
    drawImage: (...args: number[]) => drawCalls.push(args),
  };
  const output = {
    set width(value: number) {
      outputWidth = value;
    },
    get width() {
      return outputWidth;
    },
    set height(value: number) {
      outputHeight = value;
    },
    get height() {
      return outputHeight;
    },
    getContext: () => context,
    toBlob: (callback: BlobCallback, mimeType: string) =>
      callback(new Blob(["story"], { type: mimeType })),
  };
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => output },
  });
  try {
    const source = { width: 1000, height: 2200 } as HTMLCanvasElement;
    const result = await createStoryBlob(source);
    assert.equal(outputWidth, 1080);
    assert.equal(outputHeight, 1920);
    assert.equal(result.type, "image/png");
    assert.deepEqual(drawCalls[0], [
      source,
      129.09090909090912,
      56,
      821.8181818181818,
      1808,
    ]);
  } finally {
    if (previousDocument) {
      Object.defineProperty(globalThis, "document", previousDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
});

test("story export rejects an empty source composition", async () => {
  await assert.rejects(
    createStoryBlob({ width: 0, height: 0 } as HTMLCanvasElement),
    /belum siap/,
  );
});
