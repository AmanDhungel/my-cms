"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { money, quantity } from "@/lib/billing"
import type { PublicQuote } from "@/lib/quote-review"

/**
 * The client's view of a quotation.
 *
 * Deliberately plain, and deliberately not the dashboard: whoever opens this
 * has never seen EMS and is here to do one thing — read a price list and say
 * what they think of it. Every line carries its own "comment on this", because
 * "the cable is too expensive" is only useful when it is attached to the
 * cable.
 */
export function QuoteReview({
  token,
  initial,
}: {
  token: string
  initial: PublicQuote
}) {
  const [quote, setQuote] = React.useState(initial)
  const [name, setName] = React.useState(initial.clientName ?? "")
  const [remark, setRemark] = React.useState("")
  const [lineIndex, setLineIndex] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)

  const decided = quote.status !== "pending"

  async function send(decision?: "approved" | "changes_requested") {
    if (busy) return
    if (!remark.trim() && !decision) {
      toast.error("Write a remark, or say whether you approve it")
      return
    }

    setBusy(true)
    try {
      const response = await fetch(`/api/quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name.trim() || undefined,
          remark: remark.trim() || undefined,
          lineIndex: lineIndex ?? undefined,
          decision,
        }),
      })

      const body = (await response.json()) as {
        quote?: PublicQuote
        error?: string
      }
      if (!response.ok || !body.quote) {
        throw new Error(body.error ?? "That didn't go through")
      }

      setQuote(body.quote)
      setRemark("")
      setLineIndex(null)
      toast.success(
        decision === "approved"
          ? "Thank you — they have been told"
          : decision === "changes_requested"
            ? "Sent. They will come back to you."
            : "Remark sent"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't send")
    } finally {
      setBusy(false)
    }
  }

  const remarksFor = (index: number | null) =>
    quote.remarks.filter((one) => one.lineIndex === index)

  return (
    <main className="bg-n-50 min-h-screen py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 sm:px-6">
        <header className="flex flex-col gap-1.5">
          <span className="text-p-600 font-mono text-[11px] tracking-[0.08em] uppercase">
            Quotation {quote.number}
          </span>
          <h1 className="font-heading m-0 text-[26px] font-bold tracking-[-0.015em]">
            {quote.business}
          </h1>
          <p className="text-n-600 m-0 text-[14px]">
            Prepared for {quote.customer} ·{" "}
            {new Date(quote.issuedOn).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </header>

        {decided ? (
          <div
            className={cn(
              "rounded-[12px] border px-4 py-3 text-[13.5px]",
              quote.status === "approved"
                ? "border-s-done/30 bg-s-done/10 text-s-done"
                : "border-a-400/40 bg-a-50 text-a-900"
            )}
          >
            {quote.status === "approved"
              ? `Approved${quote.clientName ? ` by ${quote.clientName}` : ""}. They have been told.`
              : `Changes requested${quote.clientName ? ` by ${quote.clientName}` : ""}. They will come back to you.`}
          </div>
        ) : null}

        {/* ---- the prices ---------------------------------------------- */}
        <section className="border-n-200 overflow-hidden rounded-[14px] border bg-white">
          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.6fr_90px_110px_80px_110px_120px] gap-3 border-b px-4 py-2.5 sm:grid">
            {["ITEM", "QTY", "PRICE", "OFF", "TOTAL", ""].map((head, i) => (
              <span
                key={`${head}-${i}`}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {quote.lines.map((line, index) => {
            const said = remarksFor(index)
            return (
              <div
                key={index}
                data-quote-line
                className="border-n-200/70 grid gap-2 border-b px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_90px_110px_80px_110px_120px] sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">{line.name}</span>
                  <span className="text-n-500 text-xs sm:hidden">
                    {quantity(line.qty)} {line.unit} · {money(line.price)}
                  </span>
                </span>

                <span className="text-n-600 hidden text-[13px] sm:block">
                  {quantity(line.qty)} {line.unit}
                </span>
                <span className="hidden font-mono text-[13px] tabular-nums sm:block">
                  {money(line.price)}
                </span>
                <span className="text-n-500 hidden font-mono text-[12.5px] sm:block">
                  {line.discountPct ? `${line.discountPct}%` : "—"}
                </span>
                <span className="font-mono text-[13.5px] font-semibold tabular-nums">
                  {money(line.total)}
                </span>

                <div className="sm:justify-self-end">
                  {decided ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setLineIndex(index)
                        document
                          .getElementById("say-something")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }}
                      aria-label={`Comment on ${line.name}`}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[12px] font-semibold",
                        lineIndex === index
                          ? "border-p-400 bg-p-100 text-p-700"
                          : "border-n-300 text-n-600 hover:bg-n-100 bg-white"
                      )}
                    >
                      {said.length > 0 ? `${said.length} remark${said.length === 1 ? "" : "s"}` : "Comment"}
                    </button>
                  )}
                </div>

                {said.length > 0 ? (
                  <div className="col-span-full flex flex-col gap-1.5 pt-1">
                    {said.map((one, i) => (
                      <Remark key={i} remark={one} />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}

          <dl className="bg-n-50 m-0 flex flex-col gap-1.5 px-4 py-3.5">
            <Row label="Subtotal" value={money(quote.subtotal)} />
            {quote.discountTotal > 0 ? (
              <Row label="Discount" value={`−${money(quote.discountTotal)}`} />
            ) : null}
            {quote.vatRate > 0 ? (
              <Row
                label={`VAT ${quote.vatRate}%`}
                value={money(quote.vatAmount)}
              />
            ) : null}
            <Row label="Total" value={money(quote.total)} strong />
          </dl>
        </section>

        {quote.note ? (
          <p className="text-n-600 border-n-200 m-0 rounded-[12px] border bg-white px-4 py-3 text-[13.5px] leading-relaxed">
            {quote.note}
          </p>
        ) : null}

        {/* ---- remarks about the whole thing --------------------------- */}
        {remarksFor(null).length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-heading m-0 text-[15px] font-semibold">
              On the quotation as a whole
            </h2>
            {remarksFor(null).map((one, i) => (
              <Remark key={i} remark={one} />
            ))}
          </section>
        ) : null}

        {/* ---- having your say ----------------------------------------- */}
        {decided ? (
          <p className="text-n-500 m-0 text-center text-[13px]">
            You have already answered this quotation. Contact {quote.business} if
            anything has changed.
          </p>
        ) : (
          <section
            id="say-something"
            className="border-n-200 flex flex-col gap-3 rounded-[14px] border bg-white p-4 sm:p-5"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading m-0 text-[16px] font-semibold">
                What do you think?
              </h2>
              <p className="text-n-500 m-0 text-[13px]">
                {lineIndex === null
                  ? "About the quotation as a whole. Pick a line above to comment on just that one."
                  : `About "${quote.lines[lineIndex]?.name}".`}
                {lineIndex !== null ? (
                  <button
                    type="button"
                    onClick={() => setLineIndex(null)}
                    className="text-p-700 ml-1.5 font-semibold underline"
                  >
                    the whole thing instead
                  </button>
                ) : null}
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-n-600 text-[12px] font-semibold tracking-[0.05em] uppercase">
                Your name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="So they know who replied"
                aria-label="Your name"
                className="border-n-300 focus:border-p-400 h-[42px] rounded-md border bg-white px-3 text-[14px] outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-n-600 text-[12px] font-semibold tracking-[0.05em] uppercase">
                Your remark
              </span>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                rows={4}
                placeholder="Which prices aren't justified, and what you'd like changed."
                aria-label="Your remark"
                className="border-n-300 focus:border-p-400 resize-y rounded-md border bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("approved")}
                className="bg-p-500 rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
              >
                {busy ? "Sending…" : "Approve this quotation"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("changes_requested")}
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
              >
                Request changes
              </button>
              <button
                type="button"
                disabled={busy || !remark.trim()}
                onClick={() => void send()}
                className="text-n-600 hover:text-n-900 rounded-md px-3 py-2.5 text-[13.5px] font-semibold disabled:opacity-40"
              >
                Just leave a remark
              </button>
            </div>
          </section>
        )}

        <footer className="text-n-400 pb-6 text-center text-[11.5px]">
          This link was sent to you by {quote.business}. Please don&apos;t pass
          it on.
        </footer>
      </div>
    </main>
  )
}

function Remark({
  remark,
}: {
  remark: PublicQuote["remarks"][number]
}) {
  return (
    <div
      data-remark
      className={cn(
        "rounded-[10px] border px-3 py-2",
        remark.fromClient
          ? "border-n-200 bg-n-50"
          : "border-p-400/30 bg-p-100/40"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">
          {remark.author}
          {remark.fromClient ? "" : " · them"}
        </span>
        <span className="text-n-400 font-mono text-[10.5px]">
          {new Date(remark.at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </div>
      <p className="text-n-700 m-0 text-[13px] leading-relaxed whitespace-pre-line">
        {remark.text}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("m-0 text-[13px]", strong && "font-semibold")}>
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 font-mono tabular-nums",
          strong ? "text-[16px] font-bold" : "text-[13px]"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
