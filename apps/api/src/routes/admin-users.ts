import { AdminRoleSchema } from "@photobooth/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticateBearerToken,
  createAdminCredential,
} from "../lib/admin-auth.js";
import type {
  AdminCredentialRepository,
  AdminUserRepository,
} from "../lib/admin-auth.js";
import { HttpApiError } from "../lib/api-error.js";

interface AdminUserRouteOptions {
  credentialRepository: AdminCredentialRepository;
  userRepository: AdminUserRepository;
}

const newAdminSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    role: AdminRoleSchema.default("EDITOR"),
  })
  .strict();
const userIdSchema = z.uuid();

async function requireAdministrator(
  authorization: string | undefined,
  repository: AdminCredentialRepository,
) {
  const identity = await authenticateBearerToken(authorization, repository);
  if (!identity) {
    throw new HttpApiError(
      401,
      "admin_auth_required",
      "Autentikasi administrator diperlukan.",
    );
  }
  if (identity.role !== "ADMINISTRATOR") {
    throw new HttpApiError(
      403,
      "admin_role_required",
      "Tindakan ini memerlukan peran administrator.",
    );
  }
  return identity;
}

export const registerAdminUserRoutes: FastifyPluginAsync<
  AdminUserRouteOptions
> = async (app, { credentialRepository, userRepository }) => {
  app.get("/api/admin/users", async (request, reply) => {
    await requireAdministrator(
      request.headers.authorization,
      credentialRepository,
    );
    return reply.send({ users: await userRepository.list() });
  });

  app.post("/api/admin/users", async (request, reply) => {
    await requireAdministrator(
      request.headers.authorization,
      credentialRepository,
    );
    const parsed = newAdminSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpApiError(
        400,
        "invalid_admin_user",
        "Data administrator tidak valid.",
      );
    }

    const credential = createAdminCredential();
    try {
      const user = await userRepository.create(
        parsed.data.email,
        parsed.data.role,
        credential.hash,
      );
      return reply.code(201).send({ user, token: credential.token });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new HttpApiError(
          409,
          "admin_email_in_use",
          "Email administrator sudah digunakan.",
        );
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/admin/users/:id/rotate-token",
    async (request, reply) => {
      await requireAdministrator(
        request.headers.authorization,
        credentialRepository,
      );
      const id = userIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new HttpApiError(
          404,
          "admin_user_not_found",
          "Administrator tidak ditemukan.",
        );
      }
      const user = await userRepository.findById(id.data);
      if (!user) {
        throw new HttpApiError(
          404,
          "admin_user_not_found",
          "Administrator tidak ditemukan.",
        );
      }
      const credential = createAdminCredential();
      await userRepository.rotateCredential(id.data, credential.hash);
      return reply.send({ user, token: credential.token });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/admin/users/:id",
    async (request, reply) => {
      const identity = await requireAdministrator(
        request.headers.authorization,
        credentialRepository,
      );
      const id = userIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new HttpApiError(
          404,
          "admin_user_not_found",
          "Administrator tidak ditemukan.",
        );
      }
      const result = await userRepository.deleteIfAllowed(id.data, identity.id);
      if (result === "self") {
        throw new HttpApiError(
          409,
          "cannot_remove_self",
          "Anda tidak dapat menghapus kredensial aktif.",
        );
      }
      if (result === "last-administrator") {
        throw new HttpApiError(
          409,
          "last_administrator",
          "Minimal satu administrator harus tetap aktif.",
        );
      }
      if (result === "not-found") {
        throw new HttpApiError(
          404,
          "admin_user_not_found",
          "Administrator tidak ditemukan.",
        );
      }
      return reply.code(204).send();
    },
  );
};
