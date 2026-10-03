import { z } from "zod";

export const ShareCreatedResponseSchema = z
  .object({
    shareUrl: z.url().refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Share URL must use HTTP or HTTPS."),
    qrCodeDataUrl: z.string().startsWith("data:image/png;base64,").nullable(),
    deleteToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.iso.datetime(),
    mimeType: z.enum(["image/png", "image/jpeg"]),
    fileSizeBytes: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024),
  })
  .strict();

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({ code: z.string().min(1), message: z.string().min(1) })
      .strict(),
  })
  .strict();

export type ShareCreatedResponse = z.infer<typeof ShareCreatedResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
