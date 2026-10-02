"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/use-camera.js";
import styles from "./booth-session.module.css";

const PHOTO_COUNTS = [2, 3, 4, 5, 6] as const;
const COUNTDOWNS = [3, 5, 10] as const;

export function BoothSession() {
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photoCount, setPhotoCount] = useState(4);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
                disabled={camera.status === "requesting"}
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
                disabled={camera.status === "requesting"}
              >
                {COUNTDOWNS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} detik
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={mirror}
              onChange={(event) => setMirror(event.currentTarget.checked)}
            />
            <span>Cerminkan pratinjau dan hasil foto</span>
          </label>

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
                    disabled={camera.status === "requesting"}
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
                disabled={camera.status === "requesting"}
              >
                Balik kamera depan/belakang
              </button>
              <button
                className={styles.textButton}
                type="button"
                onClick={camera.stopCamera}
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
            {camera.stream ? (
              <video
                ref={videoRef}
                className={mirror ? styles.videoMirrored : styles.video}
                autoPlay
                muted
                playsInline
                aria-label="Pratinjau langsung dari kamera"
              />
            ) : (
              <div className={styles.videoPlaceholder}>
                <span className={styles.cameraGlyph} aria-hidden="true">
                  ◉
                </span>
                <p>Kameramu akan muncul di sini</p>
                <span>Belum ada gambar yang diambil</span>
              </div>
            )}
          </div>
          <p className={styles.previewCaption}>
            {camera.stream
              ? "Pastikan pencahayaan cukup sebelum memulai."
              : "Pratinjau hanya muncul setelah kamu mengaktifkan kamera."}
          </p>
        </section>
      </div>
    </main>
  );
}
