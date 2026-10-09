import { createHmac } from "node:crypto";
import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import QRCode from "qrcode";
import { HttpApiError } from "../lib/api-error.js";
import type { TurnConfiguration } from "../config/env.js";
import {
  type RemoteCameraSessionStore,
  type RemoteCameraSession,
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
  registry: RemoteCameraSessionStore;
  webOrigin: string;
  turn: TurnConfiguration | null;
}

interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

function createCoturnIceServer(
  sessionId: string,
  turn: Extract<TurnConfiguration, { provider: "coturn" }>,
): IceServerEntry {
  const expiry = Math.floor(Date.now() / 1000) + turn.credentialTtlSeconds;
  const username = `${expiry}:${sessionId}`;
  const credential = createHmac("sha1", turn.sharedSecret)
    .update(username)
    .digest("base64");
  return { urls: turn.urls, username, credential };
}

const meterIceServerSchema = z
  .object({
    urls: z.union([
      z.string().min(1).max(512),
      z.array(z.string().min(1).max(512)).min(1).max(4),
    ]),
    username: z.string().max(256).optional(),
    credential: z.string().max(512).optional(),
  })
  .strict();

function readMeteredIceServers(value: unknown): IceServerEntry[] | null {
  const parsed = z.array(meterIceServerSchema).min(1).max(7).safeParse(value);
  if (!parsed.success) return null;

  let hasTurnServer = false;
  const iceServers: IceServerEntry[] = [];
  for (const entry of parsed.data) {
    const urls = typeof entry.urls === "string" ? [entry.urls] : entry.urls;
    if (urls.some((url) => !/^(stun|stuns|turn|turns):[^\s,]+$/i.test(url))) {
      return null;
    }

    const usesTurn = urls.some((url) => /^turns?:/i.test(url));
    if (usesTurn) {
      if (!entry.username || !entry.credential) return null;
      hasTurnServer = true;
      iceServers.push({
        urls: entry.urls,
        username: entry.username,
        credential: entry.credential,
      });
    } else {
      if (entry.username !== undefined || entry.credential !== undefined) {
        return null;
      }
      iceServers.push({ urls: entry.urls });
    }
  }

  return hasTurnServer ? iceServers : null;
}

async function fetchMeteredIceServers(
  turn: Extract<TurnConfiguration, { provider: "metered" }>,
): Promise<IceServerEntry[]> {
  const url = new URL(
    `/api/v1/turn/credentials`,
    `https://${turn.appName}.metered.live`,
  );
  url.searchParams.set("apiKey", turn.apiKey);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error("Metered credential request failed.");
    }
    const body = await response.text();
    if (body.length > 16 * 1024) {
      throw new Error("Metered response exceeded its size limit.");
    }
    const iceServers = readMeteredIceServers(JSON.parse(body) as unknown);
    if (!iceServers) throw new Error("Metered response was invalid.");
    return iceServers;
  } catch {
    throw new HttpApiError(
      503,
      "turn_provider_unavailable",
      "Layanan relay kamera sementara tidak tersedia. Coba buat QR baru sebentar lagi.",
    );
  }
}

async function createIceServerConfiguration(
  sessionId: string,
  turn: RemoteCameraRouteOptions["turn"],
): Promise<{ iceServers: IceServerEntry[]; turnConfigured: boolean }> {
  if (!turn) {
    return {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      turnConfigured: false,
    };
  }
  if (turn.provider === "metered") {
    return {
      iceServers: await fetchMeteredIceServers(turn),
      turnConfigured: true,
    };
  }
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      createCoturnIceServer(sessionId, turn),
    ],
    turnConfigured: true,
  };
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

async function requireSession(
  registry: RemoteCameraSessionStore,
  sessionId: string,
): Promise<RemoteCameraSession> {
  const session = await registry.get(sessionId);
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
> = async (app, { registry, webOrigin, turn }) => {
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
      const session = await registry.create();
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

  app.get<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/ice-servers",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const sessionId = readSessionId(request.params);
      await requireSession(registry, sessionId);
      return reply.send(await createIceServerConfiguration(sessionId, turn));
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
      handleWriteResult(await registry.setOffer(sessionId, offer));
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/offer",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const session = await requireSession(
        registry,
        readSessionId(request.params),
      );
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
      handleWriteResult(await registry.setAnswer(sessionId, answer));
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId/answer",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const session = await requireSession(
        registry,
        readSessionId(request.params),
      );
      if (!session.answer) return reply.code(204).send();
      return reply.send(session.answer);
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    "/api/remote-camera/sessions/:sessionId",
    async (request, reply) => {
      const sessionId = readSessionId(request.params);
      if (!(await registry.close(sessionId))) {
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
