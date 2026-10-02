import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";

// Next.js injects inline bootstrap scripts, and React's dev tooling needs eval.
// The optional research worker is reachable only from a local checkout.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://vercel.live https://vercel.com",
  "font-src 'self' data: https://vercel.live",
  "connect-src 'self' http://127.0.0.1:8787 https://raw.githubusercontent.com https://gist.githubusercontent.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
