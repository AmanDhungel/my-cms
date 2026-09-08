import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

/** Workspace members, for the assignee picker. Not exposed to employees. */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const members = await User.find({ business: viewer.businessId }).sort({
      name: 1,
    })

    return ok({ members: members.map(toUserDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}
