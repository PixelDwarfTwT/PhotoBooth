import QRCode from "qrcode";
import { ApiCapabilitiesSchema } from "@photobooth/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ApiEnvironment } from "../config/env.js";
import { HttpApiError } from "../lib/api-error.js";
import type { createShareService } from "../services/share-service.js";

interface ShareRouteOptions {
  environment: ApiEnvironment;
  service: ReturnType<typeof createShareService> | null;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readDeleteToken(
  authorization: string | undefined,
): string | undefined {
  return authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
}

export const registerShareRoutes: FastifyPluginAsync<
  ShareRouteOptions
> = async (app, { environment, service }) => {
  app.get("/api/capabilities", async (_request, reply) => {
    const capabilities = ApiCapabilitiesSchema.parse({
      cloudSharingEnabled: Boolean(service),
      consentVersion: environment.consentVersion,
      shareTtlHours: environment.shareTtlHours,
      shareMaxBytes: environment.shareMaxBytes,
    });
    return reply
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
      .send(capabilities);
  });

  app.post(
    "/api/share",
    {
      config: {
        rateLimit: {
          max: environment.shareRateLimitMax,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      if (!service) {
        throw new HttpApiError(
          503,
          "cloud_sharing_unavailable",
          "Penyimpanan cloud belum tersedia. Unduh hasil ke perangkat ini.",
        );
      }

      if (!Buffer.isBuffer(request.body)) {
        throw new HttpApiError(
          400,
          "invalid_upload_body",
          "Berkas gambar tidak dapat dibaca.",
        );
      }
      const created = await service.create({
        body: request.body,
        mimeType: headerValue(request.headers["content-type"]),
        consentVersion: headerValue(request.headers["x-share-consent-version"]),
      });
      const shareUrl = new URL(
        `/share/${created.token}`,
        environment.webOrigin,
      ).toString();
      let qrCodeDataUrl: string | null = null;
      try {
        qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
        });
      } catch {
        // The read URL remains usable if QR rendering is unavailable.
      }

      return reply.code(201).header("Cache-Control", "no-store").send({
        shareUrl,
        qrCodeDataUrl,
        deleteToken: created.deleteToken,
        expiresAt: created.expiresAt.toISOString(),
        mimeType: created.mimeType,
        fileSizeBytes: created.fileSizeBytes,
      });
    },
  );

  app.get<{ Params: { token: string } }>(
    "/api/share/:token",
    async (request, reply) => {
      reply
        .header("Cache-Control", "private, no-store")
        .header("Referrer-Policy", "no-referrer")
        .header("X-Robots-Tag", "noindex, nofollow, noarchive");
      if (!service) {
        throw new HttpApiError(
          503,
          "cloud_sharing_unavailable",
          "Tautan berbagi tidak tersedia.",
        );
      }
      const share = await service.read(request.params.token);
      if (!share) {
        throw new HttpApiError(
          404,
          "share_not_found",
          "Tautan ini sudah kedaluwarsa atau dihapus.",
        );
      }

      return reply
        .header("Content-Type", share.record.mimeType)
        .header("Content-Length", Number(share.record.fileSizeBytes))
        .header("Content-Disposition", "inline; filename=photobooth-share")
        .header("Cache-Control", "private, no-store")
        .header("Pragma", "no-cache")
        .header("Referrer-Policy", "no-referrer")
        .header("X-Robots-Tag", "noindex, nofollow, noarchive")
        .header("X-Share-Expires-At", share.record.expiresAt.toISOString())
        .header("X-Content-Type-Options", "nosniff")
        .header("X-Frame-Options", "DENY")
        .send(share.body);
    },
  );

  app.delete<{ Params: { token: string } }>(
    "/api/share/:token",
    async (request, reply) => {
      if (!service) {
        throw new HttpApiError(
          503,
          "cloud_sharing_unavailable",
          "Tautan berbagi tidak tersedia.",
        );
      }
      const deleteToken = readDeleteToken(request.headers.authorization);
      if (!deleteToken) {
        throw new HttpApiError(
          401,
          "share_delete_token_required",
          "Token penghapusan diperlukan.",
        );
      }
      await service.revoke(request.params.token, deleteToken);
      return reply.code(204).send();
    },
  );
};
