import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { enabledList, modulesUpdate, resolveModules } from "@/lib/modules"
import { connectToDatabase } from "@/lib/mongodb"
import { modulesSchema } from "@/lib/validations/modules"
import { Business, type BusinessDocument } from "@/models/business"

export const runtime = "nodejs"

/**
 * Which sidebar sections the workspace uses (lib/modules.ts).
 *
 * A display preference only: no other endpoint reads it, so switching a
 * section off never refuses an API call — the mobile app and old links keep
 * working.
 */
function modulesBody(
  business: Pick<BusinessDocument, "enabledModules" | "modulesConfiguredAt">,
  canEdit: boolean
) {
  const state = resolveModules(business.enabledModules)
  return {
    /** Always the full answer: a workspace that never chose has all four. */
    modules: enabledList(state),
    state,
    /** False until the owner (or a super admin) has chosen once. */
    configured: Boolean(business.modulesConfiguredAt),
    configuredAt: business.modulesConfiguredAt
      ? business.modulesConfiguredAt.toISOString()
      : null,
    canEdit,
  }
}

/** Who may change the sections: the owner, or a super admin in the workspace. */
function mayEdit(viewer: { role: string; email: string }) {
  return viewer.role === "owner" || isSuperAdmin(viewer.email)
}

/** Any member may read it; the crew's own screens don't use it. */
export async function GET() {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const business = await Business.findById(viewer.businessId).select(
      "enabledModules modulesConfiguredAt"
    )
    if (!business) throw new HttpError(404, "That workspace no longer exists")

    return ok(modulesBody(business, mayEdit(viewer)))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Owner or super admin. Sets the sections and marks the choice as made, so
 * the dashboard stops asking.
 */
export async function PUT(request: Request) {
  try {
    const viewer = await requireUser()
    if (!mayEdit(viewer)) {
      throw new HttpError(403, "Only the owner can change which sections the workspace uses")
    }
    const { modules } = modulesSchema.parse(await readJson(request))

    await connectToDatabase()

    const business = await Business.findOneAndUpdate(
      { _id: viewer.businessId },
      modulesUpdate(modules, new Date()),
      { new: true, runValidators: true }
    ).select("enabledModules modulesConfiguredAt")
    if (!business) throw new HttpError(404, "That workspace no longer exists")
    // Read back, never assumed: a write that silently stored nothing (a
    // stale schema in a long-running dev server did exactly that) must not
    // be reported as saved, or the chooser would just ask again.
    if (!business.modulesConfiguredAt) {
      throw new HttpError(500, "The sections couldn't be saved. Try again.")
    }

    return ok(modulesBody(business, true))
  } catch (error) {
    return handleApiError(error)
  }
}
