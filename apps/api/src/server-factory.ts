import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { loadApiEnvironment, type ApiEnvironment } from "./config/env.js";
import { mapApiError } from "./lib/api-error.js";
import { privacySafeRequestSerializer } from "./lib/request-logging.js";
import type {
  AdminCredentialRepository,
  AdminUserRepository,
} from "./lib/admin-auth.js";
import { registerAdminUserRoutes } from "./routes/admin-users.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerRemoteCameraRoutes } from "./routes/remote-camera.js";
import { registerShareRoutes } from "./routes/shares.js";
import type { CatalogRouteServices } from "./services/catalog-service.js";
import type { createShareService } from "./services/share-service.js";
import {
  RemoteCameraRegistry,
  type RemoteCameraSessionStore,
} from "./services/remote-camera-registry.js";

export interface ApiRouteServices {
  catalog: CatalogRouteServices;
  adminUsers: {
    credentialRepository: AdminCredentialRepository;
    userRepository: AdminUserRepository;
  };
  shareService: ReturnType<typeof createShareService> | null;
}

export function buildServer(
  environment: ApiEnvironment = loadApiEnvironment(),
  services?: ApiRouteServices,
  remoteCameraRegistry: RemoteCameraSessionStore = new RemoteCameraRegistry(),
) {
  const app = Fastify({
    bodyLimit: environment.shareMaxBytes,
    logger: {
      level: environment.environment === "test" ? "silent" : "info",
      serializers: {
        req: (request) =>
          privacySafeRequestSerializer(
            request as unknown as Parameters<
              typeof privacySafeRequestSerializer
            >[0],
          ),
      },
      redact: [
        "req.headers.authorization",
        "req.headers.x-share-consent-version",
      ],
    },
  });
  const stopRemoteCameraSweeper = remoteCameraRegistry.startSweeper?.();
  if (stopRemoteCameraSweeper) {
    app.addHook("onClose", async () => stopRemoteCameraSweeper());
  }

  void app.register(cors, {
    origin: environment.webOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-share-consent-version",
    ],
    maxAge: 600,
  });
  void app.register(rateLimit, { global: false });

  app.addContentTypeParser(
    ["image/png", "image/jpeg"],
    { parseAs: "buffer", bodyLimit: environment.shareMaxBytes },
    (_request, body, done) => done(null, body),
  );

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({
      error: { code: "not_found", message: "Endpoint tidak ditemukan." },
    }),
  );
  app.setErrorHandler((error, request, reply) => {
    const mapped = mapApiError(error);
    if (mapped.statusCode >= 500) {
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined;
      request.log.error(
        {
          code: mapped.body.error.code,
          errorName: error instanceof Error ? error.name : "UnknownError",
          ...(errorCode && /^[A-Z0-9_]+$/.test(errorCode)
            ? { errorCode }
            : {}),
        },
        "API request failed",
      );
    }

    return reply.status(mapped.statusCode).send(mapped.body);
  });

  void app.register(registerHealthRoute);
  void app.register(registerRemoteCameraRoutes, {
    registry: remoteCameraRegistry,
    webOrigin: environment.webOrigin,
    turn: environment.turn,
  });

  if (services) {
    void app.register(registerCatalogRoutes, {
      environment,
      ...services.catalog,
    });
    void app.register(registerAdminUserRoutes, services.adminUsers);
    void app.register(registerShareRoutes, {
      environment,
      service: services.shareService,
    });
  }

  return app;
}
