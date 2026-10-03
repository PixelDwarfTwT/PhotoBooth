export async function readBoundedBlob(
  response: Response,
  maxBytes: number,
): Promise<Blob | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) return null;

  const contentLengthHeader = response.headers.get("content-length");
  const contentLength =
    contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;

  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([bytes.buffer], {
    type: response.headers.get("content-type") ?? "",
  });
}
