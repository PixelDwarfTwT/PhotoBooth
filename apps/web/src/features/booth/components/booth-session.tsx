"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/use-camera";
import { useCaptureSequence } from "../hooks/use-capture-sequence";
import { BOOTH_FILTERS, getBoothFilter } from "../lib/editor-options";
import { CAPTURE_PHOTO_COUNT } from "../lib/capture-count";
import { API_ORIGIN } from "@/lib/api-origin";
import {
  readPoseGuideCatalog,
  type BoothPoseGuideOption,
} from "../lib/catalog-client";
import { CaptureReview } from "./capture-review";
import { PhotoEditor } from "./photo-editor";
import styles from "./booth-session.module.css";
import type { BoothFilter } from "../types";

const COUNTDOWNS = [3, 5, 10] as const;
const LOCAL_POSE_GUIDES: BoothPoseGuideOption[] = [
  {
    title: "Senyum bareng",
    instruction: "Rapatkan bahu, lihat kamera, lalu senyum bersama.",
    assetUrl: null,
    altText: null,
  },
  {
    title: "Pose spontan",
    instruction: "Saling tunjuk atau tertawa seolah sedang bercerita.",
    assetUrl: null,
    altText: null,
  },
  {
    title: "Bentuk hati",
    instruction:
      "Gunakan tangan untuk membuat bentuk hati kecil di depan kamera.",
    assetUrl: null,
    altText: null,
  },
];

function abortError(): Error {
  const error = new Error("Persiapan sesi foto dibatalkan.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function waitForVideoFrame(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(
        new Error("Pratinjau kamera belum siap. Coba aktifkan kamera lagi."),
      );
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    }

    function onReady() {
      if (video.videoWidth < 1) return;
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("Pratinjau kamera gagal dimuat. Coba aktifkan lagi."));
    }

    function onAbort() {
      cleanup();
      reject(abortError());
    }

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function BoothSession() {
  const capture = useCaptureSequence();
  const preparationAbortRef = useRef<AbortController | null>(null);
  const sequenceActiveRef = useRef(false);
  const handleCameraLoss = useCallback(() => {
    preparationAbortRef.current?.abort();
    if (sequenceActiveRef.current) capture.cancelSequence();
  }, [capture.cancelSequence]);
  const camera = useCamera(handleCameraLoss);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<BoothFilter>("natural");
  const [selectedFilterIntensity, setSelectedFilterIntensity] = useState(1);
  const [poseGuides, setPoseGuides] = useState(LOCAL_POSE_GUIDES);
  const [poseGuideIndex, setPoseGuideIndex] = useState(0);
  const [isPreparingCapture, setIsPreparingCapture] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const captureBusy =
    capture.phase === "countdown" || capture.phase === "capturing";
  const settingsLocked =
    camera.status === "requesting" ||
    isPreparingCapture ||
    captureBusy ||
    capture.photos.length > 0;
  const currentPoseGuide = poseGuides[poseGuideIndex % poseGuides.length];

  useEffect(() => {
    if (!API_ORIGIN) return;
    const controller = new AbortController();
    void fetch(`${API_ORIGIN}/api/pose-guides`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return [];
        return readPoseGuideCatalog(await response.json());
      })
      .then((guides) => {
        if (guides.length && !controller.signal.aborted) {
          setPoseGuides(guides);
          setPoseGuideIndex(0);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (camera.stream) {
      video.srcObject = camera.stream;
      void video.play().catch(() => {
        setPreviewError(
          "Pratinjau kamera tidak dapat diputar. Coba matikan lalu aktifkan kamera kembali.",
        );
      });
    } else {
      video.pause();
      video.srcObject = null;
    }

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [camera.stream]);

  useEffect(() => {
    if (capture.phase === "complete" || capture.phase === "error") {
      camera.stopCamera();
    }
  }, [camera.stopCamera, capture.phase]);

  useEffect(() => {
    if (camera.error?.code === "stream-ended" && captureBusy) {
      capture.cancelSequence();
    }
  }, [camera.error?.code, capture.cancelSequence, captureBusy]);

  useEffect(
    () => () => {
      preparationAbortRef.current?.abort();
    },
    [],
  );

  const getVideo = useCallback(async (signal: AbortSignal) => {
    const video = videoRef.current;
    if (!video) throw new Error("Pratinjau kamera belum tersedia.");
    await waitForVideoFrame(video, signal);
    const stream = video.srcObject as MediaStream | null;
    if (
      !stream?.getVideoTracks().some((track) => track.readyState === "live")
    ) {
      throw new Error(
        "Koneksi kamera terputus. Aktifkan kamera kembali untuk melanjutkan.",
      );
    }
    return video;
  }, []);

  async function startCaptureSequence(resume: boolean) {
    if (preparationAbortRef.current || sequenceActiveRef.current) return;
    const preparation = new AbortController();
    preparationAbortRef.current = preparation;
    setActionError(null);
    setIsPreparingCapture(true);

    try {
      if (!camera.stream) {
        const started = await camera.startCamera();
        if (!started || preparation.signal.aborted) return;
      }

      const video = await getVideo(preparation.signal);
      if (preparation.signal.aborted) return;

      preparationAbortRef.current = null;
      setIsPreparingCapture(false);
      sequenceActiveRef.current = true;
      try {
        if (resume) {
          await capture.resumeSequence(video, countdownSeconds);
        } else {
          await capture.startSequence(video, countdownSeconds);
        }
      } finally {
        sequenceActiveRef.current = false;
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Kamera belum siap. Coba lagi.",
        );
      }
    } finally {
      if (preparationAbortRef.current === preparation) {
        preparationAbortRef.current = null;
      }
      setIsPreparingCapture(false);
    }
  }

  async function retakePhoto(index: number) {
    if (preparationAbortRef.current || sequenceActiveRef.current) return;
    const preparation = new AbortController();
    preparationAbortRef.current = preparation;
    setActionError(null);
    setIsPreparingCapture(true);

    try {
      const cameraStarted = await camera.startCamera();
      if (!cameraStarted || preparation.signal.aborted) return;

      const video = await getVideo(preparation.signal);
      if (preparation.signal.aborted) return;

      preparationAbortRef.current = null;
      setIsPreparingCapture(false);
      sequenceActiveRef.current = true;
      try {
        await capture.retakePhoto(video, index, countdownSeconds);
      } finally {
        sequenceActiveRef.current = false;
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Kamera belum siap. Coba lagi.",
        );
        camera.stopCamera();
      }
    } finally {
      if (preparationAbortRef.current === preparation) {
        preparationAbortRef.current = null;
      }
      setIsPreparingCapture(false);
    }
  }

  function cancelCapture() {
    preparationAbortRef.current?.abort();
    preparationAbortRef.current = null;
    capture.cancelSequence();
    camera.stopCamera();
  }

  function stopCameraFromUser() {
    preparationAbortRef.current?.abort();
    preparationAbortRef.current = null;
    if (sequenceActiveRef.current) capture.cancelSequence();
    camera.stopCamera();
  }

  function startNewSession() {
    preparationAbortRef.current?.abort();
    preparationAbortRef.current = null;
    capture.resetSequence();
    camera.stopCamera();
    setActionError(null);
  }

  function activateCamera() {
    setPreviewError(null);
    void camera.startCamera();
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          className={styles.wordmark}
          href="/"
          aria-label="Kembali ke beranda"
        >
          <span aria-hidden="true">✳</span>
          <span>photo booth</span>
        </Link>
        <span className={styles.localBadge}>
          <span aria-hidden="true" />
          Diproses di perangkat
        </span>
      </header>

      <div className={styles.content}>
        <section className={styles.previewCard} aria-label="Pratinjau kamera">
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>Pratinjau</span>
            <span className={styles.cameraStatus} aria-live="polite">
              <span
                className={
                  camera.stream
                    ? `${styles.statusDot} ${styles.statusDotLive}`
                    : styles.statusDot
                }
                aria-hidden="true"
              />
              {camera.status === "requesting"
                ? "Meminta izin kamera"
                : camera.stream
                  ? "Kamera aktif"
                  : "Kamera belum aktif"}
            </span>
          </div>
          <div className={styles.videoFrame}>
            <video
              ref={videoRef}
              className={mirror ? styles.videoMirrored : styles.video}
              style={{
                filter: getBoothFilter(selectedFilter, selectedFilterIntensity)
                  .css,
              }}
              autoPlay
              muted
              playsInline
              hidden={!camera.stream}
              aria-label="Pratinjau langsung dari kamera"
            />
            {!camera.stream ? (
              <div className={styles.videoPlaceholder}>
                <span className={styles.cameraGlyph} aria-hidden="true">
                  ◉
                </span>
                <p>Kameramu akan muncul di sini</p>
                <span>Belum ada gambar yang diambil</span>
              </div>
            ) : null}
            {capture.countdownValue !== null &&
            capture.currentPhotoIndex !== null ? (
              <div className={styles.cameraCountdown} aria-hidden="true">
                <span className={styles.cameraCountdownLabel}>
                  Foto {capture.currentPhotoIndex + 1}/{CAPTURE_PHOTO_COUNT}
                </span>
                <span className={styles.cameraCountdownNumber}>
                  {capture.countdownValue}
                </span>
              </div>
            ) : null}
          </div>
          <p className={styles.previewCaption}>
            {camera.stream
              ? "Pastikan pencahayaan cukup sebelum memulai."
              : "Pratinjau hanya muncul setelah kamu mengaktifkan kamera."}
          </p>
        </section>

        <section className={styles.setupCard} aria-labelledby="booth-title">
          <p className={styles.eyebrow}>Studio foto kecil</p>
          <h1 id="booth-title">Siapkan sesi fotomu</h1>
          <p className={styles.intro}>
            Satu sesi berisi tepat {CAPTURE_PHOTO_COUNT} foto. Atur waktu untuk
            bersiap; kamera dimulai saat kamu menekan tombol di bawah.
          </p>

          {currentPoseGuide ? (
            <section
              className={styles.poseGuide}
              aria-label="Ide pose"
              aria-live="polite"
            >
              <div>
                <p className={styles.poseGuideEyebrow}>Ide pose</p>
                <h2>{currentPoseGuide.title}</h2>
                <p>{currentPoseGuide.instruction}</p>
                {poseGuides.length > 1 ? (
                  <button
                    className={styles.poseGuideNext}
                    type="button"
                    onClick={() =>
                      setPoseGuideIndex(
                        (index) => (index + 1) % poseGuides.length,
                      )
                    }
                    disabled={captureBusy}
                  >
                    Ide pose lain
                  </button>
                ) : null}
              </div>
              {currentPoseGuide.assetUrl && currentPoseGuide.altText ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentPoseGuide.assetUrl}
                  alt={currentPoseGuide.altText}
                />
              ) : null}
            </section>
          ) : null}

          <div className={styles.settingsGrid}>
            <label className={styles.field} htmlFor="countdown-duration">
              <span>Waktu hitung mundur</span>
              <select
                id="countdown-duration"
                value={countdownSeconds}
                onChange={(event) =>
                  setCountdownSeconds(Number(event.currentTarget.value))
                }
                disabled={settingsLocked}
              >
                {COUNTDOWNS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} detik
                  </option>
                ))}
              </select>
            </label>
          </div>

          {capture.photos.length === 0 ? (
            <>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(event) => setMirror(event.currentTarget.checked)}
                  disabled={settingsLocked}
                />
                <span>Cerminkan pratinjau dan hasil foto</span>
              </label>
              <label className={styles.field} htmlFor="preview-filter">
                <span>Filter pratinjau</span>
                <select
                  id="preview-filter"
                  value={selectedFilter}
                  onChange={(event) =>
                    setSelectedFilter(event.currentTarget.value as BoothFilter)
                  }
                  disabled={settingsLocked}
                >
                  {BOOTH_FILTERS.map((filter) => (
                    <option key={filter.key} value={filter.key}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {camera.devices.length > 1 ? (
            <label className={styles.field} htmlFor="camera-device">
              <span>Pilih kamera</span>
              <select
                id="camera-device"
                value={camera.selectedDeviceId}
                onChange={(event) =>
                  void camera.selectCamera(event.currentTarget.value)
                }
                disabled={camera.status === "requesting" || settingsLocked}
              >
                <option value="">Otomatis</option>
                {camera.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Kamera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {camera.stream ? (
            <div className={styles.cameraControls}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void camera.toggleFacingMode()}
                disabled={camera.status === "requesting" || settingsLocked}
              >
                Balik kamera depan/belakang
              </button>
              <button
                className={styles.textButton}
                type="button"
                onClick={stopCameraFromUser}
                disabled={captureBusy}
              >
                Matikan kamera
              </button>
            </div>
          ) : (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={activateCamera}
              disabled={camera.status === "requesting"}
            >
              {camera.status === "requesting"
                ? "Menghubungkan kamera…"
                : camera.status === "error"
                  ? "Coba aktifkan kamera lagi"
                  : "Aktifkan kamera"}
            </button>
          )}

          {camera.stream && capture.photos.length === 0 ? (
            <button
              className={`${styles.primaryButton} ${styles.startSessionButton}`}
              type="button"
              onClick={() => void startCaptureSequence(false)}
              disabled={captureBusy || isPreparingCapture}
            >
              Mulai sesi foto
            </button>
          ) : null}

          {captureBusy || isPreparingCapture ? (
            <button
              className={styles.textButton}
              type="button"
              onClick={cancelCapture}
            >
              Hentikan pengambilan
            </button>
          ) : null}

          {camera.error ? (
            <p className={styles.errorMessage} role="alert">
              {camera.error.message}
            </p>
          ) : null}
          {previewError ? (
            <p className={styles.errorMessage} role="alert">
              {previewError}
            </p>
          ) : null}
          {actionError ? (
            <p className={styles.errorMessage} role="alert">
              {actionError}
            </p>
          ) : null}

          <p className={styles.privacyNote}>
            Foto diproses di browser dan tidak dikirim ke server. Kamu bisa
            mematikan kamera kapan saja.
          </p>
        </section>

        {captureBusy || capture.announcement ? (
          <p
            className={styles.liveAnnouncement}
            role="status"
            aria-live="polite"
          >
            {capture.announcement}
          </p>
        ) : null}

        {capture.error && capture.photos.length === 0 ? (
          <p className={styles.errorMessage} role="alert">
            {capture.error}
          </p>
        ) : null}

        {capture.photos.length > 0 ? (
          <CaptureReview
            photos={capture.photos}
            targetCount={CAPTURE_PHOTO_COUNT}
            error={capture.error}
            busy={captureBusy || isPreparingCapture}
            onRetake={(index) => void retakePhoto(index)}
            onMove={capture.movePhoto}
            onContinue={() => void startCaptureSequence(true)}
          />
        ) : null}

        {capture.photos.length === CAPTURE_PHOTO_COUNT ? (
          <PhotoEditor
            photos={capture.photos}
            mirror={mirror}
            filter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onFilterIntensityChange={setSelectedFilterIntensity}
            onNewSession={startNewSession}
          />
        ) : null}
      </div>
    </main>
  );
}
