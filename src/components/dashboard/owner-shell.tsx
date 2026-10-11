"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import {
  ApprovalsIcon,
  BellIcon,
  BadgeIcon,
  BoxIcon,
  CalendarIcon,
  ChartIcon,
  CoinsIcon,
  OutgoingIcon,
  ClockIcon,
  ContactIcon,
  DashboardIcon,
  FlagIcon,
  HandshakeIcon,
  LoopIcon,
  RosterIcon,
  StackIcon,
  WrenchIcon,
  PeopleIcon,
  ProjectsIcon,
  ReceiptIcon,
  SettingsIcon,
  TicketsIcon,
  WalletIcon,
} from "@/components/dashboard/nav-icons";
import { SectionOff } from "@/components/dashboard/modules/section-off";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { initialsOf, type Viewer } from "@/components/dashboard/viewer";
import {
  ALL_MODULES_ON,
  NAV_SECTIONS,
  isPathTurnedOff,
  moduleForPath,
  visibleSections,
  type ModuleState,
} from "@/lib/modules";
import { useUnreadCount } from "@/lib/queries";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Rendered as a monospace count chip. `null` means no store backs it yet. */
  count?: number | null;
  /** Marigold pill: something is waiting, but nothing is wrong. */
  accent?: boolean;
  /** Red circle: unread, and it should catch the eye across the room. */
  alert?: boolean;
};

export function OwnerShell({
  viewer,
  counts,
  modules = ALL_MODULES_ON,
  children,
}: {
  viewer: Viewer;
  /** The sections this workspace uses; all of them when it never chose. */
  modules?: ModuleState;
  counts: {
    people: number;
    pendingInvites: number;
    projects: number;
    tickets: number;
    inventory: number;
    sales: number;
    customers: number;
    payments: number;
    expenses: number;
    maintenance: number;
    approvals: number;
    unread: number;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Seeded by the server render, then polled so the badge clears without a
  // full navigation once the feed is read.
  const unread = useUnreadCount(counts.unread).data.unread;

  // Icons and badges by link; which links show, in what order and under
  // which heading comes from the shared config (lib/modules.ts), filtered by
  // role first and then by the sections this workspace uses.
  const decorations: Record<string, Omit<NavItem, "href" | "label">> = {
    "/dashboard": { icon: DashboardIcon },
    "/dashboard/projects": { icon: ProjectsIcon, count: counts.projects },
    "/dashboard/tickets": { icon: TicketsIcon, count: counts.tickets },
    "/dashboard/people": { icon: PeopleIcon, count: counts.people },
    "/dashboard/attendance": { icon: ClockIcon },
    "/dashboard/approvals": {
      icon: ApprovalsIcon,
      count: counts.approvals,
      accent: true,
    },
    // Everything with a date on it that isn't a ticket: what is coming up,
    // and who is meant to be where.
    "/dashboard/calendar": { icon: CalendarIcon },
    "/dashboard/meetings": { icon: HandshakeIcon },
    "/dashboard/installations": { icon: WrenchIcon },
    "/dashboard/follow-ups": { icon: LoopIcon },
    "/dashboard/schedules": { icon: RosterIcon },
    "/dashboard/deadlines": { icon: FlagIcon },
    "/dashboard/maintenance": { icon: WrenchIcon, count: counts.maintenance },
    // Stock and the bills raised against it sit together, away from the
    // day-to-day ticket work above them. Expenses and Payments are the
    // owner's alone; a supervisor records stock purchases from Inventory.
    "/dashboard/inventory": { icon: BoxIcon, count: counts.inventory },
    "/dashboard/sales": { icon: ReceiptIcon, count: counts.sales },
    "/dashboard/customers": { icon: ContactIcon, count: counts.customers },
    "/dashboard/expenses": { icon: OutgoingIcon, count: counts.expenses },
    "/dashboard/payments": { icon: WalletIcon, count: counts.payments },
    // Four groups rather than twenty-five links: each opens a hub listing
    // the reports under it, which keeps the sidebar readable without hiding
    // any.
    "/dashboard/reports/sales": { icon: ChartIcon },
    "/dashboard/reports/inventory": { icon: StackIcon },
    "/dashboard/reports/finance": { icon: CoinsIcon },
    "/dashboard/reports/employee": { icon: BadgeIcon },
    "/dashboard/notifications": { icon: BellIcon, count: unread, alert: true },
    "/dashboard/settings": { icon: SettingsIcon },
  };

  const sections = visibleSections(NAV_SECTIONS, {
    role: viewer.role,
    modules,
  }).map((section) => ({
    ...section,
    items: section.items.map(
      (item): NavItem => ({
        href: item.href,
        label: item.label,
        ...decorations[item.href],
      }),
    ),
  }));

  const turnedOff = isPathTurnedOff(pathname, modules)
    ? NAV_SECTIONS.find((section) => section.module === moduleForPath(pathname))
    : undefined;

  return (
    <div className="bg-n-50 min-h-screen">
      <header className="border-n-200 sticky top-0 z-40 flex items-center justify-between gap-6 border-b bg-[rgba(250,249,247,0.9)] px-7 py-3 backdrop-blur-[14px]">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="bg-p-500 flex size-6 items-center justify-center rounded-[7px]">
              <span className="bg-n-50 size-2 rounded-full" />
            </span>
            <span className="font-heading text-[15px] font-bold tracking-[-0.01em]">
              EMS
            </span>
          </Link>
          <span className="text-n-500 font-mono text-[11px] tracking-[0.06em]">
            {viewer.businessName.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-[13px] font-semibold">{viewer.name}</span>
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.05em]">
              {viewer.role.toUpperCase()}
            </span>
          </div>
          <span
            aria-hidden
            className="font-heading bg-p-100 text-p-700 flex size-8 items-center justify-center rounded-[9px] text-[12px] font-semibold">
            {initialsOf(viewer.name)}
          </span>
          <SignOutButton className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-1.5 text-[13px] font-semibold transition-colors" />
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-49px)] lg:grid-cols-[236px_1fr]">
        <aside className="border-n-200 bg-n-100 ems-thin-scroll top-[49px] hidden h-[calc(100vh-49px)] flex-col gap-[26px] self-start overflow-y-auto overscroll-contain border-r px-4 py-6 lg:sticky lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            {viewer.businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.businessLogo}
                alt=""
                className="size-8 shrink-0 rounded-[9px] object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="font-heading bg-p-100 text-p-700 flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold">
                {initialsOf(viewer.businessName)}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="font-heading truncate text-sm font-semibold">
                {viewer.businessName}
              </span>
              <span className="text-n-500 font-mono text-[10.5px] tracking-[0.05em]">
                {viewer.role.toUpperCase()}
              </span>
            </span>
          </div>

          {sections.map((section) => (
            <NavGroup
              key={section.module ?? "account"}
              label={section.label}
              items={section.items}
              pathname={pathname}
              pendingInvites={counts.pendingInvites}
            />
          ))}

          {viewer.superAdmin ? (
            <Link
              href="/admin"
              className="border-p-200 bg-p-100 text-p-700 hover:bg-p-100/70 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[13px] font-semibold transition-colors">
              Super admin
              <span aria-hidden className="font-mono text-[11px]">
                →
              </span>
            </Link>
          ) : null}

          <div className="border-n-200 mt-auto flex flex-col gap-2 rounded-[10px] border bg-white p-3.5">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em]">
              INVITE ONLY
            </span>
            <p className="text-n-600 m-0 text-[13px] leading-[1.55]">
              Everyone on the crew joins through a link you send from People.
            </p>
            <Link
              href="/dashboard/people"
              className="bg-p-500 rounded-md px-3 py-2 text-center text-[13px] font-semibold text-white hover:brightness-[1.06]">
              Invite someone
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          {turnedOff ? (
            <SectionOff
              section={turnedOff.label}
              canManage={viewer.role === "owner" || Boolean(viewer.superAdmin)}
            />
          ) : (
            children
          )}
        </div>
      </div>

      <MobileNav
        items={sections.flatMap((section) => section.items)}
        pathname={pathname}
      />
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  pendingInvites,
}: {
  /** `null` when only an always-on link is left of a section that is off. */
  label: string | null;
  items: NavItem[];
  pathname: string;
  pendingInvites: number;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {label ? (
        <span className="text-n-400 px-2 pb-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
          {label}
        </span>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-[13.5px] transition-colors",
              active
                ? "text-p-700 bg-white font-semibold shadow-[0_1px_2px_rgba(27,24,21,0.05)]"
                : "text-n-700 hover:bg-n-200/60 font-medium",
            )}>
            <span className="flex items-center gap-2.5">
              <Icon className="size-[15px]" />
              {item.label}
            </span>
            <NavCount item={item} pendingInvites={pendingInvites} />
          </Link>
        );
      })}
    </nav>
  );
}

function NavCount({
  item,
  pendingInvites,
}: {
  item: NavItem;
  pendingInvites: number;
}) {
  // Unread notifications get the one red badge in the nav, so it reads as
  // "look at this" rather than as another count.
  if (item.alert) {
    if (!item.count) return null;
    return <AlertBadge count={item.count} />;
  }

  // People carries a second, marigold chip for invites that haven't been
  // accepted yet — the one number an owner acts on from the sidebar.
  if (item.href === "/dashboard/people") {
    return (
      <span className="flex items-center gap-1.5">
        {pendingInvites > 0 ? (
          <span className="bg-a-400 text-a-900 rounded-full px-1.5 py-px font-mono text-[11px] font-medium">
            {pendingInvites}
          </span>
        ) : null}
        <span className="text-n-500 font-mono text-[11px]">{item.count}</span>
      </span>
    );
  }

  // Approvals and notifications wear the marigold chip, but only when there
  // is actually something waiting — a "0" badge is just noise.
  if (item.accent) {
    if (!item.count) return null;
    return (
      <span className="bg-a-400 text-a-900 rounded-full px-1.5 py-px font-mono text-[11px] font-medium">
        {item.count}
      </span>
    );
  }

  if (typeof item.count === "number") {
    return (
      <span className="text-n-500 font-mono text-[11px]">{item.count}</span>
    );
  }

  return null;
}

/**
 * The unread badge. Red, circular and never showing a zero — it exists to be
 * noticed from across a desk, so it carries the count and an accessible label
 * rather than colour alone.
 */
function AlertBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        "bg-s-overdue grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 font-mono text-[10.5px] leading-none font-semibold text-white tabular-nums",
        className,
      )}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileNav({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <nav className="border-n-200 sticky bottom-0 z-40 flex items-stretch gap-1 overflow-x-auto border-t bg-[rgba(250,249,247,0.95)] px-3 py-2 backdrop-blur-[14px] lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-[68px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] whitespace-nowrap transition-colors",
              active ? "text-p-700 bg-white font-semibold" : "text-n-500",
            )}>
            <span className="relative">
              <Icon className="size-[17px]" />
              {item.alert && item.count ? (
                // Sits on the icon here — there is no room for a trailing chip
                // in a bottom bar.
                <AlertBadge
                  count={item.count}
                  className="absolute -top-1.5 -right-2.5"
                />
              ) : null}
            </span>
            {item.label.replace("Organization ", "")}
          </Link>
        );
      })}
    </nav>
  );
}

/** /dashboard only matches exactly; the rest match their subtree. */
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
