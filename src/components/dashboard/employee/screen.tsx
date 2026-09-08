import { cn } from "cn"

/**
 * One crew screen. Below `lg` it fills the phone frame the shell draws; from
 * `lg` up the shell hands over a full column, so the padding opens out and the
 * heading steps up to the owner-side size.
 */
export function EmployeeScreen({
  eyebrow,
  title,
  aside,
  children,
  className,
}: {
  eyebrow: string
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col lg:mx-auto lg:w-full lg:max-w-[1040px] lg:px-8",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-[18px] lg:px-0 lg:pt-7 lg:pb-6">
        <div className="flex flex-col gap-[3px] lg:gap-1.5">
          <span className="text-p-600 font-mono text-[11px] tracking-[0.07em] uppercase lg:text-[11.5px] lg:tracking-[0.08em]">
            {eyebrow}
          </span>
          <h1 className="font-heading m-0 text-[22px] font-bold tracking-[-0.01em] lg:text-[28px] lg:tracking-[-0.015em]">
            {title}
          </h1>
        </div>
        {aside}
      </div>

      <div className="flex flex-col gap-4 px-5 pb-6 lg:px-0 lg:pb-12">
        {children}
      </div>
    </div>
  )
}

/** A tile inside a crew screen. */
export function PhoneCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-n-200 flex flex-col gap-2.5 rounded-[14px] border bg-white p-[15px]",
        className
      )}
      {...props}
    />
  )
}

export function PhoneEmpty({ message }: { message: string }) {
  return (
    <div className="border-n-300 rounded-[14px] border border-dashed bg-white px-4 py-8 text-center lg:px-6 lg:py-14">
      <p className="text-n-500 m-0 mx-auto max-w-[52ch] text-[13px] leading-relaxed lg:text-sm">
        {message}
      </p>
    </div>
  )
}

/** Small metric tile — a row on the phone, a grid cell on a desktop. */
export function PhoneStat({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-n-200 flex flex-1 flex-col gap-[3px] rounded-[10px] border bg-white px-3 py-2.5 lg:gap-1.5 lg:rounded-xl lg:p-4",
        className
      )}
    >
      <span className="text-n-500 font-mono text-[10px] tracking-[0.06em] lg:text-[10.5px] lg:tracking-[0.07em]">
        {label}
      </span>
      <span className="font-heading text-[18px] font-semibold lg:text-[28px] lg:leading-none">
        {value}
      </span>
    </div>
  )
}
