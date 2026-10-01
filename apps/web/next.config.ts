import type { NextConfig } from 'next';

/**
 * Server-side origin of the Fastify API.
 *
 * `next.config.ts` is evaluated in Node, never in the browser, so this value is
 * not inlined into the client bundle — it stays a server-only rewrite target.
 */
const API_ORIGIN = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.example.com' },
    ],
  },

  /**
   * Proxy the API through the storefront's own origin.
   *
   * Why: the browser then talks to a single origin, which removes CORS from the
   * picture entirely (no preflight, no allowlist to drift) and means only one
   * port has to be reachable — useful on Codespaces, where a second forwarded
   * port is one more thing that can silently drop.
   *
   * The API keeps working standalone; this is additive. Server components still
   * call `API_INTERNAL_URL` directly, so SSR does not round-trip through here.
   *
   * `/api/v1` is free to claim: this app has no `app/api` route handlers.
   */
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` },
      // Ticket QR images and PDFs are served by the API's /media route.
      { source: '/media/:path*', destination: `${API_ORIGIN}/media/:path*` },
      // `api.health()` is the only endpoint outside those two prefixes.
      { source: '/health', destination: `${API_ORIGIN}/health` },
    ];
  },
};

export default nextConfig;