import {
  AssetMutationSchema,
  CatalogMutationSchemas,
  FilterConfigSchema,
  FilterMutationSchema,
  FrameLayoutConfigSchema,
  FrameMutationSchema,
  PoseGuideMutationSchema,
  ThemeMutationSchema,
  type CatalogCollection,
} from "@photobooth/contracts";
import { Prisma, type PrismaClient } from "@photobooth/db";
import type {
  AdminCredentialRepository,
  AdminIdentity,
  AdminUserRepository,
  AdminUserView,
} from "../lib/admin-auth.js";
import type {
  CatalogRepository,
  PublicationWindow,
} from "./catalog-service.js";

function activeThemeWhere(now: Date) {
  return {
    status: "PUBLISHED" as const,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

function assetUrl(
  storageKey: string,
  baseUrl: string | undefined,
): string | null {
  if (!baseUrl) return null;
  const path = storageKey.split("/").map(encodeURIComponent).join("/");
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, base).toString();
}

function parseInput(collection: CatalogCollection, input: unknown) {
  return CatalogMutationSchemas[collection].parse(input);
}

function themeData(input: unknown): Prisma.ThemeUncheckedCreateInput {
  const value = ThemeMutationSchema.parse(input);
  return {
    ...value,
    thumbnailAssetId: value.thumbnailAssetId ?? null,
    startsAt: value.startsAt ? new Date(value.startsAt) : null,
    endsAt: value.endsAt ? new Date(value.endsAt) : null,
  };
}

function assetData(input: unknown): Prisma.AssetUncheckedCreateInput {
  const value = AssetMutationSchema.parse(input);
  return {
    ...value,
    themeId: value.themeId ?? null,
    fileSizeBytes: BigInt(value.fileSizeBytes),
  };
}

function frameData(input: unknown): Prisma.FrameUncheckedCreateInput {
  const value = FrameMutationSchema.parse(input);
  return {
    ...value,
    layoutConfig: value.layoutConfig as Prisma.InputJsonValue,
  };
}

function filterData(input: unknown): Prisma.FilterUncheckedCreateInput {
  const value = FilterMutationSchema.parse(input);
  return {
    ...value,
    previewAssetId: value.previewAssetId ?? null,
    config: value.config as Prisma.InputJsonValue,
  };
}

function poseGuideData(input: unknown): Prisma.PoseGuideUncheckedCreateInput {
  const value = PoseGuideMutationSchema.parse(input);
  return {
    ...value,
    themeId: value.themeId ?? null,
    assetId: value.assetId ?? null,
  };
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly assetBaseUrl?: string,
  ) {}

  async listPublished(
    collection: CatalogCollection,
    now: Date,
    themeSlug?: string,
  ): Promise<unknown[]> {
    switch (collection) {
      case "themes": {
        const themes = await this.client.theme.findMany({
          where: activeThemeWhere(now),
          orderBy: [{ startsAt: "asc" }, { name: "asc" }],
          include: {
            thumbnailAsset: { select: { storageKey: true, status: true } },
          },
        });
        return themes.map((theme) => ({
          id: theme.id,
          name: theme.name,
          slug: theme.slug,
          description: theme.description,
          thumbnailUrl:
            theme.thumbnailAsset?.status === "PUBLISHED"
              ? assetUrl(theme.thumbnailAsset.storageKey, this.assetBaseUrl)
              : null,
          startsAt: theme.startsAt?.toISOString() ?? null,
          endsAt: theme.endsAt?.toISOString() ?? null,
        }));
      }
      case "assets": {
        const assets = await this.client.asset.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        return assets.map((asset) => ({
          id: asset.id,
          themeId: asset.themeId,
          assetType: asset.assetType,
          assetUrl: assetUrl(asset.storageKey, this.assetBaseUrl),
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          fileSizeBytes: Number(asset.fileSizeBytes),
          altText: asset.altText,
          licenseNote: asset.licenseNote,
          sortOrder: asset.sortOrder,
        }));
      }
      case "frames": {
        const frames = await this.client.frame.findMany({
          where: {
            status: "PUBLISHED",
            theme: {
              is: {
                ...activeThemeWhere(now),
                ...(themeSlug ? { slug: themeSlug } : {}),
              },
            },
            asset: { is: { status: "PUBLISHED", assetType: "FRAME" } },
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            theme: { select: { slug: true } },
            asset: { select: { storageKey: true, altText: true } },
          },
        });
        return frames.map((frame) => ({
          id: frame.id,
          themeId: frame.themeId,
          themeSlug: frame.theme.slug,
          name: frame.name,
          assetUrl: assetUrl(frame.asset.storageKey, this.assetBaseUrl),
          altText: frame.asset.altText,
          layoutConfig: FrameLayoutConfigSchema.parse(frame.layoutConfig),
          isLimited: frame.isLimited,
        }));
      }
      case "filters": {
        const filters = await this.client.filter.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        return filters.map((filter) => ({
          id: filter.id,
          name: filter.name,
          filterKey: filter.filterKey,
          config: FilterConfigSchema.parse(filter.config),
        }));
      }
      case "pose-guides": {
        const guides = await this.client.poseGuide.findMany({
          where: {
            status: "PUBLISHED",
            AND: [
              {
                OR: [
                  { themeId: null },
                  { theme: { is: activeThemeWhere(now) } },
                ],
              },
              {
                OR: [
                  { assetId: null },
                  { asset: { is: { status: "PUBLISHED" } } },
                ],
              },
            ],
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { asset: { select: { storageKey: true, altText: true } } },
        });
        return guides.map((guide) => ({
          id: guide.id,
          themeId: guide.themeId,
          title: guide.title,
          instruction: guide.instruction,
          assetUrl: guide.asset
            ? assetUrl(guide.asset.storageKey, this.assetBaseUrl)
            : null,
          altText: guide.asset?.altText ?? null,
        }));
      }
    }
  }

  async listForAdmin(collection: CatalogCollection): Promise<unknown[]> {
    switch (collection) {
      case "themes":
        return this.client.theme.findMany({ orderBy: { name: "asc" } });
      case "assets":
        return this.client.asset.findMany({
          orderBy: [{ assetType: "asc" }, { sortOrder: "asc" }],
        });
      case "frames":
        return this.client.frame.findMany({
          orderBy: [{ themeId: "asc" }, { sortOrder: "asc" }],
        });
      case "filters":
        return this.client.filter.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
      case "pose-guides":
        return this.client.poseGuide.findMany({
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        });
    }
  }

  async create(
    collection: CatalogCollection,
    input: unknown,
  ): Promise<unknown> {
    const parsed = parseInput(collection, input);
    switch (collection) {
      case "themes":
        return this.client.theme.create({ data: themeData(parsed) });
      case "assets":
        return this.client.asset.create({ data: assetData(parsed) });
      case "frames":
        return this.client.frame.create({ data: frameData(parsed) });
      case "filters":
        return this.client.filter.create({ data: filterData(parsed) });
      case "pose-guides":
        return this.client.poseGuide.create({ data: poseGuideData(parsed) });
    }
  }

  async update(
    collection: CatalogCollection,
    id: string,
    input: unknown,
  ): Promise<unknown> {
    const parsed = parseInput(collection, input);
    switch (collection) {
      case "themes":
        return this.client.theme.update({
          where: { id },
          data: themeData(parsed),
        });
      case "assets":
        return this.client.asset.update({
          where: { id },
          data: assetData(parsed),
        });
      case "frames":
        return this.client.frame.update({
          where: { id },
          data: frameData(parsed),
        });
      case "filters":
        return this.client.filter.update({
          where: { id },
          data: filterData(parsed),
        });
      case "pose-guides":
        return this.client.poseGuide.update({
          where: { id },
          data: poseGuideData(parsed),
        });
    }
  }

  async archive(collection: CatalogCollection, id: string): Promise<void> {
    switch (collection) {
      case "themes":
        await this.client.theme.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        return;
      case "assets":
        await this.client.asset.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        return;
      case "frames":
        await this.client.frame.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        return;
      case "filters":
        await this.client.filter.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        return;
      case "pose-guides":
        await this.client.poseGuide.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
    }
  }
}

function toAdminUserView(user: {
  id: string;
  email: string;
  role: "EDITOR" | "ADMINISTRATOR";
  createdAt: Date;
  lastLoginAt: Date | null;
}): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export class PrismaAdminCredentialRepository
  implements AdminCredentialRepository, AdminUserRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findByCredentialHash(hash: string): Promise<AdminIdentity | null> {
    const user = await this.client.adminUser.findUnique({
      where: { credentialHash: hash },
      select: { id: true, email: true, role: true },
    });
    return user ? { id: user.id, email: user.email, role: user.role } : null;
  }

  async list(): Promise<AdminUserView[]> {
    const users = await this.client.adminUser.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { email: "asc" },
    });
    return users.map(toAdminUserView);
  }

  async create(
    email: string,
    role: "EDITOR" | "ADMINISTRATOR",
    credentialHash: string,
  ): Promise<AdminUserView> {
    const user = await this.client.adminUser.create({
      data: { email, role, credentialHash },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    return toAdminUserView(user);
  }

  async findById(id: string): Promise<AdminUserView | null> {
    const user = await this.client.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    return user ? toAdminUserView(user) : null;
  }

  async rotateCredential(id: string, credentialHash: string): Promise<void> {
    await this.client.adminUser.update({
      where: { id },
      data: { credentialHash },
    });
  }

  async deleteIfAllowed(
    id: string,
    currentUserId: string,
  ): Promise<"deleted" | "self" | "last-administrator" | "not-found"> {
    return this.client.$transaction(
      async (transaction) => {
        const target = await transaction.adminUser.findUnique({
          where: { id },
          select: { id: true, role: true },
        });
        if (!target) return "not-found";
        if (target.id === currentUserId) return "self";
        if (
          target.role === "ADMINISTRATOR" &&
          (await transaction.adminUser.count({
            where: { role: "ADMINISTRATOR" },
          })) <= 1
        ) {
          return "last-administrator";
        }
        await transaction.adminUser.delete({ where: { id } });
        return "deleted";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export function themePublicationWindow(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null,
): PublicationWindow {
  return { status, startsAt, endsAt };
}
