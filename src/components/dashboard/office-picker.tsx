"use client"

import * as React from "react"
import { cn } from "cn"

import { FieldLabel, inputClass } from "@/components/auth/field"
import { MapPicker, type Pin } from "@/components/dashboard/map-picker"
import { AWAY_RADIUS_M, OFFICE_RADIUS_M } from "@/lib/work-constants"

export type OfficeValue = {
  lat: number
  lng: number
  label?: string
  radiusM: number
  awayRadiusM: number
}

/**
 * Where the office is, and how far from it a shift may be opened without
 * explanation. Shared by sign-up and settings; sign-up hides the two rings
 * and lets them default, since nobody wants to tune metres on day one.
 */
export function OfficePicker({
  value,
  onChange,
  showRings = true,
  className,
}: {
  value: OfficeValue | null
  onChange: (next: OfficeValue | null) => void
  showRings?: boolean
  className?: string
}) {
  const pin: Pin | null = value ? { lat: value.lat, lng: value.lng } : null

  const handlePin = React.useCallback(
    (next: Pin) => {
      onChange({
        radiusM: OFFICE_RADIUS_M,
        awayRadiusM: AWAY_RADIUS_M,
        ...value,
        lat: next.lat,
        lng: next.lng,
      })
    },
    [onChange, value]
  )

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <MapPicker
        value={pin}
        radiusM={value?.radiusM ?? OFFICE_RADIUS_M}
        outerRadiusM={value?.awayRadiusM ?? AWAY_RADIUS_M}
        onChange={handlePin}
      />

      {value ? (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>What this place is called</FieldLabel>
              <input
                value={value.label ?? ""}
                onChange={(event) =>
                  onChange({ ...value, label: event.target.value })
                }
                placeholder="Optional — e.g. Balaju head office"
                className={inputClass}
              />
            </label>

            {showRings ? (
              <div className="grid grid-cols-2 gap-3.5">
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>At the office</FieldLabel>
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    aria-label="Office radius in metres"
                    value={value.radiusM}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        radiusM: Number(event.target.value) || 0,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>Reason beyond</FieldLabel>
                  <input
                    type="number"
                    min={20}
                    max={20000}
                    aria-label="Reason required beyond, in metres"
                    value={value.awayRadiusM}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        awayRadiusM: Number(event.target.value) || 0,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-n-500 text-[12.5px]">
              {showRings ? (
                <>
                  Inside {value.radiusM} m counts as at the office. Past{" "}
                  {value.awayRadiusM} m, starting a shift asks why.
                </>
              ) : (
                <>
                  Shifts started more than {AWAY_RADIUS_M} m away will ask why.
                  You can change that in settings.
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-n-500 hover:text-s-overdue text-[12.5px] font-semibold"
            >
              Remove the office
            </button>
          </div>
        </>
      ) : (
        <span className="text-n-500 text-[12.5px]">
          Optional. Drop a pin and shifts started away from it have to say why
          — leave it empty and they can be started from anywhere.
        </span>
      )}
    </div>
  )
}
