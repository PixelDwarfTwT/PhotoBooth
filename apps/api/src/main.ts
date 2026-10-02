import type { FastifyInstance } from "fastify";
import { buildServer } from "./app.js";
import { loadApiEnvironment } from "./config/env.js";

async function startServer(): Promise<void> {
  let app: FastifyInstance | undefined;

  try {
    const environment = loadApiEnvironment();
    app = buildServer();
    await app.listen({
      host: environment.host,
      port: environment.port,
    });
  } catch (error: unknown) {
    await app?.close().catch(() => undefined);

    const message =
      error instanceof Error ? error.message : "Unexpected startup error";
    console.error("API startup failed: " + message);
    process.exitCode = 1;
  }
}

void startServer();
