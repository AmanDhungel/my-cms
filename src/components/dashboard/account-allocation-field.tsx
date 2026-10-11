"use client"

import * as React from "react"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { useCanSeeAccounts } from "@/components/dashboard/money-pickers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import {
  formatPaisa,
  maskAccountNumber,
  needsAccount,
  planAllocations,
  projectBalance,
  splitProgress,
  toPaisa,
  type AllocationInput,
} from "@/lib/allocations"
import { ApiRequestError } from "@/lib/api-client"
import { money } from "@/lib/billing"
import { useAccounts, useCreateAccount } from "@/lib/queries"
import type { AccountDTO } from "@/models/account"

/**
 * Which account (or accounts) the money moved through.
 *
 * One field for every form that records money — a payment, an expense — so
 * the rules are the same everywhere: cash names no account and hides this
 * altogether; any other method needs one, picked here or added on the spot;
 * and a payment can be split across several as long as the parts add up.
 *
 * Owners only, like the accounts themselves. A supervisor recording a stock
 * purchase sees nothing here and is not asked for an account.
 */

export type AllocationDraft = {
  accountId: string
  split: boolean
  rows: { key: string; accountId: string; amount: string }[]
}

export const emptyAllocationDraft: AllocationDraft = {
  accountId: "",
  split: false,
  rows: [],
}

/** A record's own allocations, as an edit form starts from them. */
export type PreviousAllocation = {
  direction: "in" | "out"
  allocations: AllocationInput[]
}

let rowSeq = 0
const nextKey = () => `row-${++rowSeq}`

/** The form state an existing record starts from. */
export function draftFrom(record: {
  accountId: string | null
  allocations?: AllocationInput[] | null
}): AllocationDraft {
  const allocations = record.allocations ?? []
  if (allocations.length > 1) {
    return {
      accountId: allocations[0].accountId,
      split: true,
      rows: allocations.map((row) => ({
        key: nextKey(),
        accountId: row.accountId,
        amount: String(row.amount),
      })),
    }
  }
  return {
    accountId: allocations[0]?.accountId ?? record.accountId ?? "",
    split: false,
    rows: [],
  }
}

/**
 * What a record's own previous allocations were, for the low-balance check
 * on an edit. A record from before allocations existed counts in full
 * against the one account it names.
 */
export function previousOf(record: {
  accountId: string | null
  amount: number
  method: string
  allocations?: AllocationInput[] | null
}, direction: "in" | "out"): PreviousAllocation {
  if (record.allocations?.length) {
    return { direction, allocations: record.allocations }
  }
  if (record.accountId) {
    return { direction, allocations: [{ accountId: record.accountId, amount: record.amount }] }
  }
  return { direction, allocations: [] }
}

/** The request fields for a draft: nothing for cash, a split, or one account. */
export function allocationPayload(
  draft: AllocationDraft,
  method: string,
  fallbackAccountId: string
): { accountId?: string; allocations?: AllocationInput[] } {
  if (!needsAccount(method)) return {}
  if (draft.split) {
    return {
      allocations: draft.rows.map((row) => ({
        accountId: row.accountId,
        amount: Number(row.amount) || 0,
      })),
    }
  }
  const accountId = draft.accountId || fallbackAccountId
  return accountId ? { accountId } : {}
}

/**
 * The same checks the server makes, run before sending: the account a
 * non-cash method needs, and a split that adds up. Field paths match the
 * server's, so either side's message lands in the same place.
 */
export function validateAllocation(
  draft: AllocationDraft,
  options: { method: string; amount: number; fallbackAccountId: string; requireAccount: boolean }
): Record<string, string> {
  const payload = allocationPayload(draft, options.method, options.fallbackAccountId)
  if (draft.split && needsAccount(options.method) && draft.rows.length === 0) {
    return { allocations: "Add at least one account to the split" }
  }
  const plan = planAllocations({
    method: options.method,
    amount: options.amount,
    accountId: payload.accountId,
    allocations: payload.allocations,
    requireAccount: options.requireAccount,
  })
  // An amount problem is the amount field's own message, not this one's.
  if (plan.ok || plan.path === "amount") return {}
  return { [plan.path]: plan.message }
}

export function AccountAllocationField({
  method,
  amount,
  direction,
  value,
  onChange,
  errors,
  previous,
  fallbackAccountId,
}: {
  method: string
  /** The payment's total, in rupees. */
  amount: number
  direction: "in" | "out"
  value: AllocationDraft
  onChange: (next: AllocationDraft) => void
  errors: Partial<Record<string, string>>
  /** On an edit: what this record had allocated, put back before warning. */
  previous?: PreviousAllocation | null
  /** The workspace's default account, shown (and saved) until one is picked. */
  fallbackAccountId: string
}) {
  const allowed = useCanSeeAccounts()
  const query = useAccounts(allowed)
  const all = React.useMemo(() => query.data?.accounts ?? [], [query.data])
  const accounts = all.filter((one) => !one.archived)
  // Which row the account being added should land in; -1 is single mode.
  const [adding, setAdding] = React.useState<number | null>(null)

  if (!allowed || query.isError || !needsAccount(method)) return null

  const amountPaisa = toPaisa(amount) || 0
  const singleId = value.accountId || fallbackAccountId

  function previousPaisa(accountId: string) {
    if (!previous) return null
    const paisa = previous.allocations
      .filter((row) => row.accountId === accountId)
      .reduce((sum, row) => sum + toPaisa(row.amount), 0)
    return paisa ? { direction: previous.direction, paisa } : null
  }

  function warningFor(accountId: string, paisa: number) {
    const account = accounts.find((one) => one.id === accountId)
    if (!account || paisa <= 0) return null
    const projection = projectBalance({
      balancePaisa: toPaisa(account.balance),
      direction,
      amountPaisa: paisa,
      previous: previousPaisa(accountId),
    })
    if (!projection.warn) return null
    return `Heads up: ${account.name} has ${formatPaisa(projection.before)}. This ${formatPaisa(paisa)} will take it to ${formatPaisa(projection.after)}.`
  }

  function setSplit(on: boolean) {
    if (on) {
      onChange({
        ...value,
        split: true,
        rows:
          value.rows.length > 0
            ? value.rows
            : [
                {
                  key: nextKey(),
                  accountId: singleId,
                  amount: amountPaisa > 0 ? String(amount) : "",
                },
              ],
      })
    } else {
      onChange({
        ...value,
        split: false,
        accountId: value.rows[0]?.accountId || value.accountId,
      })
    }
  }

  function setRow(index: number, patch: Partial<AllocationDraft["rows"][number]>) {
    onChange({
      ...value,
      rows: value.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    })
  }

  function addRow(accountId = "") {
    const { remaining } = splitProgress(amount, value.rows)
    onChange({
      ...value,
      rows: [
        ...value.rows,
        {
          key: nextKey(),
          accountId,
          amount: remaining > 0 ? String(remaining / 100) : "",
        },
      ],
    })
  }

  function removeRow(index: number) {
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) })
  }

  function created(account: AccountDTO) {
    if (adding === -1 || adding === null) {
      onChange({ ...value, accountId: account.id })
    } else if (adding >= value.rows.length) {
      addRow(account.id)
    } else {
      setRow(adding, { accountId: account.id })
    }
  }

  const progress = splitProgress(amount, value.rows)
  const singleWarning = value.split ? null : warningFor(singleId, amountPaisa)

  return (
    <div className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel>{value.split ? "Accounts" : "Account"}</FieldLabel>
        <label className="text-n-700 flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            checked={value.split}
            onChange={(event) => setSplit(event.target.checked)}
            className="accent-p-500 size-4"
          />
          Split across accounts
        </label>
      </div>

      {!value.split ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AccountSelect
              accounts={accounts}
              value={singleId}
              onChange={(id) => onChange({ ...value, accountId: id })}
              loading={query.isPending}
              invalid={Boolean(errors.accountId)}
              label="Account"
            />
            <button
              type="button"
              onClick={() => setAdding(-1)}
              className="border-n-300 text-p-700 hover:bg-n-100 shrink-0 rounded-md border bg-white px-3 py-2 text-[13px] font-semibold"
            >
              + Add account
            </button>
          </div>
          {accounts.length === 0 && !query.isPending ? (
            <span className="text-n-500 text-[11.5px]">
              No accounts yet. Add the bank or wallet this went through.
            </span>
          ) : null}
          <FieldError message={errors.accountId} />
          <Warning message={singleWarning} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {value.rows.map((row, index) => {
              const taken = new Set(
                value.rows.filter((_, i) => i !== index).map((other) => other.accountId)
              )
              const rowWarning = warningFor(row.accountId, toPaisa(Number(row.amount)) || 0)
              return (
                <div key={row.key} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                    <AccountSelect
                      accounts={accounts.filter((one) => !taken.has(one.id) || one.id === row.accountId)}
                      value={row.accountId}
                      onChange={(id) => setRow(index, { accountId: id })}
                      loading={query.isPending}
                      invalid={Boolean(errors[`allocations.${index}.accountId`])}
                      label={`Account ${index + 1}`}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) => setRow(index, { amount: event.target.value })}
                      placeholder="0"
                      aria-label={`Amount from account ${index + 1}`}
                      aria-invalid={Boolean(errors[`allocations.${index}.amount`])}
                      className={cn(inputClass, "py-2 text-[14px]")}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label={`Remove account ${index + 1}`}
                      className="text-n-500 hover:text-n-800 hover:bg-n-100 rounded-md px-2 py-2 text-[16px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <FieldError
                    message={
                      errors[`allocations.${index}.accountId`] ??
                      errors[`allocations.${index}.amount`]
                    }
                  />
                  <Warning message={rowWarning} />
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addRow()}
              className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[12.5px] font-semibold"
            >
              + Add another account
            </button>
            <button
              type="button"
              onClick={() => setAdding(value.rows.length)}
              className="border-n-300 text-p-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[12.5px] font-semibold"
            >
              + Add new account
            </button>
          </div>

          <p
            className={cn(
              "m-0 font-mono text-[12px]",
              progress.remaining === 0 ? "text-n-600" : "text-a-700"
            )}
            aria-live="polite"
          >
            Allocated {formatPaisa(progress.allocated)} of {formatPaisa(progress.total)} — Remaining{" "}
            {formatPaisa(progress.remaining)}
          </p>
          <FieldError message={errors.allocations} />
        </>
      )}

      <AddAccountDialog
        open={adding !== null}
        onClose={() => setAdding(null)}
        onCreated={created}
        existing={all}
        method={method}
      />
    </div>
  )
}

function AccountSelect({
  accounts,
  value,
  onChange,
  loading,
  invalid,
  label,
}: {
  accounts: AccountDTO[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  invalid: boolean
  label: string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      aria-invalid={invalid}
      className={cn(inputClass, "min-w-0 flex-1 cursor-pointer py-2 text-[14px]")}
    >
      <option value="">
        {loading ? "Loading…" : accounts.length === 0 ? "No accounts yet" : "Pick an account"}
      </option>
      {accounts.map((account) => {
        const masked = maskAccountNumber(account.reference)
        return (
          <option key={account.id} value={account.id}>
            {account.name}
            {masked ? ` ${masked}` : ""} · {money(account.balance)}
          </option>
        )
      })}
    </select>
  )
}

/** Amber and non-blocking: the money may well be on its way in. */
function Warning({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="border-a-400 bg-a-50 text-a-900 m-0 rounded-md border px-2.5 py-1.5 text-[12.5px] leading-[1.45]"
    >
      {message}
    </p>
  )
}

/**
 * "+ Add account": a second dialog over the payment form, which stays open
 * and keeps everything typed into it. Radix stacks the two, so Escape and a
 * click on the scrim close only this one, and focus stays trapped in it.
 */
function AddAccountDialog({
  open,
  onClose,
  onCreated,
  existing,
  method,
}: {
  open: boolean
  onClose: () => void
  onCreated: (account: AccountDTO) => void
  existing: AccountDTO[]
  method: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[420px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[18px] font-semibold">
            Add an account
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13px]">
            A bank account or wallet the business uses. It is picked for this
            payment once added.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddAccountBody
            onClose={onClose}
            onCreated={onCreated}
            existing={existing}
            method={method}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AddAccountBody({
  onClose,
  onCreated,
  existing,
  method,
}: {
  onClose: () => void
  onCreated: (account: AccountDTO) => void
  existing: AccountDTO[]
  method: string
}) {
  const create = useCreateAccount()
  const [name, setName] = React.useState("")
  const [reference, setReference] = React.useState("")
  const [opening, setOpening] = React.useState("0")
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({})
  const [failure, setFailure] = React.useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    // This form sits inside another form's React tree; its submit must not
    // reach the payment form behind it.
    event.stopPropagation()
    if (create.isPending) return

    const next: Partial<Record<string, string>> = {}
    const trimmed = name.trim()
    if (trimmed.length < 2) next.name = "Give it a name"
    else if (existing.some((one) => one.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      next.name = "You already have one by that name"
    }
    const openingBalance = opening.trim() === "" ? 0 : Number(opening)
    if (!Number.isFinite(openingBalance)) next.openingBalance = "Enter a number"
    setErrors(next)
    setFailure(null)
    if (Object.keys(next).length > 0) return

    create.mutate(
      {
        name: trimmed,
        // Online payments land in wallets more often than in banks.
        kind: method === "online" ? "wallet" : "bank",
        reference: reference.trim() || undefined,
        openingBalance,
      },
      {
        onSuccess: ({ account }) => {
          onCreated(account)
          onClose()
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) {
            const fields = error.fieldErrors ?? {}
            if (error.status === 409) {
              setErrors({ name: error.message })
              return
            }
            if (Object.keys(fields).length > 0) {
              setErrors(
                Object.fromEntries(
                  Object.entries(fields).map(([path, messages]) => [path, messages[0]])
                )
              )
              return
            }
          }
          setFailure(error instanceof Error ? error.message : "Could not reach the server")
        },
      }
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Name</FieldLabel>
        <input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setErrors((prev) => ({ ...prev, name: undefined }))
          }}
          placeholder="e.g. NIC Asia current"
          aria-invalid={Boolean(errors.name)}
          className={inputClass}
        />
        <FieldError message={errors.name} />
      </label>
      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Account number</FieldLabel>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Optional"
          inputMode="text"
          aria-invalid={Boolean(errors.reference)}
          className={inputClass}
        />
        <FieldError message={errors.reference} />
      </label>
      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Opening balance</FieldLabel>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={opening}
          onChange={(event) => {
            setOpening(event.target.value)
            setErrors((prev) => ({ ...prev, openingBalance: undefined }))
          }}
          aria-invalid={Boolean(errors.openingBalance)}
          className={inputClass}
        />
        <span className="text-n-500 text-[11.5px]">
          What is in it today, before this payment.
        </span>
        <FieldError message={errors.openingBalance} />
      </label>
      {failure ? (
        <p role="alert" className="text-s-overdue m-0 text-[12.5px]">
          {failure}
        </p>
      ) : null}
      <DialogFooter className="gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {create.isPending ? "Adding…" : "Add account"}
        </button>
      </DialogFooter>
    </form>
  )
}
