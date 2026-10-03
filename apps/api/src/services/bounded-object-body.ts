export async function collectBoundedObjectBody(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of body) {
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(
        "Stored share object exceeds the configured maximum size.",
      );
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, totalBytes);
}
