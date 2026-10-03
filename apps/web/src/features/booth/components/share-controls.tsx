"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ApiErrorResponseSchema,
  type ApiCapabilities,
  type ShareCreatedResponse,
} from "@photobooth/contracts";
import { API_ORIGIN } from "@/lib/api-origin";
import { canvasToBlob } from "../lib/canvas-compositor";
import {
  readApiCapabilities,
  readCreatedShare,
  supportsFileSharing,
} from "../lib/sharing-client";
import styles from "./share-controls.module.css";

interface ShareControlsProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  disabled: boolean;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const parsed = ApiErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // The API may return a non-JSON error from a proxy.
  }
  return "Permintaan gagal. Foto tetap tersimpan di perangkat ini.";
}

function downloadBlob(blob: Blob, extension: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `photo-booth-${new Date().toISOString().slice(0, 10)}.${extension}`;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sharePath(shareUrl: string): string | null {
  try {
    const path = new URL(shareUrl).pathname;
    const token = path.match(/^\/share\/([A-Za-z0-9_-]{43})$/)?.[1];
    return token ? `/api/share/${token}` : null;
  } catch {
    return null;
  }
}

export function ShareControls({ canvasRef, disabled }: ShareControlsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<ApiCapabilities | null>(
    null,
  );
  const [capabilityStatus, setCapabilityStatus] = useState("loading");
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<ShareCreatedResponse | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!API_ORIGIN) {
      setCapabilityStatus("unavailable");
      return;
    }
    const controller = new AbortController();
    void fetch(`${API_ORIGIN}/api/capabilities`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        return readApiCapabilities(await response.json());
      })
      .then((result) => {
        if (!result) throw new Error("Invalid capabilities response");
        setCapabilities(result);
        setCapabilityStatus(result.cloudSharingEnabled ? "ready" : "disabled");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCapabilityStatus("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  async function shareToDevice(): Promise<void> {
    const canvas = canvasRef.current;
    if (!canvas || disabled || busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const blob = await canvasToBlob(canvas, "png");
      if (typeof File !== "undefined") {
        const file = new File([blob], "photo-booth.png", { type: "image/png" });
        const shareApi =
          typeof navigator === "undefined" ||
          typeof navigator.canShare !== "function"
            ? undefined
            : {
                share: navigator.share,
                canShare: ({ files }: { files: readonly unknown[] }) =>
                  navigator.canShare({ files: files as File[] }),
              };
        if (supportsFileSharing(shareApi, [file])) {
          try {
            await navigator.share({
              files: [file],
              title: "Photo strip",
              text: "Photo strip yang dibuat di browser.",
            });
            setStatus("Hasil dibagikan melalui menu perangkat.");
            return;
          } catch (shareError) {
            if (
              shareError instanceof Error &&
              shareError.name === "AbortError"
            ) {
              setStatus("Berbagi dibatalkan. Hasil tetap tersedia di editor.");
              return;
            }
          }
        }
      }
      downloadBlob(blob, "png");
      setStatus(
        "Browser ini belum mendukung berbagi berkas; PNG diunduh ke perangkat.",
      );
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Hasil tidak dapat dibagikan. Coba unduh PNG.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCloudShare(): Promise<void> {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !capabilities?.cloudSharingEnabled ||
      !consentChecked ||
      busy ||
      !API_ORIGIN
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let blob = await canvasToBlob(canvas, "png");
      if (blob.size > capabilities.shareMaxBytes) {
        blob = await canvasToBlob(canvas, "jpg");
      }
      if (blob.size > capabilities.shareMaxBytes) {
        throw new Error(
          "Photo strip melebihi batas ukuran. Coba tata letak kolase atau JPG dari editor.",
        );
      }

      const response = await fetch(`${API_ORIGIN}/api/share`, {
        method: "POST",
        headers: {
          "Content-Type": blob.type,
          "X-Share-Consent-Version": capabilities.consentVersion,
        },
        body: blob,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const parsed = readCreatedShare(await response.json());
      if (!parsed)
        throw new Error(
          "Tautan berbagi tidak valid. Foto tetap tersimpan lokal.",
        );
      setShare(parsed);
      setConsentChecked(false);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Tautan gagal dibuat. Foto tetap tersimpan di perangkat.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyShareLink(): Promise<void> {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      setStatus("Tautan disalin.");
    } catch {
      setStatus("Pilih tautan di kolom untuk menyalinnya secara manual.");
    }
  }

  async function revokeShare(): Promise<void> {
    if (!share || !API_ORIGIN || busy) return;
    const path = sharePath(share.shareUrl);
    if (!path) {
      setError("Alamat tautan tidak dapat diverifikasi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_ORIGIN}${path}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${share.deleteToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setShare(null);
      setDialogOpen(false);
      setStatus("Tautan dihapus. Berkas tidak lagi dapat dibuka.");
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Tautan tidak dapat dihapus saat ini.",
      );
    } finally {
      setBusy(false);
    }
  }

  const cloudDisabled = capabilityStatus !== "ready" || disabled || busy;
  const ttlLabel = capabilities
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(
        capabilities.shareTtlHours / 24,
      )
    : "";
  const maxSizeLabel = capabilities
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(
        capabilities.shareMaxBytes / (1024 * 1024),
      )
    : "";

  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => void shareToDevice()}
          disabled={disabled || busy}
        >
          {busy ? "Menyiapkan…" : "Bagikan ke perangkat"}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            setError("");
            setStatus("");
            setDialogOpen(true);
          }}
          disabled={cloudDisabled}
          aria-describedby="cloud-share-availability"
        >
          Buat tautan cloud
        </button>
      </div>
      <p className={styles.availability} id="cloud-share-availability">
        {capabilityStatus === "loading"
          ? "Memeriksa ketersediaan tautan sementara…"
          : capabilityStatus === "ready"
            ? `Cloud opsional tersedia; tautan kedaluwarsa dalam ${ttlLabel} hari.`
            : "Tautan cloud sedang tidak tersedia. Unduh atau bagikan langsung dari perangkat."}
      </p>
      {status ? (
        <p className={styles.status} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <dialog
        className={styles.dialog}
        ref={dialogRef}
        aria-labelledby="share-dialog-title"
        onClose={() => {
          setDialogOpen(false);
          if (!share) setConsentChecked(false);
        }}
        onCancel={() => {
          setDialogOpen(false);
          if (!share) setConsentChecked(false);
        }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Berbagi sementara</p>
            <h2 id="share-dialog-title">
              {share ? "Tautan photo strip" : "Simpan salinan ke cloud?"}
            </h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={() => setDialogOpen(false)}
            aria-label="Tutup dialog berbagi"
          >
            ×
          </button>
        </div>

        {share ? (
          <div className={styles.result}>
            <p>
              Siapa pun yang memiliki tautan dapat melihat salinan ini sampai{" "}
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(share.expiresAt))}
              .
            </p>
            {share.qrCodeDataUrl ? (
              // QR is generated from the same temporary share URL by the API.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.qr}
                src={share.qrCodeDataUrl}
                alt="Kode QR untuk membuka tautan photo strip"
              />
            ) : null}
            <label className={styles.linkLabel} htmlFor="created-share-url">
              Tautan berbagi
            </label>
            <input
              className={styles.linkInput}
              id="created-share-url"
              type="url"
              readOnly
              value={share.shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void copyShareLink()}
              >
                Salin tautan
              </button>
              <button
                className={styles.dangerButton}
                type="button"
                onClick={() => void revokeShare()}
                disabled={busy}
              >
                {busy ? "Menghapus…" : "Hapus tautan sekarang"}
              </button>
            </div>
            <p className={styles.privacyCopy}>
              Token untuk menghapus tautan hanya disimpan sementara di halaman
              ini dan tidak disertakan dalam URL.
            </p>
            {status ? (
              <p className={styles.status} role="status">
                {status}
              </p>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <form
            className={styles.dialogBody}
            onSubmit={(event) => {
              event.preventDefault();
              void createCloudShare();
            }}
          >
            <p>
              Foto hasil akhir akan dikirim ke penyimpanan cloud privat agar
              dapat dibuka lewat tautan dan QR. Tautan berlaku selama{" "}
              {ttlLabel || "beberapa"} hari. Setelah kedaluwarsa, berkas fisik
              dihapus oleh proses cleanup terjadwal.
            </p>
            <p>
              Berkas dibatasi sampai {maxSizeLabel || "batas layanan"} MiB. Jika
              PNG terlalu besar, editor akan mencoba JPG sebelum mengirim.
            </p>
            <p>
              Siapa pun yang memiliki tautan dapat melihat foto. Kamu juga dapat
              menghapus tautan sekarang. Foto lain di sesi dan data kamera tidak
              dikirim.
            </p>
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) =>
                  setConsentChecked(event.currentTarget.checked)
                }
                disabled={busy}
              />
              <span>
                Saya setuju mengunggah photo strip ini untuk dibagikan
                sementara.
              </span>
            </label>
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={!consentChecked || busy}
              >
                {busy ? "Mengunggah…" : "Setuju dan buat tautan"}
              </button>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </dialog>
    </div>
  );
}
