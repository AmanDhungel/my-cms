"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import { BillDialog } from "@/components/dashboard/sales/bill-dialog"
import { PaymentChip } from "@/components/dashboard/sales/payment"
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

/** Bills the workspace has raised, and the button that raises another. */
export function SalesView({ vatRate }: { vatRate: number }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const query = useBills()
  const bills = query.data?.bills ?? []

  const needle = search.trim().toLowerCase()
  const visible = needle
    ? bills.filter((bill) =>
        [bill.number, bill.customer.name, bill.customer.phone].some((field) =>
          field?.toLowerCase().includes(needle)
        )
      )
    : bills

  const issued = bills.filter((bill) => bill.status === "issued")
  const revenue = issued.reduce((sum, bill) => sum + bill.total, 0)
  const vat = issued.reduce((sum, bill) => sum + bill.vatAmount, 0)

  // What is still owed. A cheque is money you hold but the bank doesn't, so
  // it is counted apart rather than folded into either side.
  const owed = issued
    .filter((bill) => bill.payment === "unpaid")
    .reduce((sum, bill) => sum + bill.total, 0)
  const onCheque = issued.filter((bill) => bill.payment === "cheque")
  const chequeTotal = onCheque.reduce((sum, bill) => sum + bill.total, 0)

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
          <StatCard label="BILLS" value={issued.length} />
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
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-4 border-b px-[18px] py-3.5">
            <h2 className="font-heading m-0 text-base font-semibold">Bills</h2>
            <label className="border-n-200 bg-n-50 flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search bills"
                className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
              />
            </label>
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

          {visible.map((bill) => (
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
                No bill matches that. Clear the search to see them all.
              </p>
            </div>
          ) : null}

          <div className="text-n-500 px-[18px] py-3 text-[13px]">
            Showing {visible.length} of {bills.length}
          </div>
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
