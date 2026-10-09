const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface RemoteCameraHostCapabilities {
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  peerConnectionAvailable: boolean;
  hostname: string;
}

export interface RemoteCameraSessionInfo {
  sessionId: string;
  expiresAt: string;
  phoneUrl: string;
  qrCodeDataUrl: string | null;
}

export interface RemoteCameraIceConfiguration {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
}

export interface RemoteCameraDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface RemoteCameraOffer {
  type: "offer";
  sdp: string;
}

export interface RemoteCameraAnswer {
  type: "answer";
  sdp: string;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".localhost")
  );
}

export function canUseRemoteCameraHost(
  capabilities: RemoteCameraHostCapabilities,
): boolean {
  return (
    capabilities.secureContext &&
    capabilities.mediaDevicesAvailable &&
    capabilities.peerConnectionAvailable &&
    !isLoopbackHostname(capabilities.hostname)
  );
}

export function preferRemoteCameraStream<T>(
  remoteStream: T | null,
  localStream: T | null,
): T | null {
  return remoteStream ?? localStream;
}

export function isRemoteCameraSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function isTerminalRemoteCameraStatus(status: number): boolean {
  return status === 404 || status === 409;
}

export function shouldKeepRemoteCameraOnDismiss(
  state: "idle" | "starting" | "waiting" | "connecting" | "connected" | "error",
): boolean {
  return state === "connected";
}

export function getPhoneCameraErrorMessage(error: unknown): string {
  const candidate =
    error && typeof error === "object"
      ? (error as { name?: unknown; message?: unknown })
      : null;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Kamera tidak ditemukan. Periksa kamera ponsel lalu coba lagi.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
  }
  return typeof candidate?.message === "string"
    ? candidate.message
    : "Kamera ponsel gagal tersambung. Coba lagi.";
}

export function readRemoteCameraDescription(
  value: unknown,
  expectedType: "offer",
): RemoteCameraOffer | null;
export function readRemoteCameraDescription(
  value: unknown,
  expectedType: "answer",
): RemoteCameraAnswer | null;
export function readRemoteCameraDescription(
  value: unknown,
  expectedType: "offer" | "answer",
): RemoteCameraDescription | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.type !== expectedType ||
    typeof candidate.sdp !== "string" ||
    candidate.sdp.length < 1 ||
    candidate.sdp.length > 20 * 1024
  ) {
    return null;
  }
  return { type: expectedType, sdp: candidate.sdp };
}

export function readRemoteCameraIceConfiguration(
  value: unknown,
): RemoteCameraIceConfiguration | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.turnConfigured !== "boolean" ||
    !Array.isArray(candidate.iceServers) ||
    candidate.iceServers.length < 1 ||
    candidate.iceServers.length > 8
  ) {
    return null;
  }

  const iceServers: RTCIceServer[] = [];
  let hasTurnServer = false;
  for (const item of candidate.iceServers) {
    if (!item || typeof item !== "object") return null;
    const entry = item as Record<string, unknown>;
    const urls =
      typeof entry.urls === "string"
        ? [entry.urls]
        : Array.isArray(entry.urls) &&
            entry.urls.length > 0 &&
            entry.urls.length <= 4 &&
            entry.urls.every((url) => typeof url === "string")
          ? (entry.urls as string[])
          : null;
    if (
      !urls ||
      urls.some(
        (url) =>
          url.length > 512 ||
          !/^(stun|stuns|turn|turns):[^\s,]+$/i.test(url),
      )
    ) {
      return null;
    }

    const usesTurn = urls.some((url) => /^turns?:/i.test(url));
    if (usesTurn) {
      hasTurnServer = true;
      if (
        typeof entry.username !== "string" ||
        entry.username.length < 1 ||
        entry.username.length > 256 ||
        typeof entry.credential !== "string" ||
        entry.credential.length < 1 ||
        entry.credential.length > 512
      ) {
        return null;
      }
      iceServers.push({
        urls,
        username: entry.username,
        credential: entry.credential,
      });
    } else {
      if (entry.username !== undefined || entry.credential !== undefined) {
        return null;
      }
      iceServers.push({ urls });
    }
  }

  if (candidate.turnConfigured !== hasTurnServer) return null;
  return { iceServers, turnConfigured: candidate.turnConfigured };
}

export function readRemoteCameraSessionInfo(
  value: unknown,
  expectedOrigin?: string,
): RemoteCameraSessionInfo | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    !isRemoteCameraSessionId(candidate.sessionId) ||
    typeof candidate.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.expiresAt)) ||
    typeof candidate.phoneUrl !== "string" ||
    (candidate.qrCodeDataUrl !== null &&
      (typeof candidate.qrCodeDataUrl !== "string" ||
        candidate.qrCodeDataUrl.length > 100_000 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(
          candidate.qrCodeDataUrl,
        )))
  ) {
    return null;
  }

  try {
    const phoneUrl = new URL(candidate.phoneUrl);
    const expectedPath = `/remote-camera/${candidate.sessionId}`;
    if (
      !["http:", "https:"].includes(phoneUrl.protocol) ||
      phoneUrl.username ||
      phoneUrl.password ||
      phoneUrl.pathname !== expectedPath ||
      phoneUrl.search ||
      phoneUrl.hash ||
      (expectedOrigin && phoneUrl.origin !== expectedOrigin)
    ) {
      return null;
    }
    return {
      sessionId: candidate.sessionId,
      expiresAt: candidate.expiresAt,
      phoneUrl: phoneUrl.toString(),
      qrCodeDataUrl: candidate.qrCodeDataUrl,
    };
  } catch {
    return null;
  }
}
