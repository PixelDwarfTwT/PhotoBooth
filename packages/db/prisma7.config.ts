import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);

config({ path: repositoryEnvPath });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://photobooth:photobooth@localhost:5432/photobooth?schema=public",
  },
});
