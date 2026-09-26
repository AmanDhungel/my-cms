import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { prettyState } from "@/lib/activity-labels"
import { markDeparture } from "@/lib/attendance"
import { notifySupervisors, notifyUser } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { shiftOn } from "@/lib/week-server"
import { loadTicketForViewer } from "@/lib/tickets"
import { PAST_TICKET_MESSAGE, isPastTicket } from "@/lib/ticket-window"
import {
  ticketStatusSchema,
  type TicketStatusValues,
} from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import {
  MAX_TICKET_PHOTOS_EACH,
  toTicketDTO,
  type TicketStatus,
} from "@/models/ticket"
import { deleteUploads, isBusinessKeyIn, keyFromUrl } from "@/lib/s3"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Who may move a ticket where.
 *
 * The assignee runs their own work up to "ready for review" but can't sign it
 * off — that's the whole point of a review column. Owners and supervisors move
 * it anywhere, including back down the board.
 */
const ASSIGNEE_CAN_SET: readonly TicketStatus[] = [
  "in_progress",
  "blocked",
  "in_review",
]

/** Reaching either of these means the visit is over. */
const CLOSES_THE_VISIT: readonly TicketStatus[] = ["in_review", "done"]

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tickets/[id]/status">
) {
  try {
    const viewer = await requireUser()
    const { id } = await ctx.params
    const values = ticketStatusSchema.parse(await request.json())

    await connectToDatabase()

    const ticket = await loadTicketForViewer(id, viewer)

    if (ticket.status === "cancelled") {
      throw new HttpError(409, "That ticket was cancelled")
    }

    const isReviewer = viewer.role !== "employee"

    // Past tickets are view-only for the crew. Owners and supervisors keep
    // every move they had, including reopening one.
    if (!isReviewer) {
      const business = await getWorkspace(viewer.businessId)
      if (isPastTicket(ticket, new Date(), business.timeZone)) {
        throw new HttpError(403, PAST_TICKET_MESSAGE)
      }
    }

    // Permission is settled before position: "you can't move it there" is a
    // truer answer than "it's already there" when both would apply.
    if (!isReviewer && !ASSIGNEE_CAN_SET.includes(values.status)) {
      throw new HttpError(
        403,
        values.status === "done"
          ? "Send it for review — your owner signs work off"
          : "You can't move a ticket there"
      )
    }

    if (ticket.status === values.status) {
      throw new HttpError(409, `That ticket is already ${label(values.status)}`)
    }

    /*
     * Completion photos. The crew sends its own whole list with the change:
     * kept photos by URL, new ones as just uploaded. Sending a ticket for
     * review needs at least one. Each new one must be this workspace's
     * ticket picture; nobody can adopt someone else's photo on the ticket
     * (dropping it later would delete theirs). Removed ones are deleted from
     * storage only after the save has landed.
     */
    let removedPhotos: string[] = []
    if (!isReviewer && (values.photos !== undefined || values.status === "in_review")) {
      const all = ticket.photos ?? []
      const mine = all.filter((photo) => String(photo.uploadedBy) === viewer.id)
      const othersUrls = new Set(
        all.filter((photo) => String(photo.uploadedBy) !== viewer.id).map((photo) => photo.url)
      )
      const wanted = [
        ...new Set((values.photos ?? mine.map((photo) => ({ url: photo.url }))).map((one) => one.url)),
      ]
      const refuse = (message: string) =>
        new HttpError(422, "Validation failed", { photos: [message] })

      if (wanted.length > MAX_TICKET_PHOTOS_EACH) {
        throw refuse(`Five photos is the most you can add to a ticket`)
      }
      const keptUrls = new Set(mine.map((photo) => photo.url))
      const added: { key: string; url: string; uploadedBy: string; uploadedAt: Date }[] = []
      for (const url of wanted) {
        if (othersUrls.has(url)) throw refuse("That photo was added by someone else")
        if (keptUrls.has(url)) continue
        const key = keyFromUrl(url)
        if (!key || !isBusinessKeyIn(key, viewer.businessId, "ticket")) {
          throw refuse("That picture isn't one of ours")
        }
        added.push({ key, url, uploadedBy: viewer.id, uploadedAt: new Date() })
      }
      if (values.status === "in_review" && wanted.length === 0) {
        throw refuse("Add at least one photo of the finished work")
      }
      const keep = new Set(wanted)
      removedPhotos = mine.filter((photo) => !keep.has(photo.url)).map((photo) => photo.url)
      // Everything already there stays where it was; new ones go on the end.
      ticket.set("photos", [
        ...all.filter((photo) => !removedPhotos.includes(photo.url)),
        ...added,
      ])
    }

    const cameFrom = ticket.status

    ticket.status = values.status
    ticket.blockedReason =
      values.status === "blocked" ? values.blockedReason : undefined

    /*
     * The structured half of the same answer.
     *
     * Raised when work stops and cleared — not deleted — when it resumes, so
     * "this job was stuck on material for three days" is still on the record
     * after the material turns up.
     */
    if (values.status === "blocked") {
      ticket.set("blocker", {
        reason: values.blockerReason,
        note: values.blockerNote,
        needs: values.needs ?? [],
        raisedAt: new Date(),
        raisedBy: viewer.id,
        clearedAt: undefined,
      })
    } else if (ticket.blocker?.raisedAt && !ticket.blocker.clearedAt) {
      ticket.set("blocker.clearedAt", new Date())
    }

    // Handing work over while still checked in closes the visit, so attendance
    // isn't left open for the rest of the day. Only the acting person's visit
    // closes — a crewmate still on site keeps theirs.
    const myVisit = (ticket.openCheckIns ?? []).find(
      (entry) => String(entry.user) === viewer.id
    )

    if (CLOSES_THE_VISIT.includes(values.status) && myVisit) {
      const at = new Date()
      ticket.set(
        "openCheckIns",
        ticket.openCheckIns.filter((entry) => String(entry.user) !== viewer.id)
      )
      ticket.checkedOutAt = at

      const [business, me] = await Promise.all([
        getWorkspace(viewer.businessId),
        User.findById(viewer.id).select("shift week"),
      ])

      await markDeparture({
        businessId: ticket.business,
        userId: viewer.id,
        at,
        source: "derived",
        shift: shiftOn(dayKeyInZone(at, business.timeZone), me, business),
        timeZone: business.timeZone,
      })
    }

    await ticket.save()
    // Only now that the ticket no longer points at them.
    if (removedPhotos.length > 0) void deleteUploads(removedPhotos, viewer.businessId)
    await ticket.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await logActivity({
      businessId: ticket.business,
      action: "ticket_status",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: ticket.title,
      detail: values.status === "blocked" ? values.blockedReason : ticket.site,
      from: prettyState(cameFrom),
      to: prettyState(values.status),
      targetKind: "ticket",
      targetId: ticket._id,
      href: "/dashboard/tickets",
    })

    await announce(ticket, values, viewer, isReviewer)

    return ok({ ticket: toTicketDTO(ticket, viewer.id) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Work moving up the board tells the owners; a decision coming back down
 * tells the person who did the work. Nobody is told about their own action.
 */
async function announce(
  ticket: Awaited<ReturnType<typeof loadTicketForViewer>>,
  values: TicketStatusValues,
  viewer: { id: string; name: string; businessId: string },
  isReviewer: boolean
) {
  const shared = {
    businessId: ticket.business,
    href: "/dashboard/tickets",
    actor: viewer.id,
    ticket: ticket._id,
  }

  if (values.status === "blocked") {
    await notifySupervisors({
      ...shared,
      kind: "ticket_blocked",
      title: `${viewer.name} is blocked on ${ticket.title}`,
      body: blockerLine(values),
    })
    return
  }

  if (values.status === "in_review") {
    await notifySupervisors({
      ...shared,
      kind: "ticket_in_review",
      title: `${viewer.name} sent ${ticket.title} for review`,
      body: ticket.site,
    })
    return
  }

  if (values.status === "done") {
    // A reviewer signing off is news for the crew who did the work; anyone
    // who signed off their own ticket needs no notification about it.
    if (isReviewer) {
      const crew = (ticket.assignees ?? [])
        .map((ref) => String((ref as { _id?: unknown })?._id ?? ref))
        .filter((id) => id !== viewer.id)

      await Promise.all(
        crew.map((userId) =>
          notifyUser({
            ...shared,
            userId,
            kind: "ticket_done",
            title: `${ticket.title} was signed off`,
            body: ticket.site,
          })
        )
      )
      return
    }

    await notifySupervisors({
      ...shared,
      kind: "ticket_done",
      title: `${viewer.name} finished ${ticket.title}`,
      body: ticket.site,
    })
  }
}

function label(status: string) {
  if (status === "in_progress") return "in progress"
  if (status === "in_review") return "in review"
  return status
}

/**
 * What the notification says.
 *
 * A shortage is the case worth spelling out: "blocked — waiting on 40 m of
 * 2.5mm cable" is something the owner can act on this afternoon, where
 * "blocked" on its own only prompts a phone call to ask what for.
 */
function blockerLine(values: {
  blockedReason?: string
  blockerReason?: string
  needs?: { name: string; qty?: number; unit?: string }[]
}) {
  const parts = [values.blockedReason].filter(Boolean) as string[]

  if (values.needs?.length) {
    const short = values.needs
      .map((one) =>
        one.qty ? `${one.qty}${one.unit ? ` ${one.unit}` : ""} ${one.name}` : one.name
      )
      .join(", ")
    parts.push(`Short of: ${short}`)
  }

  return parts.join(" — ") || undefined
}
