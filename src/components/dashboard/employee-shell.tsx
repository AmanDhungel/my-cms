"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { initialsOf, type Viewer } from "@/components/dashboard/viewer"

const NAV = [
  { href: "/dashboard", label: "Home", icon: HomeGlyph },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClockGlyph },
  { href: "/dashboard/requests", label: "Requests", icon: SheetGlyph },
  { href: "/dashboard/profile", label: "Profile", icon: PersonGlyph },
]

/**
 * The crew view. The design draws it as a 390px phone; on a real phone the
 * frame drops away and the app fills the screen, so the same markup serves
 * both without a second layout.
 */
export function EmployeeShell({
  viewer,
  children,
}: {
  viewer: Viewer
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="bg-n-50 flex min-h-screen flex-col sm:bg-[repeating-linear-gradient(118deg,var(--n-100)_0_26px,#edeae4_26px_52px)]">
      <header className="border-n-200 sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-[rgba(250,249,247,0.9)] px-5 py-3 backdrop-blur-[14px]">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="bg-p-500 flex size-6 items-center justify-center rounded-[7px]"
          >
            <span className="bg-n-50 size-2 rounded-full" />
          </span>
          <span className="font-heading text-[15px] font-bold tracking-[-0.01em]">
            EMS
          </span>
          <span className="text-n-500 hidden font-mono text-[11px] tracking-[0.06em] sm:inline">
            {viewer.businessName.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="font-heading bg-p-100 text-p-700 flex size-8 items-center justify-center rounded-full text-[12px] font-semibold"
          >
            {initialsOf(viewer.name)}
          </span>
          <SignOutButton className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[13px] font-semibold transition-colors" />
        </div>
      </header>

      <div className="flex flex-1 justify-center px-0 py-0 sm:px-8 sm:py-9">
        <div className="border-n-300 bg-n-50 flex w-full flex-1 flex-col sm:max-w-[390px] sm:flex-none sm:rounded-[26px] sm:border sm:shadow-[0_18px_44px_rgba(27,24,21,0.16)]">
          <div className="flex-1 [animation:ems-view-in_.35s_cubic-bezier(.2,.7,.2,1)_both] sm:overflow-hidden sm:rounded-t-[26px]">
            {children}
          </div>

          <nav className="border-n-200 bg-n-100 sticky bottom-0 grid grid-cols-4 gap-1 border-t px-3 pt-2.5 pb-4 sm:rounded-b-[26px]">
            {NAV.map((item) => {
              const Icon = item.icon
              const active =
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1.5 text-[11px]",
                    active ? "text-p-700 font-semibold" : "text-n-500"
                  )}
                >
                  <Icon />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

const glyph = {
  viewBox: "0 0 24 24",
  width: 19,
  height: 19,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
} as const

function HomeGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <path d="M4 11l8-6 8 6v8H4z" />
    </svg>
  )
}

function ClockGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function SheetGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  )
}

function PersonGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  )
}
