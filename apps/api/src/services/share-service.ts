import { randomBytes, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { HttpApiError } from "../lib/api-error.js";
import { sha256Token } from "../lib/admin-auth.js";
import { validateShareUpload } from "./share-validation.js";

export interface ShareRecord {
  id: string;
  tokenHash: string;
  deleteTokenHash: string;
  storageKey: string;
  mimeType: "image/png" | "image/jpeg";
  fileSizeBytes: bigint | number;
  createdAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  consentVersion: string;
}

export type NewShareRecord = Omit<ShareRecord, "id">;

export interface ShareRepository {
  create(record: NewShareRecord): Promise<ShareRecord>;
  findByTokenHash(tokenHash: string): Promise<ShareRecord | null>;
  listForCleanup(
    now: Date,
    limit: number,
    excludedIds?: readonly string[],
  ): Promise<ShareRecord[]>;
  markActive(id: string): Promise<void>;
  markDeleted(id: string, deletedAt: Date): Promise<void>;
  deleteById(id: string): Promise<void>;
}

export interface PrivateObjectStore {
  putObject(key: string, body: Uint8Array, mimeType: string): Promise<void>;
  getObject(key: string): Promise<Buffer | Readable | null>;
  deleteObject(key: string): Promise<void>;
}

export interface ShareServiceOptions {
  repository: ShareRepository;
  objectStore: PrivateObjectStore;
  consentVersion: string;
  maxBytes: number;
  ttlHours: number;
  now?: () => Date;
}

export interface ShareCreateInput {
  body: Uint8Array;
  mimeType: string | undefined;
  consentVersion: string | undefined;
}

export interface CreatedShare {
  token: string;
  deleteToken: string;
  expiresAt: Date;
  mimeType: "image/png" | "image/jpeg";
  fileSizeBytes: number;
}

const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createShareService(options: ShareServiceOptions) {
  const now = options.now ?? (() => new Date());

  return {
    async create(input: ShareCreateInput): Promise<CreatedShare> {
      const validated = validateShareUpload({
        body: input.body,
        mimeType: input.mimeType,
        consentVersion: input.consentVersion,
        expectedConsentVersion: options.consentVersion,
        maxBytes: options.maxBytes,
      });
      const token = createToken();
      const deleteToken = createToken();
      const storageKey = `shares/${randomUUID()}`;
      const createdAt = now();
      const expiresAt = new Date(
        createdAt.getTime() + options.ttlHours * 60 * 60 * 1000,
      );

      const record = await options.repository.create({
        tokenHash: sha256Token(token),
        deleteTokenHash: sha256Token(deleteToken),
        storageKey,
        mimeType: validated.mimeType,
        fileSizeBytes: validated.fileSizeBytes,
        createdAt,
        expiresAt,
        // Reserve a cleanup-visible tombstone until the object upload commits.
        deletedAt: createdAt,
        consentVersion: options.consentVersion,
      });

      await options.objectStore.putObject(
        storageKey,
        input.body,
        validated.mimeType,
      );
      try {
        await options.repository.markActive(record.id);
      } catch (error) {
        await options.repository
          .markDeleted(record.id, now())
          .catch(() => undefined);
        await options.objectStore
          .deleteObject(storageKey)
          .catch(() => undefined);
        throw error;
      }

      return {
        token,
        deleteToken,
        expiresAt,
        mimeType: validated.mimeType,
        fileSizeBytes: validated.fileSizeBytes,
      };
    },

    async read(
      token: string,
    ): Promise<{ record: ShareRecord; body: Buffer | Readable } | null> {
      if (!shareTokenPattern.test(token)) return null;
      const record = await options.repository.findByTokenHash(
        sha256Token(token),
      );
      const currentTime = now();
      if (
        !record ||
        record.deletedAt ||
        record.expiresAt.getTime() <= currentTime.getTime()
      ) {
        return null;
      }

      const body = await options.objectStore.getObject(record.storageKey);
      return body ? { record, body } : null;
    },

    async revoke(token: string, deleteToken: string): Promise<void> {
      if (
        !shareTokenPattern.test(token) ||
        !shareTokenPattern.test(deleteToken)
      ) {
        throw new HttpApiError(
          404,
          "share_not_found",
          "Tautan berbagi tidak tersedia.",
        );
      }
      const record = await options.repository.findByTokenHash(
        sha256Token(token),
      );
      if (!record || record.deletedAt) {
        throw new HttpApiError(
          404,
          "share_not_found",
          "Tautan berbagi tidak tersedia.",
        );
      }
      if (record.deleteTokenHash !== sha256Token(deleteToken)) {
        throw new HttpApiError(
          403,
          "share_delete_forbidden",
          "Token penghapusan tidak valid.",
        );
      }

      await options.repository.markDeleted(record.id, now());
      try {
        await options.objectStore.deleteObject(record.storageKey);
      } catch {
        throw new HttpApiError(
          503,
          "share_delete_pending",
          "Tautan sudah dinonaktifkan. Proses cleanup terjadwal akan mencoba menghapus berkas kembali.",
        );
      }
    },

    async cleanupExpired(): Promise<{ removed: number; retriable: number }> {
      let removed = 0;
      let retriable = 0;
      const excludedIds: string[] = [];

      while (true) {
        const records = await options.repository.listForCleanup(
          now(),
          100,
          excludedIds,
        );
        if (records.length === 0) break;

        for (const record of records) {
          try {
            await options.objectStore.deleteObject(record.storageKey);
            await options.repository.deleteById(record.id);
            removed += 1;
          } catch {
            retriable += 1;
            excludedIds.push(record.id);
          }
        }
      }

      return { removed, retriable };
    },
  };
}
