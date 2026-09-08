import Link from "next/link"

/**
 * Shared across all three views. The section links are absolute (`/#flow`) so
 * they still work from the login and signup screens.
 */
export function SiteHeader() {
  return (
    <header className="border-n-200 sticky top-0 z-50 flex items-center justify-between gap-6 border-b bg-[rgba(250,249,247,0.82)] px-6 py-4 backdrop-blur-[14px] sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="bg-p-500 flex size-[26px] items-center justify-center rounded-lg"
        >
          <span className="bg-n-50 size-[9px] rounded-full" />
        </span>
        <span className="font-heading text-base font-bold tracking-[-0.01em]">
          EMS
        </span>
        <span className="text-n-500 hidden font-mono text-[11px] tracking-[0.06em] sm:inline">
          FIELD OPS
        </span>
      </Link>

      <nav className="flex items-center gap-2">
        <Link
          href="/#flow"
          className="text-n-700 hover:bg-n-100 hidden rounded-md px-3.5 py-2 text-sm font-medium transition-colors md:block"
        >
          The flow
        </Link>
        <Link
          href="/#proof"
          className="text-n-700 hover:bg-n-100 hidden rounded-md px-3.5 py-2 text-sm font-medium transition-colors md:block"
        >
          Check-in
        </Link>
        <Link
          href="/login"
          className="text-p-700 border-n-300 rounded-md border bg-white px-4 py-[9px] text-sm font-semibold transition-transform hover:-translate-y-px"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="bg-a-400 text-a-900 rounded-md border border-transparent px-4 py-[9px] text-sm font-semibold transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06]"
        >
          Get started
        </Link>
      </nav>
    </header>
  )
}
