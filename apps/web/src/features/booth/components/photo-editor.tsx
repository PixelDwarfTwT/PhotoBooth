"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BoothFilter,
  BoothLayout,
  CapturedPhoto,
  StickerPlacement,
} from "../types";
import {
  BOOTH_FILTERS,
  BOOTH_LAYOUTS,
  DEFAULT_FILTER_OPTIONS,
  LOCAL_FRAMES,
  DEFAULT_STICKER_SIZE,
  MAX_STICKER_SIZE,
  MIN_STICKER_SIZE,
  STICKER_SYMBOLS,
  getFrameLayouts,
} from "../lib/editor-options";
import { API_ORIGIN } from "@/lib/api-origin";
import { readFilterCatalog, readFrameCatalog } from "../lib/catalog-client";
import {
  getDefaultFrameId,
  prioritizeRemoteFrames,
} from "../lib/frame-selection";
import { canvasToBlob, renderComposition } from "../lib/canvas-compositor";
import { createLoopGif, recordPhotoLoop } from "../lib/motion-export";
import { MOTION_FILTERS, type MotionFilter } from "../lib/export-presets";
import { createStoryBlob } from "../lib/story-export";
import { StickerLayer } from "./sticker-layer";
import { ShareControls } from "./share-controls";
import styles from "./booth-session.module.css";

interface PhotoEditorProps {
  photos: CapturedPhoto[];
  mirror: boolean;
  filter: BoothFilter;
  onFilterChange: (filter: BoothFilter) => void;
  onFilterIntensityChange: (intensity: number) => void;
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
  onFilterIntensityChange,
  onNewSession,
}: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderIdRef = useRef(0);
  const activeExportUrlRef = useRef<string | null>(null);
  const storyPreviewUrlRef = useRef<string | null>(null);
  const motionPreviewUrlRef = useRef<string | null>(null);
  const printImageUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const motionAbortRef = useRef<AbortController | null>(null);
  const [layout, setLayout] = useState<BoothLayout>("strip");
  const [frames, setFrames] = useState([...LOCAL_FRAMES]);
  const [selectedFrameId, setSelectedFrameId] = useState(LOCAL_FRAMES[0]!.id);
  const [filterOptions, setFilterOptions] = useState([
    ...DEFAULT_FILTER_OPTIONS,
  ]);
  const [filterStrength, setFilterStrength] = useState(1);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [removeFrameBackground, setRemoveFrameBackground] = useState(true);
  const [frameBackgroundNotice, setFrameBackgroundNotice] = useState("");
  const [stickers, setStickers] = useState<StickerPlacement[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [filterFallback, setFilterFallback] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [motionFilter, setMotionFilter] = useState<MotionFilter>("normal");
  const [stillPreviewUrl, setStillPreviewUrl] = useState<string | null>(null);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [motionPreviewUrl, setMotionPreviewUrl] = useState<string | null>(null);
  const [motionPreviewFormat, setMotionPreviewFormat] = useState<
    "gif" | "video" | null
  >(null);
  const [motionPreviewFilter, setMotionPreviewFilter] =
    useState<MotionFilter>("normal");
  const [printImageUrl, setPrintImageUrl] = useState<string | null>(null);
  const activeFrame =
    frames.find((frame) => frame.id === selectedFrameId) ?? frames[0]!;
  const frameLayouts = useMemo(
    () => getFrameLayouts(activeFrame.layoutConfig),
    [activeFrame.layoutConfig],
  );
  const activeFilter =
    filterOptions.find((option) => option.key === filter) ??
    DEFAULT_FILTER_OPTIONS.find((option) => option.key === filter) ??
    DEFAULT_FILTER_OPTIONS[0]!;

  useEffect(() => {
    if (!API_ORIGIN) return;
    const controller = new AbortController();

    void Promise.all([
      fetch(`${API_ORIGIN}/api/frames`, { signal: controller.signal }),
      fetch(`${API_ORIGIN}/api/filters`, { signal: controller.signal }),
    ])
      .then(async ([framesResponse, filtersResponse]) => {
        if (!framesResponse.ok || !filtersResponse.ok) {
          throw new Error("Katalog online belum tersedia.");
        }
        return [
          await framesResponse.json(),
          await filtersResponse.json(),
        ] as const;
      })
      .then(([framePayload, filterPayload]) => {
        const remoteFrames = readFrameCatalog(framePayload);
        const remoteFilters = readFilterCatalog(filterPayload);
        if (remoteFrames.length) {
          setFrames(prioritizeRemoteFrames(remoteFrames, LOCAL_FRAMES));
          setSelectedFrameId(
            getDefaultFrameId(remoteFrames, LOCAL_FRAMES[0]!.id),
          );
        }
        if (remoteFilters.length) setFilterOptions(remoteFilters);
        setCatalogNotice(
          `${remoteFrames.length} bingkai Supabase + ${LOCAL_FRAMES.length} preset lokal tersedia.`,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalogNotice(
            "Katalog online belum terjangkau; preset lokal tetap tersedia.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!frameLayouts.includes(layout)) setLayout(frameLayouts[0] ?? "strip");
  }, [frameLayouts, layout]);

  useEffect(() => {
    if (filterOptions.some((option) => option.key === filter)) return;
    const firstFilter = filterOptions[0];
    if (firstFilter) onFilterChange(firstFilter.key);
  }, [filter, filterOptions, onFilterChange]);

  useEffect(() => {
    setFilterStrength(activeFilter.intensity);
    onFilterIntensityChange(activeFilter.intensity);
  }, [activeFilter.key, activeFilter.intensity, onFilterIntensityChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;

    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    setIsRendering(true);
    setRenderError(null);
    setFrameBackgroundNotice("");

    void renderComposition(canvas, {
      photos,
      layout: frameLayouts.includes(layout)
        ? layout
        : (frameLayouts[0] ?? "strip"),
      filter,
      filterIntensity: filterStrength,
      mirror,
      stickers,
      frame: activeFrame.layoutConfig,
      frameAssetUrl: activeFrame.assetUrl,
      removeFrameBackground,
      onFrameBackgroundRemovalFailure: () => {
        if (renderIdRef.current === renderId) {
          setFrameBackgroundNotice(
            "Latar template tidak dikenali. Asset gambar dilewati agar foto tetap terlihat; gunakan PNG frame transparan untuk hasil terbaik.",
          );
        }
      },
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
  }, [
    activeFrame.assetUrl,
    activeFrame.layoutConfig,
    filter,
    filterStrength,
    frameLayouts,
    layout,
    mirror,
    photos,
    removeFrameBackground,
    stickers,
    renderAttempt,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      motionAbortRef.current?.abort();
      if (activeExportUrlRef.current) {
        URL.revokeObjectURL(activeExportUrlRef.current);
      }
      if (storyPreviewUrlRef.current)
        URL.revokeObjectURL(storyPreviewUrlRef.current);
      if (motionPreviewUrlRef.current)
        URL.revokeObjectURL(motionPreviewUrlRef.current);
      if (printImageUrlRef.current)
        URL.revokeObjectURL(printImageUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRendering) return;
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return;
    try {
      setStillPreviewUrl(canvas.toDataURL("image/jpeg", 0.68));
    } catch {
      setStillPreviewUrl(null);
    }
  }, [isRendering]);

  useEffect(() => {
    const onAfterPrint = () => {
      if (printImageUrlRef.current) {
        URL.revokeObjectURL(printImageUrlRef.current);
        printImageUrlRef.current = null;
      }
      setPrintImageUrl(null);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const moveSticker = useCallback((id: string, x: number, y: number) => {
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === id ? { ...sticker, x, y } : sticker,
      ),
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
      setExportMessage(
        `Unduhan ${format.toUpperCase()} dimulai. Foto tetap tersimpan di sesi browser ini.`,
      );
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

  async function exportMotion(format: "gif" | "video") {
    const canvas = canvasRef.current;
    if (!canvas || isRendering || isExporting) return;

    const abortController = new AbortController();
    motionAbortRef.current = abortController;
    setIsExporting(true);
    setExportMessage(
      format === "gif"
        ? "Membuat GIF loop di perangkat…"
        : "Merekam klip loop di perangkat…",
    );
    setExportError(null);
    try {
      const blob =
        format === "gif"
          ? await createLoopGif(canvas, { filter: motionFilter })
          : await recordPhotoLoop(canvas, {
              signal: abortController.signal,
              filter: motionFilter,
            });
      if (!mountedRef.current || abortController.signal.aborted) return;
      const downloadUrl = URL.createObjectURL(blob);
      if (activeExportUrlRef.current)
        URL.revokeObjectURL(activeExportUrlRef.current);
      activeExportUrlRef.current = downloadUrl;
      const previewUrl = URL.createObjectURL(blob);
      if (motionPreviewUrlRef.current) {
        URL.revokeObjectURL(motionPreviewUrlRef.current);
      }
      motionPreviewUrlRef.current = previewUrl;
      setMotionPreviewUrl(previewUrl);
      setMotionPreviewFormat(format);
      setMotionPreviewFilter(motionFilter);
      const extension =
        format === "gif" ? "gif" : blob.type.includes("mp4") ? "mp4" : "webm";
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `photo-booth-loop-${new Date().toISOString().slice(0, 10)}.${extension}`;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setExportMessage(
        `Unduhan ${extension.toUpperCase()} dimulai. Klip dibuat di perangkat ini.`,
      );
    } catch (error) {
      if (!mountedRef.current) return;
      setExportError(
        error instanceof Error
          ? error.message
          : "Klip loop gagal dibuat. PNG dan JPG tetap tersedia.",
      );
      setExportMessage("");
    } finally {
      motionAbortRef.current = null;
      if (mountedRef.current) setIsExporting(false);
    }
  }

  async function exportStory() {
    const canvas = canvasRef.current;
    if (!canvas || isRendering || isExporting) return;
    setIsExporting(true);
    setExportMessage("Menyiapkan gambar Instagram Story di perangkat…");
    setExportError(null);
    try {
      const blob = await createStoryBlob(canvas);
      if (!mountedRef.current) return;
      const downloadUrl = URL.createObjectURL(blob);
      if (activeExportUrlRef.current) {
        URL.revokeObjectURL(activeExportUrlRef.current);
      }
      activeExportUrlRef.current = downloadUrl;
      const previewUrl = URL.createObjectURL(blob);
      if (storyPreviewUrlRef.current) {
        URL.revokeObjectURL(storyPreviewUrlRef.current);
      }
      storyPreviewUrlRef.current = previewUrl;
      setStoryPreviewUrl(previewUrl);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `photo-booth-story-${new Date().toISOString().slice(0, 10)}.png`;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setExportMessage("Instagram Story 9:16 diunduh ke perangkat.");
    } catch (error) {
      if (!mountedRef.current) return;
      setExportError(
        error instanceof Error
          ? error.message
          : "Gambar Story gagal dibuat. Hasil photo strip tetap tersedia.",
      );
      setExportMessage("");
    } finally {
      if (mountedRef.current) setIsExporting(false);
    }
  }

  async function printPhoto() {
    const canvas = canvasRef.current;
    if (!canvas || isRendering || isExporting || Boolean(renderError)) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await canvasToBlob(canvas, "png");
      if (!mountedRef.current) return;
      const imageUrl = URL.createObjectURL(blob);
      if (printImageUrlRef.current)
        URL.revokeObjectURL(printImageUrlRef.current);
      printImageUrlRef.current = imageUrl;
      setPrintImageUrl(imageUrl);
      window.requestAnimationFrame(() => window.print());
    } catch (error) {
      if (!mountedRef.current) return;
      setExportError(
        error instanceof Error
          ? error.message
          : "Photo strip gagal disiapkan untuk dicetak.",
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

      <div className={styles.editorWorkspace}>
        <div className={styles.editorCanvasColumn}>
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
              Browser ini belum mendukung filter Canvas. Pratinjau tanpa filter;
              kamu tetap bisa menambahkan stiker dan menyimpan hasilnya.
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
        </div>

        <div className={styles.editorControls}>
          <fieldset className={styles.editorGroup}>
            <legend>Tata letak</legend>
            <div className={styles.optionRow}>
              {BOOTH_LAYOUTS.filter((option) =>
                frameLayouts.includes(option.key),
              ).map((option) => (
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
              {
                BOOTH_LAYOUTS.find((option) => option.key === layout)
                  ?.description
              }
            </p>
          </fieldset>

          <fieldset className={styles.editorGroup}>
            <legend>Bingkai foto ({frames.length})</legend>
            <div className={styles.frameOptions}>
              {frames.map((frame) => (
                <button
                  className={
                    selectedFrameId === frame.id
                      ? `${styles.frameOption} ${styles.frameOptionSelected}`
                      : styles.frameOption
                  }
                  type="button"
                  key={frame.id}
                  aria-pressed={selectedFrameId === frame.id}
                  onClick={() => setSelectedFrameId(frame.id)}
                >
                  <span
                    className={styles.frameSwatch}
                    aria-hidden="true"
                    style={{
                      background: frame.layoutConfig.backgroundColor,
                      borderColor: frame.layoutConfig.borderColor,
                    }}
                  />
                  {frame.name}
                </button>
              ))}
            </div>
            {catalogNotice ? (
              <p className={styles.controlHint} role="status">
                {catalogNotice}
              </p>
            ) : null}
            {activeFrame.assetUrl ? (
              <div className={styles.frameBackgroundControl}>
                <label className={styles.frameBackgroundToggle}>
                  <input
                    type="checkbox"
                    checked={removeFrameBackground}
                    onChange={(event) =>
                      setRemoveFrameBackground(event.currentTarget.checked)
                    }
                  />
                  Hapus latar terang otomatis
                </label>
                <p className={styles.controlHint}>
                  Pola kotak-kotak di frame dibersihkan di browser. Foto tidak
                  diunggah; matikan opsi ini jika ada detail terang yang ikut
                  hilang.
                </p>
              </div>
            ) : null}
            {frameBackgroundNotice ? (
              <p className={styles.fallbackNotice} role="status">
                {frameBackgroundNotice}
              </p>
            ) : null}
          </fieldset>

          <fieldset className={styles.editorGroup}>
            <legend>Filter foto</legend>
            <div className={styles.optionRow}>
              {filterOptions.map((option) => (
                <button
                  className={
                    filter === option.key
                      ? `${styles.optionButton} ${styles.optionButtonSelected}`
                      : styles.optionButton
                  }
                  type="button"
                  key={option.key}
                  aria-pressed={filter === option.key}
                  onClick={() => {
                    onFilterChange(option.key);
                    setFilterStrength(option.intensity);
                    onFilterIntensityChange(option.intensity);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label
              className={styles.rangeField}
              htmlFor="photo-filter-strength"
            >
              <span>
                Intensitas filter{" "}
                <strong>{Math.round(filterStrength * 100)}%</strong>
              </span>
              <input
                id="photo-filter-strength"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={filterStrength}
                disabled={filter === "natural"}
                aria-valuetext={`${Math.round(filterStrength * 100)} persen`}
                onChange={(event) => {
                  const nextStrength = Number(event.currentTarget.value);
                  setFilterStrength(nextStrength);
                  onFilterIntensityChange(nextStrength);
                }}
              />
            </label>
          </fieldset>

          <fieldset className={styles.editorGroup}>
            <legend>Filter video dan GIF</legend>
            <div className={styles.optionRow}>
              {MOTION_FILTERS.map((option) => (
                <button
                  className={
                    motionFilter === option.key
                      ? `${styles.optionButton} ${styles.optionButtonSelected}`
                      : styles.optionButton
                  }
                  type="button"
                  key={option.key}
                  aria-pressed={motionFilter === option.key}
                  onClick={() => setMotionFilter(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className={styles.controlHint}>
              Filter ini hanya dipakai untuk GIF dan klip video; foto dan ekspor
              gambar tetap memakai filter foto di atas.
            </p>
          </fieldset>

          <fieldset className={styles.editorGroup}>
            <legend>Stiker dekoratif</legend>
            <p className={styles.controlHint}>
              Seret stiker pada photo strip. Dengan keyboard: tombol panah untuk
              memindahkan, Shift + panah untuk langkah lebih besar, +/− untuk
              ukuran, dan Delete untuk menghapus.
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
        </div>
      </div>

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
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void exportStory()}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            Unduh Instagram Story 9:16
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void printPhoto()}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            Cetak photo strip
          </button>
        </div>
        <div className={styles.motionActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void exportMotion("gif")}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            {isExporting && exportMessage.startsWith("Membuat GIF")
              ? "Membuat GIF…"
              : "Unduh GIF loop"}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void exportMotion("video")}
            disabled={isRendering || isExporting || Boolean(renderError)}
          >
            {isExporting && exportMessage.startsWith("Merekam")
              ? "Merekam klip…"
              : "Unduh klip loop"}
          </button>
        </div>
        <ShareControls
          canvasRef={canvasRef}
          disabled={isRendering || isExporting || Boolean(renderError)}
        />
      </div>
      <section className={styles.resultPreviews} aria-label="Pratinjau hasil">
        <h3>Hasil siap dibagikan</h3>
        <div className={styles.resultPreviewGrid}>
          <figure className={styles.resultPreviewCard}>
            <figcaption>Photo strip</figcaption>
            {stillPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stillPreviewUrl} alt="Pratinjau photo strip" />
            ) : (
              <span className={styles.previewPlaceholder}>Sedang disusun…</span>
            )}
          </figure>
          <figure className={styles.resultPreviewCard}>
            <figcaption>Instagram Story 9:16</figcaption>
            {storyPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storyPreviewUrl} alt="Pratinjau Instagram Story" />
            ) : stillPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.storyStillPreview}
                src={stillPreviewUrl}
                alt="Photo strip yang akan dimuat dalam kanvas Story"
              />
            ) : (
              <span className={styles.previewPlaceholder}>Belum ada hasil</span>
            )}
          </figure>
          {motionPreviewUrl && motionPreviewFormat ? (
            <figure className={styles.resultPreviewCard}>
              <figcaption>
                {motionPreviewFormat === "gif" ? "GIF loop" : "Klip video"} ·{" "}
                {
                  MOTION_FILTERS.find(
                    (item) => item.key === motionPreviewFilter,
                  )?.label
                }
              </figcaption>
              {motionPreviewFormat === "gif" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={motionPreviewUrl} alt="Pratinjau GIF loop" />
              ) : (
                <video
                  src={motionPreviewUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Pratinjau klip video"
                />
              )}
            </figure>
          ) : null}
        </div>
      </section>
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
      <button
        className={styles.textButton}
        type="button"
        onClick={onNewSession}
      >
        Mulai sesi foto baru
      </button>
      {printImageUrl ? (
        <div className={styles.printOnly}>
          {/* The print-only copy is created from the current local canvas. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={printImageUrl} alt="Photo strip untuk dicetak" />
        </div>
      ) : null}
    </section>
  );
}
