import { z } from "zod";

export const ApiCapabilitiesSchema = z.object({
  cloudSharingEnabled: z.boolean(),
  consentVersion: z.string().min(1).max(50),
  shareTtlHours: z.number().int().min(1).max(720),
  shareMaxBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024),
});

export type ApiCapabilities = z.infer<typeof ApiCapabilitiesSchema>;
