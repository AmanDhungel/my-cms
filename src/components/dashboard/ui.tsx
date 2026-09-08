import { cn } from "cn"

/** Owner-side page frame: the design's 28/32px padded main with the view-in cue. */
export function DashboardMain({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "flex min-w-0 flex-col gap-6 px-5 pt-7 pb-12 sm:px-8",
        "[animation:ems-view-in_.35s_cubic-bezier(.2,.7,.2,1)_both]",
        className
      )}
      {...props}
    />
  )
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? (
          <p className="text-p-600 m-0 font-mono text-[11.5px] tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading m-0 text-[28px] font-bold tracking-[-0.015em]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-n-600 m-0 text-[14.5px]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2.5">{actions}</div> : null}
    </div>
  )
}

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "border-n-200 rounded-[14px] border bg-white",
        className
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  aside,
}: {
  title: string
  aside?: React.ReactNode
}) {
  return (
    <div className="border-n-200 flex items-center justify-between gap-4 border-b px-[18px] py-4">
      <h2 className="font-heading m-0 text-base font-semibold">{title}</h2>
      {aside}
    </div>
  )
}

/**
 * The design's dashed empty card. Every list that has no store behind it yet
 * shows this rather than sample rows, so nothing on screen is invented.
 */
export function EmptyState({
  message,
  action,
  className,
}: {
  message: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-n-300 flex flex-col items-center gap-3 rounded-[14px] border border-dashed bg-white px-6 py-10 text-center",
        className
      )}
    >
      <p className="text-n-500 m-0 max-w-[46ch] text-sm leading-relaxed">
        {message}
      </p>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4",
        accent ? "border-a-400 bg-a-50" : "border-n-200 bg-white"
      )}
    >
      <span
        className={cn(
          "font-mono text-[10.5px] tracking-[0.07em]",
          accent ? "text-a-700" : "text-n-500"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-[28px] leading-none font-semibold",
          accent && "text-a-900"
        )}
      >
        {value}
      </span>
      {hint ? (
        <span
          className={cn(
            "flex items-center gap-1.5 text-[12.5px]",
            accent ? "text-a-700" : "text-n-600"
          )}
        >
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-[7px] rounded-full", className)} />
}

/** Solid petrol button — the design's primary action. */
export const primaryButtonClass =
  "bg-p-500 flex items-center gap-[7px] rounded-md px-[15px] py-2.5 text-sm font-semibold text-white shadow-[0_3px_10px_rgba(14,124,123,0.22)] transition-[filter] hover:brightness-[1.06] disabled:opacity-60"

/** Outlined white button — the design's secondary action. */
export const secondaryButtonClass =
  "border-n-300 text-n-700 hover:bg-n-100 flex items-center gap-[7px] rounded-md border bg-white px-[15px] py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
