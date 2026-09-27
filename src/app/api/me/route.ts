import { handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { buildMe } from "@/lib/me"

export const runtime = "nodejs"

/**
 * Who is signed in, their workspace, today's shift and what their role may
 * do — the data the web's dashboard layout and pages load server-side
 * (lib/me.ts). Any role; cookie or Bearer.
 */
export async function GET() {
  try {
    const viewer = await requireUser()
    return ok(await buildMe(viewer))
  } catch (error) {
    return handleApiError(error)
  }
}
