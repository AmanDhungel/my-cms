"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { RowsSkeleton } from "@/components/dashboard/skeletons"
import { EmptyState, Panel, StatCard } from "@/components/dashboard/ui"
import { money } from "@/lib/billing"
import { DAYBOOK_LABELS, DAYBOOK_TYPES } from "@/lib/daybook"
import { addDays } from "@/lib/estimates"
import { useAccounts, useDayBook } from "@/lib/queries"

/**
 * The day book: every rupee that moved on a day (or over a range), newest
 * first, with Money in / Money out / Net. "Cash only" leaves out everything
 * that went through a bank or wallet — cash moves no account, so that is the
 * cash in hand for the day.
 */
export function DayBookPanel({ today }: { today: string }) {
  const [from, setFrom] = React.useState(today)
  const [to, setTo] = React.useState(today)
  const [accountId, setAccountId] = React.useState("")
  const [type, setType] = React.useState("")
  const [cashOnly, setCashOnly] = React.useState(false)
  const accounts = useAccounts()
  const query = useDayBook({ from, to, accountId: cashOnly ? undefined : accountId, type, cashOnly })
  const data = query.data

  const presets: [string, string, string][] = [
    ["Today", today, today],
    ["Yesterday", addDays(today, -1), addDays(today, -1)],
    ["Last 7 days", addDays(today, -6), today],
  ]

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 p-[14px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map(([label, start, end]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFrom(start)
                setTo(end)
              }}
              aria-pressed={from === start && to === end}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                from === start && to === end
                  ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                  : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
              )}
            >
              {label}
            </button>
          ))}
          <span className="flex items-center gap-1.5">
            <input type="date" aria-label="From" value={from} max={to} onChange={(event) => setFrom(event.target.value || today)} className="border-n-300 rounded-md border bg-white px-2 py-1 text-[12.5px]" />
            <span className="text-n-500 text-[12.5px]">to</span>
            <input type="date" aria-label="To" value={to} min={from} onChange={(event) => setTo(event.target.value || from)} className="border-n-300 rounded-md border bg-white px-2 py-1 text-[12.5px]" />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={accountId}
            disabled={cashOnly}
            onChange={(event) => setAccountId(event.target.value)}
            aria-label="Account"
            className="border-n-300 rounded-md border bg-white px-2 py-1.5 text-[12.5px] disabled:opacity-50"
          >
            <option value="">Every account</option>
            {(accounts.data?.accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="Type"
            className="border-n-300 rounded-md border bg-white px-2 py-1.5 text-[12.5px]"
          >
            <option value="">Everything</option>
            {DAYBOOK_TYPES.map((one) => (
              <option key={one} value={one}>
                {DAYBOOK_LABELS[one]}
              </option>
            ))}
          </select>
          <label className="text-n-700 flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold">
            <input type="checkbox" checked={cashOnly} onChange={(event) => setCashOnly(event.target.checked)} className="accent-p-500 size-4" />
            Cash only
          </label>
        </div>
      </Panel>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError || !data ? (
        <EmptyState message="Couldn't load the day book. Your connection may have dropped." />
      ) : (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <StatCard label="MONEY IN" value={money(data.moneyIn)} />
            <StatCard label="MONEY OUT" value={money(data.moneyOut)} />
            <StatCard label={data.net >= 0 ? "NET — MORE IN" : "NET — MORE OUT"} value={money(Math.abs(data.net))} accent={data.net < 0} />
          </div>
          <Panel className="overflow-hidden">
            {data.entries.length === 0 ? (
              <p className="text-n-500 m-0 px-6 py-10 text-center text-sm">
                No money moved {from === to ? (from === today ? "today" : `on ${from}`) : "in these days"}
                {cashOnly ? " in cash" : ""}.
              </p>
            ) : (
              data.entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="border-n-200/70 hover:bg-n-50 grid gap-1 border-b px-[18px] py-3 md:grid-cols-[100px_1.5fr_1fr_140px] md:items-center md:gap-3"
                >
                  <span className="text-n-600 text-[12.5px]">{entry.on}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">{entry.party}</span>
                    <span className="text-n-500 truncate text-[12px]">
                      {DAYBOOK_LABELS[entry.type]}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </span>
                  </span>
                  <span className="text-n-600 truncate text-[12.5px] capitalize">
                    {entry.method}
                    {entry.accounts.length ? ` · ${entry.accounts.join(", ")}` : ""}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[13px] font-semibold tabular-nums md:text-right",
                      entry.direction === "in" ? "text-s-done" : "text-s-overdue"
                    )}
                  >
                    {entry.direction === "in" ? "+" : "−"} {money(entry.amount)}
                  </span>
                </Link>
              ))
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
