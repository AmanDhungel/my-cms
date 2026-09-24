import { randomUUID } from "node:crypto"

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { HttpError } from "@/lib/api-response"

/**
 * Every file the app stores, in one place.
 *
 * Two operations, used by every feature that holds a picture: sign an upload,
 * and delete one. They live here rather than beside each feature so there is a
 * single answer to where an object goes, how it is named, and what it costs to
 * remove — and so a new feature that holds images inherits all of it.
 *
 * The bytes never pass through this server. The browser asks for a signed
 * URL, PUTs straight to S3 and reports the address back, which keeps a photo
 * off the request path and the AWS keys off the client.
 */

const REGION = process.env.AWS_REGION
const BUCKET = process.env.AWS_BUCKET_NAME

/**
 * Built lazily and kept.
 *
 * A module-level client would be constructed while the build collects pages,
 * where the environment may not carry the keys at all — and would then throw
 * during a build that has no intention of uploading anything.
 */
let client: S3Client | null = null

function s3() {
  const id = process.env.AWS_ACCESS_KEY_ID
  const secret = process.env.AWS_SECRET_ACCESS_KEY

  if (!REGION || !BUCKET || !id || !secret) {
    throw new HttpError(
      503,
      "File storage isn't configured on this server yet."
    )
  }

  client ??= new S3Client({
    region: REGION,
    credentials: { accessKeyId: id, secretAccessKey: secret },
  })
  return client
}

/** Whether storage can work at all, so the UI can say so rather than fail. */
export function uploadsConfigured() {
  return Boolean(
    REGION &&
      BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  )
}

/**
 * What an upload is for.
 *
 * It only decides the folder, but the folder is what makes a bucket
 * readable a year later — and what lets a lifecycle rule treat one kind of
 * file differently from another.
 */
export const UPLOAD_PURPOSES = ["site", "maintenance", "ticket"] as const
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return (
    typeof value === "string" &&
    (UPLOAD_PURPOSES as readonly string[]).includes(value)
  )
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

/**
 * Where the object goes.
 *
 * Filed under the workspace so one business's files are never mixed with
 * another's, and named with a fresh id rather than whatever the file was
 * called — two people uploading `photo.jpg` must not overwrite each other,
 * and an original filename is one more thing a stranger could guess.
 */
function keyFor(
  businessId: string,
  purpose: UploadPurpose,
  contentType: string
) {
  const ext = EXTENSIONS[contentType] ?? "bin"
  return `${purpose}/${businessId}/${randomUUID()}.${ext}`
}

export type SignedUpload = {
  /** PUT the bytes here, with the same Content-Type. */
  uploadUrl: string
  /** Where it will be readable once the PUT succeeds. */
  url: string
  key: string
}

export async function signUpload(
  businessId: string,
  purpose: UploadPurpose,
  contentType: string,
  size: number
): Promise<SignedUpload> {
  const key = keyFor(businessId, purpose, contentType)

  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      // Signed in, so a signature can't be reused for a different-sized body.
      ContentLength: size,
    }),
    { expiresIn: 300 }
  )

  return { uploadUrl, url: publicUrlFor(key), key }
}

/**
 * The address a browser will read the file from.
 *
 * The plain bucket URL, unless a CDN or custom domain is configured — in
 * which case that wins, because serving an image from the bucket directly is
 * the slowest way to serve it.
 */
export function publicUrlFor(key: string) {
  const base = process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, "")
  if (base) return `${base}/${key}`
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
}

/** The object key behind one of our URLs, or null if it isn't one of ours. */
export function keyFromUrl(url: string): string | null {
  const bases = [
    process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, ""),
    `https://${BUCKET}.s3.${REGION}.amazonaws.com`,
  ].filter(Boolean) as string[]

  for (const base of bases) {
    if (url.startsWith(`${base}/`)) {
      const key = url.slice(base.length + 1)
      // A key from outside the workspace folders is not ours to touch.
      return decodeURIComponent(key.split("?")[0]) || null
    }
  }
  return null
}

export function isOwnUpload(url: string) {
  return keyFromUrl(url) !== null
}

/**
 * Remove files we no longer reference.
 *
 * Returns what happened rather than throwing: an image that has already been
 * replaced in the database is gone from the product either way, and failing
 * the whole save because the bucket refused a tidy-up would lose the edit the
 * person actually made. The caller logs it; nothing waits on it.
 *
 * Deletes are batched because S3 charges a request either way, and a form
 * with a dozen pictures otherwise costs a dozen round trips.
 */
export async function deleteUploads(urls: string[]): Promise<{
  deleted: number
  failed: string[]
}> {
  const keys = [...new Set(urls.map(keyFromUrl).filter(Boolean))] as string[]
  if (keys.length === 0 || !uploadsConfigured()) {
    return { deleted: 0, failed: [] }
  }

  const failed: string[] = []
  let deleted = 0

  // S3 takes a thousand keys per call; the chunking is here so a caller never
  // has to know that.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    try {
      const result = await s3().send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        })
      )
      deleted += batch.length - (result.Errors?.length ?? 0)
      for (const error of result.Errors ?? []) {
        if (error.Key) failed.push(error.Key)
      }
    } catch {
      failed.push(...batch)
    }
  }

  return { deleted, failed }
}

/**
 * The files a record used to hold and no longer does.
 *
 * Called after a save with the URLs from before and after: whatever was
 * dropped gets removed from the bucket. Doing it server-side rather than in
 * the browser is what stops a closed tab from leaving an orphan behind for
 * ever.
 */
export async function reconcileUploads(before: string[], after: string[]) {
  const kept = new Set(after)
  const orphans = before.filter((url) => url && !kept.has(url))
  if (orphans.length === 0) return { deleted: 0, failed: [] }
  return deleteUploads(orphans)
}
