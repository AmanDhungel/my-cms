import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { deleteUploads, signUpload } from "@/lib/s3"
import { uploadSchema, deleteUploadSchema } from "@/lib/validations/uploads"

export const runtime = "nodejs"

/**
 * Signing an upload, for whatever holds pictures.
 *
 * One endpoint rather than one per feature: the rules — who may upload, what
 * types, what size — are the same everywhere, and a second copy of them is a
 * second place for them to drift.
 *
 * The bytes never come through here. The signature is narrowed to a single
 * key, one content type and one size, and expires in five minutes, so it is
 * worth nothing to anyone else.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")
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
 * business id, so anything addressed outside it is dropped before a delete is
 * attempted rather than trusted from the request.
 *
 * Most tidying happens on the server as a side effect of saving, which is
 * what catches a closed tab. This is for the case where the browser knows it
 * has orphaned something and nothing else will notice.
 */
export async function DELETE(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")
    const { urls } = deleteUploadSchema.parse(await request.json())

    const own = urls.filter((url) => url.includes(`/${viewer.businessId}/`))
    const result = await deleteUploads(own)

    return ok({ deleted: result.deleted, refused: urls.length - own.length })
  } catch (error) {
    return handleApiError(error)
  }
}
