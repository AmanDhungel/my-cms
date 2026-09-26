import { fail, handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import {
  MAX_UPLOAD_BYTES,
  deleteUploads,
  isBusinessKey,
  uploaderOf,
  isUploadPurpose,
  keyFromUrl,
  sniffImageType,
  uploadFile,
} from "@/lib/s3"
import { assertMultipartLength } from "@/lib/storage/http"
import { isTenantRequest } from "@/lib/tenancy"
import { deleteUploadSchema } from "@/lib/validations/uploads"
import { logActivity } from "@/lib/activity"
import { canDelete } from "@/lib/auth/permissions"
import { referencesOf } from "@/lib/image-ownership"
import { getWorkspace } from "@/lib/workspace"
import type { UserRole } from "@/models/user"
import { enforceLimit } from "@/lib/security/rate-limit"
import { CROSS_ORIGIN_MESSAGE, isSameOrigin } from "@/lib/security/same-origin"

export const runtime = "nodejs"

/** Which upload folders each role may write to. */
const PURPOSES_BY_ROLE: Record<UserRole, readonly string[]> = {
  owner: ["site", "maintenance", "ticket", "products", "logo"],
  supervisor: ["maintenance", "ticket", "products"],
  employee: ["ticket"],
}

/**
 * Uploading, for whatever holds pictures.
 *
 * One endpoint rather than one per feature: the rules — who may upload, what
 * types, what size — are the same everywhere, and a second copy of them is a
 * second place for them to drift.
 *
 * One body: multipart, carrying the bytes here, where they are read before
 * they are stored — the type comes from the first bytes, not the filename,
 * so nothing but a picture ever lands in the bucket. The older JSON body,
 * which asked for a presigned PUT and let the browser write to S3 unchecked,
 * is retired: nothing calls it, and it now answers 410.
 *
 * Not reachable from a tenant site's host: the proxy is kept off this route
 * (see proxy.ts), so the route turns such requests away itself.
 */
export async function POST(request: Request) {
  if (isTenantRequest(request)) return fail("Not found", 404)
  // The proxy is kept off this route, so it checks the origin itself (CSRF).
  if (!isSameOrigin(request.method, request.headers)) return fail(CROSS_ORIGIN_MESSAGE, 403)
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")
    await enforceLimit("uploads", viewer.id)

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
      // Each role uploads only for what it can save a picture on: the crew
      // for ticket photos, supervisors also for stock and the repair bench,
      // the owner for everything (logo and site included).
      if (!PURPOSES_BY_ROLE[viewer.role].includes(purpose)) {
        throw new HttpError(403, "You can't add pictures there")
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
        // Recorded on the object, from the session.
        uploadedBy: viewer.id,
        contentType: sniffed,
        fileName: file.name,
      })

      return ok({ key: stored.key, url: stored.url }, 201)
    }

    return fail("Uploads now go through the form upload", 410)
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
  if (isTenantRequest(request)) return fail("Not found", 404)
  if (!isSameOrigin(request.method, request.headers)) return fail(CROSS_ORIGIN_MESSAGE, 403)
  try {
    const viewer = await requireRole("owner", "supervisor", "employee")
    const { urls } = deleteUploadSchema.parse(await readJson(request))

    // Scoped on the parsed key, not the URL text: a query string is dropped
    // when the key is resolved, so matching the raw URL would let a
    // `?/<own-id>/` tail vouch for an object under someone else's prefix.
    // The fence is storage's own definition of the workspace's keys, so
    // nothing passes here only to be dropped, uncounted, by deleteUploads.
    const inWorkspace = urls.filter((url) => {
      const key = keyFromUrl(url)
      return key !== null && isBusinessKey(key, viewer.businessId)
    })

    /*
     * The owner may delete any of the workspace's pictures. Anyone else only
     * their own (lib/auth/permissions.ts): a picture a saved record points
     * at must be recorded there as theirs (and, for an employee, not on a
     * past ticket); one no record points at yet — a fresh upload left
     * behind by a failed save — must carry their id in the object's own
     * metadata. That second case is the system tidying up after the
     * uploader, not a delete of anyone's saved work. Everything else is
     * counted as refused.
     */
    const own: string[] = []
    const audited: string[] = []
    const business = await getWorkspace(viewer.businessId)
    for (const url of inWorkspace) {
      const key = keyFromUrl(url)!
      const refs = await referencesOf(key, url, viewer.businessId, business.timeZone)
      if (viewer.role === "owner") {
        own.push(url)
        if (refs.length > 0) audited.push(url)
        continue
      }
      const allowed =
        refs.length > 0
          ? refs.every((ref) =>
              canDelete(viewer, { kind: "image", uploadedBy: ref.uploadedBy, onPastTicket: ref.onPastTicket })
            )
          : (await uploaderOf(key)) === viewer.id
      if (allowed) {
        own.push(url)
        if (refs.length > 0) audited.push(url)
      }
    }
    const result = await deleteUploads(own, viewer.businessId)

    // A saved picture removed is a delete worth recording; tidying a fresh
    // upload is not.
    for (const url of audited) {
      void logActivity({
        businessId: viewer.businessId,
        action: "image_deleted",
        actorId: viewer.id,
        actorName: viewer.name,
        subject: keyFromUrl(url)?.split("/").slice(-2).join("/") ?? "picture",
        targetKind: "image",
      })
    }

    return ok({ deleted: result.deleted, refused: urls.length - own.length })
  } catch (error) {
    return handleApiError(error)
  }
}
