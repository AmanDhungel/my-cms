"use client"

import Link from "next/link"
import { cn } from "cn"

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
import { usePartyLedger } from "@/lib/queries"
import type { LedgerEntry } from "@/lib/ledger"

const KIND_LABELS: Record<LedgerEntry["kind"], string> = {
  bill: "Bill",
  "payment-in": "Payment in",
  "payment-out": "Payment out",
  expense: "Expense",
}

/**
 * Everything that has passed between the workspace and one party.
 *
 * Oldest first, with a running balance down the right — the order a ledger is
 * read in, and the only order in which a running balance means anything. What
 * the figure at the bottom says is what they owe today.
 */
export function PartyLedgerView({ id }: { id: string }) {
  const query = usePartyLedger(id)
  const party = query.data?.party
  const ledger = query.data?.ledger

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Sales & stock"
        title={party?.name ?? "Party"}
        subtitle={
          party
            ? [
                party.company,
                party.phone,
                party.kind === "both"
                  ? "Customer and supplier"
                  : party.kind === "vendor"
                    ? "Supplier"
                    : "Customer",
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        actions={
          <Link
            href="/dashboard/customers"
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3.5 py-2 text-[13.5px] font-semibold"
          >
            All parties
          </Link>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : query.isError || !ledger ? (
        <EmptyState
          message="Couldn't load this ledger. Your connection may have dropped."
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
      ) : (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="BILLED" value={money(ledger.billed)} />
            <StatCard label="RECEIVED" value={money(ledger.received)} />
            <StatCard label="PAID OUT" value={money(ledger.paidOut)} />
            <StatCard
              label={ledger.owed < 0 ? "IN CREDIT" : "STILL OWED"}
              value={money(Math.abs(ledger.owed))}
              accent={ledger.owed > 0}
              hint={
                ledger.owed < 0
                  ? "we are holding their money"
                  : ledger.owed === 0
                    ? "all settled"
                    : undefined
              }
            />
          </div>

          {ledger.entries.length === 0 ? (
            <EmptyState message="Nothing has passed between you yet. Bills raised against them, and payments either way, will appear here." />
          ) : (
            <Panel className="overflow-hidden">
              <div className="border-n-200 bg-n-100 hidden grid-cols-[110px_120px_1.4fr_110px_110px_120px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
                {["DATE", "WHAT", "REFERENCE", "OWED", "PAID", "BALANCE"].map(
                  (head) => (
                    <span
                      key={head}
                      className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                    >
                      {head}
                    </span>
                  )
                )}
              </div>

              {ledger.entries.map((entry, index) => (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  data-ledger-row
                  className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3 lg:grid-cols-[110px_120px_1.4fr_110px_110px_120px] lg:items-center"
                >
                  <span className="text-n-600 text-[12.5px]">
                    {shortDate(entry.on)}
                  </span>

                  <span
                    className={cn(
                      "w-fit rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                      entry.kind === "bill"
                        ? "bg-a-400/15 text-a-700"
                        : entry.kind === "payment-in"
                          ? "bg-s-done/15 text-s-done"
                          : "bg-n-100 text-n-600"
                    )}
                  >
                    {KIND_LABELS[entry.kind]}
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="truncate text-[13.5px] font-semibold"
                      >
                        {entry.reference}
                      </Link>
                    ) : (
                      <span className="truncate text-[13.5px] font-semibold">
                        {entry.reference}
                      </span>
                    )}
                    {entry.detail ? (
                      <span className="text-n-500 truncate text-xs capitalize">
                        {entry.detail}
                      </span>
                    ) : null}
                  </span>

                  <span className="font-mono text-[12.5px] tabular-nums">
                    {entry.debit ? money(entry.debit) : "—"}
                  </span>
                  <span className="text-s-done font-mono text-[12.5px] tabular-nums">
                    {entry.credit ? money(entry.credit) : "—"}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[13px] font-semibold tabular-nums",
                      ledger.running[index] > 0 && "text-s-overdue"
                    )}
                  >
                    {money(ledger.running[index])}
                  </span>
                </div>
              ))}

              <div className="bg-n-50 flex items-center justify-between px-[18px] py-3.5">
                <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
                  {ledger.entries.length} ENTRIES
                </span>
                <span className="text-[13.5px] font-semibold">
                  {ledger.owed > 0
                    ? `${money(ledger.owed)} still owed`
                    : ledger.owed < 0
                      ? `${money(-ledger.owed)} in their credit`
                      : "Settled in full"}
                </span>
              </div>
            </Panel>
          )}
        </>
      )}

      {query.isPending ? <RowsSkeleton rows={4} /> : null}
    </DashboardMain>
  )
}

/** "12 Mar 2026" from a "YYYY-MM-DD" day, without turning it into an instant. */
function shortDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-")
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}
