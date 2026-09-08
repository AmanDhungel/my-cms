import type { Metadata } from "next"
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
})

export const metadata: Metadata = {
  title: {
    default: "EMS — field task management",
    template: "%s",
  },
  description:
    "Assign located tasks, verify check-ins inside the geofence, and watch status flow back the moment it changes.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
