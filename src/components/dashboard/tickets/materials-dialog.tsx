"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldLabel, inputClass } from "@/components/auth/field"
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
import { money, quantity } from "@/lib/billing"
import {
  reportMutationError,
  useInventoryItems,
  useTicketMaterials,
} from "@/lib/queries"
import { ticketMaterialsSchema } from "@/lib/validations/work"
import type { TicketDTO } from "@/models/ticket"

/** A line being typed, where every number is still a string. */
type Draft = {
  key: string
  itemId: string
  name: string
  unit: string
  qty: string
  unitCost: string
}

let seq = 0
const nextKey = () => `mat-${(seq += 1)}`

/**
 * Writing up what a job used.
 *
 * An item can be picked off the shelf or simply named — a roll of tape bought
 * on the way is still material the job consumed, and a form that refused it
 * would just mean it never gets recorded. Picking one takes its cost from
 * stock, so the total is what the job actually cost rather than a guess.
 *
 * Recording this does not move the shelf. The same items are usually billed
 * to the customer, and taking them off here as well would count one cable
 * twice.
 */
export function MaterialsDialog({
  ticket,
  open,
  onClose,
}: {
  ticket: TicketDTO
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[620px] sm:p-6"
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            What did this job use?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {ticket.title}
          </DialogDescription>
        </DialogHeader>
        {/* Remounted on each open, so the form never shows stale input. */}
        {open ? <Body ticket={ticket} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  ticket,
  onClose,
}: {
  ticket: TicketDTO
  onClose: () => void
}) {
  const [lines, setLines] = React.useState<Draft[]>(() =>
    ticket.materials.map((one) => ({
      key: nextKey(),
      itemId: one.itemId ?? "",
      name: one.name,
      unit: one.unit,
      qty: String(one.qty),
      unitCost: String(one.unitCost),
    }))
  )
  const [error, setError] = React.useState<string | null>(null)

  const stock = useInventoryItems()
  const mutation = useTicketMaterials(ticket.id)
  const available = stock.data?.items ?? []

  function addFromStock(itemId: string) {
    const item = available.find((one) => one.id === itemId)
    if (!item) return
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        qty: "1",
        unitCost: String(item.costPrice ?? 0),
      },
    ])
    setError(null)
  }

  function addByHand() {
    setLines((prev) => [
      ...prev,
      { key: nextKey(), itemId: "", name: "", unit: "pcs", qty: "1", unitCost: "0" },
    ])
  }

  function set(key: string, patch: Partial<Draft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
    setError(null)
  }

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unitCost) || 0),
    0
  )

  function submit() {
    if (mutation.isPending) return

    const parsed = ticketMaterialsSchema.safeParse({
      materials: lines.map((line) => ({
        itemId: line.itemId || undefined,
        name: line.name,
        unit: line.unit || "pcs",
        qty: line.qty || 0,
        unitCost: line.unitCost || 0,
      })),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the lines")
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(
          lines.length === 0 ? "Materials cleared" : "Materials recorded"
        )
        onClose()
      },
      onError: (mutationError) =>
        reportMutationError(mutationError, (_path, message) =>
          setError(message)
        ),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Add from stock</FieldLabel>
            <select
              value=""
              disabled={stock.isPending}
              onChange={(event) => {
                if (event.target.value) addFromStock(event.target.value)
              }}
              aria-label="Add an item from stock"
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">
                {stock.isPending ? "Loading the stock list…" : "Pick an item…"}
              </option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {quantity(item.stock)} {item.unit} on the shelf
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={addByHand}
            className="border-n-300 text-n-700 hover:bg-n-100 h-[42px] self-end rounded-md border bg-white px-3.5 text-[13px] font-semibold"
          >
            Something else
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-n-500 m-0 py-3 text-[13px]">
            Nothing recorded yet. Add whatever the job got through — it is what
            tells your owner what this ticket cost.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <div
                key={line.key}
                data-material-row
                className="border-n-200/70 grid items-end gap-2 border-b pb-2 last:border-0 sm:grid-cols-[1fr_72px_66px_92px_34px]"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    ITEM
                  </span>
                  <input
                    value={line.name}
                    readOnly={Boolean(line.itemId)}
                    onChange={(event) => set(line.key, { name: event.target.value })}
                    placeholder="What was used"
                    aria-label="Item"
                    className={cn(
                      inputClass,
                      "h-[36px] py-1 text-[13px]",
                      line.itemId && "bg-n-50 text-n-600"
                    )}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    QTY
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={line.qty}
                    onChange={(event) => set(line.key, { qty: event.target.value })}
                    aria-label="Quantity"
                    className={cn(inputClass, "h-[36px] py-1 text-[13px]")}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    UNIT
                  </span>
                  <input
                    value={line.unit}
                    readOnly={Boolean(line.itemId)}
                    onChange={(event) => set(line.key, { unit: event.target.value })}
                    aria-label="Unit"
                    className={cn(
                      inputClass,
                      "h-[36px] py-1 text-[13px]",
                      line.itemId && "bg-n-50 text-n-600"
                    )}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    {line.itemId ? "COST EACH" : "COST EACH"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    readOnly={Boolean(line.itemId)}
                    onChange={(event) =>
                      set(line.key, { unitCost: event.target.value })
                    }
                    aria-label="Cost each"
                    className={cn(
                      inputClass,
                      "h-[36px] py-1 text-[13px]",
                      line.itemId && "bg-n-50 text-n-600"
                    )}
                  />
                </label>

                <button
                  type="button"
                  aria-label={`Remove ${line.name || "line"}`}
                  onClick={() =>
                    setLines((prev) => prev.filter((one) => one.key !== line.key))
                  }
                  className="text-n-400 hover:bg-n-100 hover:text-s-overdue h-[36px] rounded-md px-2 text-[16px] leading-none"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="border-n-200 flex items-center justify-between border-t pt-2">
              <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
                WHAT IT COST
              </span>
              <span className="font-mono text-[14px] font-semibold tabular-nums">
                {money(Math.round(total * 100) / 100)}
              </span>
            </div>
          </div>
        )}

        {error ? (
          <p className="text-s-overdue m-0 text-[12.5px]">{error}</p>
        ) : null}

        <p className="text-n-500 m-0 text-[12px] leading-relaxed">
          This records what the job used. It does not take the items off the
          shelf — bill them to the customer to do that.
        </p>
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
          {mutation.isPending ? "Saving…" : "Save materials"}
        </button>
      </DialogFooter>
    </>
  )
}
