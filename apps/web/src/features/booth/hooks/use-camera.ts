"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraIssue, cameraIssueFromError } from "../lib/camera-errors.js";
import type {
  CameraFacingMode,
  CameraIssue,
  CameraStatus,
} from "../types.js";

interface CameraStartOptions {
  deviceId?: string | null;
  facingMode?: CameraFacingMode;
}

export interface CameraController {
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  facingMode: CameraFacingMode;
  status: CameraStatus;
  error: CameraIssue | null;
  startCamera: (options?: CameraStartOptions) => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  toggleFacingMode: () => Promise<void>;
  stopCamera: () => void;
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useCamera(): CameraController {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState<CameraFacingMode>("user");
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraIssue | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const stopCurrentStream = useCallback(() => {
    const activeStream = streamRef.current;
    streamRef.current = null;
    stopStream(activeStream);
  }, []);

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;
    stopCurrentStream();
    setStream(null);
    setStatus("idle");
    setError(null);
  }, [stopCurrentStream]);

  const startCamera = useCallback(
    async (options?: CameraStartOptions) => {
      if (!window.isSecureContext) {
        setError(cameraIssue("insecure-context"));
        setStatus("error");
        return;
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        setError(cameraIssue("unsupported"));
        setStatus("error");
        return;
      }

      stopCurrentStream();
      setStream(null);
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setError(null);
      setStatus("requesting");

      const deviceId =
        options?.deviceId === null
          ? ""
          : (options?.deviceId ?? selectedDeviceId);
      const nextFacingMode = options?.facingMode ?? facingMode;

      try {
        const nextStream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(deviceId
              ? { deviceId: { exact: deviceId } }
              : { facingMode: { ideal: nextFacingMode } }),
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          stopStream(nextStream);
          return;
        }

        streamRef.current = nextStream;
        setStream(nextStream);
        setFacingMode(nextFacingMode);
        setStatus("live");

        const activeDeviceId = nextStream
          .getVideoTracks()
          .at(0)
          ?.getSettings().deviceId;
        if (activeDeviceId) setSelectedDeviceId(activeDeviceId);

        for (const track of nextStream.getVideoTracks()) {
          track.addEventListener(
            "ended",
            () => {
              if (streamRef.current !== nextStream) return;
              streamRef.current = null;
              setStream(null);
              setError(cameraIssue("stream-ended"));
              setStatus("error");
            },
            { once: true },
          );
        }

        if (typeof mediaDevices.enumerateDevices === "function") {
          try {
            const availableDevices = await mediaDevices.enumerateDevices();
            if (
              mountedRef.current &&
              requestIdRef.current === requestId &&
              streamRef.current === nextStream
            ) {
              setDevices(
                availableDevices.filter((device) => device.kind === "videoinput"),
              );
            }
          } catch {
            // Device labels/listing are optional; the active stream remains usable.
          }
        }
      } catch (cameraError) {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        stopCurrentStream();
        setStream(null);
        setError(cameraIssueFromError(cameraError));
        setStatus("error");
      }
    },
    [facingMode, selectedDeviceId, stopCurrentStream],
  );

  const selectCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (streamRef.current) {
        await startCamera({ deviceId, facingMode });
      }
    },
    [facingMode, startCamera],
  );

  const toggleFacingMode = useCallback(async () => {
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacingMode);
    setSelectedDeviceId("");
    if (streamRef.current) {
      await startCamera({ deviceId: null, facingMode: nextFacingMode });
    }
  }, [facingMode, startCamera]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      stopCurrentStream();
    };
  }, [stopCurrentStream]);

  return {
    stream,
    devices,
    selectedDeviceId,
    facingMode,
    status,
    error,
    startCamera,
    selectCamera,
    toggleFacingMode,
    stopCamera,
  };
}
