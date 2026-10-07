export function getDefaultFrameId<T extends { id: string }>(
  frames: readonly T[],
  fallbackId: string,
): string {
  return frames[0]?.id ?? fallbackId;
}
