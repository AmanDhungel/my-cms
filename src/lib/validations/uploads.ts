import { z } from "zod"

import {
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_PURPOSES,
} from "@/lib/storage/types"

/**
 * What the upload endpoint will sign for, and nothing else.
 *
 * The same list storage enforces, under the name this module has always
 * exported — one allowlist, not two that drift.
 */
export const UPLOAD_TYPES = UPLOAD_CONTENT_TYPES

export const uploadSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(UPLOAD_TYPES, {
    message: "Images only — JPEG, PNG, WebP or AVIF",
  }),
  /**
   * Bytes. Checked here so a signature is never handed out for a huge file,
   * and set to the same megabyte the browser compresses down to — anything
   * arriving over it did not come through our own form.
   */
  size: z
    .number()
    .int()
    .positive()
    .max(
      MAX_UPLOAD_BYTES,
      "Pictures are compressed under 1 MB before uploading"
    ),
})

export type UploadValues = z.infer<typeof uploadSchema>

export const deleteUploadSchema = z.object({
  urls: z.array(z.string().trim().url()).max(50, "That is a lot of files"),
})
