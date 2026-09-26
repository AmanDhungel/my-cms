import { HttpError } from "@/lib/api-response"
import { MAX_UPLOAD_BYTES } from "@/lib/storage/types"

/**
 * Request-level checks for the upload route, kept out of the route module so
 * it exports nothing but handlers and can share them with any other route
 * that takes a body of bytes.
 */

/**
 * How much bigger than the file itself a multipart body may be: the boundary
 * lines, the part headers and the `purpose` field. Generous, because this is
 * only a first gate — the measured checks after parsing still decide.
 */
const MULTIPART_SLACK = 64 * 1024

/**
 * Refuse an oversized multipart upload before its body is read.
 *
 * `request.formData()` buffers the whole body before any of the size checks
 * after it can run, so a body that is plainly too big is turned away on the
 * declared length alone. The header can lie in either direction, which is
 * why this only ever decides against a request, never for one: the file's
 * measured size after parsing remains the authoritative check.
 *
 * No usable length at all — missing, not a number, negative — is refused
 * with 411 rather than let through, because every browser sets it for a
 * multipart body and a request without one is not from our own form.
 */
export function assertMultipartLength(headers: Headers): void {
  // A Content-Length is a run of digits and nothing else. Matched as such
  // rather than through Number(), which reads "" as 0 and "1e12" as a size.
  const raw = headers.get("content-length")?.trim()
  if (!raw || !/^\d+$/.test(raw)) {
    throw new HttpError(411, "Send the picture with its size")
  }

  const declared = Number(raw)
  if (declared > MAX_UPLOAD_BYTES + MULTIPART_SLACK) {
    throw new HttpError(
      413,
      "Pictures are compressed under 1 MB before uploading"
    )
  }
}
