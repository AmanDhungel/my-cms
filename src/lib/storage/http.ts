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

/** The most a whole multipart upload body may weigh, in bytes. */
export const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + MULTIPART_SLACK

const TOO_LARGE = "Pictures are compressed under 1 MB before uploading"

/**
 * Refuse an oversized multipart upload before its body is read, when the
 * request declares its length.
 *
 * A body that is plainly too big is turned away on the declared length
 * alone. The header can lie in either direction, which is why this only ever
 * decides against a request, never for one: `readCappedBody` counts what
 * actually arrives, and the file's measured size after parsing remains the
 * authoritative check.
 *
 * No usable length — a native client streaming the body in chunks sends
 * none — is not refused: the counted read below bounds it just the same.
 */
export function assertMultipartLength(headers: Headers): void {
  // A Content-Length is a run of digits and nothing else. Matched as such
  // rather than through Number(), which reads "" as 0 and "1e12" as a size.
  const raw = headers.get("content-length")?.trim()
  if (!raw || !/^\d+$/.test(raw)) return

  if (Number(raw) > MAX_MULTIPART_BYTES) {
    throw new HttpError(413, TOO_LARGE)
  }
}

/**
 * The request body, read chunk by chunk and abandoned — the stream
 * cancelled, a 413 thrown — the moment it passes `limit`. Nothing past the
 * limit is ever held in memory, whether or not the request declared a
 * Content-Length (the route runs outside the proxy, so Next has not
 * buffered the body first; src/proxy.ts).
 */
export async function readCappedBody(request: Request, limit = MAX_MULTIPART_BYTES) {
  if (!request.body) throw new HttpError(400, "No file was sent")

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      throw new HttpError(413, TOO_LARGE)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
