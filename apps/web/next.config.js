/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@contachile/validators'],
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
