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
import type { TicketDTO } from "@/models/ticket"

/** Read-only view of everything the ticket already carries. Fetches nothing. */
export function TicketDetailDialog({
  ticket,
  timeZone,
  open,
  onClose,
}: {
  ticket: TicketDTO
  timeZone: string
  open: boolean
  onClose: () => void
}) {
  const [materialsOpen, setMaterialsOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[560px] p-5 sm:p-6")}
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

        {open ? <Body ticket={ticket} timeZone={timeZone} /> : null}

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setMaterialsOpen(true)}
            className="border-n-300 text-n-700 hover:bg-n-100 mr-auto rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            {ticket.materials.length > 0 ? "Edit materials" : "Materials used"}
          </button>
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

function Body({ ticket, timeZone }: { ticket: TicketDTO; timeZone: string }) {
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
          {clock(ticket.startAt, timeZone)}–{clock(ticket.endAt, timeZone)} ·{" "}
          {dateLabel(ticket.startAt, timeZone)}
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
