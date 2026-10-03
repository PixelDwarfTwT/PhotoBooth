import type { CameraIssue, CameraIssueCode } from "../types";

const CAMERA_MESSAGES: Record<CameraIssueCode, string> = {
  "insecure-context":
    "Kamera hanya bisa digunakan melalui HTTPS atau localhost.",
  unsupported:
    "Browser ini belum mendukung akses kamera. Coba gunakan versi terbaru Chrome, Safari, Firefox, atau Edge.",
  "permission-denied":
    "Izin kamera belum diberikan. Ubah izin situs di pengaturan browser, lalu coba lagi.",
  "no-camera":
    "Kami tidak menemukan kamera yang dapat digunakan di perangkat ini.",
  "camera-busy":
    "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.",
  "device-unavailable":
    "Kamera yang dipilih tidak tersedia. Pilih kamera lain atau coba lagi.",
  "stream-ended":
    "Koneksi kamera terputus. Aktifkan kamera kembali untuk melanjutkan.",
  unknown: "Kamera tidak dapat dimulai. Coba lagi atau pilih perangkat lain.",
};

export function cameraIssue(code: CameraIssueCode): CameraIssue {
  return { code, message: CAMERA_MESSAGES[code] };
}

export function cameraIssueFromError(error: unknown): CameraIssue {
  const name =
    error instanceof Error && "name" in error ? error.name : undefined;

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return cameraIssue("permission-denied");
    case "NotFoundError":
    case "DevicesNotFoundError":
      return cameraIssue("no-camera");
    case "NotReadableError":
    case "TrackStartError":
      return cameraIssue("camera-busy");
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return cameraIssue("device-unavailable");
    case "SecurityError":
      return cameraIssue("insecure-context");
    default:
      return cameraIssue("unknown");
  }
}
