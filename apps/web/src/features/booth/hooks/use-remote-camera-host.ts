"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN } from "@/lib/api-origin";
import {
  canUseRemoteCameraHost,
  readRemoteCameraDescription,
  readRemoteCameraSessionInfo,
} from "../lib/remote-camera";

export type RemoteCameraHostState =
  "idle" | "starting" | "waiting" | "connecting" | "connected" | "error";

export interface RemoteCameraHostController {
  state: RemoteCameraHostState;
  stream: MediaStream | null;
  qrCodeUrl: string | null;
  phoneUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

const SESSION_ENDPOINT = "/api/remote-camera/sessions";
const SIGNAL_POLL_INTERVAL_MS = 650;
const MAX_SIGNAL_WAIT_MS = 3 * 60_000;
const MAX_ICE_GATHERING_MS = 15_000;

function abortError(): DOMException {
  return new DOMException("Pairing kamera dihentikan.", "AbortError");
}

function waitForIceGathering(
  peerConnection: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Persiapan koneksi kamera terlalu lama. Coba sambungkan ulang.",
        ),
      );
    }, MAX_ICE_GATHERING_MS);

    function cleanup() {
      window.clearTimeout(timer);
      peerConnection.removeEventListener(
        "icegatheringstatechange",
        onGatheringChange,
      );
      signal.removeEventListener("abort", onAbort);
    }

    function onGatheringChange() {
      if (peerConnection.iceGatheringState !== "complete") return;
      cleanup();
      resolve();
    }

    function onAbort() {
      cleanup();
      reject(abortError());
    }

    if (signal.aborted) {
      onAbort();
      return;
    }
    peerConnection.addEventListener(
      "icegatheringstatechange",
      onGatheringChange,
    );
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForPollInterval(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, SIGNAL_POLL_INTERVAL_MS);
    function onAbort() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (typeof payload.error?.message === "string") {
      return payload.error.message;
    }
  } catch {
    // Keep a stable local message when the server returns a non-JSON response.
  }
  return "Koneksi kamera tidak tersedia. Coba buat QR baru.";
}

async function pollForAnswer(
  endpoint: string,
  signal: AbortSignal,
): Promise<{ type: "answer"; sdp: string }> {
  const deadline = Date.now() + MAX_SIGNAL_WAIT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) throw abortError();
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal,
    });
    if (response.status === 200) {
      const description = readRemoteCameraDescription(
        await response.json(),
        "answer",
      );
      if (!description) {
        throw new Error("Jawaban koneksi dari ponsel tidak valid.");
      }
      return description;
    }
    if (response.status !== 204) throw new Error(await readApiError(response));
    await waitForPollInterval(signal);
  }
  throw new Error("Kode QR kedaluwarsa. Buat QR baru dari booth.");
}

async function deletePairing(sessionId: string): Promise<void> {
  if (!API_ORIGIN) return;
  await fetch(`${API_ORIGIN}${SESSION_ENDPOINT}/${sessionId}`, {
    method: "DELETE",
    cache: "no-store",
  }).catch(() => undefined);
}

export function useRemoteCameraHost(): RemoteCameraHostController {
  const [state, setState] = useState<RemoteCameraHostState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [phoneUrl, setPhoneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sessionId) void deletePairing(sessionId);
    setStream(null);
    setQrCodeUrl(null);
    setPhoneUrl(null);
    setError(null);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (controllerRef.current) return;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    const previousSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (previousSessionId) void deletePairing(previousSessionId);
    setStream(null);
    if (!API_ORIGIN) {
      setState("error");
      setError("API pairing kamera belum dikonfigurasi.");
      return;
    }
    const available = canUseRemoteCameraHost({
      secureContext: window.isSecureContext,
      mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
      peerConnectionAvailable: typeof RTCPeerConnection !== "undefined",
      hostname: window.location.hostname,
    });
    if (!available) {
      setState("error");
      setError(
        "Kamera HP perlu dibuka dari alamat HTTPS yang dapat diakses kedua perangkat. Link localhost hanya berlaku di komputer ini.",
      );
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState("starting");
    setError(null);
    setStream(null);
    setQrCodeUrl(null);
    setPhoneUrl(null);

    let peerConnection: RTCPeerConnection | null = null;
    try {
      const createResponse = await fetch(`${API_ORIGIN}${SESSION_ENDPOINT}`, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!createResponse.ok) {
        throw new Error(await readApiError(createResponse));
      }
      const session = readRemoteCameraSessionInfo(
        await createResponse.json(),
        window.location.origin,
      );
      if (!session) {
        throw new Error(
          "Tautan pairing tidak sesuai dengan alamat web ini. Periksa WEB_ORIGIN pada API.",
        );
      }
      sessionIdRef.current = session.sessionId;
      setQrCodeUrl(session.qrCodeDataUrl);
      setPhoneUrl(session.phoneUrl);

      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = peerConnection;
      peerConnection.addTransceiver("video", { direction: "recvonly" });
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        setStream(remoteStream);
        event.track.addEventListener(
          "ended",
          () => {
            if (!mountedRef.current) return;
            setStream(null);
            setState("error");
            setError(
              "Kamera ponsel terputus. Buat pairing baru untuk melanjutkan.",
            );
          },
          { once: true },
        );
        if (peerConnection?.connectionState === "connected") {
          setState("connected");
        }
      };
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection?.connectionState === "connected") {
          setState("connected");
          setError(null);
        } else if (peerConnection?.connectionState === "failed") {
          peerConnection.close();
          if (peerConnectionRef.current === peerConnection) {
            peerConnectionRef.current = null;
          }
          setStream(null);
          setState("error");
          setError(
            "Ponsel dan booth tidak dapat tersambung langsung. Coba jaringan Wi-Fi lain atau buka booth melalui HTTPS.",
          );
          const failedSessionId = sessionIdRef.current;
          sessionIdRef.current = null;
          if (failedSessionId) void deletePairing(failedSessionId);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGathering(peerConnection, controller.signal);
      const localOffer = readRemoteCameraDescription(
        peerConnection.localDescription,
        "offer",
      );
      if (!localOffer)
        throw new Error("Browser gagal menyiapkan kamera booth.");

      const offerResponse = await fetch(
        `${API_ORIGIN}${SESSION_ENDPOINT}/${session.sessionId}/offer`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localOffer),
          signal: controller.signal,
        },
      );
      if (!offerResponse.ok) throw new Error(await readApiError(offerResponse));

      setState("waiting");
      const answer = await pollForAnswer(
        `${API_ORIGIN}${SESSION_ENDPOINT}/${session.sessionId}/answer`,
        controller.signal,
      );
      await peerConnection.setRemoteDescription(answer);
      if (peerConnection.connectionState === "connected") {
        setState("connected");
      } else {
        setState("connecting");
      }
    } catch (startError) {
      if (!(
        startError instanceof DOMException && startError.name === "AbortError"
      )) {
        if (mountedRef.current) {
          setState("error");
          setError(
            startError instanceof Error
              ? startError.message
              : "Kamera HP gagal tersambung. Coba lagi.",
          );
        }
      }
      peerConnection?.close();
      if (peerConnectionRef.current === peerConnection) {
        peerConnectionRef.current = null;
      }
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) void deletePairing(sessionId);
      setQrCodeUrl(null);
      setPhoneUrl(null);
      setStream(null);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      peerConnectionRef.current?.close();
      if (sessionIdRef.current) void deletePairing(sessionIdRef.current);
      controllerRef.current = null;
      peerConnectionRef.current = null;
      sessionIdRef.current = null;
    };
  }, []);

  return { state, stream, qrCodeUrl, phoneUrl, error, start, stop };
}
