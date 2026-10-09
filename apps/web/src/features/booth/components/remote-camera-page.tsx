"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN } from "@/lib/api-origin";
import {
  getPhoneCameraErrorMessage,
  isRemoteCameraSessionId,
  isTerminalRemoteCameraStatus,
  readRemoteCameraDescription,
  readRemoteCameraIceConfiguration,
} from "../lib/remote-camera";
import styles from "./remote-camera.module.css";

type PhoneCameraState =
  "idle" | "requesting" | "waiting" | "connecting" | "connected" | "error";

const SESSION_ENDPOINT = "/api/remote-camera/sessions";
const ICE_SERVERS_SUFFIX = "/ice-servers";
const POLL_INTERVAL_MS = 650;
const MAX_SIGNAL_WAIT_MS = 3 * 60_000;
const MAX_ICE_GATHERING_MS = 15_000;

class PairingUnavailableError extends Error {}

function abortError(): DOMException {
  return new DOMException("Pairing kamera dihentikan.", "AbortError");
}

function deletePairing(sessionId: string): void {
  if (API_ORIGIN === null) return;
  void fetch(`${API_ORIGIN}${SESSION_ENDPOINT}/${sessionId}`, {
    method: "DELETE",
    cache: "no-store",
  }).catch(() => undefined);
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
    }, POLL_INTERVAL_MS);
    function onAbort() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
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
      reject(new Error("Koneksi kamera terlalu lama disiapkan. Coba lagi."));
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

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (typeof payload.error?.message === "string") {
      return payload.error.message;
    }
  } catch {
    // Use a stable, user-readable error when the response is not JSON.
  }
  return "Sesi pairing tidak tersedia. Minta booth membuat QR baru.";
}

async function pollForOffer(
  endpoint: string,
  signal: AbortSignal,
): Promise<{ type: "offer"; sdp: string }> {
  const deadline = Date.now() + MAX_SIGNAL_WAIT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) throw abortError();
    const response = await fetch(endpoint, { cache: "no-store", signal });
    if (response.status === 200) {
      const offer = readRemoteCameraDescription(await response.json(), "offer");
      if (!offer)
        throw new Error("Koneksi dari booth tidak memiliki offer yang valid.");
      return offer;
    }
    if (response.status !== 204) {
      const message = await readApiError(response);
      if (isTerminalRemoteCameraStatus(response.status)) {
        throw new PairingUnavailableError(message);
      }
      throw new Error(message);
    }
    await waitForPollInterval(signal);
  }
  throw new Error("QR sudah kedaluwarsa. Minta booth membuat QR baru.");
}

export function RemoteCameraPage({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<PhoneCameraState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionUsed, setSessionUsed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (isRemoteCameraSessionId(sessionId)) deletePairing(sessionId);
    setError(null);
    setSessionUsed(true);
    setState("error");
    setError(
      "Koneksi dihentikan. Pindai QR baru dari booth untuk memulai lagi.",
    );
  }, [sessionId]);

  const connect = useCallback(async () => {
    if (controllerRef.current) return;
    if (!isRemoteCameraSessionId(sessionId)) {
      setState("error");
      setError("Tautan kamera tidak valid. Pindai QR baru dari booth.");
      return;
    }
    if (API_ORIGIN === null) {
      setState("error");
      setError("API pairing kamera belum dikonfigurasi.");
      return;
    }
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    ) {
      setState("error");
      setError(
        "Browser ini perlu mendukung kamera dan WebRTC melalui alamat HTTPS.",
      );
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState("requesting");
    setError(null);

    let localStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    let turnConfigured = false;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (controller.signal.aborted) throw abortError();
      streamRef.current = localStream;
      setStream(localStream);

      const iceResponse = await fetch(
        `${API_ORIGIN}${SESSION_ENDPOINT}/${sessionId}${ICE_SERVERS_SUFFIX}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!iceResponse.ok) throw new Error(await readApiError(iceResponse));
      const iceConfiguration = readRemoteCameraIceConfiguration(
        await iceResponse.json(),
      );
      if (!iceConfiguration) {
        throw new Error("Konfigurasi ICE dari API tidak valid.");
      }
      turnConfigured = iceConfiguration.turnConfigured;

      peerConnection = new RTCPeerConnection({
        iceServers: iceConfiguration.iceServers,
      });
      peerConnectionRef.current = peerConnection;
      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection?.connectionState === "connected") {
          setState("connected");
          setError(null);
        } else if (peerConnection?.connectionState === "failed") {
          peerConnection.close();
          if (peerConnectionRef.current === peerConnection) {
            peerConnectionRef.current = null;
          }
          localStream?.getTracks().forEach((track) => track.stop());
          if (streamRef.current === localStream) streamRef.current = null;
          setStream(null);
          setState("error");
          setSessionUsed(true);
          setError(
            turnConfigured
              ? "Koneksi kamera gagal. Periksa apakah server TURN aktif dan dapat dijangkau melalui jaringan ini."
              : "Koneksi langsung gagal. Agar perangkat di jaringan berbeda bisa tersambung, API perlu dikonfigurasi dengan TURN_URLS dan TURN_SHARED_SECRET.",
          );
          deletePairing(sessionId);
        }
      };

      setState("waiting");
      const offer = await pollForOffer(
        `${API_ORIGIN}${SESSION_ENDPOINT}/${sessionId}/offer`,
        controller.signal,
      );
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGathering(peerConnection, controller.signal);
      const localAnswer = readRemoteCameraDescription(
        peerConnection.localDescription,
        "answer",
      );
      if (!localAnswer)
        throw new Error("Browser gagal menyiapkan kamera ponsel.");

      const answerResponse = await fetch(
        `${API_ORIGIN}${SESSION_ENDPOINT}/${sessionId}/answer`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localAnswer),
          signal: controller.signal,
        },
      );
      if (!answerResponse.ok) {
        const message = await readApiError(answerResponse);
        if (isTerminalRemoteCameraStatus(answerResponse.status)) {
          throw new PairingUnavailableError(message);
        }
        throw new Error(message);
      }
      setSessionUsed(true);
      if (peerConnection.connectionState !== "connected") {
        setState("connecting");
      }
    } catch (connectError) {
      localStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === localStream) streamRef.current = null;
      if (peerConnectionRef.current === peerConnection) {
        peerConnectionRef.current = null;
      }
      peerConnection?.close();
      if (!(
        connectError instanceof DOMException &&
        connectError.name === "AbortError"
      )) {
        if (mountedRef.current) {
          const pairingUnavailable =
            connectError instanceof PairingUnavailableError;
          if (pairingUnavailable) {
            setSessionUsed(true);
            deletePairing(sessionId);
          }
          setStream(null);
          setState("error");
          setError(getPhoneCameraErrorMessage(connectError));
        }
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      peerConnectionRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (isRemoteCameraSessionId(sessionId)) deletePairing(sessionId);
      controllerRef.current = null;
      peerConnectionRef.current = null;
      streamRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => {
        setError("Pratinjau kamera ponsel gagal diputar.");
      });
    } else {
      video.pause();
      video.srcObject = null;
    }
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  const isActive =
    state === "requesting" ||
    state === "waiting" ||
    state === "connecting" ||
    state === "connected";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Photo Booth">
          <span aria-hidden="true">✳</span> Photo Booth
        </a>
        <span className={styles.privateBadge}>Koneksi privat</span>
      </header>
      <section className={styles.card} aria-labelledby="remote-camera-title">
        <div>
          <p className={styles.eyebrow}>Kamera pendamping</p>
          <h1 id="remote-camera-title">Gunakan kamera ponsel</h1>
          <p className={styles.description}>
            Izinkan akses kamera untuk menghubungkan ponsel ke booth. Video
            dikirim langsung ke browser booth melalui WebRTC; server hanya
            membantu menyambungkan kedua perangkat.
          </p>
        </div>
        <div className={styles.preview}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Pratinjau kamera ponsel"
          />
          {!stream ? (
            <div className={styles.placeholder}>
              <span aria-hidden="true">◉</span>
              <p>Kamera ponsel belum dimulai</p>
            </div>
          ) : null}
        </div>
        <p className={styles.status} role="status" aria-live="polite">
          {state === "requesting"
            ? "Menunggu izin kamera…"
            : state === "waiting"
              ? "Menunggu booth tersambung…"
              : state === "connecting"
                ? "Menyambungkan kamera ke booth…"
                : state === "connected"
                  ? "Terhubung. Booth siap mengambil foto."
                  : state === "error"
                    ? "Koneksi belum siap. Periksa pesan di bawah."
                    : "Koneksi berhenti setelah sesi ditutup atau QR kedaluwarsa."}
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          {!isActive && !sessionUsed ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void connect()}
            >
              {state === "error"
                ? "Coba sambungkan lagi"
                : "Izinkan dan sambungkan kamera"}
            </button>
          ) : isActive ? (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={stop}
            >
              Hentikan koneksi
            </button>
          ) : null}
        </div>
        {sessionUsed && state === "error" ? (
          <p className={styles.recoveryHint} role="status">
            Pairing ini sudah dipakai, dihentikan, atau kedaluwarsa. Buat QR
            baru dari booth lalu pindai lagi dengan ponsel.
          </p>
        ) : null}
        <p className={styles.privacy}>
          Jangan tutup halaman ini saat sesi foto berlangsung. Menutup halaman
          akan mematikan kamera ponsel.
        </p>
      </section>
    </main>
  );
}
