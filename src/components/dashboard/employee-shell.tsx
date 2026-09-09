"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { initialsOf, type Viewer } from "@/components/dashboard/viewer";

const NAV = [
  { href: "/dashboard", label: "Home", icon: HomeGlyph },
  { href: "/dashboard/check-in", label: "Check in", icon: PinGlyph },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClockGlyph },
  { href: "/dashboard/requests", label: "Requests", icon: SheetGlyph },
  { href: "/dashboard/profile", label: "Profile", icon: PersonGlyph },
];

/**
 * The crew view has two shapes. Below `lg` it is the design's phone app —
 * full-bleed on a handset, framed on a tablet. From `lg` up the frame is
 * dropped for a real desktop layout: sidebar on the left, page fills the rest.
 */
export function EmployeeShell({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="bg-n-50 min-h-screen">
      <header className="border-n-200 sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-[rgba(250,249,247,0.9)] px-5 py-3 backdrop-blur-[14px] lg:px-7">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="cursor-pointer flex items-center gap-2.5">
            <span
              aria-hidden
              className="bg-p-500 flex size-6 items-center justify-center rounded-[7px]">
              <span className="bg-n-50 size-2 rounded-full" />
            </span>
            <span className="font-heading text-[15px] font-bold tracking-[-0.01em]">
              EMS
            </span>
          </Link>
          <span className="text-n-500 hidden font-mono text-[11px] tracking-[0.06em] sm:inline">
            {viewer.businessName.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3 lg:gap-4">
          <div className="hidden flex-col items-end lg:flex">
            <span className="text-[13px] font-semibold">{viewer.name}</span>
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.05em]">
              {viewer.role.toUpperCase()}
            </span>
          </div>
          <span
            aria-hidden
            className="font-heading bg-p-100 text-p-700 flex size-8 items-center justify-center rounded-full text-[12px] font-semibold">
            {initialsOf(viewer.name)}
          </span>
          <SignOutButton className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[13px] font-semibold transition-colors" />
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-49px)] lg:grid-cols-[236px_1fr]">
        <aside className="border-n-200 bg-n-100 top-[49px] hidden h-[calc(100vh-49px)] flex-col gap-[26px] self-start border-r px-4 py-6 lg:sticky lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span
              aria-hidden
              className="font-heading bg-p-100 text-p-700 flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold">
              {initialsOf(viewer.businessName)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-heading truncate text-sm font-semibold">
                {viewer.businessName}
              </span>
              <span className="text-n-500 font-mono text-[10.5px] tracking-[0.05em]">
                {viewer.role.toUpperCase()}
              </span>
            </span>
          </div>

          <nav className="flex flex-col gap-0.5">
            <span className="text-n-400 px-2 pb-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
              Your day
            </span>
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] transition-colors",
                    active
                      ? "text-p-700 bg-white font-semibold shadow-[0_1px_2px_rgba(27,24,21,0.05)]"
                      : "text-n-700 hover:bg-n-200/60 font-medium",
                  )}>
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-n-200 mt-auto flex flex-col gap-2 rounded-[10px] border bg-white p-3.5">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em]">
              YOUR SHIFT
            </span>
            <span className="text-[15px] font-semibold">
              {viewer.shift ?? "Not set"}
            </span>
            <p className="text-n-600 m-0 text-[12.5px] leading-[1.55]">
              Check in from inside a task&rsquo;s geofence to start the day.
            </p>
          </div>
        </aside>

        {/* Below lg this column carries the phone board and frame; from lg up
            those wrappers collapse and the page fills the column. */}
        <div className="flex min-w-0 flex-col sm:max-lg:items-center sm:max-lg:bg-[repeating-linear-gradient(118deg,var(--n-100)_0_26px,#edeae4_26px_52px)] sm:max-lg:px-8 sm:max-lg:py-9">
          <div className="sm:max-lg:border-n-300 sm:max-lg:bg-n-50 flex w-full flex-1 flex-col sm:max-lg:max-w-[390px] sm:max-lg:flex-none sm:max-lg:rounded-[26px] sm:max-lg:border sm:max-lg:shadow-[0_18px_44px_rgba(27,24,21,0.16)]">
            <div className="flex-1 [animation:ems-view-in_.35s_cubic-bezier(.2,.7,.2,1)_both] sm:max-lg:overflow-hidden sm:max-lg:rounded-t-[26px]">
              {children}
            </div>

            <nav className="border-n-200 bg-n-100 sticky bottom-0 grid grid-cols-5 gap-0.5 border-t px-3 pt-2.5 pb-4 sm:max-lg:rounded-b-[26px] lg:hidden">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 py-1.5 text-[11px]",
                      active ? "text-p-700 font-semibold" : "text-n-500",
                    )}>
                    <Icon />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

/** /dashboard only matches exactly; the rest match their subtree. */
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const glyph = {
  viewBox: "0 0 24 24",
  width: 19,
  height: 19,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  className: "size-[19px] lg:size-[15px]",
} as const;

function HomeGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <path d="M4 11l8-6 8 6v8H4z" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SheetGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}

function PinGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg {...glyph} aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}
