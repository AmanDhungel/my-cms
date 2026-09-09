"use client"

import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { shiftLength } from "@/lib/validations/auth"

/**
 * The two ends of a working day, with the length shown once both are set.
 * The end-after-start rule is enforced by the schema; this just reports it.
 */
export function ShiftPicker({
  start,
  end,
  onStart,
  onEnd,
  error,
  disabled,
}: {
  start: string
  end: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
  error?: string
  disabled?: boolean
}) {
  const length = shiftLength(start, end)

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>Shift</FieldLabel>
        <span
          className={cn(
            "font-mono text-[11px]",
            length ? "text-p-600" : "text-n-400"
          )}
        >
          {length ? `${length} shift` : "set both ends"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="time"
          aria-label="Shift start"
          value={start}
          disabled={disabled}
          onChange={(event) => onStart(event.target.value)}
          className={cn(inputClass, "flex-1", disabled && "bg-n-100 text-n-600")}
        />
        <span className="text-n-400 text-[13px]">to</span>
        <input
          type="time"
          aria-label="Shift end"
          value={end}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => onEnd(event.target.value)}
          className={cn(inputClass, "flex-1", disabled && "bg-n-100 text-n-600")}
        />
      </div>

      <FieldError message={error} />
    </div>
  )
}
