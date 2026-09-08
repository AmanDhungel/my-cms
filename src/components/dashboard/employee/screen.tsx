import { cn } from "cn"

/** The phone screen's header + scrollable body, shared by all four tabs. */
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
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-[18px]">
        <div className="flex flex-col gap-[3px]">
          <span className="text-p-600 font-mono text-[11px] tracking-[0.07em] uppercase">
            {eyebrow}
          </span>
          <h1 className="font-heading m-0 text-[22px] font-bold tracking-[-0.01em]">
            {title}
          </h1>
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}

export function PhoneCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
    <div className="border-n-300 rounded-[14px] border border-dashed bg-white px-4 py-8 text-center">
      <p className="text-n-500 m-0 text-[13px] leading-relaxed">{message}</p>
    </div>
  )
}
