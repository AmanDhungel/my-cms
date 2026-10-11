"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"

import { BalancePill, balanceWords } from "@/components/dashboard/customers/balance-pill"
import { PaymentDialog } from "@/components/dashboard/payments/payment-dialog"
import { SettleChip } from "@/components/dashboard/sales/payment"
import { RowsSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import { money } from "@/lib/billing"
import { periodPresets, type KhataType } from "@/lib/khata"
import { usePartyStatement } from "@/lib/queries"

type Preset = "this_month" | "last_month" | "this_fy" | "all" | "custom"

const PRESETS: { key: Preset; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_fy", label: "This financial year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
]

const TYPES: { key: KhataType | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "payments", label: "Payments" },
]

/**
 * A party's ledger — the "khata" — in plain words (lib/khata.ts).
 *
 * Opening balance, every sale, purchase and payment in date order with the
 * balance after each, and the closing balance; then what is still open,
 * bill by bill. Prints as a statement, sends a reminder on WhatsApp, and
 * records a payment straight from here.
 */
export function KhataView({ id, tabs }: { id: string; tabs: React.ReactNode }) {
  const router = useRouter()
  const [preset, setPreset] = React.useState<Preset>("all")
  const [custom, setCustom] = React.useState<{ from: string; to: string }>({ from: "", to: "" })
  const [type, setType] = React.useState<KhataType | "all">("all")
  const [paying, setPaying] = React.useState<"in" | "out" | null>(null)
  const [today, setToday] = React.useState<string | null>(null)

  const range =
    preset === "custom"
      ? { from: custom.from || null, to: custom.to || null }
      : preset === "all" || !today
        ? { from: null, to: null }
        : periodPresets(today)[preset]

  const query = usePartyStatement(id, {
    from: range.from,
    to: range.to,
    types: type === "all" ? [] : [type],
  })
  const data = query.data
  // The workspace's own today, so "This month" is its month, not the browser's.
  if (data && today !== data.today) setToday(data.today)

  const party = data?.party
  const oldestSale = data?.open.find((item) => item.kind === "sale")
  const oldestPurchase = data?.open.find((item) => item.kind === "purchase")
  const owed = data?.balance ?? 0

  function reminderLink() {
    if (!data || !party) return "#"
    const digits = (party.phone ?? "").replace(/\D/g, "")
    // A ten-digit mobile starting with 9 is a Nepali number without its code.
    const phone = digits.length === 10 && digits.startsWith("9") ? `977${digits}` : digits
    const text = `Namaste ${party.name}, this is a friendly reminder from ${data.business.name} that Rs ${money(owed)} is due on your account. Thank you!`
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  }

  return (
    <DashboardMain className="gap-5">
      <style>{PRINT_CSS}</style>
      <div data-no-print className="flex flex-col gap-5">
        <PageHeading
          eyebrow="Sales & stock"
          title={party?.name ?? "Party"}
          subtitle={
            party
              ? [party.company, party.phone, party.kind === "both" ? "Customer and supplier" : party.kind === "vendor" ? "Supplier" : "Customer"]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
          actions={
            <Link href="/dashboard/customers" className={secondaryButtonClass}>
              All parties
            </Link>
          }
        />
        {tabs}
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={5} />
      ) : query.isError || !data ? (
        <EmptyState
          message="Couldn't load this ledger. Your connection may have dropped."
          action={
            <button type="button" onClick={() => void query.refetch()} className={primaryButtonClass}>
              Try again
            </button>
          }
        />
      ) : (
        <>
          <div data-no-print className="flex flex-wrap items-center justify-between gap-3">
            <BalancePill balance={owed} size="lg" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPaying("in")} className={primaryButtonClass}>
                Receive payment
              </button>
              <button type="button" onClick={() => setPaying("out")} className={secondaryButtonClass}>
                Make payment
              </button>
              {owed > 0 ? (
                <a href={reminderLink()} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                  Send reminder
                </a>
              ) : null}
              <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
                Print statement
              </button>
            </div>
          </div>

          <Panel data-no-print className="flex flex-col gap-3 p-[14px]">
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((option) => (
                <Chip key={option.key} active={preset === option.key} onClick={() => setPreset(option.key)}>
                  {option.label}
                </Chip>
              ))}
              {preset === "custom" ? (
                <span className="flex items-center gap-1.5">
                  <input
                    type="date"
                    aria-label="From"
                    value={custom.from}
                    onChange={(event) => setCustom((prev) => ({ ...prev, from: event.target.value }))}
                    className="border-n-300 rounded-md border bg-white px-2 py-1 text-[12.5px]"
                  />
                  <span className="text-n-500 text-[12.5px]">to</span>
                  <input
                    type="date"
                    aria-label="To"
                    value={custom.to}
                    onChange={(event) => setCustom((prev) => ({ ...prev, to: event.target.value }))}
                    className="border-n-300 rounded-md border bg-white px-2 py-1 text-[12.5px]"
                  />
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {TYPES.map((option) => (
                <Chip key={option.key} active={type === option.key} onClick={() => setType(option.key)}>
                  {option.label}
                </Chip>
              ))}
              <span className="text-n-500 ml-auto text-[12px]">
                Green: they owe you · Red: you owe them
              </span>
            </div>
          </Panel>

          {/* The statement: what prints. */}
          <Panel className="statement-paper overflow-hidden">
            <div className="border-n-200 flex flex-wrap items-start justify-between gap-3 border-b px-[18px] py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
                  STATEMENT OF ACCOUNT
                </span>
                <span className="font-heading text-[16px] font-semibold">{data.business.name}</span>
                <span className="text-n-600 text-[13px]">
                  {data.party.name}
                  {data.party.phone ? ` · ${data.party.phone}` : ""}
                </span>
              </div>
              <span className="text-n-600 text-[12.5px]">
                {data.statement.from || data.statement.to
                  ? `${data.statement.from ?? "Start"} to ${data.statement.to ?? data.today}`
                  : `All time, to ${data.today}`}
              </span>
            </div>

            <div className="border-n-200 bg-n-100 hidden grid-cols-[100px_1.6fr_120px_120px_150px] gap-3 border-b px-[18px] py-2 md:grid">
              {["DATE", "WHAT", "BILLED", "PAID", "BALANCE"].map((head) => (
                <span key={head} className={cn("text-n-500 font-mono text-[10.5px] tracking-[0.07em]", head !== "DATE" && head !== "WHAT" && "text-right")}>
                  {head}
                </span>
              ))}
            </div>

            <LedgerLine label="Opening balance" on={data.statement.from ?? ""} balance={data.statement.opening} strong />

            {data.statement.rows.length === 0 ? (
              <p className="text-n-500 m-0 px-[18px] py-6 text-center text-[13px]">
                Nothing in this period.
              </p>
            ) : (
              data.statement.rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => row.href && router.push(row.href)}
                  disabled={!row.href}
                  className="border-n-200/70 hover:bg-n-50 grid w-full gap-1 border-b px-[18px] py-2.5 text-left md:grid-cols-[100px_1.6fr_120px_120px_150px] md:items-center md:gap-3"
                >
                  <span className="text-n-600 text-[12.5px]">{row.on}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">{row.what}</span>
                    {row.detail ? <span className="text-n-500 truncate text-[12px]">{row.detail}</span> : null}
                  </span>
                  <Amount value={row.billed} />
                  <Amount value={row.paid} />
                  <span className={cn("font-mono text-[13px] font-semibold tabular-nums md:text-right", tone(row.running))}>
                    {money(Math.abs(row.running))}
                  </span>
                </button>
              ))
            )}

            <LedgerLine
              label="Closing balance"
              on={data.statement.to ?? data.today}
              balance={data.statement.closing}
              billed={data.statement.billed}
              paid={data.statement.paid}
              strong
            />
            <p className="text-n-600 m-0 px-[18px] py-3 text-[13px] font-semibold">
              {balanceWords(data.statement.closing)}
              {data.statement.to ? ` on ${data.statement.to}` : " today"}.
            </p>
          </Panel>

          <Panel data-no-print className="overflow-hidden">
            <div className="border-n-200 flex items-center justify-between gap-3 border-b px-[18px] py-3">
              <h2 className="font-heading m-0 text-base font-semibold">Still open, bill by bill</h2>
              <span className="text-n-500 text-[12px]">
                Payments not tied to a bill count against the oldest first.
              </span>
            </div>
            {data.open.length === 0 ? (
              <p className="text-n-500 m-0 px-[18px] py-5 text-[13px]">
                Nothing is open — every bill and purchase with them is settled.
              </p>
            ) : (
              data.open.map((item) => (
                <div
                  key={item.id}
                  className="border-n-200/70 grid gap-1 border-b px-[18px] py-2.5 md:grid-cols-[1.4fr_110px_110px_110px_120px] md:items-center md:gap-3"
                >
                  <span className="flex min-w-0 flex-col">
                    {item.href ? (
                      <Link href={item.href} className="truncate text-[13.5px] font-semibold">
                        {item.what}
                      </Link>
                    ) : (
                      <span className="truncate text-[13.5px] font-semibold">{item.what}</span>
                    )}
                    <span className="text-n-500 text-[12px]">
                      {item.on}
                      {item.dueOn !== item.on ? ` · due ${item.dueOn}` : ""}
                      {item.kind === "purchase" ? " · you owe them" : ""}
                    </span>
                  </span>
                  <LabelledAmount label="Total" value={item.total} />
                  <LabelledAmount label="Paid" value={item.paid} />
                  <LabelledAmount label="Due" value={item.due} strong />
                  <span className="md:justify-self-end">
                    <SettleChip status={item.settlement} />
                  </span>
                </div>
              ))
            )}
            {data.unapplied.length > 0 ? (
              <div className="bg-n-50 flex flex-col gap-1 px-[18px] py-3">
                {data.unapplied.map((item) => (
                  <span key={item.id} className="text-n-600 text-[12.5px]">
                    {item.on} · {item.what}: Rs {money(item.amount)} not yet set against a bill
                  </span>
                ))}
              </div>
            ) : null}
          </Panel>
        </>
      )}

      {paying && party ? (
        <PaymentDialog
          open
          today={data?.today ?? new Date().toISOString().slice(0, 10)}
          onClose={() => setPaying(null)}
          initial={
            paying === "in"
              ? {
                  direction: "in",
                  party: party.name,
                  partyId: party.id,
                  // The oldest bill still owing comes first.
                  billId: oldestSale?.id,
                  amount: oldestSale?.due,
                }
              : {
                  direction: "out",
                  party: party.name,
                  partyId: party.id,
                  purchaseId: oldestPurchase?.id,
                  amount: oldestPurchase?.due,
                }
          }
        />
      ) : null}
    </DashboardMain>
  )
}

function tone(balance: number) {
  return balance > 0 ? "text-s-done" : balance < 0 ? "text-s-overdue" : "text-n-500"
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
        active ? "bg-p-100 border-p-400 text-p-700 font-semibold" : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {children}
    </button>
  )
}

function Amount({ value }: { value: number }) {
  return (
    <span className="text-n-700 font-mono text-[13px] tabular-nums md:text-right">
      {value ? money(value) : "—"}
    </span>
  )
}

function LabelledAmount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className={cn("font-mono text-[13px] tabular-nums md:text-right", strong && "font-semibold")}>
      <span className="text-n-500 mr-1 font-sans text-[11px] md:hidden">{label}</span>
      {money(value)}
    </span>
  )
}

function LedgerLine({
  label,
  on,
  balance,
  billed,
  paid,
  strong,
}: {
  label: string
  on: string
  balance: number
  billed?: number
  paid?: number
  strong?: boolean
}) {
  return (
    <div className="border-n-200 bg-n-50 grid gap-1 border-b px-[18px] py-2.5 md:grid-cols-[100px_1.6fr_120px_120px_150px] md:items-center md:gap-3">
      <span className="text-n-600 text-[12.5px]">{on}</span>
      <span className={cn("text-[13.5px]", strong && "font-semibold")}>{label}</span>
      {billed === undefined ? <span /> : <Amount value={billed} />}
      {paid === undefined ? <span /> : <Amount value={paid} />}
      <span className={cn("font-mono text-[13px] font-semibold tabular-nums md:text-right", tone(balance))}>
        {money(Math.abs(balance))}
      </span>
    </div>
  )
}

/** The statement prints on its own: no shell, no controls. */
const PRINT_CSS = `
@media print {
  header, aside, nav, [data-no-print] { display: none !important; }
  main { padding: 0 !important; animation: none !important; }
  .statement-paper { border: 0 !important; border-radius: 0 !important; }
  @page { margin: 12mm; }
}
`
