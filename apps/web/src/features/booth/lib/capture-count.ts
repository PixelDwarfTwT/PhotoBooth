export const CAPTURE_PHOTO_COUNT = 3;

export function getCapturePhotoIndices(startIndex = 0): number[] {
  const firstIndex = Number.isInteger(startIndex) ? Math.max(0, startIndex) : 0;
  const remainingCount = Math.max(0, CAPTURE_PHOTO_COUNT - firstIndex);

  return Array.from(
    { length: remainingCount },
    (_, offset) => firstIndex + offset,
  );
}
