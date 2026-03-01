const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fix module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@web': path.resolve(__dirname),
    }
    return config
  },
  // Suppress hydration warnings
  reactStrictMode: true,
  // Transpile packages
  transpilePackages: ['@tanstack/react-query'],
}

module.exports = nextConfig
