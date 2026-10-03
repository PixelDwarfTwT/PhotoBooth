"use client";

import { useEffect, useState } from "react";
import type { CapturedPhoto } from "../types";
import styles from "./booth-session.module.css";

interface CaptureReviewProps {
  photos: CapturedPhoto[];
  targetCount: number;
  error: string | null;
  busy: boolean;
  onRetake: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onContinue: () => void;
}

function PhotoThumbnail({
  photo,
  index,
}: {
  photo: CapturedPhoto;
  index: number;
}) {
  const [source, setSource] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.blob);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.blob]);

  return source ? (
    <img
      className={styles.reviewImage}
      src={source}
      alt={`Pratinjau foto ${index + 1}`}
    />
  ) : (
    <div className={styles.reviewImagePlaceholder} aria-hidden="true" />
  );
}

export function CaptureReview({
  photos,
  targetCount,
  error,
  busy,
  onRetake,
  onMove,
  onContinue,
}: CaptureReviewProps) {
  if (photos.length === 0) return null;

  const incomplete = photos.length < targetCount;

  return (
    <section
      className={styles.captureReview}
      aria-labelledby="capture-review-title"
    >
      <div className={styles.reviewHeading}>
        <div>
          <p className={styles.eyebrow}>Sesi fotomu</p>
          <h2 id="capture-review-title">
            {incomplete ? "Foto yang sudah diambil" : "Tinjau foto"}
          </h2>
        </div>
        <span className={styles.photoCount}>
          {photos.length} / {targetCount}
        </span>
      </div>

      <ol className={styles.reviewList}>
        {photos.map((photo, index) => (
          <li className={styles.reviewItem} key={photo.id}>
            <div className={styles.reviewThumbnail}>
              <PhotoThumbnail photo={photo} index={index} />
              <span className={styles.reviewNumber}>{index + 1}</span>
            </div>
            <div className={styles.reviewActions}>
              <button
                className={styles.reviewAction}
                type="button"
                onClick={() => onMove(index, index - 1)}
                disabled={busy || index === 0}
                aria-label={`Pindahkan foto ${index + 1} ke urutan sebelumnya`}
              >
                ↑ <span>Naik</span>
              </button>
              <button
                className={styles.reviewAction}
                type="button"
                onClick={() => onMove(index, index + 1)}
                disabled={busy || index === photos.length - 1}
                aria-label={`Pindahkan foto ${index + 1} ke urutan berikutnya`}
              >
                ↓ <span>Turun</span>
              </button>
              <button
                className={styles.reviewRetake}
                type="button"
                onClick={() => onRetake(index)}
                disabled={busy}
              >
                Ulangi foto
              </button>
            </div>
          </li>
        ))}
      </ol>

      {error ? (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}

      {incomplete ? (
        <div className={styles.continueBox}>
          <p>
            {busy
              ? "Pengambilan foto sedang berlangsung."
              : `Ambil ${targetCount - photos.length} foto lagi untuk menyelesaikan sesi.`}
          </p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onContinue}
            disabled={busy}
          >
            {busy ? "Mengambil foto…" : "Lanjutkan sesi"}
          </button>
        </div>
      ) : (
        <p className={styles.reviewReady}>
          Urutan foto sudah siap. Kamu bisa mengulang satu foto atau lanjut ke
          editor.
        </p>
      )}
    </section>
  );
}
