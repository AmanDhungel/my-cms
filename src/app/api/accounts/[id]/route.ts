import type { NextRequest } from "next/server"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { accountTotals } from "@/lib/ledger"
import { connectToDatabase } from "@/lib/mongodb"
import { dayRangeInZone } from "@/lib/time"
import { accountSchema } from "@/lib/validations/accounts"
import { getWorkspace } from "@/lib/workspace"
import { Account, toAccountDTO } from "@/models/account"
import { Expense } from "@/models/expense"
import { Payment } from "@/models/payment"

export const runtime = "nodejs"

async function findOwn(businessId: string, id: string) {
  const account = await Account.findOne({ _id: id, business: businessId })
  if (!account) throw new HttpError(404, "That account doesn't exist")
  return account
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const values = accountSchema.parse(await request.json())

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)
    const account = await findOwn(viewer.businessId, id)

    const clash = await Account.findOne({
      business: viewer.businessId,
      name: values.name,
      _id: { $ne: account._id },
    })
    if (clash) throw new HttpError(409, "You already have one by that name")

    if (values.isDefault) {
      await Account.updateMany(
        { business: viewer.businessId, _id: { $ne: account._id } },
        { $set: { isDefault: false } }
      )
    }

    account.name = values.name
    account.kind = values.kind
    account.reference = values.reference
    account.detail = values.detail
    account.openingBalance = values.openingBalance
    account.openedOn = values.openedOn
      ? dayRangeInZone(values.openedOn, business.timeZone).start
      : undefined
    if (values.isDefault !== undefined) account.isDefault = values.isDefault
    await account.save()

    const totals = await accountTotals(viewer.businessId)
    return ok({
      account: toAccountDTO(account, totals.get(String(account._id))),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Close an account, or delete one nothing has touched.
 *
 * An account money has moved through is archived rather than removed: the
 * payments pointing at it still have to read correctly, and a ledger with a
 * dangling reference is worse than a closed account in the list.
 */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params

    await connectToDatabase()
    const account = await findOwn(viewer.businessId, id)

    const [payments, expenses] = await Promise.all([
      Payment.countDocuments({ business: viewer.businessId, account: id }),
      Expense.countDocuments({ business: viewer.businessId, account: id }),
    ])

    if (payments + expenses > 0) {
      account.archivedAt = new Date()
      account.isDefault = false
      await account.save()
      return ok({ id, archived: true, movements: payments + expenses })
    }

    await account.deleteOne()
    return ok({ id, archived: false, movements: 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
