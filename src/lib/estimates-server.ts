import type { ClientSession, Types } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { estimateNumber } from "@/lib/estimates"
import { Business } from "@/models/business"
import { InventoryItem } from "@/models/inventory-item"

type InputLine = {
  itemId?: string
  name: string
  unit?: string
  price: number
  qty: number
  discountPct: number
}

/**
 * An estimate's lines as they will be stored. An inventory line takes its
 * name, unit and price from the item — exactly as a bill does — so a
 * doctored request can't quote a drill at 5. Stock is not checked or moved:
 * an estimate is an offer, not a sale.
 */
export async function priceEstimateLines(
  businessId: string,
  source: "custom" | "inventory",
  lines: InputLine[]
) {
  if (source === "custom") {
    return lines.map((line) => ({
      name: line.name,
      unit: line.unit || "pcs",
      price: line.price,
      qty: line.qty,
      discountPct: line.discountPct,
    }))
  }
  const ids = [...new Set(lines.map((line) => line.itemId))]
  const items = await InventoryItem.find({ _id: { $in: ids }, business: businessId })
  const byId = new Map(items.map((item) => [String(item._id), item]))
  return lines.map((line) => {
    const item = byId.get(String(line.itemId))
    if (!item) throw new HttpError(404, `${line.name} is no longer in the inventory`)
    return {
      item: item._id as Types.ObjectId,
      name: item.name,
      unit: item.unit,
      price: item.price,
      qty: line.qty,
      discountPct: line.discountPct,
    }
  })
}

/** The next EST-0001 number: an atomic $inc on the workspace, like bills. */
export async function nextEstimateNumber(businessId: string, session?: ClientSession) {
  const counted = await Business.findByIdAndUpdate(
    businessId,
    { $inc: { estimateSeq: 1 } },
    { new: true, session }
  ).orFail()
  return estimateNumber(counted.estimateSeq ?? 1)
}
