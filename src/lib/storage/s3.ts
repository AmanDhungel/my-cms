import { randomUUID } from "node:crypto"

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { HttpError } from "@/lib/api-response"
import {
  MAX_UPLOAD_BYTES,
  isUploadContentType,
  type UploadPurpose,
} from "@/lib/storage/types"

export {
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_PURPOSES,
  isUploadContentType,
  isUploadPurpose,
  type UploadContentType,
  type UploadPurpose,
} from "@/lib/storage/types"
export { sniffImageType } from "@/lib/storage/sniff"

/**
 * Every file the app stores, in one place.
 *
 * Used by every feature that holds a picture: sign an upload, put one
 * straight from the server, replace one, delete one. They live here rather
 * than beside each feature so there is a single answer to where an object
 * goes, how it is named, and what it costs to remove — and so a new feature
 * that holds images inherits all of it.
 *
 * Two ways in. The older one signs a URL and the browser PUTs to S3 itself,
 * which keeps the bytes off this server. The newer one takes the bytes here,
 * so the server can check what they really are before anything is stored —
 * a renamed HTML file must never land in a bucket that serves pictures.
 *
 * The AWS SDK is imported only under src/lib/storage. Everything else goes
 * through this module, so a client bundle can never pick it up by accident.
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
 *
 * New objects are keyed `businesses/{businessId}/{folder}/{uuid}.{ext}`, the
 * workspace first, so one bucket policy on `businesses/*` covers everything a
 * browser is allowed to read and a whole workspace can be listed or expired
 * by its prefix. Objects written before this layout used
 * `{purpose}/{businessId}/{uuid}.{ext}`; those URLs are still stored in the
 * database and are not rewritten, so both layouts stay valid for reading,
 * ownership checks and deletion. Nothing new is written the old way.
 */
function keyFor(
  businessId: string,
  purpose: UploadPurpose,
  contentType: string
) {
  const ext = EXTENSIONS[contentType] ?? "bin"
  return `businesses/${businessId}/${purpose}/${randomUUID()}.${ext}`
}

/**
 * The only folders the old layout ever wrote to. The purposes added since
 * were born under `businesses/`, so a key rooted at one of them is not ours.
 * `sites` is the first site-builder root (commit e76724a), replaced by the
 * purpose layout about an hour later; objects written under it still exist.
 */
const LEGACY_ROOTS = ["site", "sites", "maintenance", "ticket"] as const

/**
 * The workspace a key belongs to, or null if it is not one of ours.
 *
 * Both layouts put the business id in a fixed place — second segment, after
 * `businesses/` or after a legacy root — so the one parser serves every
 * ownership question here, and "is ours at all" and "is this workspace's"
 * cannot disagree about which roots count.
 */
function businessIdOf(key: string): string | null {
  const [root, businessId, ...rest] = key.split("/")
  if (!businessId || rest.length === 0) return null
  if (root === "businesses") return businessId
  return (LEGACY_ROOTS as readonly string[]).includes(root) ? businessId : null
}

/**
 * Whether a key is one this app could have written, under either layout.
 *
 * Every delete goes through this, so a caller holding a URL from a request
 * body can only ever reach objects in the app's own folders — never the
 * bucket's root or anything else that happens to share it.
 */
function isOurKey(key: string) {
  return businessIdOf(key) !== null
}

/**
 * Whether a key belongs to one particular workspace, under either layout:
 * `businesses/<businessId>/…` or `<legacyRoot>/<businessId>/…`.
 *
 * The one definition a route should fence on. It is built from the same
 * parser as `isOurKey`, so a key that passes here is never then dropped by
 * `deleteUploads` as not ours — which is how a refusal used to go uncounted.
 */
export function isBusinessKey(key: string, businessId: string): boolean {
  if (!businessId) return false
  return businessIdOf(key) === businessId
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

export type UploadFileOptions = {
  businessId: string
  folder: UploadPurpose
  contentType: string
  /**
   * Only ever an extension hint, kept only when it is a true spelling of the
   * sniffed content type; otherwise the type's usual extension is used. The
   * stored name is always a fresh id.
   */
  fileName?: string
}

/**
 * Store bytes the server already holds.
 *
 * The checks here are the last line, not the first: the route has already
 * sniffed the bytes and measured them. They are repeated because this is the
 * one function every server-side write passes through, and a future caller
 * that forgets is otherwise a caller that stores anything.
 */
export async function uploadFile(
  input: Buffer | Uint8Array,
  opts: UploadFileOptions
): Promise<{ key: string; url: string }> {
  if (!isUploadContentType(opts.contentType)) {
    throw new HttpError(415, "Images only — JPEG, PNG, WebP or AVIF")
  }
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      "Pictures are compressed under 1 MB before uploading"
    )
  }

  const ext = extensionFor(opts.contentType, opts.fileName)
  const key = [
    "businesses",
    opts.businessId,
    opts.folder,
    `${randomUUID()}.${ext}`,
  ].join("/")

  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: input,
      ContentType: opts.contentType,
      ContentLength: input.byteLength,
    })
  )

  return { key, url: publicUrlFor(key) }
}

/**
 * The spellings a type may honestly carry — `.jpeg` is as much a JPEG as
 * `.jpg`.
 */
const SPELLINGS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
}

/**
 * The stored extension: the filename's own if it is a true spelling of the
 * sniffed type, else the type's usual one.
 *
 * Nothing else from the name survives. The extension is reduced to letters
 * and digits and must agree with what the bytes are — a `.png` that decoded
 * as a JPEG is stored as `.jpg`, so a URL never lies about its contents.
 * The stem could carry a path, a dot, or a character the URL layer would
 * have to escape, and none of it is worth anything once the object has an
 * id of its own.
 */
function extensionFor(contentType: string, fileName?: string) {
  const hinted = fileName
    ?.split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  const allowed = SPELLINGS[contentType] ?? []
  if (hinted && allowed.includes(hinted)) return hinted
  return EXTENSIONS[contentType] ?? "bin"
}

/**
 * Remove one object, and not mind if it was already gone.
 *
 * A missing key is the outcome a delete wants, so it is not an error here
 * even where S3 reports it as one. Anything else — a refused credential, a
 * bucket that has vanished — does throw, because that is a caller's decision
 * to make: a save that just replaced a picture should log it and carry on;
 * a tidy-up job might want to stop.
 */
export async function deleteFile(key: string): Promise<void> {
  // A key outside the app's own folders is refused before S3 ever hears of
  // it. Silently, because reaching here with one means a caller passed
  // something from a request through unchecked, and the object is not ours
  // to touch either way.
  if (!key || !isOurKey(key)) return

  try {
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (error) {
    if (isMissingObject(error)) return
    throw error
  }
}

function isMissingObject(error: unknown) {
  if (typeof error !== "object" || error === null) return false
  const { name, $metadata } = error as {
    name?: string
    $metadata?: { httpStatusCode?: number }
  }
  return (
    name === "NoSuchKey" ||
    name === "NotFound" ||
    $metadata?.httpStatusCode === 404
  )
}

/**
 * Swap an object for a new one.
 *
 * Upload first, delete second, always. If the upload fails the old picture
 * is still there and the record still points at it; if the delete fails the
 * new picture is stored and the record can point at it, and the leftover is
 * a line in the log rather than a lost edit. The reverse order would risk a
 * record pointing at nothing.
 */
export async function replaceFile(
  oldKey: string | null,
  input: Buffer | Uint8Array,
  opts: UploadFileOptions
): Promise<{ key: string; url: string }> {
  const stored = await uploadFile(input, opts)

  if (oldKey && oldKey !== stored.key) {
    try {
      await deleteFile(oldKey)
    } catch (error) {
      console.warn("[storage] replaced object was not removed:", oldKey, error)
    }
  }

  return stored
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

/**
 * The object key behind one of our URLs, or null if it isn't one of ours.
 *
 * Only the base is stripped; the key is whatever follows it, so both layouts
 * come back intact:
 *   <base>/businesses/<id>/site/<uuid>.jpg  ->  businesses/<id>/site/<uuid>.jpg
 *   <base>/site/<id>/<uuid>.jpg             ->  site/<id>/<uuid>.jpg
 * A URL from anywhere else, including the same bucket reached through a base
 * that isn't configured here, is null.
 */
export function keyFromUrl(url: string): string | null {
  const bases = [
    process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, ""),
    `https://${BUCKET}.s3.${REGION}.amazonaws.com`,
  ].filter(Boolean) as string[]

  for (const base of bases) {
    if (url.startsWith(`${base}/`)) {
      const key = url.slice(base.length + 1)
      // A malformed escape is not a key at all, and a request body is where
      // one comes from — so it answers "not ours" rather than throwing.
      try {
        return decodeURIComponent(key.split("?")[0]) || null
      } catch {
        return null
      }
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
  // The same fence as deleteFile: a URL that resolves to a key outside the
  // app's own folders is dropped here, whatever the caller was handed.
  const keys = [
    ...new Set(
      urls
        .map(keyFromUrl)
        .filter((key): key is string => key !== null && isOurKey(key))
    ),
  ]
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
