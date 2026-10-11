"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { EstimateChip } from "@/components/dashboard/sales/estimates/estimate-chip"
import { EstimateDialog } from "@/components/dashboard/sales/estimates/estimate-dialog"
import { RowsSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { money, quantity } from "@/lib/billing"
import { canDo } from "@/lib/estimates"
import {
  reportMutationError,
  useDeleteEstimate,
  useDuplicateEstimate,
  useEstimate,
  useEstimateStatus,
} from "@/lib/queries"
import type { EstimateDTO } from "@/models/estimate"

/**
 * One estimate: the document (it prints on its own) and everything that can
 * be done with it — share, mark sent / accepted / declined, reopen,
 * duplicate, delete a draft, and convert it into a sale.
 */
export function EstimateView({
  id,
  businessName,
  vatRate,
  today,
}: {
  id: string
  businessName: string
  vatRate: number
  today: string
}) {
  const router = useRouter()
  const query = useEstimate(id)
  const status = useEstimateStatus(id)
  const duplicate = useDuplicateEstimate(id)
  const remove = useDeleteEstimate(id)
  const [editing, setEditing] = React.useState(false)
  const [confirm, setConfirm] = React.useState<"convert" | "delete" | null>(null)
  const estimate = query.data?.estimate

  function act(action: "send" | "accept" | "decline" | "reopen", done: string) {
    status.mutate(
      { action },
      { onSuccess: () => toast.success(done), onError: (error) => reportMutationError(error) }
    )
  }

  if (query.isPending) {
    return (
      <DashboardMain>
        <RowsSkeleton rows={5} />
      </DashboardMain>
    )
  }
  if (query.isError || !estimate) {
    return (
      <DashboardMain>
        <EmptyState
          message="Couldn't load this estimate. It may have been deleted."
          action={
            <Link href="/dashboard/sales" className={primaryButtonClass}>
              Back to sales
            </Link>
          }
        />
      </DashboardMain>
    )
  }

  const state = estimate.state
  const busy = status.isPending || duplicate.isPending || remove.isPending

  return (
    <DashboardMain className="gap-5">
      <style>{PRINT_CSS}</style>
      <div data-no-print className="flex flex-col gap-4">
        <PageHeading
          eyebrow="Sales & stock · Estimate"
          title={estimate.number}
          subtitle={`For ${estimate.customer.name} · valid until ${estimate.validUntil}`}
          actions={
            <Link href="/dashboard/sales" className={secondaryButtonClass}>
              All sales
            </Link>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <EstimateChip state={state} />
          {state === "expired" ? (
            <span className="text-s-overdue text-[12.5px]">
              Its validity has passed. Reopen it to change, share or convert it.
            </span>
          ) : null}
          {estimate.saleId ? (
            <Link href={`/dashboard/sales/${estimate.saleId}`} className="text-p-600 text-[13px] font-semibold">
              Open the sale →
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canDo(state, "convert") ? (
            <button type="button" disabled={busy} onClick={() => setConfirm("convert")} className={primaryButtonClass}>
              Convert to sale
            </button>
          ) : null}
          {canDo(state, "edit") ? (
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className={secondaryButtonClass}>
              Edit
            </button>
          ) : null}
          {canDo(state, "send") ? (
            <button type="button" disabled={busy} onClick={() => act("send", "Marked as sent")} className={secondaryButtonClass}>
              Mark as sent
            </button>
          ) : null}
          {canDo(state, "accept") ? (
            <button type="button" disabled={busy} onClick={() => act("accept", "Marked as accepted")} className={secondaryButtonClass}>
              Mark accepted
            </button>
          ) : null}
          {canDo(state, "decline") ? (
            <button type="button" disabled={busy} onClick={() => act("decline", "Marked as declined")} className={secondaryButtonClass}>
              Mark declined
            </button>
          ) : null}
          {canDo(state, "reopen") ? (
            <button type="button" disabled={busy} onClick={() => act("reopen", "Reopened as a draft")} className={secondaryButtonClass}>
              Reopen
            </button>
          ) : null}
          {state !== "converted" ? (
            <a href={shareLink(estimate, businessName)} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
              Share on WhatsApp
            </a>
          ) : null}
          <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
            Print / PDF
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              duplicate.mutate(undefined, {
                onSuccess: ({ estimate: copy }) => {
                  toast.success(`${copy.number} created as a draft`)
                  router.push(`/dashboard/sales/estimates/${copy.id}`)
                },
                onError: (error) => reportMutationError(error),
              })
            }
            className={secondaryButtonClass}
          >
            Duplicate
          </button>
          {canDo(state, "delete") ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm("delete")}
              className="border-n-300 text-s-overdue rounded-md border bg-white px-[15px] py-2.5 text-sm font-semibold hover:bg-[#fdecec]"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <Panel className="estimate-paper flex flex-col gap-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">ESTIMATE</span>
            <span className="font-heading text-[18px] font-semibold">{businessName}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="font-mono text-[14px] font-semibold">{estimate.number}</span>
            <span className="text-n-600 text-[12.5px]">Date {estimate.issuedOn}</span>
            <span className="text-n-600 text-[12.5px]">Valid until {estimate.validUntil}</span>
          </div>
        </header>
        <div className="flex flex-col gap-0.5">
          <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">FOR</span>
          <span className="text-[14px] font-semibold">{estimate.customer.name}</span>
          {[estimate.customer.phone, estimate.customer.address].filter(Boolean).map((line) => (
            <span key={line} className="text-n-600 text-[13px]">
              {line}
            </span>
          ))}
        </div>
        <div className="border-n-200 overflow-hidden rounded-[10px] border">
          <div className="border-n-200 bg-n-100 grid grid-cols-[1.6fr_80px_110px_80px_120px] gap-2 border-b px-3 py-2">
            {["ITEM", "QTY", "RATE", "DISC", "AMOUNT"].map((head) => (
              <span key={head} className={cn("text-n-500 font-mono text-[10.5px] tracking-[0.07em]", head !== "ITEM" && "text-right")}>
                {head}
              </span>
            ))}
          </div>
          {estimate.lines.map((line, index) => (
            <div key={index} className="border-n-200/70 grid grid-cols-[1.6fr_80px_110px_80px_120px] gap-2 border-b px-3 py-2 last:border-b-0">
              <span className="text-[13.5px]">
                {index + 1}. {line.name}
              </span>
              <span className="text-right font-mono text-[13px]">
                {quantity(line.qty)} {line.unit}
              </span>
              <span className="text-right font-mono text-[13px]">{money(line.price)}</span>
              <span className="text-n-600 text-right font-mono text-[13px]">
                {line.discountPct ? `${quantity(line.discountPct)}%` : "—"}
              </span>
              <span className="text-right font-mono text-[13px] font-semibold">{money(line.net)}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex w-full max-w-[280px] flex-col gap-1">
          <Row label="Subtotal" value={estimate.subtotal} />
          {estimate.discountTotal > 0 ? <Row label="Discount" value={-estimate.discountTotal} /> : null}
          {estimate.vatRate > 0 ? <Row label={`VAT ${quantity(estimate.vatRate)}%`} value={estimate.vatAmount} /> : null}
          <Row label="Total" value={estimate.total} strong />
        </div>
        {estimate.note ? (
          <div className="flex flex-col gap-1">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">NOTES AND TERMS</span>
            <p className="text-n-700 m-0 text-[13px] whitespace-pre-wrap">{estimate.note}</p>
          </div>
        ) : null}
      </Panel>

      <EstimateDialog
        open={editing}
        onClose={() => setEditing(false)}
        editing={estimate}
        vatRate={vatRate}
        today={today}
      />

      <Dialog open={confirm !== null} onOpenChange={(next) => (next ? null : setConfirm(null))}>
        <DialogContent overlayClassName={emsDialogOverlay} className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}>
          <DialogHeader>
            <DialogTitle className="font-heading text-[18px] font-semibold">
              {confirm === "convert" ? `Convert ${estimate.number} into a sale?` : `Delete ${estimate.number}?`}
            </DialogTitle>
            <DialogDescription className="text-n-600 text-[13.5px]">
              {confirm === "convert"
                ? "The new sale opens with this estimate's party, lines, prices and terms filled in. Adjust what was actually delivered and any payment, then save — the estimate is marked converted and linked to it."
                : "A draft that was never sent can be deleted. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2.5">
            <button type="button" onClick={() => setConfirm(null)} className={secondaryButtonClass}>
              Cancel
            </button>
            {confirm === "convert" ? (
              <button
                type="button"
                autoFocus
                onClick={() => router.push(`/dashboard/sales?fromEstimate=${estimate.id}`)}
                className={primaryButtonClass}
              >
                Open the sale form
              </button>
            ) : (
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => {
                      toast.success(`${estimate.number} deleted`)
                      router.push("/dashboard/sales?tab=estimates")
                    },
                    onError: (error) => reportMutationError(error),
                  })
                }
                className="bg-s-overdue rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardMain>
  )
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-[12.5px]", strong ? "font-heading text-[14px] font-semibold" : "text-n-600")}>{label}</span>
      <span className={cn("font-mono tabular-nums", strong ? "text-[17px] font-semibold" : "text-[13px]")}>{money(value)}</span>
    </div>
  )
}

/** A short WhatsApp summary; the party's number when there is one. */
function shareLink(estimate: EstimateDTO, businessName: string) {
  const digits = (estimate.customer.phone ?? "").replace(/\D/g, "")
  const phone = digits.length === 10 && digits.startsWith("9") ? `977${digits}` : digits
  const lines = estimate.lines
    .slice(0, 8)
    .map((line) => `• ${line.name} × ${quantity(line.qty)} — ${money(line.net)}`)
  const text = [
    `Namaste ${estimate.customer.name},`,
    `Here is estimate ${estimate.number} from ${businessName}:`,
    ...lines,
    ...(estimate.lines.length > 8 ? [`…and ${estimate.lines.length - 8} more`] : []),
    `Total: Rs ${money(estimate.total)}`,
    `Valid until ${estimate.validUntil}.`,
  ].join("\n")
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

const PRINT_CSS = `
@media print {
  header:not(.estimate-paper header), aside, nav, [data-no-print] { display: none !important; }
  main { padding: 0 !important; animation: none !important; }
  .estimate-paper { border: 0 !important; border-radius: 0 !important; }
  @page { margin: 12mm; }
}
`
