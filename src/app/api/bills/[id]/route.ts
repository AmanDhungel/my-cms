import mongoose from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { billUpdateSchema } from "@/lib/validations/sales"
import { Bill, toBillDTO } from "@/models/bill"
import { InventoryItem } from "@/models/inventory-item"

export const runtime = "nodejs"

/**
 * Settle a bill or void it.
 *
 * Voiding puts back whatever stock the bill took, in the same transaction
 * that marks it, so the two can't come apart. Bills are never deleted — a
 * cancelled sale is part of the record.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/bills/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = billUpdateSchema.parse(await request.json())

    await connectToDatabase()

    // ---- settling it: no stock moves, so no transaction is needed ----
    if ("payment" in values) {
      const settled = await Bill.findOneAndUpdate(
        { _id: id, business: viewer.businessId, status: "issued" },
        values.payment === "cheque"
          ? { $set: { payment: "cheque", chequeNo: values.chequeNo } }
          : // A cheque number left behind would outlive the cheque.
            { $set: { payment: values.payment }, $unset: { chequeNo: "" } },
        { new: true }
      )

      if (!settled) {
        const existing = await Bill.findOne({
          _id: id,
          business: viewer.businessId,
        })

        if (!existing) throw new HttpError(404, "That bill doesn't exist")
        throw new HttpError(409, `${existing.number} is void`)
      }

      return ok({ bill: toBillDTO(settled) })
    }

    const session = await mongoose.startSession()
    let voidedId: mongoose.Types.ObjectId | undefined

    try {
      await session.withTransaction(async () => {
        // Claiming the bill first is what stops a double click from putting
        // the same stock back twice.
        const bill = await Bill.findOneAndUpdate(
          { _id: id, business: viewer.businessId, status: "issued" },
          {
            $set: {
              status: "void",
              voidedAt: new Date(),
              voidedBy: viewer.id,
            },
          },
          { new: true, session }
        )

        if (!bill) {
          const existing = await Bill.findOne({
            _id: id,
            business: viewer.businessId,
          }).session(session)

          if (!existing) throw new HttpError(404, "That bill doesn't exist")
          throw new HttpError(409, `${existing.number} is already void`)
        }

        for (const line of bill.lines) {
          if (!line.item) continue
          await InventoryItem.updateOne(
            { _id: line.item, business: viewer.businessId },
            { $inc: { stock: line.qty } },
            { session }
          )
        }

        voidedId = bill._id
      })
    } finally {
      await session.endSession()
    }

    const bill = await Bill.findById(voidedId).orFail()

    return ok({ bill: toBillDTO(bill) })
  } catch (error) {
    return handleApiError(error)
  }
}
