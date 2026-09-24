import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { sameText } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { customerSchema } from "@/lib/validations/customers"
import { Customer, toCustomerDTO } from "@/models/customer"

export const runtime = "nodejs"

/** Everyone the workspace bills. Owners and supervisors, like the bills. */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const customers = await Customer.find({ business: viewer.businessId })
      .sort({ name: 1 })
      .limit(1000)

    return ok({ customers: customers.map(toCustomerDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = customerSchema.parse(await request.json())

    await connectToDatabase()

    const clash = await Customer.findOne({
      business: viewer.businessId,
      name: sameText(values.name),
    })

    if (clash) throw new HttpError(409, `${clash.name} is already a customer`)

    const customer = await Customer.create({
      business: viewer.businessId,
      name: values.name,
      kind: values.kind,
      company: values.company,
      phone: values.phone,
      email: values.email || undefined,
      location: values.location,
      pan: values.pan,
      note: values.note,
      createdBy: viewer.id,
    })

    return ok({ customer: toCustomerDTO(customer) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
