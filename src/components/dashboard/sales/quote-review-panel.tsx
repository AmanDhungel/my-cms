"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { Panel } from "@/components/dashboard/ui"
import { inviteReviewSchema } from "@/lib/validations/review"
import type { BillDTO } from "@/models/bill"

/**
 * Sending a quotation to the client, and what came back.
 *
 * EMS has no mail or SMS gateway, so this produces a link rather than
 * sending one — the owner passes it on however they already talk to this
 * client. Saying that plainly is better than a "Send" button that quietly
 * does nothing.
 */
export function QuoteReviewPanel({ bill }: { bill: BillDTO }) {
  const router = useRouter()
  const review = bill.review

  const [invitedTo, setInvitedTo] = React.useState(review?.invitedTo ?? "")
  const [days, setDays] = React.useState("30")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [link, setLink] = React.useState<string | null>(null)

  const live = Boolean(review && !review.revoked && review.token)

  async function share() {
    if (busy) return

    const parsed = inviteReviewSchema.safeParse({ invitedTo, days })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check that")
      return
    }
    setError(null)
    setBusy(true)

    try {
      const response = await fetch(`/api/bills/${bill.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const body = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "That didn't go through")
      }
      setLink(body.url)
      toast.success("Link ready — send it to them")
      router.refresh()
    } catch (problem) {
      toast.error(problem instanceof Error ? problem.message : "That failed")
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/bills/${bill.id}/review`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        throw new Error(body.error ?? "That didn't go through")
      }
      setLink(null)
      toast.success("Link withdrawn")
      router.refresh()
    } catch (problem) {
      toast.error(problem instanceof Error ? problem.message : "That failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="ems-print-hide flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading m-0 text-[15.5px] font-semibold">
            Client review
          </h2>
          <p className="text-n-500 m-0 text-[12.5px]">
            Send this quotation to the client so they can read it, comment on
            any line and approve it.
          </p>
        </div>
        {review ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] font-semibold",
              review.revoked
                ? "bg-n-100 text-n-500"
                : review.status === "approved"
                  ? "bg-s-done/15 text-s-done"
                  : review.status === "changes_requested"
                    ? "bg-a-400/15 text-a-700"
                    : "bg-p-100 text-p-700"
            )}
          >
            {review.revoked
              ? "Withdrawn"
              : review.status === "approved"
                ? "Approved"
                : review.status === "changes_requested"
                  ? "Changes requested"
                  : "Waiting on them"}
          </span>
        ) : null}
      </div>

      {/* ---- sharing it ------------------------------------------------ */}
      <div className="border-n-200 flex flex-wrap items-end gap-3 rounded-[10px] border bg-white p-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-[7px]">
          <FieldLabel>Their email or phone number</FieldLabel>
          <input
            value={invitedTo}
            onChange={(event) => {
              setInvitedTo(event.target.value)
              setError(null)
            }}
            placeholder="name@example.com or +977 98…"
            aria-label="Their email or phone number"
            aria-invalid={Boolean(error)}
            className={inputClass}
          />
          <FieldError message={error ?? undefined} />
        </label>

        <label className="flex w-[130px] flex-col gap-[7px]">
          <FieldLabel>Good for</FieldLabel>
          <select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            aria-label="Good for"
            className={cn(inputClass, "cursor-pointer")}
          >
            {["7", "14", "30", "60", "90"].map((one) => (
              <option key={one} value={one}>
                {one} days
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void share()}
          disabled={busy}
          className="bg-p-500 h-[42px] rounded-md px-4 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {busy ? "Working…" : live ? "New link" : "Create link"}
        </button>

        {live ? (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="border-n-300 text-n-600 hover:text-s-overdue h-[42px] rounded-md border bg-white px-3.5 text-[13px] font-semibold disabled:opacity-60"
          >
            Withdraw
          </button>
        ) : null}
      </div>

      {link ? (
        <div className="border-p-400/40 bg-p-100/40 flex flex-col gap-2 rounded-[10px] border p-3">
          <span className="text-p-700 font-mono text-[10.5px] tracking-[0.07em]">
            SEND THEM THIS
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <code
              data-quote-link
              className="border-n-200 min-w-0 flex-1 truncate rounded border bg-white px-2.5 py-2 font-mono text-[12px]"
            >
              {link}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success("Copied"))
                  .catch(() => toast.error("Couldn't copy — select it by hand"))
              }}
              className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2 text-[12.5px] font-semibold"
            >
              Copy
            </button>
          </div>
          <span className="text-n-600 text-[12px]">
            EMS doesn&apos;t send email or messages — pass this on yourself.
            Anyone with the link can read the quotation, so don&apos;t post it
            publicly.
          </span>
        </div>
      ) : live && review?.invitedAt ? (
        <p className="text-n-500 m-0 text-[12.5px]">
          Shared with {review.invitedTo} on{" "}
          {new Date(review.invitedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          {review.expiresAt
            ? ` · good until ${new Date(review.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
            : ""}
          . Create a new link if they need it again.
        </p>
      ) : null}

      {/* ---- what they said -------------------------------------------- */}
      {review && review.remarks.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
            WHAT THEY SAID
          </span>
          {review.remarks.map((remark, index) => (
            <div
              key={index}
              data-client-remark
              className={cn(
                "rounded-[10px] border px-3 py-2",
                remark.fromClient
                  ? "border-a-400/40 bg-a-50"
                  : "border-n-200 bg-white"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-semibold">
                  {remark.author}
                  {remark.lineIndex !== null
                    ? ` · on ${bill.lines[remark.lineIndex]?.name ?? `line ${remark.lineIndex + 1}`}`
                    : " · on the whole quotation"}
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
          ))}

          <p className="text-n-500 m-0 text-[12px]">
            Revise the quotation and create a new link to send it back to them.
          </p>
        </div>
      ) : review && !review.revoked ? (
        <p className="text-n-500 m-0 text-[12.5px]">
          Nothing back from them yet.
        </p>
      ) : null}
    </Panel>
  )
}
