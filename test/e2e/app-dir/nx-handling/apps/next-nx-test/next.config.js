//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  experimental: {
    // Disable because nx tries to copy the config to the dist dir
    // and expect to load the config inside the dist dir again.
    // In this case, the `distDir` will be relative to the original config,
    // not the config inside the dist dir, and cause distDir path mismatch.
    serializeNextConfigForProduction: false,
  },
}

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
]

module.exports = composePlugins(...plugins)(nextConfig)
