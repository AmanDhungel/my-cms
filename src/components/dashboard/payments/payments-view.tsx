"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  DateRangeFilter,
  withinRangeOfDay,
  type DateRange,
} from "@/components/dashboard/date-range-filter"
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
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { PaymentDialog } from "@/components/dashboard/payments/payment-dialog"
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
import {
  reportMutationError,
  useDeletePayment,
  usePayments,
} from "@/lib/queries"
import type { PaymentDirection, PaymentMethod } from "@/lib/work-constants"
import type { PaymentDTO } from "@/models/payment"

const PER_PAGE = 10

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank",
  online: "Online",
}

type Tab = "ledger" | "parties"

/**
 * Money that has changed hands: what you paid out to companies and people,
 * and what they paid you. Owner only.
 */
export function PaymentsView({ today }: { today: string }) {
  const [tab, setTab] = React.useState<Tab>("ledger")
  const [open, setOpen] = React.useState(false)
  const [direction, setDirection] = React.useState<PaymentDirection | "all">(
    "all"
  )
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [deleting, setDeleting] = React.useState<PaymentDTO | null>(null)

  const query = usePayments()
  const payments = query.data?.payments ?? []

  // Every filter puts you back on the first page.
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const needle = search.trim().toLowerCase()
  const visible = payments.filter((payment) => {
    if (direction !== "all" && payment.direction !== direction) return false
    if (!withinRangeOfDay(payment.paidOn, range)) return false
    if (!needle) return true
    return [payment.party, payment.note, payment.reference, payment.bill?.number]
      .some((field) => field?.toLowerCase().includes(needle))
  })

  const totalIn = sum(payments, "in")
  const totalOut = sum(payments, "out")
  const parties = partiesOf(payments)

  const rows = paginate(visible, page, PER_PAGE)
  const partyRows = paginate(parties, page, PER_PAGE)

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Sales & stock"
        title="Payments"
        subtitle="What you have paid out, and what other people have paid you."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={primaryButtonClass}
          >
            <PlusIcon className="size-3.5" />
            Record payment
          </button>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="MONEY IN" value={money(totalIn)} />
          <StatCard label="MONEY OUT" value={money(totalOut)} />
          <StatCard
            label="NET"
            value={money(totalIn - totalOut)}
            accent={totalIn - totalOut < 0}
            hint={
              totalIn - totalOut < 0 ? "more has gone out than come in" : undefined
            }
          />
          <StatCard label="PARTIES" value={parties.length} />
        </div>
      )}

      <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
        {(
          [
            ["ledger", "Payments"],
            ["parties", "Parties"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value)
              setPage(1)
            }}
            aria-pressed={tab === value}
            className={cn(
              "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors",
              tab === value
                ? "bg-p-100 text-p-700 font-semibold"
                : "text-n-600 hover:bg-n-100 font-medium"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the payments. Your connection may have dropped."
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
      ) : payments.length === 0 ? (
        <EmptyState
          message="Nothing recorded yet. Put in what you pay suppliers and what customers hand over, and both sides add up here."
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={primaryButtonClass}
            >
              Record payment
            </button>
          }
        />
      ) : tab === "ledger" ? (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="All"
                active={direction === "all"}
                onClick={() => change(setDirection)("all")}
              />
              <Chip
                label="Money in"
                count={payments.filter((p) => p.direction === "in").length}
                active={direction === "in"}
                onClick={() => change(setDirection)("in")}
              />
              <Chip
                label="Money out"
                count={payments.filter((p) => p.direction === "out").length}
                active={direction === "out"}
                onClick={() => change(setDirection)("out")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter value={range} onChange={change(setRange)} />
              <label className="border-n-200 bg-n-50 flex min-w-[190px] items-center gap-2 rounded-md border px-2.5 py-2">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => change(setSearch)(event.target.value)}
                  placeholder="Search payments"
                  className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
                />
              </label>
            </div>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[110px_1.4fr_150px_120px_90px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["DATE", "PARTY", "METHOD", "AMOUNT", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {rows.rows.map((payment) => (
            <div
              key={payment.id}
              className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[110px_1.4fr_150px_120px_90px] lg:items-center"
            >
              <span className="text-n-600 text-[12.5px]">
                {formatDay(payment.paidOn)}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 truncate text-sm font-semibold">
                  {payment.party}
                  <DirectionChip direction={payment.direction} />
                </span>
                <span className="text-n-500 truncate text-xs">
                  {[payment.bill ? `on ${payment.bill.number}` : null, payment.note]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>

              <span className="text-n-600 text-[12.5px]">
                {METHOD_LABELS[payment.method]}
                {payment.reference ? (
                  <span className="text-n-400 font-mono"> {payment.reference}</span>
                ) : null}
              </span>

              <span
                className={cn(
                  "font-mono text-[13px] font-semibold tabular-nums",
                  payment.direction === "in" ? "text-s-done" : "text-s-overdue"
                )}
              >
                {payment.direction === "in" ? "+" : "−"} {money(payment.amount)}
              </span>

              <div className="lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => setDeleting(payment)}
                  className="border-n-300 text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-[#fdecec]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {visible.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-n-500 m-0 text-sm">
                Nothing matches that. Clear the search, the dates or the filter.
              </p>
            </div>
          ) : null}

          <Pagination
            page={rows.page}
            pageCount={rows.pageCount}
            from={rows.from}
            to={rows.to}
            total={visible.length}
            noun="payments"
            onPage={setPage}
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex items-center justify-between gap-4 border-b px-[18px] py-3.5">
            <h2 className="font-heading m-0 text-base font-semibold">
              Where each one stands
            </h2>
            <span className="text-n-500 text-[12.5px]">
              Net is what they have paid you, less what you have paid them.
            </span>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.6fr_120px_120px_120px_110px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["PARTY", "IN", "OUT", "NET", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {partyRows.rows.map((party) => (
            <div
              key={party.name}
              className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.6fr_120px_120px_120px_110px] lg:items-center"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {party.name}
                </span>
                <span className="text-n-500 text-xs">
                  {party.count} payment{party.count === 1 ? "" : "s"} · last on{" "}
                  {formatDay(party.last)}
                </span>
              </span>

              <span className="text-s-done font-mono text-[12.5px] tabular-nums">
                {money(party.in)}
              </span>
              <span className="text-s-overdue font-mono text-[12.5px] tabular-nums">
                {money(party.out)}
              </span>
              <span
                className={cn(
                  "font-mono text-[13px] font-semibold tabular-nums",
                  party.in - party.out < 0 ? "text-s-overdue" : "text-s-done"
                )}
              >
                {money(party.in - party.out)}
              </span>

              <div className="lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch(party.name)
                    setDirection("all")
                    setRange(undefined)
                    setPage(1)
                    setTab("ledger")
                  }}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Payments
                </button>
              </div>
            </div>
          ))}

          <Pagination
            page={partyRows.page}
            pageCount={partyRows.pageCount}
            from={partyRows.from}
            to={partyRows.to}
            total={parties.length}
            noun="parties"
            onPage={setPage}
          />
        </Panel>
      )}

      <PaymentDialog
        open={open}
        onClose={() => setOpen(false)}
        today={today}
        parties={parties.map((party) => party.name)}
      />

      {deleting ? (
        <DeleteDialog
          key={deleting.id}
          payment={deleting}
          open
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </DashboardMain>
  )
}

function DeleteDialog({
  payment,
  open,
  onClose,
}: {
  payment: PaymentDTO
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeletePayment(payment.id)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Delete this payment?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {money(payment.amount)}{" "}
            {payment.direction === "in" ? "from" : "to"} {payment.party} on{" "}
            {formatDay(payment.paidOn)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          It comes out of the totals and the party&rsquo;s balance.
          {payment.bill
            ? ` ${payment.bill.number} keeps the state it was given — change that on the bill if you need to.`
            : ""}
        </p>

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => {
              if (mutation.isPending) return
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Payment deleted")
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Deleting…" : "Delete payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DirectionChip({ direction }: { direction: PaymentDirection }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em] uppercase",
        direction === "in"
          ? "border-s-done/40 text-s-done bg-[#eefaf4]"
          : "border-s-overdue/40 text-s-overdue bg-[#fdecec]"
      )}
    >
      {direction === "in" ? "in" : "out"}
    </span>
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

/**
 * "2026-09-13" as "13 Sept 2026", the way the bills list writes dates. Built
 * from the parts rather than parsed, since `new Date("2026-09-13")` is UTC
 * midnight and lands on the day before in any zone behind it.
 */
function formatDay(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function sum(payments: PaymentDTO[], direction: PaymentDirection) {
  return payments
    .filter((payment) => payment.direction === direction)
    .reduce((total, payment) => total + payment.amount, 0)
}

type Party = {
  name: string
  in: number
  out: number
  count: number
  /** The most recent day money moved either way. */
  last: string
}

/**
 * One row per company or person. Names are matched without case, so "Nepal
 * Cables" and "nepal cables" are one party; the spelling shown is the one
 * from the most recent payment.
 */
function partiesOf(payments: PaymentDTO[]): Party[] {
  const byKey = new Map<string, Party>()

  // The list arrives newest first, so the first spelling seen is the latest.
  for (const payment of payments) {
    const key = payment.party.toLowerCase()
    const party = byKey.get(key) ?? {
      name: payment.party,
      in: 0,
      out: 0,
      count: 0,
      last: payment.paidOn,
    }

    party[payment.direction] += payment.amount
    party.count += 1
    if (payment.paidOn > party.last) party.last = payment.paidOn
    byKey.set(key, party)
  }

  // Biggest imbalance first: that is who you need to chase or pay.
  return [...byKey.values()].sort(
    (a, b) => Math.abs(b.in - b.out) - Math.abs(a.in - a.out)
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
