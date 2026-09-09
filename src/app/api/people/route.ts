import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

/** Workspace members, for the assignee picker. Not exposed to employees. */
export async function GET(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    // Removed people stay out of the picker and the crew list; the People
    // page asks for them separately when it wants the full history.
    const includeRemoved =
      new URL(request.url).searchParams.get("includeRemoved") === "1"

    const members = await User.find({
      business: viewer.businessId,
      ...(includeRemoved ? {} : { status: "active" }),
    }).sort({ status: 1, name: 1 })

    return ok({ members: members.map(toUserDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}
