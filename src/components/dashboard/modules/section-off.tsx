import Link from "next/link"

import {
  DashboardMain,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"

/**
 * What a page of a switched-off section shows when it is opened directly —
 * an old bookmark, a notification link. Only the display is withheld: the
 * page's API keeps answering, so nothing that reads it breaks.
 */
export function SectionOff({
  section,
  canManage,
}: {
  section: string
  /** Owner or super admin: offered the way to switch it back on. */
  canManage: boolean
}) {
  return (
    <DashboardMain>
      <div className="border-n-300 mx-auto mt-6 flex w-full max-w-[520px] flex-col items-center gap-3 rounded-[14px] border border-dashed bg-white px-6 py-12 text-center">
        <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em] uppercase">
          {section}
        </span>
        <h1 className="font-heading m-0 text-[20px] font-semibold">
          This section is turned off
        </h1>
        <p className="text-n-600 m-0 max-w-[42ch] text-[14px] leading-relaxed">
          {canManage
            ? "Your workspace doesn't use this part of EMS right now. Turn it back on and its pages return to the sidebar."
            : "Your workspace doesn't use this part of EMS right now. Ask the owner if you need it."}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">
          {canManage ? (
            <Link href="/dashboard/settings#sections" className={primaryButtonClass}>
              Turn on in Organization settings
            </Link>
          ) : null}
          <Link href="/dashboard" className={secondaryButtonClass}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </DashboardMain>
  )
}
