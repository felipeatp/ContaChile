/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@contachile/validators'],
  outputFileTracingRoot: process.cwd(),
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
