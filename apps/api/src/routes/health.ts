import type { FastifyInstance } from "fastify";
import {
  HealthResponseSchema,
  type HealthResponse,
} from "@photobooth/contracts";

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>("/api/health", async () =>
    HealthResponseSchema.parse({
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );
}
