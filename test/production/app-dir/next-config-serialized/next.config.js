/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // distDir: 'out',
  env: {
    foo: 'foo',
  },
  experimental: {
    serializeNextConfigForProduction: true,
  },
}

module.exports = nextConfig
