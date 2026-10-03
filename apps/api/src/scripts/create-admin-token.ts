import { parseArgs } from "node:util";
import { AdminRoleSchema } from "@photobooth/contracts";
import { createAdminCredential } from "../lib/admin-auth.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      email: { type: "string" },
      role: { type: "string", default: "EDITOR" },
    },
    strict: true,
  });
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide a valid administrator email with --email.");
  }
  const role = AdminRoleSchema.safeParse(values.role);
  if (!role.success) throw new Error("Role must be EDITOR or ADMINISTRATOR.");

  const { prisma } = await import("@photobooth/db");
  try {
    const credential = createAdminCredential();
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { credentialHash: credential.hash, role: role.data },
      });
    } else {
      await prisma.adminUser.create({
        data: { email, credentialHash: credential.hash, role: role.data },
      });
    }

    process.stdout.write(
      `Credential for ${email}; copy it now. The plaintext will not be shown again:\n${credential.token}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Admin credential provisioning failed.";
  process.stderr.write(`Could not provision admin credential: ${message}\n`);
  process.exitCode = 1;
});
