import type { NextRequest } from "next/server"
import mongoose from "mongoose"

import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import { money } from "@/lib/billing"
import { SUPERVISOR_KINDS, kindLabel, linesTotal } from "@/lib/expenses"
import {
  applyStockDelta,
  deltaBetween,
  priceLines,
  recomputeCosts,
} from "@/lib/expenses-server"
import { connectToDatabase } from "@/lib/mongodb"
import { dayRangeInZone } from "@/lib/time"
import { expenseSchema } from "@/lib/validations/expenses"
import { getWorkspace } from "@/lib/workspace"
import { ownParty } from "@/lib/money-refs"
import { fromPaisa, needsAccount, toPaisa } from "@/lib/allocations"
import { purchasePaidPaisa } from "@/lib/settlement"
import {
  allocationsFor,
  removeAllocations,
  resolveAllocations,
  writeAllocations,
} from "@/lib/allocations-server"
import { Expense, toExpenseDTO } from "@/models/expense"
import { Payment } from "@/models/payment"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * One expense, found within the caller's own workspace and within what their
 * role is allowed to see at all — a supervisor addressing a salary row by its
 * id gets the same "doesn't exist" as a stranger would.
 */
async function findOwn(businessId: string, role: string, id: string) {
  const filter: Record<string, unknown> = { _id: id, business: businessId }
  if (role !== "owner") filter.kind = { $in: SUPERVISOR_KINDS }

  const expense = await Expense.findOne(filter)
  if (!expense) throw new HttpError(404, "That expense doesn't exist")
  return expense
}

/**
 * Edit one.
 *
 * A purchase that changes moves the shelf by the difference, not by the new
 * figure: three of an item became five, so two more go on. Lowering it can
 * fail, and for a real reason — goods bought and since sold cannot be
 * un-bought — so the whole edit is one transaction that either lands or
 * doesn't.
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/expenses/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = expenseSchema.parse(await readJson(request))

    if (viewer.role !== "owner" && !SUPERVISOR_KINDS.includes(values.kind)) {
      throw new HttpError(
        403,
        "A supervisor can record stock purchases. The rest is the owner's to enter."
      )
    }

    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const expense = await findOwn(viewer.businessId, viewer.role, id)
    const { start } = dayRangeInZone(values.spentOn, business.timeZone)

    let employeeId: string | undefined
    if (values.employeeId) {
      const member = await User.findOne({
        _id: values.employeeId,
        business: viewer.businessId,
      }).select("name")

      if (!member) throw new HttpError(404, "That person isn't in the workspace")
      employeeId = String(member._id)
    }

    const partyRef = await ownParty(viewer.businessId, values.partyId)
    const lines = await priceLines(viewer.businessId, values.lines)
    const amount =
      values.kind === "stock" ? linesTotal(lines) : (values.amount ?? 0)

    /*
     * What is paid at the time, after the edit (lib/settlement.ts): what the
     * form says, or — from a client that doesn't send it — paid in full if it
     * was, otherwise what was already paid. The rest is owed to the party.
     */
    const mirror = expense.payment
      ? await Payment.findOne({ _id: expense.payment, business: viewer.businessId }).select("amount")
      : null
    const amountPaisa = toPaisa(amount)
    const paidPaisa = purchasePaidPaisa({
      amountPaisa,
      paidNowPaisa: values.paidNow === undefined ? undefined : toPaisa(values.paidNow),
      previous: {
        amountPaisa: toPaisa(expense.amount),
        paidPaisa: mirror ? toPaisa(mirror.amount) : 0,
      },
    })
    if (paidPaisa > amountPaisa) {
      const message = "That is more than it comes to"
      throw new HttpError(422, message, { paidNow: [message] })
    }
    if (paidPaisa < amountPaisa && !partyRef) {
      const message = "Pick the party you owe the rest to"
      throw new HttpError(422, message, { partyId: [message] })
    }

    /*
     * Which accounts it came out of. A supervisor can't see the accounts, so
     * their edit keeps whatever the owner chose rather than dropping it: the
     * one account takes the new amount; a split stays as it is, and only the
     * owner may change an amount that would no longer add up to it.
     */
    let accountId = values.accountId
    let split = values.allocations
    if (
      viewer.role !== "owner" &&
      needsAccount(values.method) &&
      !split?.length &&
      expense.payment
    ) {
      const existing =
        (await allocationsFor(viewer.businessId, [expense.payment])).get(
          String(expense.payment)
        ) ?? []
      if (existing.length > 1) {
        const total = existing.reduce((sum, row) => sum + toPaisa(row.amount), 0)
        if (total !== paidPaisa) {
          throw new HttpError(
            409,
            "The owner split this one across accounts, so only they can change its amount."
          )
        }
        split = existing
        accountId = undefined
      } else if (existing.length === 1) {
        accountId = existing[0].accountId
      }
    }
    const allocation =
      paidPaisa > 0
        ? await resolveAllocations(viewer.businessId, {
            method: values.method,
            amount: fromPaisa(paidPaisa),
            accountId,
            allocations: split,
            requireAccount: viewer.role === "owner",
          })
        : { rows: [], account: undefined, allocated: false }
    const account = allocation.account
    const dueDate =
      paidPaisa < amountPaisa && values.dueDate
        ? dayRangeInZone(values.dueDate, business.timeZone).start
        : undefined

    // Every item either side of the edit: one dropped from the purchase still
    // needs its cost worked out again without it.
    const touched = [
      ...(expense.lines ?? []).flatMap((line) =>
        line.item ? [String(line.item)] : []
      ),
      ...lines.flatMap((line) => (line.item ? [String(line.item)] : [])),
    ]

    const before = expense.amount
    const session = await mongoose.startSession()

    try {
      await session.withTransaction(async () => {
        const delta = deltaBetween(expense.lines ?? [], values.lines)
        await applyStockDelta(viewer.businessId, delta, session)

        expense.kind = values.kind
        expense.payee = values.payee
        expense.partyRef = partyRef
        expense.account = account
        expense.employee = employeeId
          ? new mongoose.Types.ObjectId(employeeId)
          : undefined
        expense.amount = amount
        expense.method = values.method
        expense.reference = values.reference
        expense.note = values.note
        expense.spentOn = start
        expense.set("lines", lines)
        // Only a purchase still partly owed has a due date.
        if (paidPaisa < amountPaisa && values.dueDate) expense.dueDate = dueDate
        else if (paidPaisa >= amountPaisa) expense.dueDate = undefined

        // Nothing paid at the time any more: its cash row goes, and with it
        // the money it took off any account.
        if (paidPaisa === 0 && expense.payment) {
          await Payment.deleteOne(
            { _id: expense.payment, business: viewer.businessId },
            { session }
          )
          await removeAllocations(session, viewer.businessId, expense.payment)
          expense.payment = undefined
        }
        // Something paid now where nothing was: it gets a cash row.
        if (paidPaisa > 0 && !expense.payment) {
          const [created] = await Payment.create(
            [
              {
                business: viewer.businessId,
                direction: "out",
                party: values.payee,
                partyRef,
                account,
                allocated: allocation.allocated || undefined,
                amount: fromPaisa(paidPaisa),
                method: values.method,
                reference: values.reference,
                note: values.note,
                paidOn: start,
                expense: expense._id,
                recordedBy: viewer.id,
              },
            ],
            { session }
          )
          expense.payment = created._id
          await writeAllocations(
            session,
            { businessId: viewer.businessId, paymentId: created._id, direction: "out" },
            allocation.rows
          )
          await expense.save({ session })
        } else {
          await expense.save({ session })
        }

        // The mirrored cash row moves with it, or the two ledgers drift.
        if (expense.payment && mirror) {
          await Payment.updateOne(
            { _id: expense.payment, business: viewer.businessId },
            {
              $set: {
                party: values.payee,
                partyRef: partyRef ?? null,
                account: account ?? null,
                allocated: allocation.allocated,
                amount: fromPaisa(paidPaisa),
                method: values.method,
                reference: values.reference,
                note: values.note,
                paidOn: start,
              },
            },
            { session }
          )
          // Its accounts are re-read from the new figures: back to cash
          // drops them, a new amount moves them.
          await writeAllocations(
            session,
            { businessId: viewer.businessId, paymentId: expense.payment, direction: "out" },
            allocation.rows
          )
        }

        await recomputeCosts(viewer.businessId, touched, session)
      })
    } finally {
      await session.endSession()
    }

    await expense.populate("employee", "name")
    await expense.populate("recordedBy", "name")

    void logActivity({
      businessId: viewer.businessId,
      action: "expense_updated",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: `${money(amount)} to ${values.payee}`,
      detail: kindLabel(values.kind),
      from: before === amount ? undefined : money(before),
      to: before === amount ? undefined : money(amount),
      targetKind: "expense",
      targetId: expense._id,
      href: "/dashboard/sales",
    })

    return ok({
      expense: toExpenseDTO(
        expense,
        business.timeZone,
        viewer.role === "owner"
          ? allocation.rows.map((row) => ({
              accountId: String(row.account),
              amount: row.amount,
            }))
          : undefined
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Delete one, putting back whatever it moved: the stock comes off the shelf
 * again, the costs are averaged without it, and the mirrored cash row goes
 * with it. A purchase whose goods have since been sold cannot be deleted —
 * the shelf would have to go negative to allow it.
 */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/expenses/[id]">
) {
  try {
    const viewer = await requireUser()
    // Deleting a record is the owner's alone (lib/auth/permissions.ts).
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params

    await connectToDatabase()
    const expense = await findOwn(viewer.businessId, viewer.role, id)

    // Payments made later against a purchase on credit point at it; deleting
    // the purchase would leave them paying for nothing.
    const settledBy = await Payment.countDocuments({
      business: viewer.businessId,
      purchase: expense._id,
    })
    if (settledBy > 0) {
      throw new HttpError(
        409,
        `${settledBy} payment${settledBy === 1 ? " was" : "s were"} made against this purchase. Delete ${settledBy === 1 ? "it" : "them"} on the Payments page first.`
      )
    }

    const touched = (expense.lines ?? []).flatMap((line) =>
      line.item ? [String(line.item)] : []
    )
    const { amount, payee, kind } = expense
    const session = await mongoose.startSession()

    try {
      await session.withTransaction(async () => {
        const delta = deltaBetween(expense.lines ?? [], [])
        await applyStockDelta(viewer.businessId, delta, session)

        if (expense.payment) {
          await Payment.deleteOne(
            { _id: expense.payment, business: viewer.businessId },
            { session }
          )
          // The money goes back on the accounts it came out of.
          await removeAllocations(session, viewer.businessId, expense.payment)
        }

        await expense.deleteOne({ session })
        // After the row is gone, so the average is of what is left.
        await recomputeCosts(viewer.businessId, touched, session)
      })
    } finally {
      await session.endSession()
    }

    void logActivity({
      businessId: viewer.businessId,
      action: "expense_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: `${money(amount)} to ${payee}`,
      detail: kindLabel(kind),
      targetKind: "expense",
      href: "/dashboard/sales",
    })

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
