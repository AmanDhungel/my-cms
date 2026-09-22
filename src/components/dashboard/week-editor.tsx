"use client"

import * as React from "react"
import { cn } from "cn"

import { inputClass } from "@/components/auth/field"
import { describeWeek, suggestedWeek, type WeekPattern } from "@/lib/week"
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/work-constants"

/**
 * A repeating week, seven rows deep. Used twice: once in settings for the
 * workspace's standard week, and once on a person who keeps different hours.
 *
 * Turning a day off drops its hours rather than hiding them, so a rest day
 * can never carry times that something else later reads as a shift.
 */
export function WeekEditor({
  value,
  onChange,
  /** Seeds the "start from" button — the workspace's week, or a shift string. */
  suggestFrom,
  className,
}: {
  value: WeekPattern | null
  onChange: (next: WeekPattern | null) => void
  suggestFrom?: WeekPattern | string | null
  className?: string
}) {
  if (!value) {
    return (
      <div className={cn("flex flex-col gap-2.5", className)}>
        <span className="text-n-500 text-[12.5px] leading-relaxed">
          No repeating week set. Without one, every past day with no attendance
          reads as an absence — weekends included.
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(
              Array.isArray(suggestFrom)
                ? suggestFrom.map((day) => ({ ...day }))
                : suggestedWeek(typeof suggestFrom === "string" ? suggestFrom : null)
            )
          }
          className="border-n-300 text-n-700 hover:bg-n-100 w-fit rounded-md border bg-white px-3.5 py-2 text-[13px] font-semibold"
        >
          Set a week
        </button>
      </div>
    )
  }

  function setDay(index: number, patch: Partial<WeekPattern[number]>) {
    onChange(
      value!.map((day, i) => (i === index ? { ...day, ...patch } : day))
    )
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="border-n-200 overflow-hidden rounded-[10px] border bg-white">
        {value.map((day, index) => {
          const working = day.kind === "work"

          return (
            <div
              key={WEEKDAYS[index]}
              className={cn(
                "border-n-200/70 grid items-center gap-3 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[92px_130px_1fr]",
                !working && "bg-n-100/60"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11.5px] tracking-[0.06em]",
                  working ? "text-n-700" : "text-n-400"
                )}
              >
                {WEEKDAYS_SHORT[index]}
              </span>

              <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
                {(["work", "off"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-label={`${WEEKDAYS[index]} ${kind === "work" ? "working" : "off"}`}
                    aria-pressed={day.kind === kind}
                    onClick={() =>
                      setDay(
                        index,
                        kind === "off"
                          ? { kind: "off", startTime: null, endTime: null }
                          : {
                              kind: "work",
                              // Falls back to whatever the week's other days
                              // do, so turning a day back on is one click.
                              startTime: day.startTime ?? firstStart(value) ?? "09:00",
                              endTime: day.endTime ?? firstEnd(value) ?? "17:00",
                            }
                      )
                    }
                    className={cn(
                      "rounded-[5px] px-2.5 py-1 text-[12px] capitalize transition-colors",
                      day.kind === kind
                        ? kind === "work"
                          ? "bg-p-100 text-p-700 font-semibold"
                          : "bg-n-200 text-n-700 font-semibold"
                        : "text-n-500 hover:bg-n-100 font-medium"
                    )}
                  >
                    {kind === "work" ? "Working" : "Off"}
                  </button>
                ))}
              </div>

              {working ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.startTime ?? ""}
                    aria-label={`${WEEKDAYS[index]} start`}
                    onChange={(event) =>
                      setDay(index, { startTime: event.target.value })
                    }
                    className={cn(inputClass, "w-auto py-1.5 text-[12.5px]")}
                  />
                  <span className="text-n-400 text-[12px]">to</span>
                  <input
                    type="time"
                    value={day.endTime ?? ""}
                    aria-label={`${WEEKDAYS[index]} end`}
                    onChange={(event) =>
                      setDay(index, { endTime: event.target.value })
                    }
                    className={cn(inputClass, "w-auto py-1.5 text-[12.5px]")}
                  />
                  {index === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          value.map((other) =>
                            other.kind === "work"
                              ? {
                                  ...other,
                                  startTime: day.startTime,
                                  endTime: day.endTime,
                                }
                              : other
                          )
                        )
                      }
                      className="text-p-600 hover:text-p-700 ml-1 text-[12px] font-semibold"
                    >
                      Copy to all
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="text-n-400 text-[12.5px]">
                  Rest day — nothing expected, nothing counted against them.
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-n-500 text-[12.5px]">{describeWeek(value)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-n-500 hover:text-s-overdue text-[12.5px] font-semibold"
        >
          Remove the week
        </button>
      </div>
    </div>
  )
}

/** A label for a week that is being followed rather than edited. */
export function WeekSummary({ week }: { week: WeekPattern | null }) {
  return (
    <div className="border-n-200 flex flex-wrap gap-1.5 rounded-[10px] border bg-white px-3 py-2.5">
      {(week ?? []).map((day, index) => (
        <span
          key={WEEKDAYS[index]}
          className={cn(
            "rounded-md border px-2 py-1 font-mono text-[10.5px]",
            day.kind === "work"
              ? "border-p-200 bg-p-100 text-p-700"
              : "border-n-300 text-n-500 bg-n-100"
          )}
          title={
            day.kind === "work"
              ? `${WEEKDAYS[index]} ${day.startTime}–${day.endTime}`
              : `${WEEKDAYS[index]} off`
          }
        >
          {WEEKDAYS_SHORT[index]}
        </span>
      ))}
      {week ? null : (
        <span className="text-n-500 text-[12.5px]">
          No standard week set for this workspace yet.
        </span>
      )}
    </div>
  )
}

function firstStart(week: WeekPattern) {
  return week.find((day) => day.kind === "work" && day.startTime)?.startTime
}

function firstEnd(week: WeekPattern) {
  return week.find((day) => day.kind === "work" && day.endTime)?.endTime
}

/** Re-exported so callers don't import from two places to build a default. */
export { suggestedWeek }
