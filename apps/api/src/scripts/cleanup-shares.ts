import { loadApiEnvironment } from "../config/env.js";
import { createShareService } from "../services/share-service.js";
import { PrismaShareRepository } from "../services/prisma-share-repository.js";
import { S3ObjectStore } from "../services/s3-object-store.js";

async function main(): Promise<void> {
  const environment = loadApiEnvironment();
  if (!environment.databaseUrl) {
    throw new Error("DATABASE_URL is required to clean up cloud shares.");
  }
  if (!environment.s3) {
    throw new Error(
      "S3 settings are required to clean up cloud shares safely.",
    );
  }

  const { prisma } = await import("@photobooth/db");
  const objectStore = new S3ObjectStore(environment.s3);
  try {
    await prisma.$connect();
    const service = createShareService({
      repository: new PrismaShareRepository(prisma),
      objectStore,
      consentVersion: environment.consentVersion,
      maxBytes: environment.shareMaxBytes,
      ttlHours: environment.shareTtlHours,
    });
    const result = await service.cleanupExpired();
    process.stdout.write(
      `Expired or revoked shares removed: ${result.removed}; pending retry: ${result.retriable}.\n`,
    );
    if (result.retriable > 0) process.exitCode = 1;
  } finally {
    await objectStore.close();
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Share cleanup failed.";
  process.stderr.write(`Share cleanup failed: ${message}\n`);
  process.exitCode = 1;
});
