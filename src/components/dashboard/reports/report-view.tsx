"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "cn"

import {
  DateRangeFilter,
  type DateRange,
} from "@/components/dashboard/date-range-filter"
import { paginate, Pagination } from "@/components/dashboard/pagination"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { inputClass } from "@/components/auth/field"
import {
  GROUP_COPY,
  type ReportColumn,
  type ReportDef,
} from "@/lib/reports"
import {
  useCustomers,
  useInventoryCategories,
  usePeople,
  useReport,
} from "@/lib/queries"

const PER_PAGE = 25

/**
 * Every report renders through this. The server decides the columns, so a new
 * report is a query and a registry entry — never another table, another filter
 * bar and another export button that drift apart from these.
 */
export function ReportView({ report }: { report: ReportDef }) {
  const [range, setRange] = React.useState<DateRange | undefined>(undefined)
  const [employeeId, setEmployeeId] = React.useState("")
  const [customerId, setCustomerId] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [payment, setPayment] = React.useState("")
  const [page, setPage] = React.useState(1)

  const blocked = report.status === "blocked"

  const query = useReport(
    report.slug,
    {
      from: range?.from ? isoDay(range.from) : undefined,
      to: range?.to ? isoDay(range.to) : undefined,
      employeeId: employeeId || undefined,
      customerId: customerId || undefined,
      categoryId: categoryId || undefined,
      payment: payment || undefined,
    },
    !blocked
  )

  const data = query.data
  const rows = React.useMemo(() => data?.rows ?? [], [data?.rows])
  const columns = React.useMemo(() => data?.columns ?? [], [data?.columns])
  const paged = paginate(rows, page, PER_PAGE)

  function reset<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setPage(1)
  }

  function exportCsv() {
    const header = columns.map((c) => c.label)
    const lines = [
      [report.title],
      [describeRange(range)],
      [],
      header,
      ...rows.map((row) =>
        columns.map((c) => String(row[c.key] ?? ""))
      ),
      [],
      ...(data?.totals ?? []).map((t) => [t.label, t.value]),
    ]
    const csv = `﻿${lines
      .map((cells) => cells.map(escapeCell).join(","))
      .join("\r\n")}`

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${report.slug}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Report saved")
  }

  return (
    <DashboardMain className="gap-5">
      <style>{printCss}</style>

      <div data-no-print className="flex flex-col gap-1">
        <Link
          href={GROUP_COPY[report.group].href}
          className="text-n-500 hover:text-p-600 w-fit text-[13px] font-medium"
        >
          ← {GROUP_COPY[report.group].title}
        </Link>
      </div>

      <PageHeading
        eyebrow="Reports & analytics"
        title={report.title}
        subtitle={report.subtitle}
        actions={
          blocked ? null : (
            <div data-no-print className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={query.isPending || rows.length === 0}
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              >
                Print
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={query.isPending || rows.length === 0}
                className={cn(primaryButtonClass, "disabled:opacity-50")}
              >
                Download CSV
              </button>
            </div>
          )
        }
      />

      {blocked ? (
        <Blocked report={report} />
      ) : (
        <>
          <div
            data-no-print
            className="border-n-200 flex flex-wrap items-center gap-2 rounded-[12px] border bg-white p-2.5"
          >
            <DateRangeFilter
              value={range}
              onChange={(next) => reset(setRange, next)}
            />

            {report.filters.includes("employee") ? (
              <PeopleFilter
                value={employeeId}
                onChange={(next) => reset(setEmployeeId, next)}
              />
            ) : null}
            {report.filters.includes("customer") ? (
              <CustomerFilter
                value={customerId}
                onChange={(next) => reset(setCustomerId, next)}
              />
            ) : null}
            {report.filters.includes("category") ? (
              <CategoryFilter
                value={categoryId}
                onChange={(next) => reset(setCategoryId, next)}
              />
            ) : null}
            {report.filters.includes("payment") ? (
              <select
                value={payment}
                aria-label="Payment state"
                onChange={(event) => reset(setPayment, event.target.value)}
                className={cn(inputClass, "w-auto cursor-pointer py-2 text-[13px]")}
              >
                <option value="">Sales only</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="cheque">Cheque</option>
                <option value="quotation">Quotations</option>
              </select>
            ) : null}

            {range || employeeId || customerId || categoryId || payment ? (
              <button
                type="button"
                onClick={() => {
                  setRange(undefined)
                  setEmployeeId("")
                  setCustomerId("")
                  setCategoryId("")
                  setPayment("")
                  setPage(1)
                }}
                className="text-n-500 hover:text-n-800 ml-auto px-2 text-[12.5px] font-semibold"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <span className="hidden text-[12px] print:block">
            {report.title} · {describeRange(range)}
          </span>

          {query.isPending ? (
            <StatGridSkeleton />
          ) : data?.stats?.length ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {data.stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  accent={stat.accent}
                />
              ))}
            </div>
          ) : null}

          {data?.note ? (
            <p className="border-a-200 bg-a-50 text-a-700 m-0 rounded-[10px] border px-4 py-3 text-[13px] leading-relaxed">
              {data.note}
            </p>
          ) : null}

          {query.isPending ? (
            <RowsSkeleton rows={5} />
          ) : query.isError ? (
            <EmptyState
              message="Couldn't run that report. Your connection may have dropped."
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
          ) : rows.length === 0 ? (
            <EmptyState message="Nothing in this window. Try widening the dates or clearing the filters." />
          ) : (
            <>
              <Panel className="overflow-x-auto" data-report-table>
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="border-n-200 bg-n-100 border-b">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={cn(
                            "text-n-500 px-[14px] py-2.5 font-mono text-[10.5px] font-normal tracking-[0.07em]",
                            column.align === "right" ? "text-right" : "text-left"
                          )}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.rows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-n-200/70 hover:bg-n-50 border-b last:border-b-0"
                      >
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={cn(
                              "px-[14px] py-2.5 text-[13px]",
                              column.align === "right"
                                ? "text-right font-mono"
                                : "text-left"
                            )}
                          >
                            {render(row[column.key], column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              {data?.totals?.length ? (
                <div className="border-n-200 flex flex-wrap gap-x-6 gap-y-2 rounded-[10px] border bg-white px-4 py-3">
                  {data.totals.map((total) => (
                    <span key={total.label} className="text-n-600 text-[13px]">
                      {total.label}{" "}
                      <span className="text-n-900 font-semibold">
                        {total.value}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}

              <div data-no-print>
                <Pagination
                  page={paged.page}
                  pageCount={paged.pageCount}
                  from={paged.from}
                  to={paged.to}
                  total={rows.length}
                  noun="rows"
                  onPage={setPage}
                />
              </div>
            </>
          )}
        </>
      )}
    </DashboardMain>
  )
}

/** What a report says when there is nothing behind it yet. */
function Blocked({ report }: { report: ReportDef }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 p-[22px]">
        <span className="text-a-700 bg-a-50 border-a-200 w-fit rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em]">
          NOT ENOUGH DATA YET
        </span>
        <p className="text-n-700 m-0 text-[14px] leading-relaxed">
          {report.missing}
        </p>
        <p className="text-n-500 m-0 text-[13px] leading-relaxed">
          Rather than show a number that looks right and isn&rsquo;t, this page
          stays empty until the workspace records what it needs.
        </p>
      </Panel>

      {report.unlock?.length ? (
        <Panel className="flex flex-col gap-2.5 p-[22px]">
          <h2 className="font-heading m-0 text-base font-semibold">
            What would unlock it
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {report.unlock.map((one) => (
              <li key={one} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="bg-p-400 mt-[7px] size-1.5 shrink-0 rounded-full"
                />
                <span className="text-n-600 text-[13.5px] leading-relaxed">
                  {one}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function PeopleFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const people = usePeople()
  return (
    <select
      value={value}
      aria-label="Employee"
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClass, "w-auto cursor-pointer py-2 text-[13px]")}
    >
      <option value="">Everyone</option>
      {(people.data?.members ?? []).map((one) => (
        <option key={one.id} value={one.id}>
          {one.name}
        </option>
      ))}
    </select>
  )
}

function CustomerFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const customers = useCustomers()
  return (
    <select
      value={value}
      aria-label="Customer"
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClass, "w-auto cursor-pointer py-2 text-[13px]")}
    >
      <option value="">All customers</option>
      {(customers.data?.customers ?? []).map((one) => (
        <option key={one.id} value={one.id}>
          {one.name}
        </option>
      ))}
    </select>
  )
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const categories = useInventoryCategories()
  return (
    <select
      value={value}
      aria-label="Category"
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClass, "w-auto cursor-pointer py-2 text-[13px]")}
    >
      <option value="">All categories</option>
      {(categories.data?.categories ?? []).map((one) => (
        <option key={one.id} value={one.id}>
          {one.name}
        </option>
      ))}
    </select>
  )
}

/** Cells come back as plain values; the column says how to read them. */
function render(value: string | number | null | undefined, column: ReportColumn) {
  if (value === null || value === undefined || value === "") return "—"

  if (column.format === "money") {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value))
  }

  if (column.format === "number") {
    return new Intl.NumberFormat("en-IN").format(Number(value))
  }

  if (column.format === "day" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, m, d] = String(value).split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(year, m - 1, d)))
      .toUpperCase()
  }

  if (column.format === "month" && /^\d{4}-\d{2}$/.test(String(value))) {
    const [year, m] = String(value).split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(year, m - 1, 1)))
      .toUpperCase()
  }

  return String(value)
}

function describeRange(range: DateRange | undefined) {
  if (!range?.from) return "All dates"
  const fmt = (at: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(at)
  return range.to ? `${fmt(range.from)} – ${fmt(range.to)}` : fmt(range.from)
}

/** The viewer's own calendar day, not UTC — the filter is read in local days. */
function isoDay(at: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

function escapeCell(cell: string) {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

/**
 * Printing keeps the report and drops the dashboard around it. Same approach
 * as the attendance sheet: hide everything, then bring back what matters,
 * which survives whatever wrapper the layout puts in between.
 */
const printCss = `
@media print {
  header, aside, nav, [data-no-print] { display: none !important; }
  main { padding: 0 !important; animation: none !important; }
  [data-report-table] { border: 0 !important; overflow: visible !important; }
  table { font-size: 10px !important; }
  tr { break-inside: avoid; }
  @page { margin: 12mm; }
}
`
