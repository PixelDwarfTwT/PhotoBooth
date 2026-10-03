import type { FastifyInstance } from "fastify";
import { buildServer } from "./app.js";
import { loadApiEnvironment } from "./config/env.js";
import {
  PrismaAdminCredentialRepository,
  PrismaCatalogRepository,
} from "./services/prisma-catalog-repository.js";
import { PrismaShareRepository } from "./services/prisma-share-repository.js";
import { S3ObjectStore } from "./services/s3-object-store.js";
import { createShareService } from "./services/share-service.js";

async function startServer(): Promise<void> {
  let app: FastifyInstance | undefined;
  let closeResources: (() => Promise<void>) | undefined;

  try {
    const environment = loadApiEnvironment();
    if (!environment.databaseUrl) {
      throw new Error("DATABASE_URL is required to start the API.");
    }

    const { prisma } = await import("@photobooth/db");
    await prisma.$connect();
    const adminRepository = new PrismaAdminCredentialRepository(prisma);
    const objectStore = environment.s3
      ? new S3ObjectStore(environment.s3)
      : null;
    const shareService = objectStore
      ? createShareService({
          repository: new PrismaShareRepository(prisma),
          objectStore,
          consentVersion: environment.consentVersion,
          maxBytes: environment.shareMaxBytes,
          ttlHours: environment.shareTtlHours,
        })
      : null;

    let resourcesClosed = false;
    closeResources = async () => {
      if (resourcesClosed) return;
      resourcesClosed = true;
      try {
        await objectStore?.close();
      } finally {
        await prisma.$disconnect();
      }
    };

    app = buildServer(environment, {
      catalog: {
        repository: new PrismaCatalogRepository(
          prisma,
          environment.assetPublicBaseUrl,
        ),
        adminCredentials: adminRepository,
      },
      adminUsers: {
        credentialRepository: adminRepository,
        userRepository: adminRepository,
      },
      shareService,
    });
    app.addHook("onClose", closeResources);
    await app.listen({
      host: environment.host,
      port: environment.port,
    });
  } catch (error: unknown) {
    await app?.close().catch(() => undefined);
    await closeResources?.().catch(() => undefined);

    const message =
      error instanceof Error ? error.message : "Unexpected startup error";
    console.error("API startup failed: " + message);
    process.exitCode = 1;
  }
}

void startServer();
