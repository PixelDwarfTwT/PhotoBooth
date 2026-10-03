import { HttpApiError } from "./api-error.js";

export function mapPrismaCatalogError(error: unknown): unknown {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;

  if (code === "P2002") {
    return new HttpApiError(
      409,
      "catalog_conflict",
      "Nilai katalog sudah digunakan.",
    );
  }
  if (code === "P2003") {
    return new HttpApiError(
      400,
      "catalog_relation_invalid",
      "Relasi data katalog tidak valid.",
    );
  }
  if (code === "P2025") {
    return new HttpApiError(
      404,
      "catalog_record_not_found",
      "Data katalog tidak ditemukan.",
    );
  }

  return error;
}
