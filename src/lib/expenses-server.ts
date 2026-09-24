import mongoose, { type ClientSession } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { quantity } from "@/lib/billing"
import { Expense } from "@/models/expense"
import { InventoryItem } from "@/models/inventory-item"

/**
 * What a stock purchase does to the shelf.
 *
 * Two things move: the count, and what the item is reckoned to have cost.
 * Both are done here so recording, editing and deleting a purchase all go
 * through the same arithmetic rather than three near-copies of it.
 */

/** How many of each item a purchase adds, keyed by item id. */
export type StockDelta = Map<string, number>

/**
 * The net change between what a purchase used to say and what it says now.
 *
 * Editing a purchase is the interesting case: three of an item became five,
 * so the shelf moves by two, not by five. Recording is the same sum against
 * an empty "before", and deleting against an empty "after".
 */
export function deltaBetween(
  before: { item?: unknown; qty: number }[],
  after: { itemId: string; qty: number }[]
): StockDelta {
  const delta: StockDelta = new Map()

  for (const line of before) {
    if (!line.item) continue
    const key = String(line.item)
    delta.set(key, (delta.get(key) ?? 0) - line.qty)
  }
  for (const line of after) {
    delta.set(line.itemId, (delta.get(line.itemId) ?? 0) + line.qty)
  }

  for (const [id, qty] of delta) if (qty === 0) delta.delete(id)
  return delta
}

/**
 * Move the shelf by the delta, refusing to take off more than is there.
 *
 * Only a reduction can fail, and it fails for a real reason: goods bought and
 * since sold cannot be un-bought. The guard is in the filter rather than in a
 * read beforehand, so two people editing at once cannot both pass the check
 * and leave the count negative between them.
 */
export async function applyStockDelta(
  businessId: string,
  delta: StockDelta,
  session: ClientSession
) {
  for (const [id, qty] of delta) {
    const filter: Record<string, unknown> = {
      _id: id,
      business: businessId,
    }
    // Taking stock off: there has to be enough of it left to take.
    if (qty < 0) filter.stock = { $gte: -qty }

    const moved = await InventoryItem.updateOne(
      filter,
      { $inc: { stock: qty } },
      { session }
    )

    if (moved.matchedCount === 0) {
      const item = await InventoryItem.findOne(
        { _id: id, business: businessId },
        { name: 1, stock: 1, unit: 1 },
        { session }
      )

      if (!item) {
        throw new HttpError(404, "One of those items is no longer in the stock list")
      }
      throw new HttpError(
        409,
        `Only ${quantity(item.stock)} ${item.unit} of ${item.name} is left, and this change takes ${quantity(-qty)} off`
      )
    }
  }
}

/**
 * Work each item's cost back out from the purchases on record.
 *
 * Deliberately recomputed rather than nudged. A running average that is only
 * ever adjusted forwards cannot be reversed: delete the purchase that set it
 * and the figure it left behind stays, quietly wrong. Averaging the ledger
 * from scratch costs one grouped read per affected item and is always exactly
 * what the records say — including zero, once the last purchase is gone.
 */
export async function recomputeCosts(
  businessId: string,
  itemIds: Iterable<string>,
  session: ClientSession
) {
  for (const id of new Set(itemIds)) {
    const itemId = new mongoose.Types.ObjectId(id)

    const [summed] = await Expense.aggregate<{ qty: number; spend: number }>([
      { $match: { business: new mongoose.Types.ObjectId(businessId) } },
      { $unwind: "$lines" },
      { $match: { "lines.item": itemId } },
      {
        $group: {
          _id: null,
          qty: { $sum: "$lines.qty" },
          spend: { $sum: { $multiply: ["$lines.qty", "$lines.cost"] } },
        },
      },
    ]).session(session)

    const cost =
      summed && summed.qty > 0
        ? Math.round((summed.spend / summed.qty) * 100) / 100
        : 0

    await InventoryItem.updateOne(
      { _id: itemId, business: businessId },
      { $set: { costPrice: cost } },
      { session }
    )
  }
}

/**
 * Turn the ids a caller sent into purchase lines.
 *
 * The name and unit are read from the stock list so the record says what the
 * item was actually called; the cost stays the caller's, because what a
 * vendor charged is exactly the thing the stock list does not know.
 */
export async function priceLines(
  businessId: string,
  wanted: { itemId: string; qty: number; cost: number }[]
) {
  if (wanted.length === 0) return []

  const items = await InventoryItem.find({
    _id: { $in: wanted.map((line) => line.itemId) },
    business: businessId,
  }).select("name unit")

  const byId = new Map(items.map((item) => [String(item._id), item]))

  return wanted.map((line) => {
    const item = byId.get(line.itemId)
    if (!item) {
      throw new HttpError(
        404,
        "One of those items is no longer in the stock list"
      )
    }
    return {
      item: item._id,
      name: item.name,
      unit: item.unit,
      qty: line.qty,
      cost: line.cost,
    }
  })
}
