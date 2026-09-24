/** The sidebar and bottom-nav glyphs, traced from the design's inline SVGs. */
type IconProps = { className?: string }

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
} as const

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  )
}

export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M3 7h6l2 2h10v10H3z" />
    </svg>
  )
}

export function TasksIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  )
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M17 11a3 3 0 1 0 0-6" />
    </svg>
  )
}

export function ApprovalsIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </svg>
  )
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  )
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function InboxIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M4.5 6h15l1.5 7v5H3v-5z" />
    </svg>
  )
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function BoxIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  )
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h12v4" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H7a2 2 0 0 1-4 0" />
      <circle cx="16.5" cy="13.5" r="1" />
    </svg>
  )
}

export function ContactIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M15 9h3M15 13h3" />
    </svg>
  )
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function HandshakeIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M3 10.5 7 7l3.5 2.5L14 7l4 3.5" />
      <path d="M7 7v8.5M18 10.5V17M10.5 9.5 9 15l2.5 2 2-2.5 2.5 2" />
    </svg>
  )
}

export function WrenchIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M15.5 3.5a5 5 0 0 0-6 6.6L3.8 15.8a2 2 0 0 0 2.8 2.8l5.7-5.7a5 5 0 0 0 6.6-6l-3 3-2.4-2.4z" />
    </svg>
  )
}

export function LoopIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M4 10a7 7 0 0 1 12-4.5L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 14a7 7 0 0 1-12 4.5L4 15" />
      <path d="M4 20v-5h5" />
    </svg>
  )
}

export function RosterIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M9 9v12M3 15h18" />
    </svg>
  )
}

export function FlagIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M5 21V4" />
      <path d="M5 4.5h11l-2 3.5 2 3.5H5" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 20v-6M12.5 20V9M17 20v-9" />
    </svg>
  )
}

export function StackIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <path d="M12 3 3 7.5l9 4.5 9-4.5z" />
      <path d="M3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5" />
    </svg>
  )
}

export function CoinsIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <ellipse cx="9" cy="6.5" rx="6" ry="2.8" />
      <path d="M3 6.5v4c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4" />
      <path d="M9 13.3v4c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-7" />
      <ellipse cx="15" cy="10.3" rx="6" ry="2.8" />
    </svg>
  )
}

/** A banknote with the arrow leaving it: money on its way out. */
export function OutgoingIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <rect x="2.5" y="6" width="14" height="9" rx="1.6" />
      <circle cx="9.5" cy="10.5" r="1.8" />
      <path d="M20 12v7" />
      <path d="M17.2 16.2 20 19l2.8-2.8" />
    </svg>
  )
}

export function BadgeIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className} aria-hidden>
      <circle cx="12" cy="9" r="4" />
      <path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5" />
    </svg>
  )
}
