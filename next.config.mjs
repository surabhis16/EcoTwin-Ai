import { fileURLToPath } from "url"
import { dirname } from "path"

/** @type {import('next').NextConfig} */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
