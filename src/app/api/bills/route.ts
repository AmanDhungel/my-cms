import mongoose from "mongoose"

import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { holdsStock, quantity, totalsOf } from "@/lib/billing"
import { fromPaisa, toPaisa } from "@/lib/allocations"
import { resolveAllocations, writeAllocations } from "@/lib/allocations-server"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { paidByBill } from "@/lib/payments"
import { billSchema } from "@/lib/validations/sales"
import { getWorkspace } from "@/lib/workspace"
import { Bill, toBillDTO } from "@/models/bill"
import { Business } from "@/models/business"
import { InventoryItem } from "@/models/inventory-item"
import { Payment } from "@/models/payment"
import { Estimate } from "@/models/estimate"

export const runtime = "nodejs"

/** The bills this workspace has raised, newest first. */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const [bills, paid, business] = await Promise.all([
      Bill.find({ business: viewer.businessId }).sort({ createdAt: -1 }).limit(200),
      // What has actually been received against each one, so a bill paid in
      // instalments shows what is left rather than just "unpaid".
      paidByBill(viewer.businessId),
      getWorkspace(viewer),
    ])
    // For the due date and the Paid / Partly paid / Unpaid / Overdue chip.
    const context = {
      timeZone: business.timeZone,
      today: dayKeyInZone(new Date(), business.timeZone),
    }

    return ok({
      bills: bills.map((bill) =>
        toBillDTO(bill, paid.get(String(bill._id)) ?? 0, context)
      ),
    })
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
    const values = billSchema.parse(await readJson(request))

    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const vatRate = values.withVat ? business.vatRate : 0

    type Line = {
      item?: mongoose.Types.ObjectId
      name: string
      unit: string
      price: number
      qty: number
      discountPct: number
      /** What it cost us, taken off the item as the bill is raised. */
      cost?: number
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
          // Snapshotted, because what a thing costs changes with every
          // purchase: asking later would price this sale at a later figure.
          cost: item.costPrice || undefined,
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

    /*
     * Money taken at the till. "Paid" means the whole total came in now; a
     * partial amount leaves the rest owing on the bill. Either way it is an
     * ordinary "Money in" payment against the bill — cash moves through no
     * account, anything else through one (lib/allocations.ts) — written in
     * the same transaction as the bill, so the two can't disagree.
     *
     * A client that only sends payment: "paid" (as every one did before this)
     * is taken as paid in cash. A cheque recorded without `received` stays a
     * flag, as before: a cheque needs an account, which such a client can't
     * name. A quotation takes no money.
     */
    const totalPaisa = toPaisa(totals.total)
    let receivedPaisa = 0
    if (values.payment === "paid") receivedPaisa = totalPaisa
    else if (values.payment !== "quotation" && values.received) {
      receivedPaisa = toPaisa(values.received.amount)
    }
    if (receivedPaisa > totalPaisa) {
      const message = "That is more than the bill comes to"
      throw new HttpError(422, message, { "received.amount": [message] })
    }
    const receivedMethod = values.received?.method ?? "cash"
    const receivedAllocation =
      receivedPaisa > 0
        ? await resolveAllocations(viewer.businessId, {
            method: receivedMethod,
            amount: fromPaisa(receivedPaisa),
            accountId: values.received?.accountId,
            allocations: values.received?.allocations,
            // A supervisor raises bills but can't see the accounts.
            requireAccount: viewer.role === "owner",
          })
        : null
    // Paid in full at the till settles it, whatever was ticked.
    const paymentFlag =
      receivedPaisa > 0 && receivedPaisa >= totalPaisa && values.payment === "unpaid"
        ? "paid"
        : values.payment
    const dueDate = values.dueDate
      ? dayRangeInZone(values.dueDate, business.timeZone).start
      : undefined

    /*
     * Converting an estimate. Checked here for a clear answer, then again —
     * atomically — inside the transaction, which is what makes a double click
     * or a second tab unable to make two sales out of one estimate.
     */
    const todayStart = dayRangeInZone(
      dayKeyInZone(new Date(), business.timeZone),
      business.timeZone
    ).start
    const alreadyConverted = (saleId: unknown) =>
      Bill.findById(saleId)
        .select("number")
        .then((sale) => {
          const message = `This estimate is already sale ${sale?.number ?? ""}.`.replace(" .", ".")
          return new HttpError(409, message, { estimateId: [message] }, undefined, {
            saleId: String(saleId),
            saleNumber: sale?.number ?? null,
          })
        })
    if (values.estimateId) {
      const estimate = await Estimate.findOne({
        _id: values.estimateId,
        business: viewer.businessId,
      })
      if (!estimate) throw new HttpError(404, "That estimate doesn't exist")
      if (estimate.saleRef) throw await alreadyConverted(estimate.saleRef)
      if (estimate.status === "declined") {
        throw new HttpError(409, "This estimate was declined. Reopen it before converting.")
      }
      if (estimate.status !== "accepted" && estimate.validUntil < todayStart) {
        throw new HttpError(409, "This estimate has expired. Reopen it (or extend its date) before converting.")
      }
    }

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
              customerRef: values.customerId,
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
              payment: paymentFlag,
              // A cheque number means nothing on a bill settled another way.
              chequeNo:
                values.payment === "cheque" ? values.chequeNo : undefined,
              status: "issued",
              issuedBy: viewer.id,
              dueDate,
              estimateRef: values.estimateId,
            },
          ],
          { session }
        )

        billId = bill._id

        if (values.estimateId) {
          // Only an estimate still open and not yet converted flips; anything
          // else means another save got there first.
          const flipped = await Estimate.findOneAndUpdate(
            {
              _id: values.estimateId,
              business: viewer.businessId,
              saleRef: { $exists: false },
              $or: [
                { status: "accepted" },
                { status: { $in: ["draft", "sent"] }, validUntil: { $gte: todayStart } },
              ],
            },
            { $set: { status: "converted", saleRef: bill._id, convertedAt: new Date() } },
            { new: true, session }
          )
          if (!flipped) {
            const now = await Estimate.findById(values.estimateId).session(session)
            if (now?.saleRef) throw await alreadyConverted(now.saleRef)
            throw new HttpError(409, "This estimate can't be converted any more.")
          }
        }

        if (receivedAllocation) {
          const [payment] = await Payment.create(
            [
              {
                business: viewer.businessId,
                direction: "in",
                party: values.customer.name,
                partyRef: values.customerId,
                account: receivedAllocation.account,
                allocated: receivedAllocation.allocated || undefined,
                amount: fromPaisa(receivedPaisa),
                method: receivedMethod,
                reference:
                  values.received?.reference ||
                  (values.payment === "cheque" ? values.chequeNo : undefined),
                note: `Received at sale ${number}`,
                paidOn: dayRangeInZone(
                  dayKeyInZone(new Date(), business.timeZone),
                  business.timeZone
                ).start,
                bill: bill._id,
                recordedBy: viewer.id,
              },
            ],
            { session }
          )
          await writeAllocations(
            session,
            { businessId: viewer.businessId, paymentId: payment._id, direction: "in" },
            receivedAllocation.rows
          )
        }
      })
    } finally {
      await session.endSession()
    }

    const bill = await Bill.findById(billId).orFail()

    return ok(
      {
        bill: toBillDTO(bill, fromPaisa(receivedPaisa), {
          timeZone: business.timeZone,
          today: dayKeyInZone(new Date(), business.timeZone),
        }),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
