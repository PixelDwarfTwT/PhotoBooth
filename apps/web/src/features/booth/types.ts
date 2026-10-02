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
