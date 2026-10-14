import path from "node:path"

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // This app lives inside the legacy app's repo; without this Next picks the parent as root and loads its middleware.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  typedRoutes: true,
}

export default nextConfig
