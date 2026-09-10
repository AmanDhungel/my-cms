import mongoose from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { holdsStock } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { billUpdateSchema } from "@/lib/validations/sales"
import type { BillPayment } from "@/lib/work-constants"
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

    // ---- settling it ----
    if ("payment" in values) {
      const next = values.payment
      const session = await mongoose.startSession()

      try {
        await session.withTransaction(async () => {
          // `new: false` hands back the state it was in, which is what says
          // whether stock has to move with it.
          const before = await Bill.findOneAndUpdate(
            { _id: id, business: viewer.businessId, status: "issued" },
            next === "cheque"
              ? { $set: { payment: "cheque", chequeNo: values.chequeNo } }
              : // A cheque number left behind would outlive the cheque.
                { $set: { payment: next }, $unset: { chequeNo: "" } },
            { new: false, session }
          )

          if (!before) {
            const existing = await Bill.findOne({
              _id: id,
              business: viewer.businessId,
            }).session(session)

            if (!existing) throw new HttpError(404, "That bill doesn't exist")
            throw new HttpError(409, `${existing.number} is void`)
          }

          const held = holdsStock(before.payment as BillPayment)
          const holds = holdsStock(next)
          if (held === holds) return

          // Accepting a quotation takes the stock; turning a sale back into
          // one gives it back. Both happen with the change, not after it.
          for (const line of before.lines) {
            if (!line.item) continue

            if (holds) {
              const moved = await InventoryItem.updateOne(
                {
                  _id: line.item,
                  business: viewer.businessId,
                  stock: { $gte: line.qty },
                },
                { $inc: { stock: -line.qty } },
                { session }
              )

              if (moved.modifiedCount === 0) {
                throw new HttpError(
                  409,
                  `There isn't enough ${line.name} in stock to accept this quotation`
                )
              }
            } else {
              await InventoryItem.updateOne(
                { _id: line.item, business: viewer.businessId },
                { $inc: { stock: line.qty } },
                { session }
              )
            }
          }
        })
      } finally {
        await session.endSession()
      }

      const settled = await Bill.findById(id).orFail()

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

        // A quotation never took the stock, so there is none to give back.
        if (holdsStock(bill.payment as BillPayment)) {
          for (const line of bill.lines) {
            if (!line.item) continue
            await InventoryItem.updateOne(
              { _id: line.item, business: viewer.businessId },
              { $inc: { stock: line.qty } },
              { session }
            )
          }
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
