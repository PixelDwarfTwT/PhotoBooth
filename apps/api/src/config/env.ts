import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repositoryEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.env",
);

config({ path: repositoryEnvPath });

const ApiEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export type ApiEnvironment = {
  host: string;
  port: number;
};

export function loadApiEnvironment(): ApiEnvironment {
  const parsed = ApiEnvironmentSchema.safeParse({
    HOST: process.env["HOST"] ?? "127.0.0.1",
    PORT: process.env["PORT"] ?? "4000",
  });

  if (!parsed.success) {
    const reasons = parsed.error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join("; ");

    throw new Error("Invalid API configuration. " + reasons);
  }

  return {
    host: parsed.data.HOST,
    port: parsed.data.PORT,
  };
}
