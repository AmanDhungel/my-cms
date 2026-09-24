import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { loadAccounts } from "@/lib/ledger"
import { connectToDatabase } from "@/lib/mongodb"
import { dayRangeInZone } from "@/lib/time"
import { accountSchema } from "@/lib/validations/accounts"
import { getWorkspace } from "@/lib/workspace"
import { Account, toAccountDTO } from "@/models/account"

export const runtime = "nodejs"

/**
 * Where the workspace's money sits.
 *
 * Owner only, like the rest of the money pages: a supervisor runs the stock
 * and the bills but doesn't see what the business holds.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner")
    const { accounts, totals } = await loadAccounts(viewer.businessId)

    return ok({
      accounts: accounts.map((account) =>
        toAccountDTO(
          account,
          totals.get(String(account._id)) ?? {
            received: 0,
            paidOut: 0,
            movements: 0,
          }
        )
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = accountSchema.parse(await request.json())

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)

    const clash = await Account.findOne({
      business: viewer.businessId,
      name: values.name,
    })
    if (clash) throw new HttpError(409, "You already have one by that name")

    // Exactly one default, so clearing the others is part of setting it.
    if (values.isDefault) {
      await Account.updateMany(
        { business: viewer.businessId },
        { $set: { isDefault: false } }
      )
    }

    const account = await Account.create({
      business: viewer.businessId,
      name: values.name,
      kind: values.kind,
      reference: values.reference,
      detail: values.detail,
      openingBalance: values.openingBalance,
      openedOn: values.openedOn
        ? dayRangeInZone(values.openedOn, business.timeZone).start
        : undefined,
      // The first one is the default whether or not anyone said so.
      isDefault:
        values.isDefault ??
        (await Account.countDocuments({ business: viewer.businessId })) === 0,
      createdBy: viewer.id,
    })

    return ok({ account: toAccountDTO(account) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
