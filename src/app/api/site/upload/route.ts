import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { signUpload } from "@/lib/s3"
import { uploadSchema } from "@/lib/validations/site"

export const runtime = "nodejs"

/**
 * Hands the browser a signature to upload one picture with.
 *
 * The bytes never come through here. The client asks for a URL, PUTs the file
 * straight to S3 and sends back the address — so a 5 MB photo doesn't travel
 * through the app server, and the AWS keys stay on it. The signature is
 * narrowed to a single key, one content type and one size, and expires in
 * five minutes, so it is worth nothing to anyone else.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = uploadSchema.parse(await request.json())

    const signed = await signUpload(
      viewer.businessId,
      values.contentType,
      values.size
    )

    return ok({ uploadUrl: signed.uploadUrl, url: signed.url })
  } catch (error) {
    return handleApiError(error)
  }
}
