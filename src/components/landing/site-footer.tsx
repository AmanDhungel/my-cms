import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-n-200 bg-n-100 flex flex-wrap items-center justify-between gap-4 border-t px-6 py-7 sm:px-10">
      <span className="text-n-500 font-mono text-[11px] tracking-[0.06em]">
        EMS · FIELD OPERATIONS · V1
      </span>
      <div className="text-n-600 flex gap-4.5 text-[13px]">
        <Link href="#flow" className="hover:text-p-700">
          Flow
        </Link>
        <Link href="#proof" className="hover:text-p-700">
          Check-in
        </Link>
      </div>
    </footer>
  )
}
