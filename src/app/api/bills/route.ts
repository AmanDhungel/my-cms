import mongoose from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { holdsStock, quantity, totalsOf } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { billSchema } from "@/lib/validations/sales"
import { getWorkspace } from "@/lib/workspace"
import { Bill, toBillDTO } from "@/models/bill"
import { Business } from "@/models/business"
import { InventoryItem } from "@/models/inventory-item"

export const runtime = "nodejs"

/** The bills this workspace has raised, newest first. */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const bills = await Bill.find({ business: viewer.businessId })
      .sort({ createdAt: -1 })
      .limit(200)

    return ok({ bills: bills.map(toBillDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Raise a bill. An inventory bill takes its prices from stock rather than
 * from the request, and moves that stock: the number, the decrements and the
 * bill itself are written in one transaction, so a sale can never take stock
 * without leaving a bill behind, or the reverse.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = billSchema.parse(await request.json())

    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const vatRate = values.withVat ? business.vatRate : 0

    type Line = {
      item?: mongoose.Types.ObjectId
      name: string
      unit: string
      price: number
      qty: number
      discountPct: number
    }

    let lines: Line[]
    /** Total quantity per item, since one item can appear on two lines. */
    const wanted = new Map<string, number>()

    if (values.source === "inventory") {
      const ids = [...new Set(values.lines.map((line) => line.itemId))]
      const items = await InventoryItem.find({
        _id: { $in: ids },
        business: viewer.businessId,
      })
      const byId = new Map(items.map((item) => [String(item._id), item]))

      lines = values.lines.map((line) => {
        const item = byId.get(String(line.itemId))
        if (!item) {
          throw new HttpError(404, `${line.name} is no longer in the inventory`)
        }
        return {
          item: item._id,
          name: item.name,
          unit: item.unit,
          // Read from stock, never from the request.
          price: item.price,
          qty: line.qty,
          discountPct: line.discountPct,
        }
      })

      // A quotation is a price, not a sale: it neither needs the stock to be
      // there nor takes it. Leaving `wanted` empty skips both below.
      if (holdsStock(values.payment)) {
        for (const line of lines) {
          const key = String(line.item)
          wanted.set(key, (wanted.get(key) ?? 0) + line.qty)
        }
      }

      for (const [id, qty] of wanted) {
        const item = byId.get(id)
        if (item && item.stock < qty) {
          throw new HttpError(
            409,
            `Only ${quantity(item.stock)} ${item.unit} of ${item.name} left, and the bill asks for ${quantity(qty)}`
          )
        }
      }
    } else {
      lines = values.lines.map((line) => ({
        name: line.name,
        unit: line.unit || "pcs",
        price: line.price,
        qty: line.qty,
        discountPct: line.discountPct,
      }))
    }

    const totals = totalsOf(lines, vatRate)

    const session = await mongoose.startSession()
    let billId: mongoose.Types.ObjectId | undefined

    try {
      await session.withTransaction(async () => {
        // The counter lives on the workspace, so two people billing at once
        // get two numbers rather than one number twice.
        const counted = await Business.findByIdAndUpdate(
          business._id,
          { $inc: { billSeq: 1 } },
          { new: true, session }
        ).orFail()

        const number = `BILL-${String(counted.billSeq).padStart(4, "0")}`

        for (const [id, qty] of wanted) {
          const moved = await InventoryItem.updateOne(
            { _id: id, business: viewer.businessId, stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { session }
          )

          // Someone else sold it between the check above and here.
          if (moved.modifiedCount === 0) {
            throw new HttpError(
              409,
              "Stock moved while this bill was being written. Check the counts and try again."
            )
          }
        }

        const [bill] = await Bill.create(
          [
            {
              business: viewer.businessId,
              number,
              source: values.source,
              customer: {
                name: values.customer.name,
                phone: values.customer.phone,
                email: values.customer.email || undefined,
                address: values.customer.address,
                pan: values.customer.pan,
              },
              lines,
              vatRate,
              ...totals,
              note: values.note,
              payment: values.payment,
              // A cheque number means nothing on a bill settled another way.
              chequeNo:
                values.payment === "cheque" ? values.chequeNo : undefined,
              status: "issued",
              issuedBy: viewer.id,
            },
          ],
          { session }
        )

        billId = bill._id
      })
    } finally {
      await session.endSession()
    }

    const bill = await Bill.findById(billId).orFail()

    return ok({ bill: toBillDTO(bill) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
