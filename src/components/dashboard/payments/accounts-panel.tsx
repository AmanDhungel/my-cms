"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  EmptyState,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { money } from "@/lib/billing"
import {
  reportMutationError,
  useAccounts,
  useCloseAccount,
  useCreateAccount,
  useUpdateAccount,
} from "@/lib/queries"
import { accountSchema } from "@/lib/validations/accounts"
import { ACCOUNT_KINDS, type AccountKind } from "@/lib/work-constants"
import type { AccountDTO } from "@/models/account"

const KIND_LABELS: Record<AccountKind, string> = {
  bank: "Bank account",
  wallet: "Wallet",
  cash: "Cash in hand",
}

/**
 * Where the money sits.
 *
 * Every balance here is the opening figure plus everything that has moved
 * since, worked out on each request rather than stored — so it cannot drift
 * away from the payments behind it, and there is no "recalculate" button to
 * forget to press.
 */
export function AccountsPanel({ today }: { today: string }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AccountDTO | null>(null)

  const query = useAccounts()
  const accounts = query.data?.accounts ?? []
  const live = accounts.filter((one) => !one.archived)

  const held = live.reduce((sum, one) => sum + one.balance, 0)
  const inflow = live.reduce((sum, one) => sum + one.received, 0)
  const outflow = live.reduce((sum, one) => sum + one.paidOut, 0)

  return (
    <>
      {query.isPending ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="HELD"
            value={money(held)}
            accent={held < 0}
            hint={`across ${live.length} account${live.length === 1 ? "" : "s"}`}
          />
          <StatCard label="RECEIVED" value={money(inflow)} />
          <StatCard label="PAID OUT" value={money(outflow)} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={3} />
      ) : accounts.length === 0 ? (
        <EmptyState
          message="No accounts yet. Add the banks and wallets you actually receive money into, with what was in them when you started — every payment can then say where it went."
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New account
            </button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
              {live.length} OPEN
              {accounts.length > live.length
                ? ` · ${accounts.length - live.length} CLOSED`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New account
            </button>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.4fr_120px_120px_130px_96px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["ACCOUNT", "OPENING", "MOVEMENTS", "BALANCE", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {accounts.map((account) => (
            <div
              key={account.id}
              data-account-row
              className={cn(
                "border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.4fr_120px_120px_130px_96px] lg:items-center",
                account.archived && "opacity-55"
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 truncate text-sm font-semibold">
                  {account.name}
                  {account.isDefault ? (
                    <span className="bg-p-100 text-p-700 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.06em]">
                      DEFAULT
                    </span>
                  ) : null}
                  {account.archived ? (
                    <span className="text-n-500 border-n-300 rounded-full border px-1.5 text-[9.5px] tracking-[0.05em] uppercase">
                      closed
                    </span>
                  ) : null}
                </span>
                <span className="text-n-500 truncate text-xs">
                  {[KIND_LABELS[account.kind], account.reference, account.detail]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              <span className="text-n-600 font-mono text-[12.5px] tabular-nums">
                {money(account.openingBalance)}
              </span>

              <span className="text-n-600 text-[12.5px]">
                {account.movements}
              </span>

              <span
                className={cn(
                  "font-mono text-[13.5px] font-semibold tabular-nums",
                  account.balance < 0 && "text-s-overdue"
                )}
              >
                {money(account.balance)}
              </span>

              <div className="flex gap-1.5 lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(account)
                    setOpen(true)
                  }}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Edit
                </button>
                {account.archived ? null : (
                  <CloseButton account={account} />
                )}
              </div>
            </div>
          ))}
        </Panel>
      )}

      <AccountDialog
        open={open}
        today={today}
        editing={editing}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}

function CloseButton({ account }: { account: AccountDTO }) {
  const mutation = useCloseAccount(account.id)

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      aria-label={`Close ${account.name}`}
      onClick={() => {
        if (mutation.isPending) return
        mutation.mutate(undefined, {
          onSuccess: ({ archived }) =>
            toast.success(
              archived
                ? `${account.name} closed. Its history is kept.`
                : `${account.name} removed`
            ),
          onError: (error) => reportMutationError(error),
        })
      }}
      className="border-n-300 text-n-500 hover:text-s-overdue rounded-md border bg-white px-2 py-1.5 text-[12.5px] font-semibold"
    >
      ×
    </button>
  )
}

function AccountDialog({
  open,
  today,
  editing,
  onClose,
}: {
  open: boolean
  today: string
  editing: AccountDTO | null
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[560px] sm:p-6"
        )}
      >
        {open ? (
          <Body today={today} editing={editing} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  today,
  editing,
  onClose,
}: {
  today: string
  editing: AccountDTO | null
  onClose: () => void
}) {
  const [name, setName] = React.useState(editing?.name ?? "")
  const [kind, setKind] = React.useState<AccountKind>(editing?.kind ?? "bank")
  const [reference, setReference] = React.useState(editing?.reference ?? "")
  const [detail, setDetail] = React.useState(editing?.detail ?? "")
  const [openingBalance, setOpeningBalance] = React.useState(
    editing ? String(editing.openingBalance) : ""
  )
  const [openedOn, setOpenedOn] = React.useState(
    editing?.openedOn ? editing.openedOn.slice(0, 10) : today
  )
  const [isDefault, setIsDefault] = React.useState(editing?.isDefault ?? false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const create = useCreateAccount()
  const update = useUpdateAccount(editing?.id ?? "")
  const mutation = editing ? update : create

  function submit() {
    if (mutation.isPending) return

    const parsed = accountSchema.safeParse({
      name,
      kind,
      reference: reference || null,
      detail: detail || null,
      openingBalance: openingBalance || 0,
      openedOn: openedOn || null,
      isDefault,
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: ({ account }) =>
        toast.success(editing ? `${account.name} saved` : `${account.name} added`),
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path]: message }))
        ),
    })
    if (!mutation.isError) onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-[19px] font-semibold">
          {editing ? `Edit ${editing.name}` : "Add an account"}
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          A bank, a wallet, or the cash drawer. Payments and expenses say which
          one they moved through.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Name</FieldLabel>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setErrors((prev) => ({ ...prev, name: "" }))
              }}
              placeholder="Nabil Bank — current"
              aria-label="Name"
              aria-invalid={Boolean(errors.name)}
              className={inputClass}
            />
            <FieldError message={errors.name} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Kind</FieldLabel>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as AccountKind)}
              aria-label="Kind"
              className={cn(inputClass, "cursor-pointer")}
            >
              {ACCOUNT_KINDS.map((one) => (
                <option key={one} value={one}>
                  {KIND_LABELS[one]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>
              {kind === "wallet" ? "Wallet ID" : "Account number"}
            </FieldLabel>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
              aria-label="Reference"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>
              {kind === "wallet" ? "Registered number" : "Branch"}
            </FieldLabel>
            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Optional"
              aria-label="Detail"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Opening balance</FieldLabel>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={openingBalance}
              onChange={(event) => {
                setOpeningBalance(event.target.value)
                setErrors((prev) => ({ ...prev, openingBalance: "" }))
              }}
              placeholder="0"
              aria-label="Opening balance"
              aria-invalid={Boolean(errors.openingBalance)}
              className={inputClass}
            />
            <span className="text-n-500 text-[11.5px]">
              What was in it the day you started using EMS.
            </span>
            <FieldError message={errors.openingBalance} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>As at</FieldLabel>
            <input
              type="date"
              value={openedOn}
              onChange={(event) => setOpenedOn(event.target.value)}
              aria-label="As at"
              className={inputClass}
            />
          </label>
        </div>

        <label className="border-n-200 flex items-start gap-2.5 rounded-[10px] border bg-white p-3">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
            aria-label="Offer this one first"
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold">
              Offer this one first
            </span>
            <span className="text-n-500 text-[12px]">
              New payments and expenses start on it. Only one can be.
            </span>
          </span>
        </label>
      </div>

      <DialogFooter className="mt-1 gap-2 sm:gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : editing ? "Save" : "Add account"}
        </button>
      </DialogFooter>
    </>
  )
}
