"use client"

import * as React from "react"
import { cn } from "cn"

import type { ReportChartData } from "@/lib/reports"

/**
 * The two series colours, snapped to passing steps of the app's own ramps.
 *
 * `#35a79c` is p-400 and `#c87f0f` is a-500. The brand's p-500 was the obvious
 * first choice and fails the chroma floor — at that darkness the hue reads as
 * grey — and every darker teal that clears 3:1 contrast fails it too, so the
 * pair below is the closest passing pick from the same ramps.
 *
 * Validated (light, surface #ffffff): lightness band, chroma floor, CVD
 * separation (worst adjacent ΔE 15.0 protan) and normal-vision separation
 * (ΔE 20.7) all pass. Contrast for the teal is 2.93:1, a WARN whose documented
 * relief is visible labels or a table view — every chart here sits directly
 * above the report's full table, so that relief always holds.
 */
const SERIES = ["#35a79c", "#c87f0f"] as const

const GRID = "#e4e1da" // n-200
const AXIS_TEXT = "#78715f" // n-500
const LABEL_TEXT = "#423d33" // n-700

const BAR_MAX = 24
const RADIUS = 4
// The right gutter carries half of the last axis label plus the value that
// rides a bar's tip, so it is wider than the left.
const PAD = { top: 16, right: 30, bottom: 34, left: 52 }

/**
 * Every report's chart. The server decides the shape, so a new report is a
 * query and a descriptor rather than another bespoke chart that drifts from
 * the table beneath it.
 */
export function ReportChart({
  chart,
  limit,
}: {
  chart: ReportChartData
  /** Trims a ranking chart for a card. The full set is on the report. */
  limit?: number
}) {
  const [box, setBox] = React.useState<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(720)
  const [hover, setHover] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!box) return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(Math.max(320, Math.round(next)))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])

  const horizontal = chart.kind === "bar"
  // Ranking charts are already sorted biggest-first, so a limit takes the
  // head. A chart over time is never trimmed — cutting a time axis short
  // would change what it says.
  const trimmed =
    limit && chart.kind === "bar" && chart.labels.length > limit
      ? {
          ...chart,
          labels: chart.labels.slice(0, limit),
          series: chart.series.map((one) => ({
            ...one,
            values: one.values.slice(0, limit),
          })),
        }
      : chart

  const count = trimmed.labels.length
  const series = trimmed.series

  // Horizontal charts grow with their rows; columns keep a fixed sky.
  const height = horizontal
    ? Math.max(170, PAD.top + PAD.bottom + count * 30)
    : 260

  const gutter = horizontal ? Math.min(180, Math.max(90, width * 0.26)) : PAD.left
  /**
   * How many characters actually fit in the label gutter.
   *
   * The text is anchored to the gutter's right edge, so an over-long label
   * does not overflow harmlessly — it runs off the left of the viewport and
   * loses its first letters, which is worse than no label at all. 6.6px is a
   * deliberately pessimistic width for 11px text, and the 12 is the padding
   * either side.
   */
  const labelChars = Math.max(6, Math.floor((gutter - 12) / 6.6))
  const plotLeft = horizontal ? gutter : PAD.left
  const plotWidth = Math.max(40, width - plotLeft - PAD.right)
  const plotTop = PAD.top
  // Both orientations keep the full bottom gutter: the axis row lives there,
  // and a plot that ate it drew its last bar straight through the labels.
  const plotHeight = Math.max(40, height - PAD.top - PAD.bottom)

  const max = Math.max(
    1,
    ...series.flatMap((one) => one.values.map((value) => Math.abs(value)))
  )
  const ticks = niceTicks(max)
  const scaleMax = ticks[ticks.length - 1]

  if (count === 0) return null

  return (
    <div
      ref={setBox}
      className="relative w-full"
      onMouseLeave={() => setHover(null)}
    >
      {series.length > 1 ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((one, index) => (
            <span
              key={one.label}
              className="text-n-600 flex items-center gap-1.5 text-[12px]"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ background: SERIES[index % SERIES.length] }}
              />
              {one.label}
            </span>
          ))}
        </div>
      ) : null}

      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${trimmed.caption ?? "Chart"} — the same figures are in the table below.`}
        className="block"
      >
        {/* Gridlines: hairline, solid, one step off the surface. */}
        {ticks.map((tick) => {
          const at = tick / scaleMax
          return horizontal ? (
            <g key={tick}>
              <line
                x1={plotLeft + at * plotWidth}
                x2={plotLeft + at * plotWidth}
                y1={plotTop}
                y2={plotTop + plotHeight}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={plotLeft + at * plotWidth}
                y={height - 12}
                textAnchor="middle"
                fontSize={10.5}
                fill={AXIS_TEXT}
                fontFamily="var(--font-mono, monospace)"
              >
                {shortNumber(tick)}
              </text>
            </g>
          ) : (
            <g key={tick}>
              <line
                x1={plotLeft}
                x2={plotLeft + plotWidth}
                y1={plotTop + (1 - at) * plotHeight}
                y2={plotTop + (1 - at) * plotHeight}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={plotLeft - 8}
                y={plotTop + (1 - at) * plotHeight + 3.5}
                textAnchor="end"
                fontSize={10.5}
                fill={AXIS_TEXT}
                fontFamily="var(--font-mono, monospace)"
              >
                {shortNumber(tick)}
              </text>
            </g>
          )
        })}

        {trimmed.labels.map((label, index) => {
          const band = (horizontal ? plotHeight : plotWidth) / count
          const thickness = Math.min(BAR_MAX, Math.max(4, band / series.length - 3))
          // The band's leftover is air, and the -3 above leaves the 2px
          // surface gap between neighbours without drawing anything.
          const groupSize = thickness * series.length
          const bandStart =
            (horizontal ? plotTop : plotLeft) + band * index + (band - groupSize) / 2
          const active = hover === index

          return (
            <g key={`${label}-${index}`}>
              {series.map((one, s) => {
                const value = one.values[index] ?? 0
                const ratio = Math.abs(value) / scaleMax
                const colour = SERIES[s % SERIES.length]
                const at = bandStart + thickness * s

                return horizontal ? (
                  <path
                    key={one.label}
                    d={barPath(
                      plotLeft,
                      at,
                      Math.max(0, ratio * plotWidth),
                      thickness,
                      RADIUS
                    )}
                    fill={colour}
                    opacity={hover === null || active ? 1 : 0.55}
                  />
                ) : (
                  <path
                    key={one.label}
                    d={columnPath(
                      at,
                      plotTop + plotHeight,
                      thickness,
                      Math.max(0, ratio * plotHeight),
                      RADIUS
                    )}
                    fill={colour}
                    opacity={hover === null || active ? 1 : 0.55}
                  />
                )
              })}

              {/*
                A full-band hit target, painted AFTER the marks so it is the
                thing the pointer actually meets — behind them the bars
                swallow every event and the tooltip never fires. Transparent,
                so the highlight is carried by the marks dimming instead.
              */}
              <rect
                x={horizontal ? plotLeft : plotLeft + band * index}
                y={horizontal ? plotTop + band * index : plotTop}
                width={horizontal ? plotWidth : band}
                height={horizontal ? band : plotHeight}
                fill="transparent"
                style={{ pointerEvents: "all" }}
                onMouseEnter={() => setHover(index)}
              />

              {/* Labels: on a bar chart the value rides the tip; on a column
                  chart only the tallest is labelled and the axis carries the
                  rest, so the plot never fills with numbers. */}
              {horizontal ? (
                <>
                  <text
                    x={plotLeft - 8}
                    y={bandStart + groupSize / 2 + 3.5}
                    textAnchor="end"
                    fontSize={11}
                    fill={LABEL_TEXT}
                  >
                    {truncate(prettyLabel(label), labelChars)}
                  </text>
                  <text
                    x={
                      plotLeft +
                      Math.abs(series[0].values[index] ?? 0) / scaleMax * plotWidth +
                      6
                    }
                    y={bandStart + groupSize / 2 + 3.5}
                    fontSize={10.5}
                    fill={AXIS_TEXT}
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {shortNumber(series[0].values[index] ?? 0)}
                  </text>
                </>
              ) : (
                <text
                  x={plotLeft + band * index + band / 2}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize={10}
                  fill={AXIS_TEXT}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {tickEvery(count) === 0 || index % tickEvery(count) === 0
                    ? truncate(prettyLabel(label), 9)
                    : ""}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover !== null ? (
        <div
          className="border-n-300 pointer-events-none absolute z-10 rounded-[8px] border bg-white px-2.5 py-1.5 shadow-[0_8px_24px_rgba(27,24,21,0.14)]"
          style={tooltipAt(hover, count, width, horizontal, plotLeft, plotWidth, plotHeight)}
        >
          <span className="text-n-900 block text-[12px] font-semibold">
            {prettyLabel(trimmed.labels[hover])}
          </span>
          {trimmed.series.map((one, index) => (
            <span
              key={one.label}
              className="text-n-600 mt-0.5 flex items-center gap-1.5 text-[11.5px] whitespace-nowrap"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: SERIES[index % SERIES.length] }}
              />
              {one.label}{" "}
              <span className="text-n-900 font-mono font-semibold">
                {format(one.values[hover] ?? 0, trimmed.format)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {trimmed.caption ? (
        <p className={cn("text-n-500 m-0 mt-1.5 text-[12px]")}>{trimmed.caption}</p>
      ) : null}
    </div>
  )
}

/** Grows from the left baseline, rounded only at the data end. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w, h / 2)
  if (w <= 0.5) return `M${x},${y} h0`
  return [
    `M${x},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `Q${x + w},${y + h} ${x + w - radius},${y + h}`,
    `H${x}`,
    "Z",
  ].join(" ")
}

/** Grows up from the baseline, rounded only at the cap. */
function columnPath(x: number, base: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h)
  if (h <= 0.5) return `M${x},${base} h0`
  const top = base - h
  return [
    `M${x},${base}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + w - radius}`,
    `Q${x + w},${top} ${x + w},${top + radius}`,
    `V${base}`,
    "Z",
  ].join(" ")
}

/** Round numbers for the axis — 0 / 500 / 1,000, never 0 / 437 / 874. */
function niceTicks(max: number) {
  const rough = max / 4
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(1, rough))))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((m) => m >= rough) ?? power * 10
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

/** Keeps the x axis from turning into a wall of dates. */
function tickEvery(count: number) {
  if (count <= 8) return 1
  return Math.ceil(count / 8)
}

function shortNumber(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)
}

function format(value: number, kind: "money" | "number") {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: kind === "money" ? 2 : 0,
    maximumFractionDigits: kind === "money" ? 2 : 1,
  }).format(value)
}

/**
 * Day and month keys come through as they are stored so the chart can sort
 * them, and are made readable here — otherwise the axis says "2026-08" while
 * the table directly beneath it says "AUG 2026".
 */
function prettyLabel(label: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [year, month, day] = label.split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(year, month - 1, day)))
      .toUpperCase()
  }

  if (/^\d{4}-\d{2}$/.test(label)) {
    const [year, month] = label.split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .toUpperCase()
  }

  return label
}

function truncate(text: string, at: number) {
  return text.length > at ? `${text.slice(0, Math.max(1, at - 1))}…` : text
}

/** Keeps the tooltip inside the chart rather than off its right edge. */
function tooltipAt(
  index: number,
  count: number,
  width: number,
  horizontal: boolean,
  plotLeft: number,
  plotWidth: number,
  plotHeight: number
): React.CSSProperties {
  if (horizontal) {
    const band = plotHeight / count
    return {
      top: PAD.top + band * index + band / 2,
      left: Math.min(plotLeft + 24, width - 200),
      transform: "translateY(-50%)",
    }
  }

  const band = plotWidth / count
  const centre = plotLeft + band * index + band / 2
  const past = centre > width / 2
  return {
    top: PAD.top,
    left: past ? undefined : centre + 10,
    right: past ? width - centre + 10 : undefined,
  }
}
