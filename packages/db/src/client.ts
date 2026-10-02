import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "./generated/prisma/client.js";

const repositoryEnvPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);

config({ path: repositoryEnvPath });

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required before importing the @photobooth/db client.",
  );
}

const globalForPrisma = globalThis as typeof globalThis & {
  photoboothPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.photoboothPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.photoboothPrisma = prisma;
}
