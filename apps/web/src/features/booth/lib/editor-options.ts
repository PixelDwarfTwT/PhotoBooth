import type { BoothFilter, BoothLayout } from "../types.js";

export const BOOTH_LAYOUTS: ReadonlyArray<{
  key: BoothLayout;
  label: string;
  description: string;
}> = [
  {
    key: "strip",
    label: "Strip foto",
    description: "Foto disusun memanjang seperti photobooth klasik.",
  },
  {
    key: "grid",
    label: "Kolase",
    description: "Foto disusun dalam dua kolom.",
  },
];

export const BOOTH_FILTERS: ReadonlyArray<{
  key: BoothFilter;
  label: string;
  css: string;
}> = [
  { key: "natural", label: "Natural", css: "none" },
  {
    key: "warm",
    label: "Hangat",
    css: "saturate(1.14) sepia(0.2) hue-rotate(-8deg) brightness(1.03)",
  },
  {
    key: "soft",
    label: "Lembut",
    css: "brightness(1.08) saturate(0.82) contrast(0.92)",
  },
  {
    key: "mono",
    label: "Monokrom",
    css: "grayscale(1) contrast(1.05)",
  },
];

export const STICKER_SYMBOLS = ["✦", "♡", "✿", "☼", "★", "☾", "❋", "♬"] as const;

export const DEFAULT_STICKER_SIZE = 64;
export const MIN_STICKER_SIZE = 36;
export const MAX_STICKER_SIZE = 112;

export function getBoothFilter(key: BoothFilter) {
  return BOOTH_FILTERS.find((filter) => filter.key === key) ?? BOOTH_FILTERS[0]!;
}
