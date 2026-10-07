import { randomBytes } from "node:crypto";

const SESSION_TTL_MS = 5 * 60_000;
const SESSION_SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_MAX_SESSIONS = 256;
const DEFAULT_MAX_SDP_BYTES = 4 * 1024 * 1024;

export interface SessionDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface RemoteCameraSession {
  sessionId: string;
  expiresAt: Date;
  offer: SessionDescription | null;
  answer: SessionDescription | null;
}

export type SessionWriteResult =
  "created" | "conflict" | "not-found" | "capacity";

interface RegistryOptions {
  now?: () => number;
  maxSessions?: number;
  maxSdpBytes?: number;
}

function copyDescription(
  description: SessionDescription | null,
): SessionDescription | null {
  return description ? { ...description } : null;
}

export class RemoteCameraRegistry {
  private readonly sessions = new Map<string, RemoteCameraSession>();
  private readonly now: () => number;
  private readonly maxSessions: number;
  private readonly maxSdpBytes: number;

  constructor(options: RegistryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxSessions = Math.max(1, options.maxSessions ?? DEFAULT_MAX_SESSIONS);
    this.maxSdpBytes = Math.max(
      1,
      options.maxSdpBytes ?? DEFAULT_MAX_SDP_BYTES,
    );
  }

  create(): Pick<RemoteCameraSession, "sessionId" | "expiresAt"> | null {
    this.deleteExpired();
    if (this.sessions.size >= this.maxSessions) return null;
    let sessionId: string;
    do {
      sessionId = randomBytes(32).toString("base64url");
    } while (this.sessions.has(sessionId));

    const expiresAt = new Date(this.now() + SESSION_TTL_MS);
    this.sessions.set(sessionId, {
      sessionId,
      expiresAt,
      offer: null,
      answer: null,
    });
    return { sessionId, expiresAt: new Date(expiresAt) };
  }

  get(sessionId: string): RemoteCameraSession | null {
    const session = this.getActive(sessionId);
    return session
      ? {
          sessionId: session.sessionId,
          expiresAt: new Date(session.expiresAt),
          offer: copyDescription(session.offer),
          answer: copyDescription(session.answer),
        }
      : null;
  }

  setOffer(sessionId: string, offer: SessionDescription): SessionWriteResult {
    const session = this.getActive(sessionId);
    if (!session) return "not-found";
    if (session.offer) return "conflict";
    if (!this.hasSdpCapacity(offer.sdp)) return "capacity";
    session.offer = { ...offer };
    return "created";
  }

  setAnswer(sessionId: string, answer: SessionDescription): SessionWriteResult {
    const session = this.getActive(sessionId);
    if (!session) return "not-found";
    if (!session.offer || session.answer) return "conflict";
    if (!this.hasSdpCapacity(answer.sdp)) return "capacity";
    session.answer = { ...answer };
    return "created";
  }

  close(sessionId: string): boolean {
    this.getActive(sessionId);
    return this.sessions.delete(sessionId);
  }

  sweepExpired(): void {
    this.deleteExpired();
  }

  startSweeper(intervalMs = SESSION_SWEEP_INTERVAL_MS): () => void {
    const timer = setInterval(() => this.deleteExpired(), intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  private getActive(sessionId: string): RemoteCameraSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt.getTime() <= this.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  private deleteExpired(): void {
    const now = this.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) this.sessions.delete(sessionId);
    }
  }

  private hasSdpCapacity(nextSdp: string): boolean {
    let storedBytes = 0;
    for (const session of this.sessions.values()) {
      if (session.offer) storedBytes += Buffer.byteLength(session.offer.sdp);
      if (session.answer) storedBytes += Buffer.byteLength(session.answer.sdp);
    }
    return storedBytes + Buffer.byteLength(nextSdp) <= this.maxSdpBytes;
  }
}
