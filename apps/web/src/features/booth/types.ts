export type CameraFacingMode = "user" | "environment";

export type CameraStatus = "idle" | "requesting" | "live" | "error";

export type CameraIssueCode =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "no-camera"
  | "camera-busy"
  | "device-unavailable"
  | "stream-ended"
  | "unknown";

export interface CameraIssue {
  code: CameraIssueCode;
  message: string;
}

export interface CapturedPhoto {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

export type CapturePhase =
  "idle" | "countdown" | "capturing" | "complete" | "error";

export type BoothLayout = "strip" | "grid";

export type BoothFilter = "natural" | "warm" | "soft" | "mono";

export interface StickerPlacement {
  id: string;
  symbol: string;
  x: number;
  y: number;
  fontSize: number;
}
