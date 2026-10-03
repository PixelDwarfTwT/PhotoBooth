import type { PrismaClient } from "@photobooth/db";
import type {
  NewShareRecord,
  ShareRecord,
  ShareRepository,
} from "./share-service.js";

function toShareRecord(record: {
  id: string;
  tokenHash: string;
  deleteTokenHash: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
  createdAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  consentVersion: string;
}): ShareRecord {
  if (record.mimeType !== "image/png" && record.mimeType !== "image/jpeg") {
    throw new Error("Stored share metadata has an unsupported MIME type.");
  }
  return {
    ...record,
    mimeType: record.mimeType,
    fileSizeBytes: record.fileSizeBytes,
  };
}

export class PrismaShareRepository implements ShareRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(record: NewShareRecord): Promise<ShareRecord> {
    const created = await this.client.shareLink.create({
      data: { ...record, fileSizeBytes: BigInt(record.fileSizeBytes) },
    });
    return toShareRecord(created);
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    const found = await this.client.shareLink.findUnique({
      where: { tokenHash },
    });
    return found ? toShareRecord(found) : null;
  }

  async listForCleanup(
    now: Date,
    limit: number,
    excludedIds: readonly string[] = [],
  ): Promise<ShareRecord[]> {
    const records = await this.client.shareLink.findMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, { deletedAt: { not: null } }],
        ...(excludedIds.length > 0 ? { id: { notIn: [...excludedIds] } } : {}),
      },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    return records.map(toShareRecord);
  }

  async markDeleted(id: string, deletedAt: Date): Promise<void> {
    await this.client.shareLink.update({ where: { id }, data: { deletedAt } });
  }

  async markActive(id: string): Promise<void> {
    await this.client.shareLink.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.client.shareLink.delete({ where: { id } });
  }
}
