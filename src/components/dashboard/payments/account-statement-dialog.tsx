"use client"

import Link from "next/link"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { RowsSkeleton } from "@/components/dashboard/skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { money } from "@/lib/billing"
import { useAccountStatement } from "@/lib/queries"
import type { AccountDTO } from "@/models/account"

/**
 * One account's statement: what it opened with, every money in and out
 * through it with the balance after each, and where it stands now — the
 * same rows its balance on the Accounts tab is added up from.
 */
export function AccountStatementDialog({
  account,
  onClose,
}: {
  account: AccountDTO | null
  onClose: () => void
}) {
  const query = useAccountStatement(account?.id ?? "", Boolean(account))
  const data = query.data

  return (
    <Dialog open={Boolean(account)} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[720px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {account?.name} — statement
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Every payment in and out of this account, oldest first, with the balance after each.
          </DialogDescription>
        </DialogHeader>

        {query.isPending || !data ? (
          <RowsSkeleton rows={4} />
        ) : (
          <div className="border-n-200 overflow-hidden rounded-[10px] border bg-white">
            <div className="border-n-200 bg-n-100 hidden grid-cols-[96px_1.6fr_110px_110px_120px] gap-2 border-b px-3 py-2 sm:grid">
              {["DATE", "WHAT", "IN", "OUT", "BALANCE"].map((head) => (
                <span key={head} className={cn("text-n-500 font-mono text-[10.5px] tracking-[0.07em]", head !== "DATE" && head !== "WHAT" && "text-right")}>
                  {head}
                </span>
              ))}
            </div>
            <Line label="Opening balance" on={data.account.openedOn ?? ""} balance={data.opening} />
            {data.rows.length === 0 ? (
              <p className="text-n-500 m-0 px-3 py-5 text-center text-[13px]">Nothing has moved through it yet.</p>
            ) : (
              data.rows.map((row) => (
                <Link
                  key={`${row.id}-${row.direction}`}
                  href={row.href}
                  className="border-n-200/70 hover:bg-n-50 grid gap-1 border-b px-3 py-2 sm:grid-cols-[96px_1.6fr_110px_110px_120px] sm:items-center sm:gap-2"
                >
                  <span className="text-n-600 text-[12.5px]">{row.on}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{row.what}</span>
                    <span className="text-n-500 truncate text-[11.5px] capitalize">{row.detail}</span>
                  </span>
                  <span className="text-s-done font-mono text-[13px] sm:text-right">
                    {row.direction === "in" ? money(row.amount) : ""}
                  </span>
                  <span className="text-s-overdue font-mono text-[13px] sm:text-right">
                    {row.direction === "out" ? money(row.amount) : ""}
                  </span>
                  <span className={cn("font-mono text-[13px] font-semibold sm:text-right", row.running < 0 && "text-s-overdue")}>
                    {money(row.running)}
                  </span>
                </Link>
              ))
            )}
            <Line label="Balance now" on={data.today} balance={data.closing} moneyIn={data.moneyIn} moneyOut={data.moneyOut} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Line({
  label,
  on,
  balance,
  moneyIn,
  moneyOut,
}: {
  label: string
  on: string
  balance: number
  moneyIn?: number
  moneyOut?: number
}) {
  return (
    <div className="border-n-200 bg-n-50 grid gap-1 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[96px_1.6fr_110px_110px_120px] sm:items-center sm:gap-2">
      <span className="text-n-600 text-[12.5px]">{on}</span>
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="text-s-done font-mono text-[13px] sm:text-right">{moneyIn !== undefined ? money(moneyIn) : ""}</span>
      <span className="text-s-overdue font-mono text-[13px] sm:text-right">{moneyOut !== undefined ? money(moneyOut) : ""}</span>
      <span className={cn("font-mono text-[13px] font-semibold sm:text-right", balance < 0 && "text-s-overdue")}>{money(balance)}</span>
    </div>
  )
}
