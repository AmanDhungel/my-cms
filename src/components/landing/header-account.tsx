"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { initialsOf } from "@/components/dashboard/viewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The right-hand side of the marketing header. It reads the session on the
 * client so the landing page itself stays static — a server-side `auth()` call
 * here would force the whole page to render per request.
 */
export function HeaderAccount() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // Same footprint as whichever state lands, so the header doesn't jump.
    return (
      <div className="flex items-center gap-2" aria-hidden>
        <Skeleton className="h-[38px] w-[84px] rounded-md" />
        <Skeleton className="size-[34px] rounded-full" />
      </div>
    );
  }

  const user = session?.user;

  if (!user) {
    return (
      <>
        <Link
          href="/login"
          className="text-p-700 border-n-300 rounded-md border bg-white px-4 py-[9px] text-sm font-semibold transition-transform hover:-translate-y-px">
          Log in
        </Link>
        <Link
          href="/signup"
          className="bg-a-400 text-a-900 rounded-md border border-transparent px-4 py-[9px] text-sm font-semibold transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06]">
          Get started
        </Link>
      </>
    );
  }

  const name = user.name ?? "Your account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="border-n-300 hover:bg-n-100 data-[state=open]:bg-n-100 flex items-center gap-2 rounded-full border bg-white py-1 pr-2 pl-1 transition-colors sm:rounded-md sm:py-1.5 sm:pr-3">
        <span
          aria-hidden
          className="font-heading bg-p-100 text-p-700 flex size-[28px] items-center justify-center rounded-full text-[11.5px] font-semibold">
          {initialsOf(name)}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[13px] font-semibold">{name}</span>
          <span className="text-n-500 font-mono text-[10px] tracking-[0.05em]">
            {user.role.toUpperCase()}
          </span>
        </span>
        <ChevronIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="border-n-200 bg-n-50 w-56 rounded-lg border p-1.5 shadow-[0_12px_32px_rgba(27,24,21,0.16)] ring-0">
        <div className="flex flex-col gap-0.5 px-2.5 py-2">
          <span className="truncate text-[13.5px] font-semibold">{name}</span>
          <span className="text-n-500 truncate text-[12px]">{user.email}</span>
        </div>

        <DropdownMenuSeparator className="bg-n-200 my-1" />

        <DropdownMenuItem asChild>
          <Link
            href="/dashboard"
            className="text-n-800 focus:bg-p-100 focus:text-p-700 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium">
            <GridIcon />
            Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => void signOut({ callbackUrl: "/" })}
          className="text-n-800 focus:bg-n-100 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium">
          <ExitIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const glyph = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true,
} as const;

function ChevronIcon() {
  return (
    <svg {...glyph} className="text-n-500 size-3.5 shrink-0">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...glyph} className="size-[15px] shrink-0">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg {...glyph} className="size-[15px] shrink-0">
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 16l4-4-4-4M20 12H10" />
    </svg>
  );
}
