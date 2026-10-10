import { z } from "zod";

export const galleryEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/),
    title: z.string().min(1).max(80),
    agent: z
      .object({
        name: z.string().min(1).max(60),
        kind: z.enum(["rules", "model", "other"]),
        homepage: z.string().url().startsWith("https://").optional(),
      })
      .strict(),
    report: z.string().regex(/^gallery\/[a-z0-9][a-z0-9-]{1,59}\.json$/),
    submittedBy: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
    submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(300).optional(),
  })
  .strict()
  .refine((e) => e.report === `gallery/${e.id}.json`, { message: "report must be gallery/<id>.json", path: ["report"] });

export const galleryIndexSchema = z
  .array(galleryEntrySchema)
  .max(500)
  .refine((entries) => new Set(entries.map((e) => e.id)).size === entries.length, "entry ids must be unique");

export type GalleryEntry = z.infer<typeof galleryEntrySchema>;

export function parseGalleryIndex(json: unknown): GalleryEntry[] {
  return galleryIndexSchema.parse(json);
}
