"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { money } from "@/lib/billing"
import { useAccounts, useCustomers } from "@/lib/queries"
import type { PartyKind } from "@/lib/work-constants"

/**
 * Choosing who the money is with, and where it sits.
 *
 * Both are shared rather than written twice: a payment and an expense ask the
 * same two questions, and a ledger only works if both record the answer the
 * same way.
 */

/**
 * The party a bill or a payment belongs to.
 *
 * Picking one is what puts the row on their ledger. Typing a name without
 * picking still works — a one-off supplier does not deserve a record — so the
 * field stays a free-text name with a list beside it rather than a select
 * that refuses anything unfamiliar.
 */
export function PartyPicker({
  label,
  name,
  partyId,
  onName,
  onParty,
  /** Which side of the book to offer. "vendor" also offers "both". */
  side,
  error,
  placeholder,
}: {
  label: string
  name: string
  partyId: string
  onName: (value: string) => void
  onParty: (id: string) => void
  side: PartyKind
  error?: string
  placeholder?: string
}) {
  const query = useCustomers()
  const parties = (query.data?.customers ?? []).filter(
    (one) => one.kind === side || one.kind === "both"
  )

  const chosen = parties.find((one) => one.id === partyId)

  return (
    <div className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>

      <select
        value={partyId}
        onChange={(event) => {
          const id = event.target.value
          onParty(id)
          // Picking someone fills the name, which is what gets snapshotted.
          const picked = parties.find((one) => one.id === id)
          if (picked) onName(picked.name)
        }}
        aria-label={`${label} — from the list`}
        className={cn(inputClass, "cursor-pointer")}
      >
        <option value="">
          {query.isPending ? "Loading…" : "Not on the ledger — type a name"}
        </option>
        {parties.map((party) => (
          <option key={party.id} value={party.id}>
            {party.name}
            {party.company ? ` · ${party.company}` : ""}
          </option>
        ))}
      </select>

      {chosen ? (
        <span className="text-n-500 text-[11.5px]">
          This lands on {chosen.name}&apos;s ledger.
        </span>
      ) : (
        <>
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder={placeholder ?? "Company or person"}
            aria-label={label}
            aria-invalid={Boolean(error)}
            className={inputClass}
          />
          <span className="text-n-500 text-[11.5px]">
            A one-off. Add them as a party to keep a running account.
          </span>
        </>
      )}

      <FieldError message={error} />
    </div>
  )
}

/**
 * The account a form should start on.
 *
 * A hook rather than something the picker sets for itself: writing the
 * default into the parent's state from inside an effect is the pattern the
 * React Compiler rejects, and it would also mark a form dirty before anyone
 * had touched it. The parent resolves the same way at submit — `chosen ||
 * fallback` — so what is shown and what is saved cannot disagree.
 */
/** Whether this viewer may see the accounts at all. Owners only. */
function useCanSeeAccounts() {
  const { data } = useSession()
  return data?.user?.role === "owner"
}

export function useDefaultAccountId() {
  const query = useAccounts(useCanSeeAccounts())
  return (
    (query.data?.accounts ?? []).find((one) => !one.archived && one.isDefault)
      ?.id ?? ""
  )
}

/** Which bank, wallet or drawer the money moved through. */
export function AccountPicker({
  value,
  onChange,
  error,
  label = "Account",
}: {
  value: string
  onChange: (id: string) => void
  error?: string
  label?: string
}) {
  /*
   * Somebody who may not see the accounts is not asked to choose one, and is
   * not made to ask for them either.
   *
   * A supervisor records stock purchases but has no view of what the business
   * holds. Gating the query on the role rather than letting it 403 is what
   * keeps a refused request out of their console — the answer was knowable
   * before asking.
   */
  const allowed = useCanSeeAccounts()
  const query = useAccounts(allowed)
  const accounts = (query.data?.accounts ?? []).filter((one) => !one.archived)
  const fallback = accounts.find((one) => one.isDefault)

  if (!allowed || query.isError) return null

  return (
    <div className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value || fallback?.id || ""}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={cn(inputClass, "cursor-pointer")}
      >
        <option value="">
          {query.isPending
            ? "Loading…"
            : accounts.length === 0
              ? "No accounts yet"
              : "Not recorded"}
        </option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {money(account.balance)}
          </option>
        ))}
      </select>
      {accounts.length === 0 && !query.isPending ? (
        <span className="text-n-500 text-[11.5px]">
          Add a bank or wallet on the Accounts tab to track balances.
        </span>
      ) : null}
      <FieldError message={error} />
    </div>
  )
}
