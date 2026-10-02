"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent, KeyboardEvent } from "react";
import type { StickerPlacement } from "../types.js";
import styles from "./booth-session.module.css";

interface StickerLayerProps {
  stickers: StickerPlacement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, difference: number) => void;
}

function constrain(value: number): number {
  return Math.min(0.96, Math.max(0.04, value));
}

export function StickerLayer({
  stickers,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onResize,
}: StickerLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const updateScale = () => {
      setScale(layer.getBoundingClientRect().width / 1000);
    };
    updateScale();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateScale);
      observer.observe(layer);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    sticker: StickerPlacement,
  ) {
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    onSelect(sticker.id);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (
      activePointerId.current !== event.pointerId ||
      !layerRef.current
    ) {
      return;
    }

    const bounds = layerRef.current.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    onMove(
      event.currentTarget.dataset.stickerId ?? "",
      constrain((event.clientX - bounds.left) / bounds.width),
      constrain((event.clientY - bounds.top) / bounds.height),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (activePointerId.current === event.pointerId) {
      activePointerId.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sticker: StickerPlacement,
  ) {
    const step = event.shiftKey ? 0.04 : 0.012;
    let x = sticker.x;
    let y = sticker.y;

    switch (event.key) {
      case "ArrowLeft":
        x -= step;
        break;
      case "ArrowRight":
        x += step;
        break;
      case "ArrowUp":
        y -= step;
        break;
      case "ArrowDown":
        y += step;
        break;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        onRemove(sticker.id);
        return;
      case "+":
      case "=":
        event.preventDefault();
        onResize(sticker.id, 8);
        return;
      case "-":
        event.preventDefault();
        onResize(sticker.id, -8);
        return;
      default:
        return;
    }

    event.preventDefault();
    onMove(sticker.id, constrain(x), constrain(y));
  }

  return (
    <div
      ref={layerRef}
      className={styles.stickerLayer}
      role="group"
      aria-label="Stiker pada photo strip"
    >
      {stickers.map((sticker, index) => {
        const selected = sticker.id === selectedId;
        const fontSize = Math.max(20, Math.round(sticker.fontSize * scale));

        return (
          <button
            key={sticker.id}
            className={
              selected
                ? `${styles.stickerHandle} ${styles.stickerHandleSelected}`
                : styles.stickerHandle
            }
            type="button"
            data-sticker-id={sticker.id}
            style={{
              left: `${sticker.x * 100}%`,
              top: `${sticker.y * 100}%`,
              fontSize: `${fontSize}px`,
            }}
            aria-label={`Stiker ${sticker.symbol} ${index + 1}, posisi ${Math.round(sticker.x * 100)} persen horizontal dan ${Math.round(sticker.y * 100)} persen vertikal${selected ? ", dipilih" : ""}. Gunakan tombol panah untuk memindahkan, tambah atau minus untuk ukuran, Delete untuk menghapus.`}
            aria-pressed={selected}
            onFocus={() => onSelect(sticker.id)}
            onPointerDown={(event) => handlePointerDown(event, sticker)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={(event) => handleKeyDown(event, sticker)}
          >
            {sticker.symbol}
          </button>
        );
      })}
    </div>
  );
}
