"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoothFilter, BoothLayout, CapturedPhoto, StickerPlacement } from "../types.js";
import {
  BOOTH_FILTERS,
  BOOTH_LAYOUTS,
  DEFAULT_STICKER_SIZE,
  MAX_STICKER_SIZE,
  MIN_STICKER_SIZE,
  STICKER_SYMBOLS,
} from "../lib/editor-options.js";
import { canvasToBlob, renderComposition } from "../lib/canvas-compositor.js";
import { StickerLayer } from "./sticker-layer.js";
import styles from "./booth-session.module.css";

interface PhotoEditorProps {
  photos: CapturedPhoto[];
  mirror: boolean;
  filter: BoothFilter;
  onFilterChange: (filter: BoothFilter) => void;
  onNewSession: () => void;
}

function createStickerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sticker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PhotoEditor({
  photos,
  mirror,
  filter,
  onFilterChange,
  onNewSession,
}: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderIdRef = useRef(0);
  const activeExportUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const [layout, setLayout] = useState<BoothLayout>("strip");
  const [stickers, setStickers] = useState<StickerPlacement[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [filterFallback, setFilterFallback] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;

    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    setIsRendering(true);
    setRenderError(null);

    void renderComposition(canvas, {
      photos,
      layout,
      filter,
      mirror,
      stickers,
      isCurrent: () => renderIdRef.current === renderId,
    })
      .then((filterApplied) => {
        if (renderIdRef.current !== renderId) return;
        setFilterFallback(!filterApplied && filter !== "natural");
        setIsRendering(false);
      })
      .catch((error: unknown) => {
        if (renderIdRef.current !== renderId) return;
        setRenderError(
          error instanceof Error
            ? error.message
            : "Photo strip gagal disusun. Foto tetap tersedia untuk dicoba lagi.",
        );
        setIsRendering(false);
      });

    return () => {
      if (renderIdRef.current === renderId) renderIdRef.current += 1;
    };
  }, [filter, layout, mirror, photos, stickers, renderAttempt]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activeExportUrlRef.current) {
        URL.revokeObjectURL(activeExportUrlRef.current);
      }
    };
  }, []);

  const moveSticker = useCallback((id: string, x: number, y: number) => {
    setStickers((current) =>
      current.map((sticker) => (sticker.id === id ? { ...sticker, x, y } : sticker)),
    );
  }, []);

  const removeSticker = useCallback((id: string) => {
    setStickers((current) => current.filter((sticker) => sticker.id !== id));
    setSelectedStickerId((current) => (current === id ? null : current));
  }, []);

  const resizeSticker = useCallback((id: string, difference: number) => {
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === id
          ? {
              ...sticker,
              fontSize: Math.min(
                MAX_STICKER_SIZE,
                Math.max(MIN_STICKER_SIZE, sticker.fontSize + difference),
              ),
            }
          : sticker,
      ),
    );
  }, []);

  function addSticker(symbol: string) {
    const index = stickers.length;
    const sticker: StickerPlacement = {
      id: createStickerId(),
      symbol,
      x: Math.min(0.88, 0.42 + (index % 4) * 0.055),
      y: Math.min(0.88, 0.42 + (Math.floor(index / 4) % 4) * 0.07),
      fontSize: DEFAULT_STICKER_SIZE,
    };
    setStickers((current) => [...current, sticker]);
    setSelectedStickerId(sticker.id);
  }

  async function exportPhoto(format: "png" | "jpg") {
    const canvas = canvasRef.current;
    if (!canvas || isRendering || isExporting) return;

    setIsExporting(true);
    setExportMessage("");
    setExportError(null);
    try {
      const blob = await canvasToBlob(canvas, format);
      if (!mountedRef.current) return;
      const downloadUrl = URL.createObjectURL(blob);
      if (activeExportUrlRef.current) {
        URL.revokeObjectURL(activeExportUrlRef.current);
      }
      activeExportUrlRef.current = downloadUrl;

      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `photo-booth-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setExportMessage(`Unduhan ${format.toUpperCase()} dimulai. Foto tetap tersimpan di sesi browser ini.`);
    } catch (error) {
      if (!mountedRef.current) return;
      setExportError(
        error instanceof Error
          ? error.message
          : "Gambar gagal diekspor. Foto dan editor tetap tersedia untuk dicoba lagi.",
      );
    } finally {
      if (mountedRef.current) setIsExporting(false);
    }
  }

  return (
    <section className={styles.editor} aria-labelledby="photo-editor-title">
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.eyebrow}>Studio dekorasi</p>
          <h2 id="photo-editor-title">Atur photo strip-mu</h2>
          <p>Semua perubahan dan ekspor diproses secara lokal di perangkat.</p>
        </div>
        <span className={styles.photoCount}>{photos.length} foto</span>
      </div>

      <fieldset className={styles.editorGroup}>
        <legend>Tata letak</legend>
        <div className={styles.optionRow}>
          {BOOTH_LAYOUTS.map((option) => (
            <button
              className={
                layout === option.key
                  ? `${styles.optionButton} ${styles.optionButtonSelected}`
                  : styles.optionButton
              }
              type="button"
              key={option.key}
              aria-pressed={layout === option.key}
              onClick={() => setLayout(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className={styles.controlHint}>
          {BOOTH_LAYOUTS.find((option) => option.key === layout)?.description}
        </p>
      </fieldset>

      <fieldset className={styles.editorGroup}>
        <legend>Filter foto</legend>
        <div className={styles.optionRow}>
          {BOOTH_FILTERS.map((option) => (
            <button
              className={
                filter === option.key
                  ? `${styles.optionButton} ${styles.optionButtonSelected}`
                  : styles.optionButton
              }
              type="button"
              key={option.key}
              aria-pressed={filter === option.key}
              onClick={() => onFilterChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.canvasArea}>
        {isRendering ? (
          <p className={styles.canvasStatus} role="status">
            Menyusun pratinjau photo strip…
          </p>
        ) : null}
        <div className={styles.canvasStage} aria-busy={isRendering}>
          <canvas
            ref={canvasRef}
            className={styles.compositionCanvas}
            role="img"
            aria-label={`Pratinjau photo strip ${layout === "strip" ? "memanjang" : "kolase"} dengan ${photos.length} foto${filter === "natural" ? "" : ` dan filter ${BOOTH_FILTERS.find((option) => option.key === filter)?.label}`}`}
          />
          <StickerLayer
            stickers={stickers}
            selectedId={selectedStickerId}
            onSelect={setSelectedStickerId}
            onMove={moveSticker}
            onRemove={removeSticker}
            onResize={resizeSticker}
          />
        </div>
      </div>

      {filterFallback ? (
        <p className={styles.fallbackNotice} role="status">
          Browser ini belum mendukung filter Canvas. Pratinjau tanpa filter; kamu tetap bisa menambahkan stiker dan menyimpan hasilnya.
          <button type="button" onClick={() => onFilterChange("natural")}>
            Gunakan natural
          </button>
        </p>
      ) : null}
      {renderError ? (
        <div className={styles.errorMessage} role="alert">
          <p>{renderError}</p>
          <button
            className={styles.inlineRetry}
            type="button"
            onClick={() => {
              setRenderError(null);
              setRenderAttempt((current) => current + 1);
            }}
          >
            Susun ulang pratinjau
          </button>
        </div>
      ) : null}

      <fieldset className={styles.editorGroup}>
        <legend>Stiker dekoratif</legend>
        <p className={styles.controlHint}>
          Seret stiker pada photo strip. Dengan keyboard: tombol panah untuk
          memindahkan, Shift + panah untuk langkah lebih besar, +/− untuk ukuran,
          dan Delete untuk menghapus.
        </p>
        <div className={styles.stickerPalette}>
          {STICKER_SYMBOLS.map((symbol) => (
            <button
              className={styles.stickerPaletteButton}
              key={symbol}
              type="button"
              onClick={() => addSticker(symbol)}
              aria-label={`Tambahkan stiker ${symbol}`}
            >
              {symbol}
            </button>
          ))}
        </div>
        {selectedStickerId ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => removeSticker(selectedStickerId)}
          >
            Hapus stiker terpilih
          </button>
        ) : null}
      </fieldset>

      <div className={styles.exportPanel}>
        <div>
          <h3>Simpan hasil</h3>
          <p>Unduh langsung ke perangkat. Foto tidak dikirim ke server.</p>
        </div>
        <div className={styles.exportActions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => void exportPhoto("png")}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            {isExporting ? "Menyiapkan…" : "Unduh PNG"}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void exportPhoto("jpg")}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            Unduh JPG
          </button>
        </div>
      </div>
      {exportError ? (
        <p className={styles.errorMessage} role="alert">
          {exportError}
        </p>
      ) : null}
      {exportMessage ? (
        <p className={styles.exportStatus} role="status" aria-live="polite">
          {exportMessage}
        </p>
      ) : null}
      <button className={styles.textButton} type="button" onClick={onNewSession}>
        Mulai sesi foto baru
      </button>
    </section>
  );
}
