import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import {
  MAX_UPLOAD_BYTES,
  deleteUploads,
  isBusinessKey,
  isUploadPurpose,
  keyFromUrl,
  signUpload,
  sniffImageType,
  uploadFile,
} from "@/lib/s3"
import { assertMultipartLength } from "@/lib/storage/http"
import { uploadSchema, deleteUploadSchema } from "@/lib/validations/uploads"

export const runtime = "nodejs"

/**
 * Uploading, for whatever holds pictures.
 *
 * One endpoint rather than one per feature: the rules — who may upload, what
 * types, what size — are the same everywhere, and a second copy of them is a
 * second place for them to drift.
 *
 * Two bodies, told apart by Content-Type. JSON asks for a signature and the
 * browser PUTs to S3 itself; the signature is narrowed to a single key, one
 * content type and one size, and expires in five minutes, so it is worth
 * nothing to anyone else. Multipart carries the bytes here, where they are
 * read before they are stored: the type comes from the first bytes, not the
 * filename, so nothing but a picture ever lands in the bucket.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")

    // Media types are case-insensitive; a client may well send
    // "Multipart/Form-Data" and still mean this branch.
    const contentType = request.headers.get("content-type")?.toLowerCase()
    if (contentType?.includes("multipart/form-data")) {
      // A cheap first gate on the declared length, before the body is read:
      // formData() buffers the whole thing, and the checks below only run
      // once it has. The header can lie, so the measured checks after
      // parsing still decide.
      assertMultipartLength(request.headers)

      const form = await request.formData()
      const purpose = form.get("purpose")
      const file = form.get("file")

      if (!isUploadPurpose(purpose)) {
        throw new HttpError(400, "That isn't something pictures are kept for")
      }
      if (!(file instanceof File)) {
        throw new HttpError(400, "No file was sent")
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new HttpError(
          413,
          "Pictures are compressed under 1 MB before uploading"
        )
      }

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw new HttpError(
          413,
          "Pictures are compressed under 1 MB before uploading"
        )
      }

      // The bytes decide, not the declared type: a browser reads `file.type`
      // off the extension, and an extension is whatever the sender says.
      const sniffed = sniffImageType(bytes)
      if (!sniffed) {
        throw new HttpError(415, "Images only — JPEG, PNG, WebP or AVIF")
      }

      const stored = await uploadFile(bytes, {
        businessId: viewer.businessId,
        folder: purpose,
        contentType: sniffed,
        fileName: file.name,
      })

      return ok({ key: stored.key, url: stored.url }, 201)
    }

    const values = uploadSchema.parse(await request.json())

    const signed = await signUpload(
      viewer.businessId,
      values.purpose,
      values.contentType,
      values.size
    )

    return ok({ uploadUrl: signed.uploadUrl, url: signed.url })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Remove files.
 *
 * Only ones belonging to the caller's own workspace: the key carries the
 * business id under both layouts — `businesses/<id>/…` and the older
 * `<purpose>/<id>/…` — so anything addressed outside it is dropped before a
 * delete is attempted rather than trusted from the request.
 *
 * Most tidying happens on the server as a side effect of saving, which is
 * what catches a closed tab. This is for the case where the browser knows it
 * has orphaned something and nothing else will notice.
 */
export async function DELETE(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")
    const { urls } = deleteUploadSchema.parse(await request.json())

    // Scoped on the parsed key, not the URL text: a query string is dropped
    // when the key is resolved, so matching the raw URL would let a
    // `?/<own-id>/` tail vouch for an object under someone else's prefix.
    // The fence is storage's own definition of the workspace's keys, so
    // nothing passes here only to be dropped, uncounted, by deleteUploads.
    const own = urls.filter((url) => {
      const key = keyFromUrl(url)
      return key !== null && isBusinessKey(key, viewer.businessId)
    })
    const result = await deleteUploads(own, viewer.businessId)

    return ok({ deleted: result.deleted, refused: urls.length - own.length })
  } catch (error) {
    return handleApiError(error)
  }
}
