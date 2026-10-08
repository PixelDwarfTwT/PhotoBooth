import type { FastifyInstance } from "fastify";
import { buildServer } from "./server-factory.js";
import { loadApiEnvironment, type ApiEnvironment } from "./config/env.js";
import {
  PrismaAdminCredentialRepository,
  PrismaCatalogRepository,
} from "./services/prisma-catalog-repository.js";
import { PrismaRemoteCameraRegistry } from "./services/prisma-remote-camera-registry.js";
import { PrismaShareRepository } from "./services/prisma-share-repository.js";
import { S3ObjectStore } from "./services/s3-object-store.js";
import { createShareService } from "./services/share-service.js";

export async function createApiApp(
  environment: ApiEnvironment = loadApiEnvironment(),
): Promise<FastifyInstance> {
  if (!environment.databaseUrl) {
    throw new Error("DATABASE_URL is required to start the API.");
  }

  const { prisma } = await import("@photobooth/db");
  let objectStore: S3ObjectStore | null = null;

  try {
    const adminRepository = new PrismaAdminCredentialRepository(prisma);
    objectStore = environment.s3 ? new S3ObjectStore(environment.s3) : null;
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
    const closeResources = async () => {
      if (resourcesClosed) return;
      resourcesClosed = true;
      try {
        await objectStore?.close();
      } finally {
        await prisma.$disconnect();
      }
    };

    const app = buildServer(
      environment,
      {
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
      },
      new PrismaRemoteCameraRegistry(prisma),
    );
    app.addHook("onClose", closeResources);
    return app;
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
    console.error("API startup failed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(errorCode && /^[A-Z0-9_]+$/.test(errorCode) ? { errorCode } : {}),
    });
    await objectStore?.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    throw error;
  }
}
