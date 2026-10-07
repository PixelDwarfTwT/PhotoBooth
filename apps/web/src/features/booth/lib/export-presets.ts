export const MOTION_FILTERS = [
  { key: "normal", label: "Normal", css: "none" },
  { key: "mono", label: "Hitam putih", css: "grayscale(1)" },
  { key: "sepia", label: "Sepia", css: "sepia(1)" },
  { key: "negative", label: "Negatif", css: "invert(1)" },
  { key: "blur", label: "Blur", css: "blur(2px)" },
] as const;

export type MotionFilter = (typeof MOTION_FILTERS)[number]["key"];

export function getMotionFilterCss(filter: MotionFilter): string {
  return MOTION_FILTERS.find((option) => option.key === filter)?.css ?? "none";
}

export interface StoryPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getStoryPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = 1080,
  targetHeight = 1920,
  padding = 56,
): StoryPlacement {
  const maxWidth = Math.max(1, targetWidth - padding * 2);
  const maxHeight = Math.max(1, targetHeight - padding * 2);
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return { x: targetWidth / 2, y: targetHeight / 2, width: 0, height: 0 };
  }
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}
