import type { CatalogCollection } from "@photobooth/contracts";
import type { AdminCredentialRepository } from "../lib/admin-auth.js";

export interface CatalogRepository {
  listPublished(
    collection: CatalogCollection,
    now: Date,
    themeSlug?: string,
  ): Promise<unknown[]>;
  listForAdmin(collection: CatalogCollection): Promise<unknown[]>;
  create(collection: CatalogCollection, input: unknown): Promise<unknown>;
  update(
    collection: CatalogCollection,
    id: string,
    input: unknown,
  ): Promise<unknown>;
  archive(collection: CatalogCollection, id: string): Promise<void>;
}

export interface CatalogRouteServices {
  repository: CatalogRepository;
  adminCredentials: AdminCredentialRepository;
}

export interface PublicationWindow {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
}

export function isThemeCurrentlyPublished(
  theme: PublicationWindow,
  now: Date,
): boolean {
  return (
    theme.status === "PUBLISHED" &&
    (!theme.startsAt || theme.startsAt.getTime() <= now.getTime()) &&
    (!theme.endsAt || theme.endsAt.getTime() > now.getTime())
  );
}
