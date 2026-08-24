import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export', // 👈 ADD THIS – enables static export for Capacitor
  images: {
    unoptimized: true, // 👈 ADD THIS – required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
