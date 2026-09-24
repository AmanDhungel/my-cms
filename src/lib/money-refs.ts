import type { Types } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { connectToDatabase } from "@/lib/mongodb"
import { Account } from "@/models/account"
import { Customer } from "@/models/customer"

/**
 * Turning an id from a request into a reference we trust.
 *
 * An id in a request body is a claim, not a fact: it could name another
 * workspace's bank account or another workspace's customer. Both lookups are
 * scoped to the caller's own business, so a wrong one comes back as "doesn't
 * exist" rather than quietly attaching a payment to somebody else's ledger.
 *
 * Shared because payments and expenses both need exactly this, and two copies
 * of a scoping check is one copy too many.
 */

export async function ownParty(
  businessId: string,
  partyId: string | undefined
): Promise<Types.ObjectId | undefined> {
  if (!partyId) return undefined
  await connectToDatabase()

  const party = await Customer.findOne({
    _id: partyId,
    business: businessId,
  }).select("_id")

  if (!party) throw new HttpError(404, "That party isn't in this workspace")
  return party._id as Types.ObjectId
}

export async function ownAccount(
  businessId: string,
  accountId: string | undefined
): Promise<Types.ObjectId | undefined> {
  if (!accountId) return undefined
  await connectToDatabase()

  const account = await Account.findOne({
    _id: accountId,
    business: businessId,
  }).select("_id archivedAt")

  if (!account) throw new HttpError(404, "That account doesn't exist")
  if (account.archivedAt) {
    throw new HttpError(409, "That account is closed. Pick another.")
  }
  return account._id as Types.ObjectId
}

/**
 * The name to snapshot alongside the reference.
 *
 * A ledger row reads back years later, by which time the party may have been
 * renamed or removed — so the text is stored too, exactly as a bill stores
 * its customer's details rather than looking them up again.
 */
export async function partyName(
  businessId: string,
  partyId: string | undefined,
  fallback: string
) {
  if (!partyId) return fallback
  await connectToDatabase()
  const party = await Customer.findOne({
    _id: partyId,
    business: businessId,
  }).select("name")
  return party?.name ?? fallback
}
