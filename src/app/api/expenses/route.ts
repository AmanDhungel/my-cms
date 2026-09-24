import mongoose from "mongoose"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { SUPERVISOR_KINDS, kindLabel, linesTotal } from "@/lib/expenses"
import {
  applyStockDelta,
  deltaBetween,
  priceLines,
  recomputeCosts,
} from "@/lib/expenses-server"
import { money } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { dayRangeInZone } from "@/lib/time"
import { expenseSchema } from "@/lib/validations/expenses"
import { getWorkspace } from "@/lib/workspace"
import { ownAccount, ownParty } from "@/lib/money-refs"
import { Expense, toExpenseDTO } from "@/models/expense"
import { Payment } from "@/models/payment"
import { User } from "@/models/user"
import type { ExpenseKind } from "@/lib/work-constants"

export const runtime = "nodejs"

/**
 * The expense ledger.
 *
 * Owners see all of it. A supervisor buys the stock, so they see and record
 * stock purchases and nothing else — what the business pays in salaries, rent
 * or tax is the owner's alone, the same rule the Payments page already keeps.
 */
function kindsFor(role: string): readonly ExpenseKind[] | null {
  return role === "owner" ? null : SUPERVISOR_KINDS
}

export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)

    const filter: Record<string, unknown> = { business: viewer.businessId }
    const allowed = kindsFor(viewer.role)
    if (allowed) filter.kind = { $in: allowed }

    const expenses = await Expense.find(filter)
      .populate("employee", "name")
      .populate("recordedBy", "name")
      .sort({ spentOn: -1, createdAt: -1 })
      .limit(500)

    return ok({
      expenses: expenses.map((expense) =>
        toExpenseDTO(expense, business.timeZone)
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Record one.
 *
 * A stock purchase is the involved case: its amount is the sum of its lines
 * rather than anything the caller sent, it raises the shelf, and it changes
 * what those items are reckoned to have cost. All of that and the row itself
 * go in one transaction, so stock can never rise without a purchase behind
 * it, or the reverse.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = expenseSchema.parse(await request.json())

    const allowed = kindsFor(viewer.role)
    if (allowed && !allowed.includes(values.kind)) {
      throw new HttpError(
        403,
        "A supervisor can record stock purchases. The rest is the owner's to enter."
      )
    }

    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    // Stored as the start of that day in the workspace's zone, so it reads
    // back as the date that was typed rather than the server's idea of it.
    const { start } = dayRangeInZone(values.spentOn, business.timeZone)

    // Salary and commission name someone on the payroll; the rest name a
    // company, which is only ever text.
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
    const account = await ownAccount(viewer.businessId, values.accountId)

    const lines = await priceLines(viewer.businessId, values.lines)
    const amount =
      values.kind === "stock" ? linesTotal(lines) : (values.amount ?? 0)

    const session = await mongoose.startSession()
    let expenseId: mongoose.Types.ObjectId | undefined

    try {
      await session.withTransaction(async () => {
        const delta = deltaBetween([], values.lines)
        await applyStockDelta(viewer.businessId, delta, session)

        const [expense] = await Expense.create(
          [
            {
              business: viewer.businessId,
              kind: values.kind,
              payee: values.payee,
              partyRef,
              account,
              employee: employeeId,
              amount,
              method: values.method,
              reference: values.reference,
              note: values.note,
              spentOn: start,
              lines,
              recordedBy: viewer.id,
            },
          ],
          { session }
        )

        // The same money seen from the cash ledger. Mirrored rather than left
        // to the owner to enter twice, so the Payments page and the cash-flow
        // report stay complete without anyone remembering to.
        const [payment] = await Payment.create(
          [
            {
              business: viewer.businessId,
              direction: "out",
              party: values.payee,
              // The mirrored cash row lands on the same ledger and the same
              // account, or the two views of one payment disagree.
              partyRef,
              account,
              amount,
              method: values.method,
              reference: values.reference,
              note: values.note,
              paidOn: start,
              // Pointed both ways: this one so a report can tell an expense's
              // cash row from one entered by hand on the Payments page.
              expense: expense._id,
              recordedBy: viewer.id,
            },
          ],
          { session }
        )

        expense.payment = payment._id
        await expense.save({ session })

        // Costs are averaged from the ledger, so this has to see the row
        // just written — hence inside the transaction, not after it.
        await recomputeCosts(
          viewer.businessId,
          lines.flatMap((line) => (line.item ? [String(line.item)] : [])),
          session
        )

        expenseId = expense._id
      })
    } finally {
      await session.endSession()
    }

    const saved = await Expense.findById(expenseId)
      .populate("employee", "name")
      .populate("recordedBy", "name")
      .orFail()

    void logActivity({
      businessId: viewer.businessId,
      action: "expense_recorded",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: `${money(amount)} to ${values.payee}`,
      detail: kindLabel(values.kind),
      targetKind: "expense",
      targetId: saved._id,
      href: "/dashboard/sales",
    })

    return ok({ expense: toExpenseDTO(saved, business.timeZone) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
