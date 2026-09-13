import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

/**
 * Someone the workspace bills. A bill still carries its own copy of the name
 * and address — what was on the paper stays on the paper — and points here
 * as well, so a customer's whole history can be added up.
 */
const customerSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    company: { type: String, trim: true, maxlength: 140 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    /** Where they are — a town, a street, a site. */
    location: { type: String, trim: true, maxlength: 200 },
    pan: { type: String, trim: true, maxlength: 30 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// One name per workspace, so the same customer isn't entered twice.
customerSchema.index({ business: 1, name: 1 }, { unique: true })

export type CustomerDocument = InferSchemaType<typeof customerSchema>

export const Customer: Model<CustomerDocument> =
  (models.Customer as Model<CustomerDocument>) ??
  model<CustomerDocument>("Customer", customerSchema)

export type CustomerDTO = {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  location: string | null
  pan: string | null
  note: string | null
  createdAt: string
}

export function toCustomerDTO(
  customer: HydratedDocument<CustomerDocument>
): CustomerDTO {
  return {
    id: String(customer._id),
    name: customer.name,
    company: customer.company ?? null,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    location: customer.location ?? null,
    pan: customer.pan ?? null,
    note: customer.note ?? null,
    createdAt: (customer.createdAt as Date).toISOString(),
  }
}
