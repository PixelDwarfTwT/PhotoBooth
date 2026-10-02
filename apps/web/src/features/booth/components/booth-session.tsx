"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/use-camera.js";
import { useCaptureSequence } from "../hooks/use-capture-sequence.js";
import { CaptureReview } from "./capture-review.js";
import styles from "./booth-session.module.css";

const PHOTO_COUNTS = [2, 3, 4, 5, 6] as const;
const COUNTDOWNS = [3, 5, 10] as const;

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Pratinjau kamera belum siap. Coba aktifkan kamera lagi."));
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
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

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
  });
}

export function BoothSession() {
  const camera = useCamera();
  const capture = useCaptureSequence();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photoCount, setPhotoCount] = useState(4);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const captureBusy =
    capture.phase === "countdown" || capture.phase === "capturing";
  const settingsLocked = camera.status === "requesting" || capture.photos.length > 0;

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

  const getVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) throw new Error("Pratinjau kamera belum tersedia.");
    await waitForVideoFrame(video);
    return video;
  }, []);

  async function startCaptureSequence(resume: boolean) {
    setActionError(null);
    if (!camera.stream) {
      const started = await camera.startCamera();
      if (!started) return;
    }

    const video = await getVideo().catch((error: unknown) => {
      setActionError(
        error instanceof Error ? error.message : "Kamera belum siap. Coba lagi.",
      );
      return null;
    });
    if (!video) return;

    if (resume) {
      await capture.resumeSequence(video, photoCount, countdownSeconds);
    } else {
      await capture.startSequence(video, photoCount, countdownSeconds);
    }
  }

  async function retakePhoto(index: number) {
    setActionError(null);
    const cameraStarted = await camera.startCamera();
    if (!cameraStarted) return;

    try {
      const video = await getVideo();
      await capture.retakePhoto(video, index, countdownSeconds);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Kamera belum siap. Coba lagi.",
      );
      camera.stopCamera();
    }
  }

  function cancelCapture() {
    capture.cancelSequence();
    camera.stopCamera();
  }

  function startNewSession() {
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
        <Link className={styles.wordmark} href="/" aria-label="Kembali ke beranda">
          <span aria-hidden="true">✳</span>
          <span>photo booth</span>
        </Link>
        <span className={styles.localBadge}>
          <span aria-hidden="true" />
          Diproses di perangkat
        </span>
      </header>

      <div className={styles.content}>
        <section className={styles.setupCard} aria-labelledby="booth-title">
          <p className={styles.eyebrow}>Studio foto kecil</p>
          <h1 id="booth-title">Siapkan sesi fotomu</h1>
          <p className={styles.intro}>
            Pilih jumlah foto dan waktu untuk bersiap. Kamera hanya dimulai saat
            kamu menekan tombol di bawah.
          </p>

          <div className={styles.settingsGrid}>
            <label className={styles.field} htmlFor="photo-count">
              <span>Jumlah foto</span>
              <select
                id="photo-count"
                value={photoCount}
                onChange={(event) => setPhotoCount(Number(event.currentTarget.value))}
                disabled={settingsLocked}
              >
                {PHOTO_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count} foto
                  </option>
                ))}
              </select>
            </label>

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
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={mirror}
                onChange={(event) => setMirror(event.currentTarget.checked)}
              />
              <span>Cerminkan pratinjau dan hasil foto</span>
            </label>
          ) : null}

          {camera.stream ? (
            <div className={styles.cameraControls}>
              {camera.devices.length > 1 ? (
                <label className={styles.field} htmlFor="camera-device">
                  <span>Pilih kamera</span>
                  <select
                    id="camera-device"
                    value={camera.selectedDeviceId}
                    onChange={(event) =>
                      void camera.selectCamera(event.currentTarget.value)
                    }
                    disabled={camera.status === "requesting" || captureBusy}
                  >
                    {camera.devices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Kamera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void camera.toggleFacingMode()}
                disabled={camera.status === "requesting" || captureBusy}
              >
                Balik kamera depan/belakang
              </button>
              <button
                className={styles.textButton}
                type="button"
                onClick={camera.stopCamera}
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
              disabled={captureBusy}
            >
              Mulai sesi foto
            </button>
          ) : null}

          {captureBusy ? (
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
          </div>
          <p className={styles.previewCaption}>
            {camera.stream
              ? "Pastikan pencahayaan cukup sebelum memulai."
              : "Pratinjau hanya muncul setelah kamu mengaktifkan kamera."}
          </p>
        </section>

        {captureBusy || capture.announcement ? (
          <p className={styles.liveAnnouncement} role="status" aria-live="polite">
            {capture.countdownValue !== null ? (
              <span className={styles.countdownNumber} aria-hidden="true">
                {capture.countdownValue}
              </span>
            ) : null}
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
            targetCount={photoCount}
            error={capture.error}
            busy={captureBusy}
            onRetake={(index) => void retakePhoto(index)}
            onMove={capture.movePhoto}
            onContinue={() => void startCaptureSequence(true)}
          />
        ) : null}

        {capture.photos.length === photoCount && photoCount > 0 ? (
          <div className={styles.editorPrompt}>
            <p>Semua foto siap. Lanjut ke editor untuk menyusun photo strip.</p>
            <button className={styles.textButton} type="button" onClick={startNewSession}>
              Mulai sesi baru
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
