"use client"

import * as React from "react"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ItemDialog } from "@/components/dashboard/inventory/item-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { money, quantity } from "@/lib/billing"
import type { ItemDTO } from "@/models/inventory-item"

/**
 * The lines and discounts of a sale — shared by the bill form and the
 * estimate form, so the two can never price a line differently.
 *
 * Moved here unchanged from bill-dialog.tsx; the parent owns the state
 * (lines, discount groups) and works the totals out from it. On a custom
 * line, Enter adds the next line and puts the cursor in it.
 */

export type DraftLine = {
  key: string
  itemId?: string
  name: string
  unit: string
  price: string
  qty: string
  /** Only set for inventory lines, to warn before the server refuses. */
  stock?: number
}

/** A discount and the lines it was given to. A line takes only one. */
export type Group = { key: string; percent: string; lines: string[] }

let seq = 0
const nextKey = () => `k${++seq}`

/** A line's discount: the percentage of whichever group holds it. */
export function linePercent(groups: Group[], key: string) {
  const group = groups.find((entry) => entry.lines.includes(key))
  return group ? Number(group.percent) || 0 : 0
}

/**
 * Lines saved with a percentage each (an estimate, a bill) back into the
 * editor's form: one discount group per distinct percentage.
 */
export function draftFromLines(
  saved: {
    itemId: string | null
    name: string
    unit: string
    price: number
    qty: number
    discountPct: number
  }[],
  stock?: Map<string, number>
): { lines: DraftLine[]; groups: Group[] } {
  const lines = saved.map((line) => ({
    key: nextKey(),
    itemId: line.itemId ?? undefined,
    name: line.name,
    unit: line.unit,
    price: String(line.price),
    qty: String(line.qty),
    stock: line.itemId ? stock?.get(line.itemId) : undefined,
  }))
  const byPercent = new Map<number, string[]>()
  saved.forEach((line, index) => {
    if (!line.discountPct) return
    byPercent.set(line.discountPct, [
      ...(byPercent.get(line.discountPct) ?? []),
      lines[index].key,
    ])
  })
  const groups = [...byPercent].map(([percent, keys]) => ({
    key: nextKey(),
    percent: String(percent),
    lines: keys,
  }))
  return { lines, groups }
}

export function LineItemsEditor({
  fromInventory,
  lines,
  setLines,
  groups,
  setGroups,
  available,
  stockPending,
  error,
  onEdit,
}: {
  fromInventory: boolean
  lines: DraftLine[]
  setLines: React.Dispatch<React.SetStateAction<DraftLine[]>>
  groups: Group[]
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  /** The items in stock, for an inventory form. */
  available: ItemDTO[]
  stockPending: boolean
  error?: string
  /** Any change to the lines: the parent clears its "lines" message. */
  onEdit: () => void
}) {
  // The line just added by hand, which takes the cursor.
  const [added, setAdded] = React.useState<string | null>(null)
  // "+ New item": made in a dialog over the form, then added as a line.
  const [newItem, setNewItem] = React.useState(false)

  /** A line's discount is the percentage of whichever group holds it. */
  const percentOf = (key: string) => linePercent(groups, key)

  function addCustomLine() {
    const line = blankLine()
    setAdded(line.key)
    setLines((prev) => [...prev, line])
    onEdit()
  }

  /** `fresh`: an item just created inline, not in the loaded list yet. */
  function addStockLine(itemId: string, fresh?: ItemDTO) {
    const item = fresh ?? available.find((entry) => entry.id === itemId)
    if (!item) return
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        price: String(item.price),
        qty: "1",
        stock: item.stock,
      },
    ])
    onEdit()
  }

  function setLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
    onEdit()
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key))
    // A discount can't keep pointing at a line that is gone.
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        lines: group.lines.filter((entry) => entry !== key),
      }))
    )
  }

  function toggleInGroup(groupKey: string, lineKey: string) {
    const target = groups.find((group) => group.key === groupKey)
    const adding = !target?.lines.includes(lineKey)

    setGroups((prev) =>
      prev.map((group) => {
        if (group.key === groupKey) {
          return {
            ...group,
            lines: adding
              ? [...group.lines, lineKey]
              : group.lines.filter((entry) => entry !== lineKey),
          }
        }
        // One discount per line: taking it here releases it there.
        return adding
          ? {
              ...group,
              lines: group.lines.filter((entry) => entry !== lineKey),
            }
          : group
      })
    )
  }

  function selectAll(groupKey: string) {
    const all = lines.map((line) => line.key)
    setGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? { ...group, lines: all }
          : { ...group, lines: [] }
      )
    )
  }

  /** Enter on the last custom line adds another, as a till would. */
  function enterAddsLine(index: number) {
    return (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return
      event.preventDefault()
      if (index === lines.length - 1) addCustomLine()
    }
  }

  return (
    <>
      {/* ---- lines ---- */}
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldLabel>Items</FieldLabel>
          {fromInventory ? (
            <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {stockPending ? (
                <Skeleton className="h-9 w-52 rounded-md" />
              ) : (
                <select
                  value=""
                  onChange={(event) => {
                    addStockLine(event.target.value)
                    event.target.value = ""
                  }}
                  aria-label="Add an item from stock"
                  className={cn(
                    inputClass,
                    "w-full cursor-pointer py-2 text-[13.5px] sm:w-[280px]"
                  )}
                >
                  <option value="">Add an item from stock…</option>
                  {available.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {money(item.price)} / {item.unit} ·{" "}
                      {quantity(item.stock)} left
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setNewItem(true)}
                className="text-p-600 text-[12.5px] font-semibold"
              >
                + New item
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={addCustomLine}
              className="text-p-600 text-[12.5px] font-semibold"
            >
              + Add line
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="border-n-300 text-n-500 rounded-md border border-dashed bg-white px-4 py-6 text-center text-[13px]">
            {fromInventory
              ? available.length === 0 && !stockPending
                ? "There is nothing in the inventory yet. Add stock first, or raise a custom bill."
                : "Nothing on the bill yet. Add an item from stock above."
              : "Nothing on the bill yet."}
          </div>
        ) : (
          <div className="border-n-200 overflow-hidden rounded-[10px] border bg-white">
            <div className="border-n-200 bg-n-100 hidden grid-cols-[1.6fr_90px_110px_100px_110px_36px] gap-2 border-b px-3 py-2 lg:grid">
              {["ITEM", "QTY", "RATE", "DISC", "AMOUNT", ""].map((head) => (
                <span
                  key={head}
                  className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                >
                  {head}
                </span>
              ))}
            </div>

            {lines.map((line, index) => {
              const pct = percentOf(line.key)
              const gross = (Number(line.price) || 0) * (Number(line.qty) || 0)
              // A line filled in from an estimate learns its stock once the
              // items have loaded.
              const inStock =
                line.stock ??
                available.find((item) => item.id === line.itemId)?.stock
              const short =
                inStock !== undefined && (Number(line.qty) || 0) > inStock

              return (
                <div
                  key={line.key}
                  className="border-n-200/70 grid gap-2 border-b px-3 py-2.5 lg:grid-cols-[1.6fr_90px_110px_100px_110px_36px] lg:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    {line.itemId ? (
                      <>
                        <span className="truncate text-[13.5px] font-semibold">
                          {index + 1}. {line.name}
                        </span>
                        <span
                          className={cn(
                            "text-[11.5px]",
                            short ? "text-s-overdue" : "text-n-500"
                          )}
                        >
                          {short
                            ? `only ${quantity(inStock ?? 0)} ${line.unit} in stock`
                            : `${quantity(inStock ?? 0)} ${line.unit} in stock`}
                        </span>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          autoFocus={line.key === added}
                          onKeyDown={enterAddsLine(index)}
                          value={line.name}
                          onChange={(event) =>
                            setLine(line.key, { name: event.target.value })
                          }
                          placeholder={`Item ${index + 1}`}
                          className={cn(
                            inputClass,
                            "w-full py-2 text-[13.5px]"
                          )}
                        />
                        <input
                          value={line.unit}
                          onChange={(event) =>
                            setLine(line.key, { unit: event.target.value })
                          }
                          placeholder="pcs"
                          className={cn(
                            inputClass,
                            "w-[74px] py-2 text-[13.5px]"
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={line.qty}
                    onKeyDown={line.itemId ? undefined : enterAddsLine(index)}
                    onChange={(event) =>
                      setLine(line.key, { qty: event.target.value })
                    }
                    aria-label={`Quantity for line ${index + 1}`}
                    className={cn(inputClass, "py-2 text-[13.5px]")}
                  />

                  {line.itemId ? (
                    <span className="text-n-700 font-mono text-[13px] lg:text-right">
                      {money(Number(line.price) || 0)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={line.price}
                      onKeyDown={enterAddsLine(index)}
                      onChange={(event) =>
                        setLine(line.key, { price: event.target.value })
                      }
                      aria-label={`Price per piece for line ${index + 1}`}
                      placeholder="0"
                      className={cn(inputClass, "py-2 text-[13.5px]")}
                    />
                  )}

                  <span
                    className={cn(
                      "font-mono text-[13px] lg:text-right",
                      pct > 0 ? "text-p-700 font-semibold" : "text-n-400"
                    )}
                  >
                    {pct > 0 ? `${quantity(pct)}%` : "—"}
                  </span>

                  <span className="font-mono text-[13px] font-semibold lg:text-right">
                    {money(gross - (gross * pct) / 100)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`Remove line ${index + 1}`}
                    className="text-n-400 hover:text-s-overdue justify-self-start text-[13px] lg:justify-self-end"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <FieldError message={error} />
      </section>

      {/* ---- discounts ---- */}
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldLabel>Discounts</FieldLabel>
          <button
            type="button"
            onClick={() =>
              setGroups((prev) => [
                ...prev,
                { key: nextKey(), percent: "", lines: [] },
              ])
            }
            disabled={lines.length === 0}
            className="text-p-600 text-[12.5px] font-semibold disabled:opacity-50"
          >
            + Add discount
          </button>
        </div>

        <p className="text-n-500 m-0 text-[12.5px]">
          Write a percentage, then tick the lines it applies to. Add a second
          discount for a different set — each line carries one, so ticking it
          here takes it off the other.
        </p>

        {groups.map((group, index) => (
          <div
            key={group.key}
            className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={group.percent}
                  onChange={(event) =>
                    setGroups((prev) =>
                      prev.map((entry) =>
                        entry.key === group.key
                          ? { ...entry, percent: event.target.value }
                          : entry
                      )
                    )
                  }
                  aria-label={`Discount ${index + 1} percent`}
                  placeholder="20"
                  className={cn(inputClass, "w-[86px] py-2 text-[13.5px]")}
                />
                <span className="text-n-600 text-[13.5px] font-semibold">
                  % off
                </span>
              </div>

              <button
                type="button"
                onClick={() => selectAll(group.key)}
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) =>
                    prev.map((entry) =>
                      entry.key === group.key ? { ...entry, lines: [] } : entry
                    )
                  )
                }
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) =>
                    prev.filter((entry) => entry.key !== group.key)
                  )
                }
                className="text-n-500 hover:text-s-overdue ml-auto text-[12.5px] font-semibold"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {lines.map((line, lineIndex) => {
                const mine = group.lines.includes(line.key)
                const takenElsewhere =
                  !mine &&
                  groups.some(
                    (entry) =>
                      entry.key !== group.key && entry.lines.includes(line.key)
                  )

                return (
                  <button
                    key={line.key}
                    type="button"
                    onClick={() => toggleInGroup(group.key, line.key)}
                    aria-pressed={mine}
                    className={cn(
                      "max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      mine
                        ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                        : takenElsewhere
                          ? "border-n-200 text-n-400 bg-n-100 font-medium"
                          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                    )}
                  >
                    {lineIndex + 1}. {line.name || "Untitled"}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>
      {fromInventory ? (
        <ItemDialog
          open={newItem}
          onClose={() => setNewItem(false)}
          onCreated={(item) => addStockLine(item.id, item)}
        />
      ) : null}
    </>
  )
}

export function Total({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "text-[12.5px]",
          strong ? "font-heading text-[14px] font-semibold" : "text-n-600"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "text-[17px] font-semibold" : "text-[13px]"
        )}
      >
        {money(value)}
      </span>
    </div>
  )
}

export function blankLine(): DraftLine {
  return { key: nextKey(), name: "", unit: "pcs", price: "", qty: "1" }
}
