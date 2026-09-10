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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PaymentChip,
  PaymentPicker,
} from "@/components/dashboard/sales/payment"
import {
  DashboardMain,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import { billSummary, renderBillPng, type BillLayout } from "@/lib/bill-image"
import { money, quantity } from "@/lib/billing"
import {
  reportMutationError,
  useSetBillPayment,
  useVoidBill,
} from "@/lib/queries"
import type { BillPayment } from "@/lib/work-constants"
import type { BillDTO } from "@/models/bill"

type Seller = { name: string; pan: string | null }

/**
 * One bill, in the two shapes it gets handed over in: a tax invoice carrying
 * both PANs and the VAT breakdown, or a plainer customer copy. Everything
 * that leaves the app — print, image, share — is built from the same record.
 */
export function BillView({
  bill,
  business,
  issuedBy,
}: {
  bill: BillDTO
  business: Seller
  issuedBy: string | null
}) {
  const router = useRouter()
  const [layout, setLayout] = React.useState<BillLayout>(
    bill.vatRate > 0 ? "tax" : "customer"
  )
  const [busy, setBusy] = React.useState(false)
  const [confirmVoid, setConfirmVoid] = React.useState(false)
  const [payment, setPayment] = React.useState<BillPayment>(bill.payment)
  const [chequeNo, setChequeNo] = React.useState(bill.chequeNo ?? "")

  const settle = useSetBillPayment(bill.id)

  /**
   * Picking a state saves at once. A cheque number is typed, so it gets its
   * own button — a half-typed number should never reach the server.
   */
  function save(next: BillPayment, cheque: string) {
    if (settle.isPending) return
    setPayment(next)
    settle.mutate(
      { payment: next, chequeNo: next === "cheque" ? cheque : undefined },
      {
        onSuccess: () => {
          toast.success(
            next === "paid"
              ? `${bill.number} marked paid`
              : next === "cheque"
                ? `${bill.number} is on cheque`
                : `${bill.number} marked unpaid`
          )
          router.refresh()
        },
        onError: (error) => {
          setPayment(bill.payment)
          reportMutationError(error)
        },
      }
    )
  }

  const summary = billSummary(bill, business.name)
  const taxLayout = layout === "tax"

  async function withImage(action: (blob: Blob) => void | Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      const blob = await renderBillPng({ bill, business, layout, issuedBy })
      await action(blob)
    } catch (error) {
      // A dismissed share sheet is not a failure worth shouting about.
      if (error instanceof Error && error.name === "AbortError") return
      toast.error(
        error instanceof Error ? error.message : "Could not build the image"
      )
    } finally {
      setBusy(false)
    }
  }

  function saveBlob(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${bill.number}.png`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const download = () =>
    void withImage((blob) => {
      saveBlob(blob)
      toast.success(`${bill.number}.png saved`)
    })

  /**
   * The share sheet is the only route that carries the image itself into
   * WhatsApp. Where it isn't available — most desktops — the file is saved
   * instead, and the WhatsApp button still carries the text.
   */
  const share = () =>
    void withImage(async (blob) => {
      const file = new File([blob], `${bill.number}.png`, {
        type: "image/png",
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${bill.number} · ${business.name}`,
          text: summary,
        })
        return
      }

      saveBlob(blob)
      toast.message("This browser has no share sheet", {
        description: "The image was saved instead — attach it from WhatsApp.",
      })
    })

  const digits = bill.customer.phone?.replace(/[^\d]/g, "") ?? ""
  const whatsappHref = `https://wa.me/${digits}?text=${encodeURIComponent(summary)}`
  const mailHref = `mailto:${bill.customer.email ?? ""}?subject=${encodeURIComponent(
    `${bill.number} from ${business.name}`
  )}&body=${encodeURIComponent(summary)}`

  return (
    <DashboardMain className="max-w-[900px] gap-4">
      <style>{printCss}</style>

      <div data-no-print className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/sales"
            className="text-n-600 hover:text-n-900 text-[13px] font-semibold"
          >
            ← All bills
          </Link>

          <div className="border-n-200 flex gap-0.5 rounded-md border bg-white p-0.5">
            {(
              [
                ["tax", "Tax invoice"],
                ["customer", "Customer copy"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLayout(value)}
                aria-pressed={layout === value}
                className={cn(
                  "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors",
                  layout === value
                    ? "bg-p-100 text-p-700 font-semibold"
                    : "text-n-600 hover:bg-n-100 font-medium"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-n-200 flex flex-wrap items-center gap-3 rounded-[10px] border bg-white px-3.5 py-3">
          <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
            PAYMENT
          </span>
          <PaymentPicker
            value={payment}
            onChange={(next) => save(next, chequeNo)}
            chequeNo={chequeNo}
            onChequeNo={setChequeNo}
            disabled={bill.status === "void" || settle.isPending}
          />
          {payment === "cheque" && chequeNo !== (bill.chequeNo ?? "") ? (
            <button
              type="button"
              onClick={() => save("cheque", chequeNo)}
              disabled={settle.isPending}
              className="bg-p-500 rounded-md px-3 py-2 text-[12.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
            >
              {settle.isPending ? "Saving…" : "Save cheque no."}
            </button>
          ) : null}
          {bill.status === "void" ? (
            <span className="text-n-500 text-[12.5px]">
              A void bill can&rsquo;t be settled.
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className={secondaryButtonClass}
          >
            Print / PDF
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className={secondaryButtonClass}
          >
            {busy ? "Working…" : "Download image"}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={busy}
            className={secondaryButtonClass}
          >
            Share image
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={secondaryButtonClass}
          >
            WhatsApp
          </a>
          <a href={mailHref} className={secondaryButtonClass}>
            Email
          </a>
          {bill.status === "issued" ? (
            <button
              type="button"
              onClick={() => setConfirmVoid(true)}
              className="border-n-300 text-s-overdue ml-auto rounded-md border bg-white px-[15px] py-2.5 text-sm font-semibold hover:bg-[#fdecec]"
            >
              Void bill
            </button>
          ) : null}
        </div>

        <p className="text-n-500 m-0 text-[12.5px]">
          Share image opens your phone&rsquo;s share sheet with the bill
          attached — that is how it reaches WhatsApp as a picture. The WhatsApp
          and Email buttons carry the text of the bill; attach the image
          yourself if you want it there too.
        </p>
      </div>

      <article className="bill-paper border-n-200 relative overflow-hidden rounded-[14px] border bg-white">
        <div className="bg-p-500 h-1.5 w-full" />

        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[24px] leading-tight font-bold">
                {business.name}
              </span>
              {taxLayout && business.pan ? (
                <span className="text-n-500 text-[12.5px]">
                  PAN {business.pan}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-p-700 font-heading text-[16px] font-bold tracking-[0.04em]">
                {taxLayout ? "TAX INVOICE" : "BILL"}
              </span>
              <span className="font-mono text-[13px] font-semibold">
                {bill.number}
              </span>
              <span className="text-n-500 text-[12px]">
                {new Date(bill.createdAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <PaymentChip
                payment={bill.payment}
                chequeNo={bill.chequeNo}
                className="mt-0.5"
              />
            </div>
          </header>

          <div className="border-n-200 border-t pt-5">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
              BILL TO
            </span>
            <p className="m-0 mt-2 text-[15px] font-semibold">
              {bill.customer.name}
            </p>
            {[
              bill.customer.phone,
              bill.customer.email,
              bill.customer.address,
              taxLayout && bill.customer.pan
                ? `PAN ${bill.customer.pan}`
                : null,
            ]
              .filter(Boolean)
              .map((detail) => (
                <p key={detail} className="text-n-500 m-0 text-[12.5px]">
                  {detail}
                </p>
              ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-n-100">
                  <th className="text-n-500 px-2.5 py-2 text-left font-mono text-[10.5px] tracking-[0.07em]">
                    ITEM
                  </th>
                  <th className="text-n-500 px-2.5 py-2 text-right font-mono text-[10.5px] tracking-[0.07em]">
                    QTY
                  </th>
                  <th className="text-n-500 px-2.5 py-2 text-right font-mono text-[10.5px] tracking-[0.07em]">
                    RATE
                  </th>
                  <th className="text-n-500 px-2.5 py-2 text-right font-mono text-[10.5px] tracking-[0.07em]">
                    DISC
                  </th>
                  <th className="text-n-500 px-2.5 py-2 text-right font-mono text-[10.5px] tracking-[0.07em]">
                    AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((line, index) => (
                  <tr key={index} className="border-n-200/70 border-b">
                    <td className="px-2.5 py-2.5">{line.name}</td>
                    <td className="text-n-600 px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {quantity(line.qty)} {line.unit}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {money(line.price)}
                    </td>
                    <td
                      className={cn(
                        "px-2.5 py-2.5 text-right font-mono tabular-nums",
                        line.discountPct > 0 ? "text-p-700" : "text-n-400"
                      )}
                    >
                      {line.discountPct > 0
                        ? `${quantity(line.discountPct)}%`
                        : "—"}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {money(line.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="flex w-full max-w-[290px] flex-col gap-1.5">
              <Row label="Subtotal" value={money(bill.subtotal)} />
              {bill.discountTotal > 0 ? (
                <Row label="Discount" value={`- ${money(bill.discountTotal)}`} />
              ) : null}
              {bill.vatRate > 0 ? (
                <>
                  <Row label="Taxable" value={money(bill.taxable)} />
                  <Row
                    label={`VAT ${quantity(bill.vatRate)}%`}
                    value={money(bill.vatAmount)}
                  />
                </>
              ) : null}
              <div className="border-n-200 mt-1.5 flex items-baseline justify-between gap-3 border-t pt-2.5">
                <span className="font-heading text-[15px] font-semibold">
                  Total
                </span>
                <span className="font-mono text-[19px] font-bold tabular-nums">
                  {money(bill.total)}
                </span>
              </div>
              {taxLayout && bill.vatRate === 0 ? (
                <span className="text-n-400 text-[11.5px]">
                  No VAT was charged on this bill.
                </span>
              ) : null}
            </div>
          </div>

          <footer className="border-n-200 flex flex-wrap justify-between gap-3 border-t pt-4">
            <span className="text-n-500 max-w-[52ch] text-[12px]">
              {bill.note ?? "Thank you."}
            </span>
            {issuedBy ? (
              <span className="text-n-400 text-[11.5px]">
                Issued by {issuedBy}
              </span>
            ) : null}
          </footer>
        </div>

        {bill.status === "void" ? (
          <span className="text-s-overdue/25 pointer-events-none absolute inset-0 flex items-center justify-center text-[92px] font-bold [transform:rotate(-20deg)]">
            VOID
          </span>
        ) : null}
      </article>

      {bill.status === "void" ? (
        <p data-no-print className="text-n-500 m-0 text-[13px]">
          This bill was voided
          {bill.voidedAt
            ? ` on ${new Date(bill.voidedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
            : ""}
          .{" "}
          {bill.source === "inventory"
            ? "The stock it took was put back."
            : "Nothing was taken from stock."}
        </p>
      ) : null}

      <VoidDialog
        bill={bill}
        open={confirmVoid}
        onClose={() => setConfirmVoid(false)}
        onDone={() => {
          setConfirmVoid(false)
          router.refresh()
        }}
      />
    </DashboardMain>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-n-600 text-[12.5px]">{label}</span>
      <span className="font-mono text-[13px] tabular-nums">{value}</span>
    </div>
  )
}

function VoidDialog({
  bill,
  open,
  onClose,
  onDone,
}: {
  bill: BillDTO
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const mutation = useVoidBill(bill.id)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Void {bill.number}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {bill.customer.name} · {money(bill.total)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          The bill stays in the list marked void — a cancelled sale is part of
          the record.{" "}
          {bill.source === "inventory"
            ? "Everything it took off stock goes back."
            : "It never touched stock, so nothing else moves."}
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
                  toast.success(`${bill.number} voided`)
                  onDone()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Voiding…" : "Void bill"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Printing hides the dashboard around the bill. Scoped to this route by
 * living in the component rather than in the global stylesheet.
 */
const printCss = `
@media print {
  header, aside, nav, [data-no-print] { display: none !important; }
  main { padding: 0 !important; animation: none !important; }
  .bill-paper { border: 0 !important; border-radius: 0 !important; }
  @page { margin: 12mm; }
}
`
