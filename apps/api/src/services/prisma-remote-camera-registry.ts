import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@photobooth/db";
import {
  REMOTE_CAMERA_MAX_SESSIONS,
  REMOTE_CAMERA_MAX_SDP_BYTES,
  REMOTE_CAMERA_SESSION_TTL_MS,
  type RemoteCameraSession,
  type RemoteCameraSessionStore,
  type SessionDescription,
  type SessionWriteResult,
} from "./remote-camera-registry.js";

const SESSION_CAPACITY_LOCK = 72_623_859_790_382_856n;

function toSession(record: {
  sessionId: string;
  expiresAt: Date;
  offerSdp: string | null;
  answerSdp: string | null;
}): RemoteCameraSession {
  return {
    sessionId: record.sessionId,
    expiresAt: record.expiresAt,
    offer: record.offerSdp ? { type: "offer", sdp: record.offerSdp } : null,
    answer: record.answerSdp ? { type: "answer", sdp: record.answerSdp } : null,
  };
}

export class PrismaRemoteCameraRegistry implements RemoteCameraSessionStore {
  constructor(private readonly client: PrismaClient) {}

  async create(): Promise<Pick<
    RemoteCameraSession,
    "sessionId" | "expiresAt"
  > | null> {
    const now = new Date();
    return this.withCapacityLock(async (transaction) => {
      await transaction.remoteCameraSession.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      const activeSessions = await transaction.remoteCameraSession.count({
        where: { expiresAt: { gt: now } },
      });
      if (activeSessions >= REMOTE_CAMERA_MAX_SESSIONS) return null;

      const sessionId = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + REMOTE_CAMERA_SESSION_TTL_MS);
      await transaction.remoteCameraSession.create({
        data: { sessionId, expiresAt },
      });
      return { sessionId, expiresAt };
    });
  }

  async get(sessionId: string): Promise<RemoteCameraSession | null> {
    const record = await this.client.remoteCameraSession.findFirst({
      where: { sessionId, expiresAt: { gt: new Date() } },
    });
    return record ? toSession(record) : null;
  }

  async setOffer(
    sessionId: string,
    offer: SessionDescription,
  ): Promise<SessionWriteResult> {
    return this.withCapacityLock(async (transaction) => {
      const now = new Date();
      const session = await transaction.remoteCameraSession.findFirst({
        where: { sessionId, expiresAt: { gt: now } },
      });
      if (!session) return "not-found";
      if (session.offerSdp) return "conflict";
      if (
        (await this.getStoredSdpBytes(transaction, now)) +
          Buffer.byteLength(offer.sdp) >
        REMOTE_CAMERA_MAX_SDP_BYTES
      ) {
        return "capacity";
      }

      const updated = await transaction.remoteCameraSession.updateMany({
        where: { sessionId, expiresAt: { gt: now }, offerSdp: null },
        data: { offerSdp: offer.sdp },
      });
      return updated.count === 1 ? "created" : "not-found";
    });
  }

  async setAnswer(
    sessionId: string,
    answer: SessionDescription,
  ): Promise<SessionWriteResult> {
    return this.withCapacityLock(async (transaction) => {
      const now = new Date();
      const session = await transaction.remoteCameraSession.findFirst({
        where: { sessionId, expiresAt: { gt: now } },
      });
      if (!session) return "not-found";
      if (!session.offerSdp || session.answerSdp) return "conflict";
      if (
        (await this.getStoredSdpBytes(transaction, now)) +
          Buffer.byteLength(answer.sdp) >
        REMOTE_CAMERA_MAX_SDP_BYTES
      ) {
        return "capacity";
      }

      const updated = await transaction.remoteCameraSession.updateMany({
        where: {
          sessionId,
          expiresAt: { gt: now },
          offerSdp: { not: null },
          answerSdp: null,
        },
        data: { answerSdp: answer.sdp },
      });
      return updated.count === 1 ? "created" : "not-found";
    });
  }

  async close(sessionId: string): Promise<boolean> {
    const deleted = await this.client.remoteCameraSession.deleteMany({
      where: { sessionId, expiresAt: { gt: new Date() } },
    });
    return deleted.count === 1;
  }

  private async getStoredSdpBytes(
    transaction: Prisma.TransactionClient,
    now: Date,
  ): Promise<number> {
    const [result] = await transaction.$queryRaw<
      Array<{ total: bigint | number }>
    >(Prisma.sql`
      SELECT COALESCE(
        SUM(
          COALESCE(OCTET_LENGTH("offer_sdp"), 0) +
          COALESCE(OCTET_LENGTH("answer_sdp"), 0)
        ),
        0
      )::bigint AS total
      FROM "remote_camera_sessions"
      WHERE "expires_at" > ${now}
    `);
    return Number(result?.total ?? 0);
  }

  private async withCapacityLock<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`
          SELECT 1 AS locked
          FROM (
            SELECT pg_advisory_xact_lock(${SESSION_CAPACITY_LOCK})
          ) AS advisory_lock
        `,
      );
      return operation(transaction);
    });
  }
}
