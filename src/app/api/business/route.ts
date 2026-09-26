import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { isBusinessKeyIn, keyFromUrl, reconcileUploads } from "@/lib/s3"
import { businessSettingsSchema } from "@/lib/validations/auth"
import { cleanWeek } from "@/lib/week-server"
import { Business, toBusinessDTO } from "@/models/business"

export const runtime = "nodejs"

/** Owner-only. The workspace a member belongs to is fixed by their session. */
export async function PATCH(request: Request) {
  try {
    const owner = await requireRole("owner")
    const values = businessSettingsSchema.parse(await request.json())

    await connectToDatabase()

    // The logo is only touched when the body says so. The key is derived
    // here rather than trusted from the client, and fenced to this workspace
    // so one owner can never point their record at another's object.
    const logoChanged = values.logo !== undefined
    let logo: { key: string; url: string } | null = null
    let previousLogoUrl: string | null = null

    if (logoChanged) {
      if (values.logo) {
        const key = keyFromUrl(values.logo.url)
        if (!key || !isBusinessKeyIn(key, owner.businessId, "logo")) {
          throw new HttpError(400, "That picture isn't one of ours")
        }
        logo = { key, url: values.logo.url }
      }
      const current = await Business.findById(owner.businessId)
        .select("logo")
        .lean()
      previousLogoUrl = current?.logo?.url ?? null
    }

    const business = await Business.findByIdAndUpdate(
      owner.businessId,
      {
        $set: {
          name: values.name,
          crewSize: values.crewSize,
          timeZone: values.timeZone,
          pan: values.pan,
          vatRate: values.vatRate,
          ...(values.office ? { office: values.office } : {}),
          ...(values.week ? { week: cleanWeek(values.week) } : {}),
          ...(logo ? { logo } : {}),
        },
        // Clearing the pin puts shift starts back to unrestricted, so it has
        // to actually remove the field rather than leave a stale one.
        // Clearing any of these has to remove the field, not blank it.
        ...(values.office === null ||
        values.week === null ||
        values.logo === null
          ? {
              $unset: {
                ...(values.office === null ? { office: "" } : {}),
                ...(values.week === null ? { week: "" } : {}),
                ...(values.logo === null ? { logo: "" } : {}),
              },
            }
          : {}),
      },
      { new: true, runValidators: true }
    ).orFail()

    // Only once the record points elsewhere is the old object let go of, so
    // a failed save never costs the logo that was already there. Nothing
    // waits on the bucket: the edit has landed either way.
    if (logoChanged) {
      void reconcileUploads(
        previousLogoUrl ? [previousLogoUrl] : [],
        logo ? [logo.url] : [],
        owner.businessId
      )
    }

    return ok({ business: toBusinessDTO(business) })
  } catch (error) {
    return handleApiError(error)
  }
}
