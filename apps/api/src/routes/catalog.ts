import {
  AssetCatalogItemSchema,
  CatalogCollectionSchema,
  CatalogMutationSchemas,
  FilterCatalogItemSchema,
  FrameCatalogItemSchema,
  PoseGuideCatalogItemSchema,
  ThemeCatalogItemSchema,
} from "@photobooth/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ApiEnvironment } from "../config/env.js";
import { authenticateBearerToken } from "../lib/admin-auth.js";
import { HttpApiError } from "../lib/api-error.js";
import { mapPrismaCatalogError } from "../lib/prisma-errors.js";
import type { CatalogRouteServices } from "../services/catalog-service.js";

interface CatalogRouteOptions extends CatalogRouteServices {
  environment: ApiEnvironment;
}

const publicSchemas = {
  themes: z.array(ThemeCatalogItemSchema),
  assets: z.array(AssetCatalogItemSchema),
  frames: z.array(FrameCatalogItemSchema),
  filters: z.array(FilterCatalogItemSchema),
  "pose-guides": z.array(PoseGuideCatalogItemSchema),
} as const;

const frameQuerySchema = z.object({
  themeSlug: z.string().trim().min(1).max(160).optional(),
});
const idSchema = z.uuid();

async function withCatalogErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapPrismaCatalogError(error);
  }
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonSafe(nested)]),
    );
  }
  return value;
}

async function requireEditor(
  authorization: string | undefined,
  adminCredentials: CatalogRouteServices["adminCredentials"],
) {
  const identity = await authenticateBearerToken(
    authorization,
    adminCredentials,
  );
  if (!identity) {
    throw new HttpApiError(
      401,
      "admin_auth_required",
      "Autentikasi administrator diperlukan.",
    );
  }
  return identity;
}

export const registerCatalogRoutes: FastifyPluginAsync<
  CatalogRouteOptions
> = async (app, options) => {
  const publicRoutes = [
    ["themes", "/api/themes"],
    ["assets", "/api/assets"],
    ["frames", "/api/frames"],
    ["filters", "/api/filters"],
    ["pose-guides", "/api/pose-guides"],
  ] as const;

  for (const [collection, url] of publicRoutes) {
    app.get(url, async (request, reply) => {
      let themeSlug: string | undefined;
      if (collection === "frames") {
        const query = frameQuerySchema.safeParse(request.query);
        if (!query.success) {
          throw new HttpApiError(
            400,
            "invalid_query",
            "Filter katalog tidak valid.",
          );
        }
        themeSlug = query.data.themeSlug;
      }

      const items = await withCatalogErrors(() =>
        options.repository.listPublished(collection, new Date(), themeSlug),
      );
      const result = publicSchemas[collection].safeParse(items);
      if (!result.success) {
        throw new HttpApiError(
          500,
          "invalid_catalog_record",
          "Katalog tidak tersedia saat ini.",
        );
      }

      return reply
        .header(
          "Cache-Control",
          "public, max-age=60, stale-while-revalidate=300",
        )
        .send({ items: result.data });
    });
  }

  app.get<{ Params: { collection: string } }>(
    "/api/admin/catalog/:collection",
    async (request, reply) => {
      await requireEditor(
        request.headers.authorization,
        options.adminCredentials,
      );
      const parsedCollection = CatalogCollectionSchema.safeParse(
        request.params.collection,
      );
      if (!parsedCollection.success) {
        throw new HttpApiError(
          404,
          "catalog_collection_not_found",
          "Jenis katalog tidak ditemukan.",
        );
      }
      const items = await withCatalogErrors(() =>
        options.repository.listForAdmin(parsedCollection.data),
      );
      return reply.send({ items: toJsonSafe(items) });
    },
  );

  app.post<{ Params: { collection: string } }>(
    "/api/admin/catalog/:collection",
    async (request, reply) => {
      await requireEditor(
        request.headers.authorization,
        options.adminCredentials,
      );
      const parsedCollection = CatalogCollectionSchema.safeParse(
        request.params.collection,
      );
      if (!parsedCollection.success) {
        throw new HttpApiError(
          404,
          "catalog_collection_not_found",
          "Jenis katalog tidak ditemukan.",
        );
      }
      const collection = parsedCollection.data;
      const parsedBody = CatalogMutationSchemas[collection].safeParse(
        request.body,
      );
      if (!parsedBody.success) {
        throw new HttpApiError(
          400,
          "invalid_catalog_input",
          "Data katalog tidak valid.",
        );
      }
      const created = await withCatalogErrors(() =>
        options.repository.create(collection, parsedBody.data),
      );
      return reply.code(201).send({ item: toJsonSafe(created) });
    },
  );

  app.put<{ Params: { collection: string; id: string } }>(
    "/api/admin/catalog/:collection/:id",
    async (request, reply) => {
      await requireEditor(
        request.headers.authorization,
        options.adminCredentials,
      );
      const parsedCollection = CatalogCollectionSchema.safeParse(
        request.params.collection,
      );
      const parsedId = idSchema.safeParse(request.params.id);
      if (!parsedCollection.success || !parsedId.success) {
        throw new HttpApiError(
          404,
          "catalog_record_not_found",
          "Data katalog tidak ditemukan.",
        );
      }
      const collection = parsedCollection.data;
      const parsedBody = CatalogMutationSchemas[collection].safeParse(
        request.body,
      );
      if (!parsedBody.success) {
        throw new HttpApiError(
          400,
          "invalid_catalog_input",
          "Data katalog tidak valid.",
        );
      }
      const updated = await withCatalogErrors(() =>
        options.repository.update(collection, parsedId.data, parsedBody.data),
      );
      return reply.send({ item: toJsonSafe(updated) });
    },
  );

  app.delete<{ Params: { collection: string; id: string } }>(
    "/api/admin/catalog/:collection/:id",
    async (request, reply) => {
      await requireEditor(
        request.headers.authorization,
        options.adminCredentials,
      );
      const parsedCollection = CatalogCollectionSchema.safeParse(
        request.params.collection,
      );
      const parsedId = idSchema.safeParse(request.params.id);
      if (!parsedCollection.success || !parsedId.success) {
        throw new HttpApiError(
          404,
          "catalog_record_not_found",
          "Data katalog tidak ditemukan.",
        );
      }
      await withCatalogErrors(() =>
        options.repository.archive(parsedCollection.data, parsedId.data),
      );
      return reply.code(204).send();
    },
  );
};
