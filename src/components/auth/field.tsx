import * as React from "react"
import { cn } from "cn"

/** Input chrome from the style guide, shared by both auth forms. */
export const inputClass =
  "border-n-300 focus:border-p-500 text-n-900 placeholder:text-n-400 aria-invalid:border-s-overdue rounded-md border bg-white px-3.5 py-3 text-[15px] outline-none transition-[border-color,box-shadow] focus:shadow-[0_0_0_3px_rgba(14,124,123,0.14)] aria-invalid:focus:shadow-[0_0_0_3px_rgba(229,72,77,0.16)]"

/** Uppercase field caption. Renders a <legend> inside a <fieldset>. */
export const fieldLabelClass =
  "text-n-600 text-[13px] font-semibold tracking-[0.05em] uppercase"

export function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span className={cn(fieldLabelClass, className)} {...props} />
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="text-s-overdue text-[12.5px]">{message}</span>
}
