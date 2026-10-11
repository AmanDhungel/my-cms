"use client"

import { Panel } from "@/components/dashboard/ui"
import { ModulesChooser } from "@/components/dashboard/modules/modules-chooser"
import type { ModuleState } from "@/lib/modules"

/**
 * Organization settings → Sections: the first-visit chooser again, for the
 * owner or a super admin to change their mind. `#sections` is where the
 * "This section is turned off" screen sends them.
 */
export function SectionsPanel({
  role,
  initial,
}: {
  role: string
  /** What is on now; `null` while the workspace has never chosen. */
  initial: ModuleState | null
}) {
  return (
    <Panel
      id="sections"
      className="grid scroll-mt-20 gap-6 p-[22px] lg:grid-cols-[210px_1fr]"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading m-0 text-base font-semibold">Sections</h2>
        <p className="text-n-500 m-0 text-[13px] leading-[1.55]">
          Which parts of EMS show in the sidebar. Turning one off hides it; no
          data is removed.
        </p>
      </div>
      <ModulesChooser role={role} initial={initial} submitLabel="Save sections" />
    </Panel>
  )
}
