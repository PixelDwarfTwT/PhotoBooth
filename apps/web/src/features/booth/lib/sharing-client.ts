import {
  ApiCapabilitiesSchema,
  ShareCreatedResponseSchema,
  type ApiCapabilities,
  type ShareCreatedResponse,
} from "@photobooth/contracts";

export interface NativeFileShareApi {
  share?: unknown;
  canShare?: (data: { files: readonly unknown[] }) => boolean;
}

export function readApiCapabilities(value: unknown): ApiCapabilities | null {
  const parsed = ApiCapabilitiesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readCreatedShare(value: unknown): ShareCreatedResponse | null {
  const parsed = ShareCreatedResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function supportsFileSharing(
  api: NativeFileShareApi | undefined,
  files: readonly unknown[],
): boolean {
  if (
    !api ||
    typeof api.share !== "function" ||
    typeof api.canShare !== "function"
  ) {
    return false;
  }
  try {
    return api.canShare({ files });
  } catch {
    return false;
  }
}
