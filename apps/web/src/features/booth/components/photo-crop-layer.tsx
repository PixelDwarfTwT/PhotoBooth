"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { CapturedPhoto } from "../types";
import {
  moveCoverCropPosition,
  type PhotoCropGeometry,
  type PhotoCropPosition,
} from "../lib/canvas-compositor";
import styles from "./booth-session.module.css";

interface PhotoCropLayerProps {
  photos: CapturedPhoto[];
  geometry: PhotoCropGeometry | null;
  positions: Record<string, PhotoCropPosition>;
  defaultPosition: PhotoCropPosition;
  filterCss: string;
  onMove: (photoId: string, position: PhotoCropPosition) => void;
}

interface ActivePhotoDrag {
  pointerId: number;
  photoId: string;
  photoIndex: number;
  cell: PhotoCropGeometry["cells"][number];
  pointerStartX: number;
  pointerStartY: number;
  positionStart: PhotoCropPosition;
  latestPosition: PhotoCropPosition;
  moved: boolean;
}

interface CropPreview {
  photoId: string;
  position: PhotoCropPosition;
}

interface PendingCropPreview extends CropPreview {
  baseGeometry: PhotoCropGeometry;
}

export function PhotoCropLayer({
  photos,
  geometry,
  positions,
  defaultPosition,
  filterCss,
  onMove,
}: PhotoCropLayerProps) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [activePreview, setActivePreview] = useState<CropPreview | null>(null);
  const [pendingPreview, setPendingPreview] =
    useState<PendingCropPreview | null>(null);
  const activeDragRef = useRef<ActivePhotoDrag | null>(null);
  const frameLayerRef = useRef<HTMLCanvasElement>(null);
  const showPreview = activePreview !== null || pendingPreview !== null;

  useEffect(() => {
    const urls = Object.fromEntries(
      photos.map((photo) => [photo.id, URL.createObjectURL(photo.blob)]),
    );
    setPhotoUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  useEffect(() => {
    if (pendingPreview && geometry !== pendingPreview.baseGeometry) {
      setPendingPreview(null);
    }
  }, [geometry, pendingPreview]);

  useEffect(() => {
    const target = frameLayerRef.current;
    const frameLayer = geometry?.frameLayer;
    if (!target || !frameLayer) return;
    const context = target.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(frameLayer, 0, 0);
  }, [geometry?.frameLayer, showPreview]);

  function getPosition(photoId: string): PhotoCropPosition {
    return positions[photoId] ?? defaultPosition;
  }

  function commitPosition(photoId: string, position: PhotoCropPosition) {
    if (geometry)
      setPendingPreview({ photoId, position, baseGeometry: geometry });
    onMove(photoId, position);
  }

  function positionAtPointer(
    event: Pick<PointerEvent<HTMLButtonElement>, "clientX" | "clientY">,
    drag: ActivePhotoDrag,
    bounds: DOMRect,
  ): PhotoCropPosition {
    const deltaX =
      ((event.clientX - drag.pointerStartX) / bounds.width) * drag.cell.width;
    const deltaY =
      ((event.clientY - drag.pointerStartY) / bounds.height) * drag.cell.height;

    return moveCoverCropPosition(
      drag.positionStart,
      photos[drag.photoIndex]!.width,
      photos[drag.photoIndex]!.height,
      drag.cell.width,
      drag.cell.height,
      deltaX,
      deltaY,
    );
  }

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    photo: CapturedPhoto,
    photoIndex: number,
    cell: PhotoCropGeometry["cells"][number],
  ) {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;

    const position = getPosition(photo.id);
    activeDragRef.current = {
      pointerId: event.pointerId,
      photoId: photo.id,
      photoIndex,
      cell,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      positionStart: position,
      latestPosition: position,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    const nextPosition = positionAtPointer(event, drag, bounds);
    if (
      nextPosition.x === drag.latestPosition.x &&
      nextPosition.y === drag.latestPosition.y
    ) {
      return;
    }

    drag.latestPosition = nextPosition;
    drag.moved = true;
    setActivePreview({ photoId: drag.photoId, position: nextPosition });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width >= 1 && bounds.height >= 1) {
      const finalPosition = positionAtPointer(event, drag, bounds);
      if (
        finalPosition.x !== drag.latestPosition.x ||
        finalPosition.y !== drag.latestPosition.y
      ) {
        drag.latestPosition = finalPosition;
        drag.moved = true;
      }
    }
    if (drag.moved) {
      const preview = {
        photoId: drag.photoId,
        position: drag.latestPosition,
      };
      commitPosition(preview.photoId, preview.position);
    }
    setActivePreview(null);

    activeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    photo: CapturedPhoto,
    cell: PhotoCropGeometry["cells"][number],
  ) {
    const step = event.shiftKey ? 0.08 : 0.025;
    let deltaX = 0;
    let deltaY = 0;

    switch (event.key) {
      case "ArrowLeft":
        deltaX = -cell.width * step;
        break;
      case "ArrowRight":
        deltaX = cell.width * step;
        break;
      case "ArrowUp":
        deltaY = -cell.height * step;
        break;
      case "ArrowDown":
        deltaY = cell.height * step;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextPosition = moveCoverCropPosition(
      getPosition(photo.id),
      photo.width,
      photo.height,
      cell.width,
      cell.height,
      deltaX,
      deltaY,
    );
    commitPosition(photo.id, nextPosition);
  }

  if (!geometry) return null;
  const preview = activePreview ?? pendingPreview;
  const previewIndex = preview
    ? photos.findIndex((photo) => photo.id === preview.photoId)
    : -1;
  const previewPhoto = previewIndex >= 0 ? photos[previewIndex] : undefined;
  const previewCell =
    previewIndex >= 0 ? geometry.cells[previewIndex] : undefined;

  return (
    <div
      className={styles.photoCropLayer}
      role="group"
      aria-label="Atur crop foto"
    >
      {preview && previewPhoto && previewCell && photoUrls[preview.photoId] ? (
        <img
          className={styles.photoCropPreview}
          src={photoUrls[preview.photoId]}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            left: `${(previewCell.x / geometry.width) * 100}%`,
            top: `${(previewCell.y / geometry.height) * 100}%`,
            width: `${(previewCell.width / geometry.width) * 100}%`,
            height: `${(previewCell.height / geometry.height) * 100}%`,
            objectPosition: `${preview.position.x * 100}% ${preview.position.y * 100}%`,
            filter: filterCss,
          }}
        />
      ) : null}
      {preview && geometry.frameLayer ? (
        <canvas
          ref={frameLayerRef}
          className={styles.photoCropFrameLayer}
          width={geometry.width}
          height={geometry.height}
          aria-hidden="true"
        />
      ) : null}
      {photos.map((photo, photoIndex) => {
        const cell = geometry.cells[photoIndex];
        if (!cell) return null;
        const position = getPosition(photo.id);

        return (
          <button
            key={photo.id}
            className={styles.photoCropHandle}
            type="button"
            style={{
              left: `${(cell.x / geometry.width) * 100}%`,
              top: `${(cell.y / geometry.height) * 100}%`,
              width: `${(cell.width / geometry.width) * 100}%`,
              height: `${(cell.height / geometry.height) * 100}%`,
            }}
            aria-label={`Atur crop foto ${photoIndex + 1}. Posisi ${Math.round(position.x * 100)} persen horizontal, ${Math.round(position.y * 100)} persen vertikal. Seret untuk menggeser; gunakan tombol panah, Shift plus panah untuk langkah lebih besar.`}
            title={`Seret untuk menggeser foto ${photoIndex + 1}`}
            onPointerDown={(event) =>
              handlePointerDown(event, photo, photoIndex, cell)
            }
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={(event) => handleKeyDown(event, photo, cell)}
          />
        );
      })}
    </div>
  );
}
