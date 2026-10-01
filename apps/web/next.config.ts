import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The storefront is served from the Node runtime so it can call the API
  // directly during SSR without exposing the API URL to the browser bundle.
  experimental: {
    optimizePackageImports: [],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.example.com' },
    ],
  },
};

export default nextConfig;