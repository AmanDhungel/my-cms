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
