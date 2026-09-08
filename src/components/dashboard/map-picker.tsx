"use client"

import * as React from "react"
import "leaflet/dist/leaflet.css"
import type * as LeafletTypes from "leaflet"
import { cn } from "cn"

import { formatDistance } from "@/lib/geo"
import { LocationError, getCurrentFix } from "@/lib/geolocation"

/** Kathmandu, so a fresh workspace opens somewhere rather than mid-ocean. */
const FALLBACK = { lat: 27.7172, lng: 85.324 }

export type Pin = { lat: number; lng: number }

/**
 * Drops the geofence marker on an OpenStreetMap tile layer. Leaflet touches
 * `window` at import time, so it's loaded inside an effect rather than at the
 * top of the module — and the marker is a `divIcon` so no image assets have to
 * resolve through the bundler.
 */
export function MapPicker({
  value,
  radiusM,
  onChange,
  className,
}: {
  value: Pin | null
  radiusM: number
  onChange: (pin: Pin) => void
  className?: string
}) {
  const holder = React.useRef<HTMLDivElement | null>(null)
  const map = React.useRef<LeafletTypes.Map | null>(null)
  const marker = React.useRef<LeafletTypes.Marker | null>(null)
  const fence = React.useRef<LeafletTypes.Circle | null>(null)
  const leaflet = React.useRef<typeof LeafletTypes | null>(null)

  const [ready, setReady] = React.useState(false)
  const [locating, setLocating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // `onChange` is re-created every render; a ref keeps the effect from
  // tearing the map down and rebuilding it on each keystroke elsewhere.
  const emit = React.useRef(onChange)
  React.useEffect(() => {
    emit.current = onChange
  }, [onChange])

  React.useEffect(() => {
    let cancelled = false

    import("leaflet").then((mod) => {
      const L = (mod.default ?? mod) as typeof LeafletTypes
      if (cancelled || !holder.current || map.current) return

      leaflet.current = L
      const start = value ?? FALLBACK

      const instance = L.map(holder.current, {
        center: [start.lat, start.lng],
        zoom: value ? 17 : 13,
        attributionControl: true,
      })

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(instance)

      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0e7c7b;border:2px solid #fff;box-shadow:0 4px 10px rgba(27,24,21,.35)"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      })

      const pin = L.marker([start.lat, start.lng], { icon, draggable: true })
      const circle = L.circle([start.lat, start.lng], {
        radius: radiusM,
        color: "#0e7c7b",
        weight: 1.5,
        fillColor: "#0e7c7b",
        fillOpacity: 0.12,
      })

      if (value) {
        pin.addTo(instance)
        circle.addTo(instance)
      }

      const place = (lat: number, lng: number) => {
        pin.setLatLng([lat, lng])
        circle.setLatLng([lat, lng])
        if (!instance.hasLayer(pin)) pin.addTo(instance)
        if (!instance.hasLayer(circle)) circle.addTo(instance)
        emit.current({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) })
      }

      instance.on("click", (event: LeafletTypes.LeafletMouseEvent) => {
        place(event.latlng.lat, event.latlng.lng)
      })
      pin.on("dragend", () => {
        const at = pin.getLatLng()
        place(at.lat, at.lng)
      })

      map.current = instance
      marker.current = pin
      fence.current = circle

      // The dialog animates in, so the container has no size on first paint.
      setTimeout(() => instance.invalidateSize(), 60)
      setReady(true)
    })

    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      marker.current = null
      fence.current = null
    }
    // Built once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the drawn fence in step with the radius field.
  React.useEffect(() => {
    fence.current?.setRadius(radiusM)
  }, [radiusM])

  // Follow a value set from outside (the "use my location" button).
  React.useEffect(() => {
    if (!value || !map.current || !marker.current || !fence.current) return
    marker.current.setLatLng([value.lat, value.lng])
    fence.current.setLatLng([value.lat, value.lng])
    if (!map.current.hasLayer(marker.current)) marker.current.addTo(map.current)
    if (!map.current.hasLayer(fence.current)) fence.current.addTo(map.current)
  }, [value])

  async function jumpToMe() {
    setLocating(true)
    setError(null)
    try {
      const fix = await getCurrentFix()
      map.current?.setView([fix.lat, fix.lng], 17)
      onChange({ lat: Number(fix.lat.toFixed(6)), lng: Number(fix.lng.toFixed(6)) })
    } catch (caught) {
      setError(
        caught instanceof LocationError
          ? caught.message
          : "Could not read your location."
      )
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="border-n-300 relative overflow-hidden rounded-lg border">
        <div
          ref={holder}
          className="h-[240px] w-full"
          // Leaflet's panes sit above the dialog's stacking context otherwise.
          style={{ zIndex: 0 }}
        />
        {!ready ? (
          <div className="bg-n-100 text-n-500 absolute inset-0 flex items-center justify-center text-[13px]">
            Loading map…
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-n-500 text-[12.5px]">
          {value ? (
            <>
              Pinned at{" "}
              <span className="font-mono">
                {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
              </span>{" "}
              · fence {formatDistance(radiusM)}
            </>
          ) : (
            "Tap the map to drop the check-in marker."
          )}
        </span>
        <button
          type="button"
          onClick={() => void jumpToMe()}
          disabled={locating}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-60"
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>

      {error ? (
        <span className="text-s-overdue text-[12.5px]">{error}</span>
      ) : null}
    </div>
  )
}
