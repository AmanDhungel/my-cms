import { randomUUID } from "node:crypto"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { HttpError } from "@/lib/api-response"

/**
 * Uploading site pictures.
 *
 * The file never passes through this server. The browser asks for a signed
 * URL, PUTs the bytes straight to S3, and tells us the address afterwards —
 * which keeps a 5 MB photo off the request path and the AWS keys off the
 * client. The signature is narrow on purpose: one key, one content type, and
 * five minutes.
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
      "Picture uploads aren't configured on this server yet."
    )
  }

  client ??= new S3Client({
    region: REGION,
    credentials: { accessKeyId: id, secretAccessKey: secret },
  })
  return client
}

/** Whether uploads can work at all, so the UI can say so rather than fail. */
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
 * Filed under the workspace so one business's pictures are never mixed with
 * another's, and named with a fresh id rather than whatever the file was
 * called — two people uploading `logo.png` must not overwrite each other, and
 * an original filename is one more thing a stranger could guess.
 */
function keyFor(businessId: string, contentType: string) {
  const ext = EXTENSIONS[contentType] ?? "bin"
  return `sites/${businessId}/${randomUUID()}.${ext}`
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
  contentType: string,
  size: number
): Promise<SignedUpload> {
  const key = keyFor(businessId, contentType)

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
 * The address a browser will read the picture from.
 *
 * The plain bucket URL, unless a CDN or custom domain is configured — in
 * which case that wins, because an image served from the bucket directly is
 * the slowest way to serve it.
 */
export function publicUrlFor(key: string) {
  const base = process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, "")
  if (base) return `${base}/${key}`
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
}

/** Whether a stored URL is one of ours, so a site can't link to anywhere. */
export function isOwnUpload(url: string) {
  const base = process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, "")
  if (base && url.startsWith(`${base}/`)) return true
  return url.startsWith(`https://${BUCKET}.s3.${REGION}.amazonaws.com/`)
}
