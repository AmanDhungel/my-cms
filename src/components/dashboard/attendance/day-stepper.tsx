"use client"

/**
 * Walks one day at a time, never past today — there is no attendance to read
 * in the future, and an empty screen would only look broken.
 */
export function DayStepper({
  day,
  today,
  onChange,
}: {
  day: string
  today: string
  onChange: (day: string) => void
}) {
  const atToday = day >= today

  return (
    <div className="flex items-center gap-1.5">
      <Step
        label="Previous day"
        glyph="‹"
        onClick={() => onChange(shiftDay(day, -1))}
      />
      <span className="border-n-200 text-n-700 min-w-[132px] rounded-md border bg-white px-3 py-2 text-center font-mono text-[12.5px]">
        {day === today ? "TODAY" : label(day)}
      </span>
      <Step
        label="Next day"
        glyph="›"
        disabled={atToday}
        onClick={() => onChange(shiftDay(day, 1))}
      />
    </div>
  )
}

function Step({
  label,
  glyph,
  onClick,
  disabled = false,
}: {
  label: string
  glyph: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[34px] items-center justify-center rounded-md border text-[16px] leading-none disabled:opacity-40"
    >
      {glyph}
    </button>
  )
}

/** Day keys are plain calendar dates, so UTC arithmetic can't drift them. */
function shiftDay(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number)
  const moved = new Date(Date.UTC(year, month - 1, date + delta))
  return moved.toISOString().slice(0, 10)
}

function label(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, date)))
    .toUpperCase()
}
