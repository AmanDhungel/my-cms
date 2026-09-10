"use client"

import * as React from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type { DateRange }

/**
 * The shadcn range picker, dressed as one of the filter controls beside it.
 * Filtering is done on whole local days: a bill raised at 5pm still belongs
 * to the day you picked.
 */
export function DateRangeFilter({
  value,
  onChange,
  label = "All dates",
}: {
  value: DateRange | undefined
  onChange: (next: DateRange | undefined) => void
  label?: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Date range"
          className={cn(
            "border-n-200 flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-[13px] transition-colors",
            value?.from
              ? "border-p-400 bg-p-100 text-p-700 font-semibold"
              : "text-n-600 hover:bg-n-100 font-medium"
          )}
        >
          <CalendarIcon />
          {rangeLabel(value) ?? label}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="border-n-200 bg-n-50 w-auto rounded-lg border p-2 shadow-[0_12px_32px_rgba(27,24,21,0.16)]"
        >
          <Calendar
            mode="range"
            numberOfMonths={1}
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            autoFocus
          />
          <div className="border-n-200 flex justify-between gap-2 border-t px-1 pt-2">
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-n-600 hover:text-n-900 text-[12.5px] font-semibold"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-p-600 text-[12.5px] font-semibold"
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {value?.from ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Clear the date range"
          className="text-n-400 hover:text-s-overdue px-1 text-[13px]"
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return null
  const from = format(range.from, "d MMM")
  if (!range.to) return from
  return `${from} – ${format(range.to, "d MMM")}`
}

/**
 * Whether a timestamp falls inside the picked days. The end is taken to the
 * last moment of its day, and a single picked day means just that day.
 */
export function withinRange(iso: string, range: DateRange | undefined) {
  if (!range?.from) return true

  const at = new Date(iso).getTime()
  const start = new Date(range.from)
  start.setHours(0, 0, 0, 0)

  const end = new Date(range.to ?? range.from)
  end.setHours(23, 59, 59, 999)

  return at >= start.getTime() && at <= end.getTime()
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}
