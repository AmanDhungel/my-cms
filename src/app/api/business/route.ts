import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { deleteUploads, isBusinessKeyIn, keyFromUrl } from "@/lib/s3"
import { businessSettingsSchema } from "@/lib/validations/auth"
import { cleanWeek } from "@/lib/week-server"
import { Business, toBusinessDTO } from "@/models/business"

export const runtime = "nodejs"

/** Owner-only. The workspace a member belongs to is fixed by their session. */
export async function PATCH(request: Request) {
  try {
    const owner = await requireRole("owner")
    const values = businessSettingsSchema.parse(await readJson(request))

    await connectToDatabase()

    // The logo is only touched when the body says so. The key is derived
    // here rather than trusted from the client, and fenced to this workspace
    // so one owner can never point their record at another's object.
    const logoChanged = values.logo !== undefined
    let logo: { key: string; url: string } | null = null

    if (logoChanged && values.logo) {
      const key = keyFromUrl(values.logo.url)
      if (!key || !isBusinessKeyIn(key, owner.businessId, "logo")) {
        throw new HttpError(400, "That picture isn't one of ours")
      }
      logo = { key, url: values.logo.url }
    }

    /*
     * One atomic write that hands back the document as it was just before
     * it. The logo this write replaced is read from that, not from a
     * separate read beforehand: two saves racing each other would both have
     * read the same "old" logo, both deleted it, and left the loser's new
     * upload orphaned in the bucket. This way each save deletes exactly the
     * logo it displaced — the winner's is the one left.
     */
    const previous = await Business.findOneAndUpdate(
      { _id: owner.businessId },
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
      { returnDocument: "before", runValidators: true }
    )
      .select("logo")
      .lean()
      .orFail()

    // Only once the record points elsewhere is the old object let go of, so
    // a failed save never costs the logo that was already there. Nothing
    // waits on the bucket: the edit has landed either way.
    const replaced = previous.logo?.url ?? null
    if (logoChanged && replaced && replaced !== logo?.url) {
      void deleteUploads([replaced], owner.businessId)
    }

    const business = await Business.findById(owner.businessId).orFail()
    return ok({ business: toBusinessDTO(business) })
  } catch (error) {
    return handleApiError(error)
  }
}
