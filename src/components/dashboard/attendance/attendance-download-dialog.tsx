"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldLabel, inputClass } from "@/components/auth/field"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildSheet,
  clock,
  fileNameFor,
  monthLabel,
  recentMonths,
  toCsv,
  totalsOf,
  type SheetRow,
  type SheetTotals,
} from "@/lib/attendance-export"
import { useAttendance } from "@/lib/queries"

export type SheetPerson = {
  id: string
  name: string
  role: string
  shift: string | null
}

/**
 * A month of one person's attendance, as a spreadsheet or a printed sheet.
 * The preview is the same markup that prints, so what is on screen is what
 * comes out of the printer.
 */
export function AttendanceDownloadDialog({
  open,
  person,
  businessName,
  defaultMonth,
  onClose,
}: {
  open: boolean
  person: SheetPerson | null
  businessName: string
  /** The month of the day being viewed, so the obvious one is preselected. */
  defaultMonth: string
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[680px] sm:p-6")}
      >
        <DialogHeader data-no-print>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Download attendance
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {person
              ? `${person.name} · a whole month, as a spreadsheet or a printed sheet.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {open && person ? (
          <Body
            person={person}
            businessName={businessName}
            defaultMonth={defaultMonth}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  person,
  businessName,
  defaultMonth,
  onClose,
}: {
  person: SheetPerson
  businessName: string
  defaultMonth: string
  onClose: () => void
}) {
  const [month, setMonth] = React.useState(defaultMonth)

  const query = useAttendance(month, person.id)
  const timeZone = query.data?.timeZone ?? "UTC"
  const today = query.data?.today ?? ""

  const rows = React.useMemo(
    () => (query.data ? buildSheet(month, query.data.days, today) : []),
    [query.data, month, today]
  )
  const totals = React.useMemo(() => totalsOf(rows), [rows])

  const months = React.useMemo(
    () => recentMonths(query.data?.today?.slice(0, 7) ?? defaultMonth),
    [query.data?.today, defaultMonth]
  )

  function downloadCsv() {
    const csv = toCsv({
      rows,
      totals,
      person,
      businessName,
      month,
      timeZone,
    })
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${fileNameFor(person, month)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`${fileNameFor(person, month)}.csv saved`)
  }

  return (
    <>
      <style>{printCss}</style>

      <div data-no-print className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[210px] flex-col gap-[7px]">
          <FieldLabel>Month</FieldLabel>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Month to download"
            className={cn(inputClass, "cursor-pointer")}
          >
            {(months.includes(month) ? months : [month, ...months]).map(
              (option) => (
                <option key={option} value={option}>
                  {monthLabel(option)}
                </option>
              )
            )}
          </select>
        </label>

        <span className="text-n-500 pb-2.5 text-[12.5px]">
          {query.isPending ? (
            "Reading the month…"
          ) : query.isError ? (
            "Couldn't read that month."
          ) : (
            <>
              {totals.worked} worked · {totals.late} late · {totals.leave} leave
              · {totals.absent} absent
            </>
          )}
        </span>
      </div>

      <div
        data-sheet-frame
        className="border-n-200 max-h-[46vh] overflow-auto rounded-[10px] border bg-white"
      >
        {query.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <Sheet
            rows={rows}
            totals={totals}
            person={person}
            businessName={businessName}
            month={month}
            timeZone={timeZone}
          />
        )}
      </div>

      <DialogFooter data-no-print className="gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={query.isPending || query.isError}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Print / save as PDF
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={query.isPending || query.isError}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-50"
        >
          Download CSV
        </button>
      </DialogFooter>
    </>
  )
}

/** The sheet itself — previewed on screen, and the only thing that prints. */
function Sheet({
  rows,
  totals,
  person,
  businessName,
  month,
  timeZone,
}: {
  rows: SheetRow[]
  totals: SheetTotals
  person: SheetPerson
  businessName: string
  month: string
  timeZone: string
}) {
  return (
    <div data-attendance-sheet className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-[15px] font-semibold">
          {businessName}
        </span>
        <span className="text-n-600 text-[13px]">
          Attendance · {monthLabel(month)}
        </span>
        <span className="text-n-500 text-[12.5px] capitalize">
          {person.name} · {person.role}
          {person.shift ? ` · ${person.shift}` : ""}
        </span>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-n-300 border-b">
            {["", "DAY", "IN", "OUT", "LATE", "WHERE THE DAY OPENED", "STATUS"].map(
              (head) => (
                <th
                  key={head}
                  className="text-n-500 px-1.5 py-1.5 text-left font-mono text-[9.5px] font-normal tracking-[0.06em]"
                >
                  {head}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.day}
              className={cn(
                "border-n-200/70 border-b",
                row.future && "text-n-400"
              )}
            >
              <td className="text-n-500 px-1.5 py-1 font-mono">{row.date}</td>
              <td className="text-n-500 px-1.5 py-1">{row.weekday}</td>
              <td className="px-1.5 py-1 font-mono">
                {row.inAt ? clock(row.inAt, timeZone) : "—"}
              </td>
              <td className="px-1.5 py-1 font-mono">
                {row.outAt ? clock(row.outAt, timeZone) : "—"}
              </td>
              <td className="text-a-700 px-1.5 py-1">{row.lateBy || ""}</td>
              <td className="text-n-600 px-1.5 py-1">
                {[row.place, row.distance, row.reason]
                  .filter(Boolean)
                  .join(" · ")}
                {row.note ? ` — ${row.note}` : ""}
              </td>
              <td className="px-1.5 py-1 capitalize">{row.status ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-n-300 flex flex-wrap gap-x-5 gap-y-1 border-t pt-2 text-[12px]">
        <Total label="Worked" value={totals.worked} />
        <Total label="Present" value={totals.present} />
        <Total label="Late" value={totals.late} />
        <Total label="Leave" value={totals.leave} />
        <Total label="Absent" value={totals.absent} />
        <Total label="Away from the office" value={totals.away} />
      </div>

      <div className="hidden pt-8 text-[12px] print:flex print:gap-16">
        <span>Signature ___________________</span>
        <span>Date ___________________</span>
      </div>
    </div>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-n-600">
      {label} <span className="text-n-900 font-semibold">{value}</span>
    </span>
  )
}

/**
 * Printing keeps the sheet and drops everything around it — the dashboard
 * behind the dialog, the scrim, and the dialog's own chrome. Scoped to this
 * component rather than the global stylesheet, like the bill's print rules.
 */
const printCss = `
@media print {
  /* Hide everything, then bring back only the sheet. Radix renders the
     dialog straight into <body> with no wrapper of its own, so anything
     keyed on a portal element would hide the dialog along with the page. */
  body * { visibility: hidden !important; }
  [data-attendance-sheet], [data-attendance-sheet] * { visibility: visible !important; }

  [data-slot="dialog-overlay"] { display: none !important; }
  [data-slot="dialog-content"] {
    position: static !important;
    /* Tailwind v4 centres this with the CSS translate property rather than
       transform, and a translated element becomes the containing block for
       its absolute children — which would drag the sheet off the page. */
    transform: none !important;
    translate: none !important;
    rotate: none !important;
    scale: none !important;
    max-width: none !important;
    width: auto !important;
    max-height: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    padding: 0 !important;
    gap: 0 !important;
    display: block !important;
  }
  /* The preview scrolls on screen; on paper it runs to as many pages as it needs. */
  [data-sheet-frame] {
    max-height: none !important;
    overflow: visible !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  [data-attendance-sheet] {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    padding: 0 !important;
  }
  [data-attendance-sheet] tr { break-inside: avoid; }
  @page { margin: 12mm; }
}
`
