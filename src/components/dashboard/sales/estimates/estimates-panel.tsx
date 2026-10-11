"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import { PlusIcon } from "@/components/dashboard/nav-icons"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { EstimateChip } from "@/components/dashboard/sales/estimates/estimate-chip"
import { EstimateDialog } from "@/components/dashboard/sales/estimates/estimate-dialog"
import { RowsSkeleton } from "@/components/dashboard/skeletons"
import {
  EmptyState,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { money } from "@/lib/billing"
import { ESTIMATE_LABELS, type EstimateState } from "@/lib/estimates"
import { useEstimates } from "@/lib/queries"

const PER_PAGE = 10
const FILTERS: (EstimateState | "all")[] = ["all", "draft", "sent", "accepted", "expired", "declined", "converted"]

/**
 * The Estimates tab on Sales: every quotation, its status, and the way to
 * its own page (share, accept, convert). Nothing here is a sale yet, so none
 * of these totals appear anywhere else in the app.
 */
export function EstimatesPanel({ vatRate, today }: { vatRate: number; today: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<EstimateState | "all">("all")
  const [page, setPage] = React.useState(1)

  const query = useEstimates()
  const estimates = query.data?.estimates ?? []
  const needle = search.trim().toLowerCase()
  const visible = estimates.filter(
    (one) =>
      (filter === "all" || one.state === filter) &&
      (!needle ||
        [one.number, one.customer.name, one.customer.phone].some((field) =>
          field?.toLowerCase().includes(needle)
        ))
  )
  const shown = paginate(visible, page, PER_PAGE)
  const openOnes = estimates.filter((one) => ["draft", "sent", "accepted"].includes(one.state))
  const accepted = estimates.filter((one) => one.state === "accepted")
  const converted = estimates.filter((one) => one.state === "converted")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-n-600 m-0 text-[13.5px]">
          Quotations for a party. They move no stock and no money until you convert one into a sale.
        </p>
        <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
          <PlusIcon className="size-3.5" />
          New estimate
        </button>
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the estimates. Your connection may have dropped."
          action={
            <button type="button" onClick={() => void query.refetch()} className={primaryButtonClass}>
              Try again
            </button>
          }
        />
      ) : estimates.length === 0 ? (
        <EmptyState
          message="No estimates yet. Price a job for a party, share it on WhatsApp, and turn it into a sale in one click when they say yes."
          action={
            <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
              Create your first estimate
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <StatCard label="OPEN" value={`${openOnes.length} · ${money(openOnes.reduce((s, one) => s + one.total, 0))}`} />
            <StatCard
              label="ACCEPTED, NOT YET SOLD"
              value={money(accepted.reduce((s, one) => s + one.total, 0))}
              accent={accepted.length > 0}
            />
            <StatCard label="CONVERTED" value={converted.length} />
          </div>

          <Panel className="overflow-hidden">
            <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3">
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setFilter(option)
                      setPage(1)
                    }}
                    aria-pressed={filter === option}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                      filter === option
                        ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                        : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                    )}
                  >
                    {option === "all" ? "All" : ESTIMATE_LABELS[option]}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search estimates"
                aria-label="Search estimates"
                className="border-n-200 bg-n-50 min-w-[190px] rounded-md border px-2.5 py-2 text-[13.5px] outline-none"
              />
            </div>

            <div className="border-n-200 bg-n-100 hidden grid-cols-[120px_1.4fr_120px_120px_120px_90px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
              {["ESTIMATE", "FOR", "DATE", "VALID UNTIL", "TOTAL", ""].map((head) => (
                <span key={head} className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
                  {head}
                </span>
              ))}
            </div>

            {shown.rows.map((one) => (
              <div
                key={one.id}
                className="border-n-200/70 hover:bg-n-50 grid gap-2 border-b px-[18px] py-3 lg:grid-cols-[120px_1.4fr_120px_120px_120px_90px] lg:items-center lg:gap-3.5"
              >
                <span className="font-mono text-[12.5px] font-semibold">{one.number}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{one.customer.name}</span>
                  <span className="flex items-center gap-1.5">
                    <EstimateChip state={one.state} />
                    <span className="text-n-500 truncate text-xs">
                      {one.lines.length} line{one.lines.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="text-n-600 text-[12.5px]">{one.issuedOn}</span>
                <span className={cn("text-[12.5px]", one.state === "expired" ? "text-s-overdue" : "text-n-600")}>
                  {one.validUntil}
                </span>
                <span className="font-mono text-[13px] font-semibold tabular-nums">{money(one.total)}</span>
                <div className="lg:justify-self-end">
                  <Link
                    href={`/dashboard/sales/estimates/${one.id}`}
                    className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
            {visible.length === 0 ? (
              <p className="text-n-500 m-0 px-6 py-8 text-center text-sm">
                Nothing matches that. Clear the search or the filter.
              </p>
            ) : null}
            <Pagination
              page={shown.page}
              pageCount={shown.pageCount}
              from={shown.from}
              to={shown.to}
              total={visible.length}
              noun="estimates"
              onPage={setPage}
            />
          </Panel>
        </>
      )}

      <EstimateDialog
        open={open}
        onClose={() => setOpen(false)}
        vatRate={vatRate}
        today={today}
        onSaved={(estimate) => router.push(`/dashboard/sales/estimates/${estimate.id}`)}
      />
    </div>
  )
}
