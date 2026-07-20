/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    // Optional: if the backend is unreachable on its own port (e.g. behind a
    // single-origin deploy), the frontend can still call /api/* and Next.js
    // will forward to the FastAPI server. In local dev the .env.local points
    // NEXT_PUBLIC_API_BASE_URL at :4000 directly, so the browser bypasses
    // this rewrite entirely.
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
