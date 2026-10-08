import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { createApiApp } from "../src/bootstrap.js";

const INTERNAL_PATH_PARAMETER = "__vercel_api_path";
let appPromise: Promise<FastifyInstance> | undefined;

function getApiApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = createApiApp()
      .then(async (app) => {
        await app.ready();
        return app;
      })
      .catch((error: unknown) => {
        appPromise = undefined;
        const errorCode =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : undefined;
        console.error("API function initialization failed.", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          ...(errorCode && /^[A-Z0-9_]+$/.test(errorCode)
            ? { errorCode }
            : {}),
        });
        throw error;
      });
  }

  return appPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
): Promise<void> {
  const forwardedUrl = new URL(request.url ?? "/", "http://vercel.local");
  const apiPath = forwardedUrl.searchParams.get(INTERNAL_PATH_PARAMETER);
  if (!apiPath || !(apiPath === "/api" || apiPath.startsWith("/api/"))) {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: { code: "invalid_api_path", message: "Path API tidak valid." },
      }),
    );
    return;
  }

  forwardedUrl.searchParams.delete(INTERNAL_PATH_PARAMETER);
  request.url = `${apiPath}${forwardedUrl.search}`;

  const app = await getApiApp();
  app.server.emit("request", request, response);
}
