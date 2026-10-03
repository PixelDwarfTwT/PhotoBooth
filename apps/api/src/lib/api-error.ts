export class HttpApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpApiError";
  }
}

export interface ApiErrorResponse {
  statusCode: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
}

export function mapApiError(error: unknown): ApiErrorResponse {
  if (error instanceof HttpApiError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  const candidateStatus =
    error instanceof Error && "statusCode" in error
      ? error.statusCode
      : undefined;
  const statusCode =
    typeof candidateStatus === "number" && candidateStatus >= 400
      ? candidateStatus
      : 500;
  const code =
    statusCode === 413
      ? "file_too_large"
      : statusCode === 400
        ? "invalid_request"
        : statusCode === 404
          ? "not_found"
          : statusCode === 415
            ? "unsupported_media_type"
            : statusCode === 429
              ? "rate_limited"
              : statusCode === 503
                ? "service_unavailable"
                : "internal_error";

  const message =
    statusCode === 413
      ? "Ukuran berkas melewati batas yang diizinkan."
      : statusCode === 400
        ? "Permintaan tidak dapat diproses."
        : statusCode === 404
          ? "Endpoint tidak ditemukan."
          : statusCode === 429
            ? "Terlalu banyak permintaan. Coba lagi sebentar."
            : statusCode === 415
              ? "Format berkas ini tidak didukung."
              : statusCode === 503
                ? "Layanan ini belum tersedia. Coba lagi nanti."
                : "Terjadi gangguan pada layanan. Coba lagi beberapa saat.";

  return { statusCode, body: { error: { code, message } } };
}
