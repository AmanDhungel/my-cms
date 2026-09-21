"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SCHEDULE_COPY, shiftDays } from "@/lib/operations"
import {
  reportMutationError,
  useClearSchedule,
  useSchedules,
  useSetSchedule,
  type CrewMember,
} from "@/lib/queries"
import { scheduleSchema } from "@/lib/validations/operations"
import { SCHEDULE_KINDS, type ScheduleKind } from "@/lib/work-constants"
import type { ScheduleDTO } from "@/models/schedule"

type Cell = { member: CrewMember; day: string; entry: ScheduleDTO | null }

/**
 * The roster, a week at a time: who is meant to be working which day.
 *
 * This is the plan, not the record — attendance is what actually happened,
 * and the two are deliberately kept apart so one can be compared against the
 * other rather than quietly overwriting it.
 */
export function SchedulesView() {
  const [from, setFrom] = React.useState<string | undefined>(undefined)
  const [editing, setEditing] = React.useState<Cell | null>(null)

  const query = useSchedules(from)

  const days = query.data?.days ?? []
  const crew = query.data?.crew ?? []
  const today = query.data?.today ?? ""

  const byCell = React.useMemo(() => {
    const map = new Map<string, ScheduleDTO>()
    for (const entry of query.data?.entries ?? []) {
      map.set(`${entry.userId}:${entry.day}`, entry)
    }
    return map
  }, [query.data?.entries])

  const rostered = query.data?.entries.length ?? 0
  const working =
    query.data?.entries.filter((one) => SCHEDULE_COPY[one.kind].hours).length ??
    0

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Operations"
        title="Employee schedules"
        subtitle="Who is meant to be working which day. Attendance records what actually happened."
        actions={
          days.length ? (
            <div className="flex items-center gap-1.5">
              <Step
                label="Previous week"
                glyph="‹"
                onClick={() => setFrom(shiftDays(days[0], -7))}
              />
              <span className="border-n-200 text-n-700 min-w-[170px] rounded-md border bg-white px-3 py-2 text-center font-mono text-[12.5px]">
                {weekLabel(days)}
              </span>
              <Step
                label="Next week"
                glyph="›"
                onClick={() => setFrom(shiftDays(days[0], 7))}
              />
            </div>
          ) : null
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <StatCard label="CREW" value={crew.length} />
          <StatCard label="DAYS ROSTERED" value={rostered} />
          <StatCard label="WORKING DAYS" value={working} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {SCHEDULE_KINDS.map((kind) => (
          <span
            key={kind}
            className="text-n-600 flex items-center gap-1.5 text-[12.5px]"
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-[3px] border",
                SCHEDULE_COPY[kind].look
              )}
            />
            {SCHEDULE_COPY[kind].label}
          </span>
        ))}
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the roster. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : crew.length === 0 ? (
        <EmptyState message="Nobody to roster yet. Invite your crew from People." />
      ) : (
        <Panel className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="border-n-200 bg-n-100 grid grid-cols-[150px_repeat(7,1fr)] gap-2 border-b px-[18px] py-2.5">
              <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
                PERSON
              </span>
              {days.map((day) => (
                <span
                  key={day}
                  className={cn(
                    "font-mono text-[10.5px] tracking-[0.07em]",
                    day === today ? "text-p-700 font-semibold" : "text-n-500"
                  )}
                >
                  {dayHead(day)}
                </span>
              ))}
            </div>

            {crew.map((member) => (
              <div
                key={member.id}
                className="border-n-200/70 grid grid-cols-[150px_repeat(7,1fr)] gap-2 border-b px-[18px] py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-semibold">
                    {member.name}
                  </span>
                  <span className="text-n-500 text-[11.5px] capitalize">
                    {member.role}
                    {member.shift ? ` · ${member.shift}` : ""}
                  </span>
                </div>

                {days.map((day) => {
                  const entry = byCell.get(`${member.id}:${day}`) ?? null
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setEditing({ member, day, entry })}
                      aria-label={`${member.name} on ${day}`}
                      className={cn(
                        "flex min-h-[46px] flex-col items-start justify-center gap-0.5 rounded-md border px-2 py-1 text-left text-[11.5px] transition-colors",
                        entry
                          ? SCHEDULE_COPY[entry.kind].look
                          : "border-n-200 text-n-400 hover:bg-n-100 border-dashed bg-white"
                      )}
                    >
                      {entry ? (
                        <>
                          <span className="font-semibold">
                            {SCHEDULE_COPY[entry.kind].label}
                          </span>
                          {entry.startTime ? (
                            <span className="font-mono text-[10.5px]">
                              {entry.startTime}–{entry.endTime}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="font-mono text-[14px]">+</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {editing ? (
        <ScheduleDialog
          key={`${editing.member.id}:${editing.day}`}
          cell={editing}
          open
          onClose={() => setEditing(null)}
        />
      ) : null}
    </DashboardMain>
  )
}

function ScheduleDialog({
  cell,
  open,
  onClose,
}: {
  cell: Cell
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[460px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {cell.member.name}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {longDate(cell.day)}
          </DialogDescription>
        </DialogHeader>
        {open ? <ScheduleBody cell={cell} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleBody({ cell, onClose }: { cell: Cell; onClose: () => void }) {
  const [kind, setKind] = React.useState<ScheduleKind>(
    cell.entry?.kind ?? "work"
  )
  const [startTime, setStartTime] = React.useState(
    cell.entry?.startTime ?? defaultStart(cell.member.shift)
  )
  const [endTime, setEndTime] = React.useState(
    cell.entry?.endTime ?? defaultEnd(cell.member.shift)
  )
  const [note, setNote] = React.useState(cell.entry?.note ?? "")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const save = useSetSchedule()
  const clear = useClearSchedule()
  const keepsHours = SCHEDULE_COPY[kind].hours

  function submit() {
    if (save.isPending) return

    const parsed = scheduleSchema.safeParse({
      userId: cell.member.id,
      day: cell.day,
      kind,
      startTime: keepsHours ? startTime : undefined,
      endTime: keepsHours ? endTime : undefined,
      note: note || undefined,
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    save.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`${cell.member.name} rostered`)
        onClose()
      },
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <FieldLabel>What kind of day</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_KINDS.map((one) => (
              <button
                key={one}
                type="button"
                onClick={() => {
                  setKind(one)
                  setErrors({})
                }}
                aria-pressed={kind === one}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                  kind === one
                    ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                    : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                )}
              >
                {SCHEDULE_COPY[one].label}
              </button>
            ))}
          </div>
        </div>

        {keepsHours ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Starts</FieldLabel>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                aria-label="Start time"
                aria-invalid={Boolean(errors.startTime)}
                className={inputClass}
              />
              <FieldError message={errors.startTime} />
            </label>
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Ends</FieldLabel>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                aria-label="End time"
                aria-invalid={Boolean(errors.endTime)}
                className={inputClass}
              />
              <FieldError message={errors.endTime} />
            </label>
          </div>
        ) : (
          <p className="text-n-500 m-0 text-[12.5px]">
            {SCHEDULE_COPY[kind].label} days carry no hours.
          </p>
        )}

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Note</FieldLabel>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — why, or where"
            className={inputClass}
          />
        </label>
      </div>

      <DialogFooter className="gap-2 sm:gap-2.5">
        {cell.entry ? (
          <button
            type="button"
            onClick={() => {
              if (clear.isPending) return
              clear.mutate(cell.entry!.id, {
                onSuccess: () => {
                  toast.success("Cleared")
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={clear.isPending}
            className="text-n-500 hover:text-s-overdue mr-auto px-1 text-[13px] font-semibold disabled:opacity-60"
          >
            {clear.isPending ? "Clearing…" : "Clear this day"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </>
  )
}

function Step({
  label,
  glyph,
  onClick,
}: {
  label: string
  glyph: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[34px] items-center justify-center rounded-md border text-[16px] leading-none"
    >
      {glyph}
    </button>
  )
}

/** Their standing shift seeds the form, so the usual case is one click. */
function defaultStart(shift: string | null) {
  return shift?.split("–")[0]?.trim() || "09:00"
}

function defaultEnd(shift: string | null) {
  return shift?.split("–")[1]?.trim() || "17:00"
}

function dayHead(day: string) {
  const [year, m, d] = day.split("-").map(Number)
  const at = new Date(Date.UTC(year, m - 1, d))
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(at)
  return `${weekday.toUpperCase()} ${String(d).padStart(2, "0")}`
}

function weekLabel(days: string[]) {
  if (days.length === 0) return ""
  const fmt = (day: string) => {
    const [year, m, d] = day.split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(year, m - 1, d)))
      .toUpperCase()
  }
  return `${fmt(days[0])} – ${fmt(days[days.length - 1])}`
}

function longDate(day: string) {
  const [year, m, d] = day.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, d)))
}
