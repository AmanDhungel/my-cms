import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import { sameText } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { customerSchema } from "@/lib/validations/customers"
import { Customer, toCustomerDTO } from "@/models/customer"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/customers/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = customerSchema.parse(await readJson(request))

    await connectToDatabase()

    const customer = await Customer.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!customer) throw new HttpError(404, "That customer doesn't exist")

    const clash = await Customer.findOne({
      _id: { $ne: customer._id },
      business: viewer.businessId,
      name: sameText(values.name),
    })

    if (clash) throw new HttpError(409, `${clash.name} is already a customer`)

    customer.name = values.name
    customer.kind = values.kind
    customer.company = values.company
    customer.phone = values.phone
    customer.email = values.email || undefined
    customer.location = values.location
    customer.pan = values.pan
    customer.note = values.note
    await customer.save()

    return ok({ customer: toCustomerDTO(customer) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Removes the record. Bills raised for them are untouched — each carries its
 * own copy of the name and address, so the paper stays true.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/customers/[id]">
) {
  try {
    const viewer = await requireUser()
    // Deleting a record is the owner's alone (lib/auth/permissions.ts).
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params

    await connectToDatabase()

    const customer = await Customer.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!customer) throw new HttpError(404, "That customer doesn't exist")

    // Audit trail: every delete is recorded (never any secret).
    void logActivity({
      businessId: viewer.businessId,
      action: "record_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: customer.name,
      detail: "customer",
    })
    return ok({ id: String(customer._id) })
  } catch (error) {
    return handleApiError(error)
  }
}
