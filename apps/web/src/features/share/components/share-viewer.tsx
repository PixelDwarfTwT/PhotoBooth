"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiErrorResponseSchema } from "@photobooth/contracts";
import { API_ORIGIN } from "@/lib/api-origin";
import { readBoundedBlob } from "@/lib/read-bounded-blob";
import {
  isValidShareToken,
  validateShareImageResponse,
} from "../lib/share-viewer";
import styles from "./share-viewer.module.css";

interface ShareViewerProps {
  token: string;
}

interface SharedImage {
  url: string;
  mimeType: "image/png" | "image/jpeg";
  expiresAt: string | null;
}

async function readError(response: Response): Promise<string> {
  try {
    const result = ApiErrorResponseSchema.safeParse(await response.json());
    if (result.success) return result.data.error.message;
  } catch {
    // Proxies can replace the API's JSON error response.
  }
  return "Tautan tidak dapat dibuka. Tautan mungkin sudah kedaluwarsa atau dihapus.";
}

export function ShareViewer({ token }: ShareViewerProps) {
  const [image, setImage] = useState<SharedImage | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    if (!isValidShareToken(token)) {
      setError("Format tautan tidak valid.");
      return () => controller.abort();
    }
    if (API_ORIGIN === null) {
      setError("Layanan tautan sementara belum dikonfigurasi.");
      return () => controller.abort();
    }

    setImage(null);
    setError("");
    void fetch(`${API_ORIGIN}/api/share/${encodeURIComponent(token)}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "image/png, image/jpeg" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const contentType = response.headers.get("content-type");
        const blob = await readBoundedBlob(response, 10 * 1024 * 1024);
        if (!blob) {
          throw new Error("Berkas melebihi batas ukuran yang didukung.");
        }
        if (controller.signal.aborted) return;
        if (!validateShareImageResponse(contentType, blob.size)) {
          throw new Error("Berkas tautan bukan PNG atau JPEG yang didukung.");
        }
        const nextObjectUrl = URL.createObjectURL(blob);
        if (controller.signal.aborted) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        objectUrl = nextObjectUrl;
        setImage({
          url: objectUrl,
          mimeType: contentType?.startsWith("image/jpeg")
            ? "image/jpeg"
            : "image/png",
          expiresAt: response.headers.get("x-share-expires-at"),
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Tautan tidak dapat dibuka. Coba lagi nanti.",
        );
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Tautan disalin.");
    } catch {
      setStatus("Salin tautan langsung dari bilah alamat browser.");
    }
  }

  const expiresLabel = image?.expiresAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(image.expiresAt))
    : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/">
          ✳ <span>photo booth</span>
        </Link>
        <p>Photo strip sementara</p>
      </header>
      <section className={styles.card} aria-labelledby="share-viewer-title">
        <p className={styles.eyebrow}>Tautan berbagi sementara</p>
        <h1 id="share-viewer-title">Photo strip</h1>
        {image ? (
          <>
            <img
              className={styles.photo}
              src={image.url}
              alt="Photo strip yang dibagikan sementara"
            />
            {expiresLabel ? (
              <p className={styles.expiry}>
                Tautan ini berakhir pada {expiresLabel}.
              </p>
            ) : null}
            <div className={styles.actions}>
              <a
                className={styles.primaryButton}
                href={image.url}
                download={`photo-booth-shared.${image.mimeType === "image/jpeg" ? "jpg" : "png"}`}
              >
                Unduh foto
              </a>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void copyLink()}
              >
                Salin tautan
              </button>
            </div>
          </>
        ) : error ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <p>
              Tautan mungkin sudah kedaluwarsa atau dihapus oleh pembuatnya.
            </p>
            <Link href="/">Kembali ke Web Photobooth</Link>
          </div>
        ) : (
          <p className={styles.status} role="status" aria-live="polite">
            Memuat foto bersama…
          </p>
        )}
        {status ? (
          <p className={styles.status} role="status">
            {status}
          </p>
        ) : null}
        <p className={styles.privacy}>
          Foto ini dimuat tanpa cache. Orang yang memiliki tautan dapat
          melihatnya sampai tautan dihapus atau kedaluwarsa.
        </p>
      </section>
    </main>
  );
}
