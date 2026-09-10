"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import {
  DateRangeFilter,
  withinRange,
  type DateRange,
} from "@/components/dashboard/date-range-filter"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { BillDialog } from "@/components/dashboard/sales/bill-dialog"
import {
  PAYMENT_LABELS,
  PaymentChip,
} from "@/components/dashboard/sales/payment"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { money } from "@/lib/billing"
import { useBills } from "@/lib/queries"
import { BILL_PAYMENTS, type BillPayment } from "@/lib/work-constants"

const PER_PAGE = 10

/** Bills the workspace has raised, and the button that raises another. */
export function SalesView({ vatRate }: { vatRate: number }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<BillPayment | "all">("all")
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [page, setPage] = React.useState(1)

  const query = useBills()
  const bills = query.data?.bills ?? []

  // Every filter puts you back on the first page: page 4 of a list that just
  // became one page long is nothing at all.
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const needle = search.trim().toLowerCase()
  const visible = bills.filter((bill) => {
    if (filter !== "all" && bill.payment !== filter) return false
    if (!withinRange(bill.createdAt, range)) return false
    if (!needle) return true
    return [bill.number, bill.customer.name, bill.customer.phone].some(
      (field) => field?.toLowerCase().includes(needle)
    )
  })

  const shown = paginate(visible, page, PER_PAGE)

  const issued = bills.filter((bill) => bill.status === "issued")
  // A quotation is a price offered, not money earned, so it stays out of
  // every total here and is counted on its own.
  const sold = issued.filter((bill) => bill.payment !== "quotation")
  const revenue = sold.reduce((sum, bill) => sum + bill.total, 0)
  const vat = sold.reduce((sum, bill) => sum + bill.vatAmount, 0)

  // What is still owed. A cheque is money you hold but the bank doesn't, so
  // it is counted apart rather than folded into either side.
  const owed = issued
    .filter((bill) => bill.payment === "unpaid")
    .reduce((sum, bill) => sum + bill.total, 0)
  const onCheque = issued.filter((bill) => bill.payment === "cheque")
  const chequeTotal = onCheque.reduce((sum, bill) => sum + bill.total, 0)
  const quotes = issued.filter((bill) => bill.payment === "quotation")

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Sales & stock"
        title="Sales"
        subtitle="Raise a bill by hand or straight from stock, then print it or send it on."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={primaryButtonClass}
          >
            <PlusIcon className="size-3.5" />
            New bill
          </button>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="BILLS"
            value={sold.length}
            hint={
              quotes.length > 0
                ? `and ${quotes.length} quotation${quotes.length === 1 ? "" : "s"}`
                : undefined
            }
          />
          <StatCard label="BILLED" value={money(revenue)} />
          <StatCard
            label="UNPAID"
            value={money(owed)}
            accent={owed > 0}
            hint={
              onCheque.length > 0
                ? `plus ${money(chequeTotal)} on ${onCheque.length} cheque${onCheque.length === 1 ? "" : "s"}`
                : undefined
            }
          />
          <StatCard label="VAT CHARGED" value={money(vat)} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the bills. Your connection may have dropped."
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
      ) : bills.length === 0 ? (
        <EmptyState
          message="No bills yet. A custom bill is typed by hand; an inventory bill pulls its prices from stock and takes the quantities off it."
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={primaryButtonClass}
            >
              New bill
            </button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="All"
                active={filter === "all"}
                onClick={() => change(setFilter)("all")}
              />
              {BILL_PAYMENTS.map((option) => (
                <Chip
                  key={option}
                  label={PAYMENT_LABELS[option]}
                  count={bills.filter((bill) => bill.payment === option).length}
                  active={filter === option}
                  onClick={() => change(setFilter)(option)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter value={range} onChange={change(setRange)} />
              <label className="border-n-200 bg-n-50 flex min-w-[190px] items-center gap-2 rounded-md border px-2.5 py-2">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => change(setSearch)(event.target.value)}
                  placeholder="Search bills"
                  className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
                />
              </label>
            </div>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[130px_1.4fr_150px_90px_120px_100px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["BILL", "CUSTOMER", "RAISED", "LINES", "TOTAL", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {shown.rows.map((bill) => (
            <div
              key={bill.id}
              className={cn(
                "border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[130px_1.4fr_150px_90px_120px_100px] lg:items-center",
                bill.status === "void" && "opacity-55"
              )}
            >
              <span className="flex items-center gap-2 font-mono text-[12.5px] font-semibold">
                {bill.number}
                {bill.status === "void" ? (
                  <span className="text-s-overdue border-s-overdue/40 rounded-full border px-1.5 text-[10px] tracking-[0.05em] uppercase">
                    void
                  </span>
                ) : null}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {bill.customer.name}
                </span>
                <span className="text-n-500 flex items-center gap-1.5 truncate text-xs">
                  <PaymentChip
                    payment={bill.payment}
                    chequeNo={bill.chequeNo}
                  />
                  {[
                    bill.customer.phone,
                    bill.source === "inventory" ? "from stock" : "custom",
                    bill.vatRate > 0 ? `VAT ${bill.vatRate}%` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              <span className="text-n-600 text-[12.5px]">
                {new Date(bill.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>

              <span className="text-n-600 text-[12.5px]">
                {bill.lines.length}
              </span>

              <span className="font-mono text-[13px] font-semibold tabular-nums">
                {money(bill.total)}
              </span>

              <div className="lg:justify-self-end">
                <Link
                  href={`/dashboard/sales/${bill.id}`}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}

          {visible.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-n-500 m-0 text-sm">
                No bill matches that. Clear the search, the dates or the filter
                to see them all.
              </p>
            </div>
          ) : null}

          <Pagination
            page={shown.page}
            pageCount={shown.pageCount}
            from={shown.from}
            to={shown.to}
            total={visible.length}
            noun="bills"
            onPage={setPage}
          />
        </Panel>
      )}

      <BillDialog
        open={open}
        vatRate={vatRate}
        onClose={() => setOpen(false)}
        // Straight to the bill, which is where printing and sending live.
        onCreated={(bill) => router.push(`/dashboard/sales/${bill.id}`)}
      />
    </DashboardMain>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {label}
      {count ? (
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      ) : null}
    </button>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-n-400 size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}
