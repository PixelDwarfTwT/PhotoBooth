"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent, KeyboardEvent } from "react";
import type { StickerPlacement } from "../types";
import styles from "./booth-session.module.css";

interface StickerLayerProps {
  stickers: StickerPlacement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragChange: (id: string | null) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, difference: number) => void;
}

interface ActiveStickerDrag {
  pointerId: number;
  stickerId: string;
  pointerStartX: number;
  pointerStartY: number;
  stickerStartX: number;
  stickerStartY: number;
  latestX: number;
  latestY: number;
  moved: boolean;
}

function constrain(value: number): number {
  return Math.min(0.96, Math.max(0.04, value));
}

export function StickerLayer({
  stickers,
  selectedId,
  onSelect,
  onMove,
  onDragChange,
  onRemove,
  onResize,
}: StickerLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<ActiveStickerDrag | null>(null);
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
    const layer = layerRef.current;
    if (!layer || activeDragRef.current) return;

    const bounds = layer.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    activeDragRef.current = {
      pointerId: event.pointerId,
      stickerId: sticker.id,
      pointerStartX: (event.clientX - bounds.left) / bounds.width,
      pointerStartY: (event.clientY - bounds.top) / bounds.height,
      stickerStartX: sticker.x,
      stickerStartY: sticker.y,
      latestX: sticker.x,
      latestY: sticker.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    onSelect(sticker.id);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = activeDragRef.current;
    const layer = layerRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !layer) return;

    const bounds = layer.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    const pointerX = (event.clientX - bounds.left) / bounds.width;
    const pointerY = (event.clientY - bounds.top) / bounds.height;
    const nextX = constrain(
      drag.stickerStartX + pointerX - drag.pointerStartX,
    );
    const nextY = constrain(
      drag.stickerStartY + pointerY - drag.pointerStartY,
    );
    if (
      !drag.moved &&
      nextX === drag.stickerStartX &&
      nextY === drag.stickerStartY
    ) {
      return;
    }

    if (!drag.moved) {
      drag.moved = true;
      onDragChange(drag.stickerId);
    }
    drag.latestX = nextX;
    drag.latestY = nextY;
    event.currentTarget.style.setProperty(
      "--sticker-drag-x",
      `${(nextX - drag.stickerStartX) * bounds.width}px`,
    );
    event.currentTarget.style.setProperty(
      "--sticker-drag-y",
      `${(nextY - drag.stickerStartY) * bounds.height}px`,
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const bounds = layerRef.current?.getBoundingClientRect();
    if (drag.moved) {
      if (bounds && bounds.width >= 1 && bounds.height >= 1) {
        const pointerX = (event.clientX - bounds.left) / bounds.width;
        const pointerY = (event.clientY - bounds.top) / bounds.height;
        drag.latestX = constrain(
          drag.stickerStartX + pointerX - drag.pointerStartX,
        );
        drag.latestY = constrain(
          drag.stickerStartY + pointerY - drag.pointerStartY,
        );
        event.currentTarget.style.setProperty(
          "--sticker-drag-x",
          `${(drag.latestX - drag.stickerStartX) * bounds.width}px`,
        );
        event.currentTarget.style.setProperty(
          "--sticker-drag-y",
          `${(drag.latestY - drag.stickerStartY) * bounds.height}px`,
        );
      }
      onMove(drag.stickerId, drag.latestX, drag.latestY);
      onDragChange(null);
    }

    activeDragRef.current = null;
    event.currentTarget.style.removeProperty("--sticker-drag-x");
    event.currentTarget.style.removeProperty("--sticker-drag-y");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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
