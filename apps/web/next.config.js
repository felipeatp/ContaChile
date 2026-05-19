/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@contachile/validators'],
  // webpack cache disabled historically due to corrupted cache issues;
  // re-enabled after cache corruption resolved. Removing this block lets
  // Next.js use its default persistent cache, dramatically improving
  // HMR and rebuild times in development.
  poweredByHeader: false,
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
