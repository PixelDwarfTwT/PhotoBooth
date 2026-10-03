import type { BoothFilter, BoothLayout } from "../types";
import type { FrameLayoutConfig } from "@photobooth/contracts";

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

export interface BoothFrameOption {
  id: string;
  name: string;
  layoutConfig: FrameLayoutConfig;
  assetUrl: string | null;
  altText: string | null;
}

export interface BoothFilterOption {
  key: BoothFilter;
  label: string;
  intensity: number;
}

export const DEFAULT_FILTER_OPTIONS: ReadonlyArray<BoothFilterOption> =
  BOOTH_FILTERS.map(({ key, label }) => ({ key, label, intensity: 1 }));

export function getFrameLayouts(config: FrameLayoutConfig): BoothLayout[] {
  if (config.layout === "strip") return ["strip"];
  if (config.layout === "grid") return ["grid"];
  return ["strip", "grid"];
}

export const LOCAL_FRAMES: ReadonlyArray<BoothFrameOption> = [
  {
    id: "local-pastel",
    name: "Pastel lembut",
    assetUrl: null,
    altText: null,
    layoutConfig: {
      backgroundColor: "#fff2f7",
      borderColor: "#f5c6d8",
      accentColor: "#bf3d6b",
      borderWidth: 12,
      photoGap: 16,
      layout: "both",
      caption: "little moments",
      motif: "dots",
    },
  },
  {
    id: "local-y2k",
    name: "Y2K sparkle",
    assetUrl: null,
    altText: null,
    layoutConfig: {
      backgroundColor: "#f5efff",
      borderColor: "#9bded6",
      accentColor: "#8954a5",
      borderWidth: 9,
      photoGap: 12,
      layout: "both",
      caption: "love this day",
      motif: "checker",
    },
  },
  {
    id: "local-warm",
    name: "Warm vintage",
    assetUrl: null,
    altText: null,
    layoutConfig: {
      backgroundColor: "#fff5e9",
      borderColor: "#e8bd8f",
      accentColor: "#9b6145",
      borderWidth: 11,
      photoGap: 14,
      layout: "both",
      caption: "good times",
      motif: "sparkles",
    },
  },
];

export const STICKER_SYMBOLS = [
  "✦",
  "♡",
  "✿",
  "☼",
  "★",
  "☾",
  "❋",
  "♬",
] as const;

export const DEFAULT_STICKER_SIZE = 64;
export const MIN_STICKER_SIZE = 36;
export const MAX_STICKER_SIZE = 112;

export function getBoothFilter(key: BoothFilter, intensity = 1) {
  const amount = Number.isFinite(intensity)
    ? Math.min(1, Math.max(0, intensity))
    : 1;
  const filter =
    BOOTH_FILTERS.find((option) => option.key === key) ?? BOOTH_FILTERS[0]!;

  switch (filter.key) {
    case "natural":
      return { ...filter, css: "none" };
    case "warm":
      return {
        ...filter,
        css: `saturate(${1 + 0.14 * amount}) sepia(${0.2 * amount}) hue-rotate(-8deg) brightness(${1 + 0.03 * amount})`,
      };
    case "soft":
      return {
        ...filter,
        css: `brightness(${1 + 0.08 * amount}) saturate(${1 - 0.18 * amount}) contrast(${1 - 0.08 * amount})`,
      };
    case "mono":
      return {
        ...filter,
        css: `grayscale(${amount}) contrast(${1 + 0.05 * amount})`,
      };
  }
}
