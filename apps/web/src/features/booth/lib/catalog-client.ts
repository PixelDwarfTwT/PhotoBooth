import {
  FilterCatalogItemSchema,
  FrameCatalogItemSchema,
  PoseGuideCatalogItemSchema,
} from "@photobooth/contracts";
import type { BoothFilterOption, BoothFrameOption } from "./editor-options";

function catalogItems(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || !("items" in value)) return [];
  return Array.isArray(value.items) ? value.items : [];
}

export function readFrameCatalog(value: unknown): BoothFrameOption[] {
  return catalogItems(value).flatMap((item) => {
    const parsed = FrameCatalogItemSchema.safeParse(item);
    return parsed.success
      ? [
          {
            id: parsed.data.id,
            name: parsed.data.name,
            layoutConfig: parsed.data.layoutConfig,
            assetUrl: parsed.data.assetUrl,
            altText: parsed.data.altText,
          },
        ]
      : [];
  });
}

export function readFilterCatalog(value: unknown): BoothFilterOption[] {
  const seenKeys = new Set<string>();
  return catalogItems(value).flatMap((item) => {
    const parsed = FilterCatalogItemSchema.safeParse(item);
    if (!parsed.success || seenKeys.has(parsed.data.filterKey)) return [];
    seenKeys.add(parsed.data.filterKey);
    return [
      {
        key: parsed.data.filterKey,
        label: parsed.data.name,
        intensity: parsed.data.config.intensity,
      },
    ];
  });
}

export interface BoothPoseGuideOption {
  title: string;
  instruction: string;
  assetUrl: string | null;
  altText: string | null;
}

export function readPoseGuideCatalog(value: unknown): BoothPoseGuideOption[] {
  return catalogItems(value).flatMap((item) => {
    const parsed = PoseGuideCatalogItemSchema.safeParse(item);
    return parsed.success
      ? [
          {
            title: parsed.data.title,
            instruction: parsed.data.instruction,
            assetUrl: parsed.data.assetUrl,
            altText: parsed.data.altText,
          },
        ]
      : [];
  });
}
