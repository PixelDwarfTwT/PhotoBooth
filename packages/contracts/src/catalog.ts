import { z } from "zod";

export const ThemeStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
]);
export const CatalogStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const AssetTypeSchema = z.enum([
  "FRAME",
  "STICKER",
  "THUMBNAIL",
  "POSE_ILLUSTRATION",
]);
export const AdminRoleSchema = z.enum(["EDITOR", "ADMINISTRATOR"]);
export const CatalogCollectionSchema = z.enum([
  "themes",
  "assets",
  "frames",
  "filters",
  "pose-guides",
]);

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const normalizedPhotoWindowSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine((window) => window.x + window.width <= 1, { path: ["width"] })
  .refine((window) => window.y + window.height <= 1, { path: ["height"] });
const publicImageUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Catalog URLs must use HTTP or HTTPS.");

export const FrameLayoutConfigSchema = z
  .object({
    backgroundColor: colorSchema.default("#fff2f7"),
    borderColor: colorSchema.default("#f5c6d8"),
    accentColor: colorSchema.default("#bf3d6b"),
    borderWidth: z.number().int().min(0).max(28).default(8),
    photoGap: z.number().int().min(0).max(40).default(12),
    layout: z.enum(["strip", "grid", "both"]).default("both"),
    caption: z.string().max(40).default(""),
    motif: z.enum(["none", "dots", "sparkles", "checker"]).default("none"),
    photoCropPositionY: z.number().min(0).max(1).optional(),
    photoWindows: z.array(normalizedPhotoWindowSchema).length(3).optional(),
    backgroundRemoval: z.enum(["light-neutral", "gray-checker"]).optional(),
  })
  .strict();
export type FrameLayoutConfig = z.infer<typeof FrameLayoutConfigSchema>;

export const FilterConfigSchema = z
  .object({ intensity: z.number().min(0).max(1).default(1) })
  .strict();
export type FilterConfig = z.infer<typeof FilterConfigSchema>;

const sortOrderSchema = z.number().int().min(-10000).max(10000).default(0);
const themeIdSchema = z.uuid();
const assetIdSchema = z.uuid();
const catalogStatusSchema = CatalogStatusSchema.default("DRAFT");

export const ThemeMutationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(2000).default(""),
    thumbnailAssetId: assetIdSchema.nullable().optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    status: ThemeStatusSchema.default("DRAFT"),
  })
  .strict()
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      Date.parse(value.startsAt) < Date.parse(value.endsAt),
    { message: "startsAt must be earlier than endsAt", path: ["endsAt"] },
  );

export const AssetMutationSchema = z
  .object({
    themeId: themeIdSchema.nullable().optional(),
    assetType: AssetTypeSchema,
    storageKey: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9/ _()-]*\.(svg|png|jpe?g|webp)$/i)
      .refine(
        (value) => !value.includes(".."),
        "storage key cannot traverse directories",
      ),
    mimeType: z.enum([
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/webp",
    ]),
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
    fileSizeBytes: z
      .number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024),
    altText: z.string().trim().min(1).max(500),
    licenseNote: z.string().trim().min(1).max(2000),
    sortOrder: sortOrderSchema,
    status: catalogStatusSchema,
  })
  .strict();

export const FrameMutationSchema = z
  .object({
    themeId: themeIdSchema,
    name: z.string().trim().min(1).max(120),
    assetId: assetIdSchema,
    layoutConfig: FrameLayoutConfigSchema,
    isLimited: z.boolean().default(false),
    status: catalogStatusSchema,
    sortOrder: sortOrderSchema,
  })
  .strict();

export const FilterMutationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    filterKey: z.enum(["natural", "warm", "soft", "mono"]),
    config: FilterConfigSchema,
    previewAssetId: assetIdSchema.nullable().optional(),
    status: catalogStatusSchema,
    sortOrder: sortOrderSchema,
  })
  .strict();

export const PoseGuideMutationSchema = z
  .object({
    themeId: themeIdSchema.nullable().optional(),
    title: z.string().trim().min(1).max(160),
    instruction: z.string().trim().min(1).max(2000),
    assetId: assetIdSchema.nullable().optional(),
    status: catalogStatusSchema,
    sortOrder: sortOrderSchema,
  })
  .strict();

export const CatalogMutationSchemas = {
  themes: ThemeMutationSchema,
  assets: AssetMutationSchema,
  frames: FrameMutationSchema,
  filters: FilterMutationSchema,
  "pose-guides": PoseGuideMutationSchema,
} as const;

export const ThemeCatalogItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  thumbnailUrl: publicImageUrlSchema.nullable(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
});

export const AssetCatalogItemSchema = z
  .object({
    id: z.uuid(),
    themeId: z.uuid().nullable(),
    assetType: AssetTypeSchema,
    assetUrl: publicImageUrlSchema.nullable(),
    mimeType: z.enum([
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/webp",
    ]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fileSizeBytes: z.number().int().positive(),
    altText: z.string(),
    licenseNote: z.string(),
    sortOrder: z.number().int(),
  })
  .strict();

export const FrameCatalogItemSchema = z.object({
  id: z.uuid(),
  themeId: z.uuid(),
  themeSlug: z.string(),
  name: z.string(),
  assetUrl: publicImageUrlSchema.nullable(),
  altText: z.string(),
  layoutConfig: FrameLayoutConfigSchema,
  isLimited: z.boolean(),
});

export const FilterCatalogItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  filterKey: z.enum(["natural", "warm", "soft", "mono"]),
  config: FilterConfigSchema,
});

export const PoseGuideCatalogItemSchema = z.object({
  id: z.uuid(),
  themeId: z.uuid().nullable(),
  title: z.string(),
  instruction: z.string(),
  assetUrl: publicImageUrlSchema.nullable(),
  altText: z.string().nullable(),
});

export const CatalogMutationInputSchema = z.discriminatedUnion("collection", [
  z.object({ collection: z.literal("themes"), data: ThemeMutationSchema }),
  z.object({ collection: z.literal("assets"), data: AssetMutationSchema }),
  z.object({ collection: z.literal("frames"), data: FrameMutationSchema }),
  z.object({ collection: z.literal("filters"), data: FilterMutationSchema }),
  z.object({
    collection: z.literal("pose-guides"),
    data: PoseGuideMutationSchema,
  }),
]);

export type ThemeMutation = z.infer<typeof ThemeMutationSchema>;
export type AssetMutation = z.infer<typeof AssetMutationSchema>;
export type AssetCatalogItem = z.infer<typeof AssetCatalogItemSchema>;
export type FrameMutation = z.infer<typeof FrameMutationSchema>;
export type FilterMutation = z.infer<typeof FilterMutationSchema>;
export type PoseGuideMutation = z.infer<typeof PoseGuideMutationSchema>;
export type CatalogCollection = z.infer<typeof CatalogCollectionSchema>;
export type ThemeCatalogItem = z.infer<typeof ThemeCatalogItemSchema>;
