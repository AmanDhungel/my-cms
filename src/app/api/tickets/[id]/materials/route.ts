import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { money } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { ticketMaterialsSchema } from "@/lib/validations/work"
import { InventoryItem } from "@/models/inventory-item"
import { Ticket, toTicketDTO } from "@/models/ticket"

export const runtime = "nodejs"

/**
 * What the job used.
 *
 * Recorded by whoever did the work — an assignee can write up their own
 * ticket, and an owner or supervisor can write up anyone's. It is a record
 * of consumption, not a stock movement: the same items are usually billed to
 * the customer, and taking them off the shelf here as well would count one
 * cable twice.
 *
 * The whole list is sent each time rather than one line at a time, because
 * that is how the form holds it and a half-applied list is how a ticket ends
 * up claiming material nobody used.
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]/materials">
) {
  try {
    const viewer = await requireUser()
    const { id } = await ctx.params
    const values = ticketMaterialsSchema.parse(await request.json())

    await connectToDatabase()

    const ticket = await Ticket.findOne({
      _id: id,
      business: viewer.businessId,
    })
    if (!ticket) throw new HttpError(404, "That ticket doesn't exist")

    const mine = ticket.assignees.some(
      (one) => String(one) === String(viewer.id)
    )
    if (viewer.role === "employee" && !mine) {
      throw new HttpError(403, "That isn't one of your tickets")
    }

    /*
     * A line naming a real item takes its name, unit and cost from the shelf
     * rather than from the request. What a thing is called and what it cost
     * are not the employee's to assert — they only say how much was used.
     */
    const named = values.materials.filter((one) => one.itemId)
    const items = named.length
      ? await InventoryItem.find({
          _id: { $in: named.map((one) => one.itemId) },
          business: viewer.businessId,
        }).select("name unit costPrice")
      : []
    const byId = new Map(items.map((item) => [String(item._id), item]))

    const materials = values.materials.map((line) => {
      const item = line.itemId ? byId.get(line.itemId) : undefined
      if (line.itemId && !item) {
        throw new HttpError(404, `${line.name} is no longer in the stock list`)
      }
      return {
        item: item?._id,
        name: item?.name ?? line.name,
        unit: item?.unit ?? line.unit,
        qty: line.qty,
        unitCost: item ? (item.costPrice ?? 0) : line.unitCost,
      }
    })

    ticket.set("materials", materials)
    await ticket.save()

    const total = materials.reduce((sum, one) => sum + one.qty * one.unitCost, 0)

    void logActivity({
      businessId: viewer.businessId,
      action: "ticket_updated",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: ticket.title,
      detail:
        materials.length === 0
          ? "cleared the materials used"
          : `used ${materials.length} item${materials.length === 1 ? "" : "s"}${total > 0 ? ` · ${money(total)}` : ""}`,
      targetKind: "ticket",
      targetId: ticket._id,
      href: "/dashboard/tickets",
    })

    return ok({ ticket: toTicketDTO(ticket, viewer.id) })
  } catch (error) {
    return handleApiError(error)
  }
}
