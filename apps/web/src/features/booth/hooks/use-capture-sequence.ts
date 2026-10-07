"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { capturePhoto } from "../lib/capture-photo";
import {
  CAPTURE_PHOTO_COUNT,
  getCapturePhotoIndices,
} from "../lib/capture-count";
import type { CapturedPhoto, CapturePhase } from "../types";

export interface CaptureSequenceController {
  photos: CapturedPhoto[];
  phase: CapturePhase;
  currentPhotoIndex: number | null;
  countdownValue: number | null;
  announcement: string;
  error: string | null;
  startSequence: (video: HTMLVideoElement, seconds: number) => Promise<boolean>;
  resumeSequence: (
    video: HTMLVideoElement,
    seconds: number,
  ) => Promise<boolean>;
  retakePhoto: (
    video: HTMLVideoElement,
    index: number,
    seconds: number,
  ) => Promise<boolean>;
  cancelSequence: () => void;
  resetSequence: () => void;
  movePhoto: (fromIndex: number, toIndex: number) => void;
}

function abortError(): Error {
  const error = new Error("Pengambilan foto dibatalkan.");
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

function waitOneSecond(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 1000);

    function onAbort() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useCaptureSequence(): CaptureSequenceController {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number | null>(
    null,
  );
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef<CapturedPhoto[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const publishPhotos = useCallback((nextPhotos: CapturedPhoto[]) => {
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
  }, []);

  const runSequence = useCallback(
    async (
      video: HTMLVideoElement,
      seconds: number,
      startIndex: number,
      controller: AbortController,
    ): Promise<boolean> => {
      try {
        for (const index of getCapturePhotoIndices(startIndex)) {
          if (controller.signal.aborted || !mountedRef.current) return false;
          setPhase("countdown");
          setCurrentPhotoIndex(index);

          for (let remaining = seconds; remaining > 0; remaining -= 1) {
            if (controller.signal.aborted) return false;
            setCountdownValue(remaining);
            setAnnouncement(
              `Foto ${index + 1} dari ${CAPTURE_PHOTO_COUNT} dalam ${remaining} detik.`,
            );
            await waitOneSecond(controller.signal);
          }

          if (controller.signal.aborted || !mountedRef.current) return false;
          setCountdownValue(null);
          setPhase("capturing");
          setAnnouncement(
            `Mengambil foto ${index + 1} dari ${CAPTURE_PHOTO_COUNT}.`,
          );
          const photo = await capturePhoto(video);
          if (controller.signal.aborted || !mountedRef.current) return false;

          const nextPhotos = photosRef.current.slice();
          nextPhotos[index] = photo;
          publishPhotos(nextPhotos);
        }

        if (controller.signal.aborted || !mountedRef.current) return false;
        setCountdownValue(null);
        setCurrentPhotoIndex(null);
        setPhase("complete");
        setAnnouncement("Semua foto siap ditinjau.");
        return true;
      } catch (captureError) {
        if (isAbortError(captureError) || !mountedRef.current) return false;
        setCountdownValue(null);
        setError(
          captureError instanceof Error
            ? captureError.message
            : "Foto tidak dapat diambil. Coba lagi.",
        );
        setPhase("error");
        setAnnouncement(
          "Pengambilan foto terhenti. Foto yang sudah diambil tetap tersedia.",
        );
        return false;
      }
    },
    [publishPhotos],
  );

  const startSequence = useCallback(
    async (video: HTMLVideoElement, seconds: number): Promise<boolean> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      publishPhotos([]);
      setError(null);
      setAnnouncement("Sesi foto dimulai.");
      return runSequence(video, seconds, 0, controller);
    },
    [publishPhotos, runSequence],
  );

  const resumeSequence = useCallback(
    async (video: HTMLVideoElement, seconds: number): Promise<boolean> => {
      const startIndex = photosRef.current.length;
      if (startIndex >= CAPTURE_PHOTO_COUNT) {
        setPhase("complete");
        return true;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setAnnouncement("Melanjutkan sesi foto.");
      return runSequence(video, seconds, startIndex, controller);
    },
    [runSequence],
  );

  const retakePhoto = useCallback(
    async (
      video: HTMLVideoElement,
      index: number,
      seconds: number,
    ): Promise<boolean> => {
      if (!photosRef.current[index]) return false;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setCurrentPhotoIndex(index);
      setPhase("countdown");

      try {
        for (let remaining = seconds; remaining > 0; remaining -= 1) {
          if (controller.signal.aborted || !mountedRef.current) return false;
          setCountdownValue(remaining);
          setAnnouncement(
            `Mengulang foto ${index + 1} dalam ${remaining} detik.`,
          );
          await waitOneSecond(controller.signal);
        }

        if (controller.signal.aborted || !mountedRef.current) return false;
        setCountdownValue(null);
        setPhase("capturing");
        setAnnouncement(`Mengambil ulang foto ${index + 1}.`);
        const replacement = await capturePhoto(video);
        if (controller.signal.aborted || !mountedRef.current) return false;

        const nextPhotos = photosRef.current.slice();
        nextPhotos[index] = replacement;
        publishPhotos(nextPhotos);
        setCurrentPhotoIndex(null);
        setPhase("complete");
        setAnnouncement(`Foto ${index + 1} berhasil diulang.`);
        return true;
      } catch (captureError) {
        if (isAbortError(captureError) || !mountedRef.current) return false;
        setCountdownValue(null);
        setError(
          captureError instanceof Error
            ? captureError.message
            : "Foto tidak dapat diulang. Coba lagi.",
        );
        setPhase("error");
        setAnnouncement("Foto sebelumnya tetap tersedia untuk dicoba lagi.");
        return false;
      }
    },
    [publishPhotos],
  );

  const cancelSequence = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCountdownValue(null);
    setCurrentPhotoIndex(null);
    setPhase("idle");
    setError(null);
    setAnnouncement("Pengambilan foto dihentikan.");
  }, []);

  const resetSequence = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    publishPhotos([]);
    setPhase("idle");
    setCurrentPhotoIndex(null);
    setCountdownValue(null);
    setError(null);
    setAnnouncement("");
  }, [publishPhotos]);

  const movePhoto = useCallback(
    (fromIndex: number, toIndex: number) => {
      const currentPhotos = photosRef.current;
      if (
        fromIndex < 0 ||
        fromIndex >= currentPhotos.length ||
        toIndex < 0 ||
        toIndex >= currentPhotos.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const nextPhotos = currentPhotos.slice();
      const [photo] = nextPhotos.splice(fromIndex, 1);
      if (!photo) return;
      nextPhotos.splice(toIndex, 0, photo);
      publishPhotos(nextPhotos);
    },
    [publishPhotos],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  return {
    photos,
    phase,
    currentPhotoIndex,
    countdownValue,
    announcement,
    error,
    startSequence,
    resumeSequence,
    retakePhoto,
    cancelSequence,
    resetSequence,
    movePhoto,
  };
}
