import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep mongoose out of the bundler: it loads native/optional deps at runtime.
  serverExternalPackages: ["mongoose"],
}

export default nextConfig
