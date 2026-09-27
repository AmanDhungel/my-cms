import type { Metadata } from "next"
import { headers } from "next/headers"
import { connection } from "next/server"
import { Inter, JetBrains_Mono, Sora } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

// Type ramp from the EMS style guide: Sora for display/headings, Inter for
// body, JetBrains Mono for IDs and numeric metadata.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  // Until the font arrives, stand in with another monospace face. The
  // default stand-in is Arial scaled up, which is far wider and re-wraps
  // short mono labels the moment the real font swaps in (landing CLS 0.17).
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"],
})

export const metadata: Metadata = {
  title: {
    default: "EMS — field ticket management",
    template: "%s",
  },
  description:
    "Assign located tickets, verify check-ins inside the geofence, and watch status flow back the moment it changes.",
}

/**
 * Rendered per request, never prerendered: the Content-Security-Policy set
 * in src/proxy.ts carries a fresh nonce on every request, and Next can only
 * stamp it on its scripts while rendering one. A static page would ship
 * scripts without it, and the policy would block them.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection()
  // next-themes injects an inline script; it needs the same nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  )
}
