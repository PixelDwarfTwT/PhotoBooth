import Fastify from "fastify";
import { registerHealthRoute } from "./routes/health.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  void app.register(registerHealthRoute);

  return app;
}
