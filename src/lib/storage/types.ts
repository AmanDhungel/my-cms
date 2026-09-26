/**
 * The storage constants that both sides of an upload agree on.
 *
 * Kept apart from the S3 implementation so a browser bundle — the compressor,
 * the validation schema that a form may share — can import the ceiling and
 * the allowlist without dragging the AWS SDK or a `node:` module along with
 * them. Nothing here may import either.
 */

/**
 * The most an upload may weigh, in bytes.
 *
 * A round million rather than a mebibyte: it is the number the browser
 * compresses down to, the number the server refuses above, and the number
 * the "1 MB" copy in the UI describes, so one value is the only honest
 * choice. Anything arriving over it did not come through our own form.
 */
export const MAX_UPLOAD_BYTES = 1_000_000

/**
 * What storage will hold, and nothing else — no SVG, which can carry
 * script.
 */
export const UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number]

export function isUploadContentType(
  value: unknown
): value is UploadContentType {
  return (
    typeof value === "string" &&
    (UPLOAD_CONTENT_TYPES as readonly string[]).includes(value)
  )
}

/**
 * What an upload is for.
 *
 * It only decides the folder, but the folder is what makes a bucket
 * readable a year later — and what lets a lifecycle rule treat one kind of
 * file differently from another.
 */
export const UPLOAD_PURPOSES = [
  "site",
  "maintenance",
  "ticket",
  "products",
  "logo",
] as const
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return (
    typeof value === "string" &&
    (UPLOAD_PURPOSES as readonly string[]).includes(value)
  )
}
