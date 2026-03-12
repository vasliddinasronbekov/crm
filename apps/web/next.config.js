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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.crmai.uz' },
      { protocol: 'https', hostname: 'crmai.uz' },
      { protocol: 'https', hostname: 'www.crmai.uz' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
}

module.exports = nextConfig
