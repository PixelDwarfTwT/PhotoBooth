import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import QRCode from "qrcode";
import { HttpApiError } from "../lib/api-error.js";
import {
  RemoteCameraRegistry,
  type SessionDescription,
  type SessionWriteResult,
} from "../services/remote-camera-registry.js";

const sessionIdPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionParamsSchema = z.object({
  sessionId: z.string().regex(sessionIdPattern),
});
const offerSchema = z
  .object({
    type: z.literal("offer"),
    sdp: z
      .string()
      .min(1)
      .max(20 * 1024),
  })
  .strict();
const answerSchema = z
  .object({
    type: z.literal("answer"),
    sdp: z
      .string()
      .min(1)
      .max(20 * 1024),
  })
  .strict();

interface RemoteCameraRouteOptions {
  registry: RemoteCameraRegistry;
  webOrigin: string;
}

function invalidRequest(message: string): HttpApiError {
  return new HttpApiError(400, "invalid_pairing_request", message);
}

function readSessionId(params: unknown): string {
  const parsed = sessionParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new HttpApiError(
      404,
      "pairing_not_found",
      "Sesi kamera sudah tidak tersedia. Buat QR baru dari booth.",
    );
  }
  return parsed.data.sessionId;
}

function readDescription(
  payload: unknown,
  kind: "offer" | "answer",
): SessionDescription {
  const parsed = (kind === "offer" ? offerSchema : answerSchema).safeParse(
    payload,
  );
  if (!parsed.success) {
    throw invalidRequest(
      `Deskripsi koneksi ${kind} tidak valid atau terlalu besar.`,
    );
  }
  return parsed.data;
}

function requireSession(registry: RemoteCameraRegistry, sessionId: string) {
  const session = registry.get(sessionId);
  if (!session) {
    throw new HttpApiError(
      404,
      "pairing_not_found",
      "Sesi kamera sudah kedaluwarsa atau ditutup. Buat QR baru dari booth.",
    );
  }
  return session;
}

function handleWriteResult(result: SessionWriteResult) {
  if (result === "not-found") {
    throw new HttpApiError(
      404,
      "pairing_not_found",
      "Sesi kamera sudah kedaluwarsa atau ditutup.",
    );
  }
  if (result === "conflict") {
    throw new HttpApiError(
      409,
      "pairing_already_used",
      "Sesi ini sudah dipakai. Buat pairing baru dari booth.",
    );
  }
  if (result === "capacity") {
    throw new HttpApiError(
      503,
      "pairing_capacity",
      "Sesi kamera sedang penuh. Tunggu sebentar lalu buat QR baru.",
    );
  }
}

export const registerRemoteCameraRoutes: FastifyPluginAsync<
  RemoteCameraRouteOptions
> = async (app, { registry, webOrigin }) => {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
  });

  app.post(
    "/api/remote-camera/sessions",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (request.body !== undefined && request.body !== null) {
        throw invalidRequest("Pembuatan sesi tidak menerima data tambahan.");
      }
      const session = registry.create();
      if (!session) {
        throw new HttpApiError(
          503,
          "pairing_capacity",
          "Sesi kamera sedang penuh. Tunggu sebentar lalu buat QR baru.",
        );
      }
      const phoneUrl = new URL(
        `/remote-camera/${session.sessionId}`,
        webOrigin,
      ).toString();
      let qrCodeDataUrl: string | null = null;
      try {
        qrCodeDataUrl = await QRCode.toDataURL(phoneUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
        });
      } catch {
        // The typed URL remains usable if QR encoding fails.
      }
      return reply.code(201).send({
        sessionId: session.sessionId,
        expiresAt: session.expiresAt.toISOString(),
        phoneUrl,
        qrCodeDataUrl,
      });
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/offer",
    {
      bodyLimit: 24 * 1024,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const sessionId = readSessionId(request.params);
      const offer = readDescription(request.body, "offer");
      handleWriteResult(registry.setOffer(sessionId, offer));
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/offer",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const session = requireSession(registry, readSessionId(request.params));
      if (!session.offer) return reply.code(204).send();
      return reply.send(session.offer);
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/answer",
    {
      bodyLimit: 24 * 1024,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const sessionId = readSessionId(request.params);
      const answer = readDescription(request.body, "answer");
      handleWriteResult(registry.setAnswer(sessionId, answer));
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/answer",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const session = requireSession(registry, readSessionId(request.params));
      if (!session.answer) return reply.code(204).send();
      return reply.send(session.answer);
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId",
    async (request, reply) => {
      const sessionId = readSessionId(request.params);
      if (!registry.close(sessionId)) {
        throw new HttpApiError(
          404,
          "pairing_not_found",
          "Sesi kamera sudah kedaluwarsa atau ditutup.",
        );
      }
      return reply.code(204).send();
    },
  );
};
