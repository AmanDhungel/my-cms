"use client"

import * as React from "react"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MapPicker } from "@/components/dashboard/map-picker"
import { TicketStatusBadge } from "@/components/dashboard/ticket-status-badge"
import { initialsOf } from "@/components/dashboard/viewer"
import { formatDistance } from "@/lib/geo"
import { MaterialsDialog } from "@/components/dashboard/tickets/materials-dialog"
import { money, quantity } from "@/lib/billing"
import { BLOCKER_LABELS } from "@/lib/tickets-client"
import { useTicket } from "@/lib/queries"
import type { TicketDTO } from "@/models/ticket"

/**
 * Read-only view of everything the ticket already carries. Fetches nothing,
 * unless `showHistory` asks for the check-in history as well.
 */
export function TicketDetailDialog({
  ticket,
  timeZone,
  open,
  onClose,
  readOnly = false,
  showHistory = false,
}: {
  ticket: TicketDTO
  timeZone: string
  open: boolean
  onClose: () => void
  /** A past ticket for the crew: nothing on it can be changed. */
  readOnly?: boolean
  /** Also list who checked in and out, and when. */
  showHistory?: boolean
}) {
  const [materialsOpen, setMaterialsOpen] = React.useState(false)
  // The completion photo open in the lightbox, by position.
  const [viewing, setViewing] = React.useState<number | null>(null)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[560px] p-5 sm:p-6")}
        // Escape closes an open photo first, then the dialog.
        onEscapeKeyDown={(event) => {
          if (viewing !== null) {
            event.preventDefault()
            setViewing(null)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {ticket.title}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {ticket.project?.name ? `${ticket.project.name} · ` : ""}
            {ticket.site}
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <Body
            ticket={ticket}
            timeZone={timeZone}
            showHistory={showHistory}
            onView={setViewing}
          />
        ) : null}

        {open && viewing !== null && ticket.photos[viewing] ? (
          <Lightbox
            photos={ticket.photos}
            index={viewing}
            timeZone={timeZone}
            onIndex={setViewing}
            onClose={() => setViewing(null)}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2.5">
          {readOnly ? (
            <span
              data-view-only
              className="text-n-500 mr-auto self-center font-mono text-[11px] tracking-[0.06em]"
            >
              VIEW ONLY
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMaterialsOpen(true)}
              className="border-n-300 text-n-700 hover:bg-n-100 mr-auto rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              {ticket.materials.length > 0 ? "Edit materials" : "Materials used"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Close
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${ticket.lat},${ticket.lng}`}
            target="_blank"
            rel="noreferrer"
            className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            Get directions
          </a>
        </DialogFooter>
      </DialogContent>

      <MaterialsDialog
        ticket={ticket}
        open={materialsOpen}
        onClose={() => setMaterialsOpen(false)}
      />
    </Dialog>
  )
}

function Body({
  ticket,
  timeZone,
  showHistory,
  onView,
}: {
  ticket: TicketDTO
  timeZone: string
  showHistory: boolean
  onView: (index: number) => void
}) {
  return (
    <div className="flex max-h-[62vh] flex-col gap-3.5 overflow-auto pr-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <TicketStatusBadge status={ticket.status} />
        {ticket.priority !== "normal" ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] uppercase",
              ticket.priority === "critical"
                ? "text-s-overdue bg-[#fdecec]"
                : "text-a-700 bg-a-50"
            )}
          >
            {ticket.priority}
          </span>
        ) : null}
      </div>

      {ticket.description ? (
        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          {ticket.description}
        </p>
      ) : null}

      {ticket.blockedReason || ticket.blocker ? (
        <div className="border-a-400 bg-a-50 text-a-900 flex flex-col gap-1.5 rounded-md border-l-2 px-3 py-2.5">
          <p className="m-0 text-[12.5px] leading-relaxed">
            <span className="font-semibold">
              Blocked{ticket.blocker?.reason ? ` — ${BLOCKER_LABELS[ticket.blocker.reason]}` : ""}
            </span>
            {ticket.blockedReason ? `: ${ticket.blockedReason}` : ""}
          </p>

          {ticket.blocker?.note ? (
            <p className="m-0 text-[12px] leading-relaxed opacity-85">
              {ticket.blocker.note}
            </p>
          ) : null}

          {/* The shortage is the part somebody can act on today. */}
          {ticket.blocker?.needs.length ? (
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="font-mono text-[10px] tracking-[0.07em] opacity-70">
                WAITING ON
              </span>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {ticket.blocker.needs.map((need, index) => (
                  <li key={index} className="text-[12.5px]">
                    {need.qty ? `${need.qty}${need.unit ? ` ${need.unit}` : ""} · ` : ""}
                    {need.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* What the job consumed, once anyone has written it up. */}
      {ticket.materials.length > 0 ? (
        <div className="border-n-200 flex flex-col gap-1.5 rounded-md border bg-white px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-n-500 font-mono text-[10px] tracking-[0.07em]">
              MATERIALS USED
            </span>
            {ticket.materialsTotal > 0 ? (
              <span className="font-mono text-[12px] font-semibold tabular-nums">
                {money(ticket.materialsTotal)}
              </span>
            ) : null}
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {ticket.materials.map((line, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-3 text-[12.5px]"
              >
                <span className="min-w-0 truncate">
                  {quantity(line.qty)} {line.unit} · {line.name}
                </span>
                {line.total > 0 ? (
                  <span className="text-n-500 font-mono text-[11.5px] tabular-nums">
                    {money(line.total)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Fact label="Window">
          {dateLabel(ticket.startAt, timeZone) === dateLabel(ticket.endAt, timeZone) ? (
            <>
              {clock(ticket.startAt, timeZone)}–{clock(ticket.endAt, timeZone)} ·{" "}
              {dateLabel(ticket.startAt, timeZone)}
            </>
          ) : (
            // A job over several days says so, rather than showing only
            // the day it started.
            <>
              {clock(ticket.startAt, timeZone)} {dateLabel(ticket.startAt, timeZone)} →{" "}
              {clock(ticket.endAt, timeZone)} {dateLabel(ticket.endAt, timeZone)}
            </>
          )}
        </Fact>
        <Fact label="Check-in area">{formatDistance(ticket.radiusM)}</Fact>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Crew</Label>
        <div className="flex flex-wrap gap-1.5">
          {ticket.assignees.length === 0 ? (
            <span className="text-n-400 text-[13px]">Unassigned</span>
          ) : (
            ticket.assignees.map((member) => {
              const here = ticket.onSite.some((entry) => entry.id === member.id)
              return (
                <span
                  key={member.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12.5px]",
                    here
                      ? "border-p-400 bg-p-50 text-p-700"
                      : "border-n-200 text-n-700 bg-white"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "font-heading flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold",
                      here ? "bg-p-500 text-white" : "bg-n-100 text-n-600"
                    )}
                  >
                    {initialsOf(member.name)}
                  </span>
                  {member.name}
                  {here ? " · on site" : ""}
                </span>
              )
            })
          )}
        </div>
      </div>

      {ticket.photos.length > 0 ? (
        <div className="flex flex-col gap-1.5" data-ticket-photos>
          <Label>Completion photos · {ticket.photos.length}</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ticket.photos.map((photo, index) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => onView(index)}
                aria-label={`Open photo ${index + 1}${photo.uploadedByName ? ` by ${photo.uploadedByName}` : ""}`}
                className="border-n-200 hover:border-p-400 focus-visible:outline-p-500 aspect-square overflow-hidden rounded-md border bg-white focus-visible:outline-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showHistory ? <History ticketId={ticket.id} timeZone={timeZone} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label>Where</Label>
        <MapPicker
          readOnly
          value={{ lat: ticket.lat, lng: ticket.lng }}
          radiusM={ticket.radiusM}
          onChange={() => {}}
        />
      </div>
    </div>
  )
}

/** One completion photo, large, with the ones either side a click away. */
function Lightbox({
  photos,
  index,
  timeZone,
  onIndex,
  onClose,
}: {
  photos: TicketDTO["photos"]
  index: number
  timeZone: string
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const photo = photos[index]
  const step = (delta: number) => onIndex((index + delta + photos.length) % photos.length)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      data-photo-lightbox
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1)
        if (event.key === "ArrowLeft") step(-1)
      }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={`Completion photo ${index + 1}`}
        className="max-h-[78vh] max-w-full rounded-md object-contain"
      />
      <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-white">
        <span className="font-mono text-[12px] opacity-80">
          {index + 1} / {photos.length}
          {photo.uploadedByName ? ` · ${photo.uploadedByName}` : ""} · {clock(photo.uploadedAt, timeZone)}{" "}
          {dateLabel(photo.uploadedAt, timeZone)}
        </span>
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => step(-1)} className="rounded-md bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25">
              Previous
            </button>
            <button type="button" onClick={() => step(1)} className="rounded-md bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25">
              Next
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="rounded-md bg-white px-3 py-1.5 font-semibold text-black"
        >
          Close
        </button>
      </div>
    </div>
  )
}

/** Who checked in and out, newest first. */
function History({ ticketId, timeZone }: { ticketId: string; timeZone: string }) {
  const query = useTicket(ticketId)
  const history = query.data?.history ?? []
  return (
    <div className="flex flex-col gap-1.5" data-ticket-history>
      <Label>History</Label>
      {query.isPending ? (
        <span className="text-n-400 text-[13px]">Loading…</span>
      ) : history.length === 0 ? (
        <span className="text-n-400 text-[13px]">Nobody checked in to this one.</span>
      ) : (
        <ul className="border-n-200 m-0 flex list-none flex-col divide-y rounded-md border bg-white p-0">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[12.5px]">
              <span>
                {entry.type === "in" ? "Checked in" : "Checked out"}
                {entry.insideFence ? "" : ` · ${formatDistance(entry.distanceM)} away`}
              </span>
              <span className="text-n-500 font-mono text-[11.5px] tabular-nums">
                {clock(entry.at, timeZone)} · {dateLabel(entry.at, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-n-200 flex flex-col gap-0.5 rounded-md border bg-white px-3 py-2">
      <Label>{label}</Label>
      <span className="text-[13.5px]">{children}</span>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em] uppercase">
      {children}
    </span>
  )
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function dateLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(new Date(iso))
}
