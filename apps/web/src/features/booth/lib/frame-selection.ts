export function getDefaultFrameId<T extends { id: string }>(
  frames: readonly T[],
  fallbackId: string,
): string {
  return frames[0]?.id ?? fallbackId;
}

export function prioritizeRemoteFrames<T>(
  remoteFrames: readonly T[],
  localFrames: readonly T[],
): T[] {
  return [...remoteFrames, ...localFrames];
}
