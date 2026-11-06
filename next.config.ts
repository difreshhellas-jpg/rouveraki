import type { NextConfig } from "next";

/**
 * Security headers. The CSP is scoped to exactly what the app loads:
 *  - Google Fonts (stylesheet + font files)
 *  - Supabase (REST + Realtime websocket)
 *  - Viva Smart Checkout (redirect target; framed nowhere, so no frame-src needed)
 *  - Google Maps embed (iframe) for the location section
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required for the
  // App Router runtime. No third-party script origins are allowed.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://images.pexels.com",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}`.trim(),
  "frame-src https://www.google.com https://maps.google.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// No database configured (a fresh fork, a new Vercel project) means the shared
// demo/ordering mode, not the Prisma + Supabase backend that would crash on
// every page that touches it. NEXT_PUBLIC_DEMO_MODE=false forces the backend.
const demoDefault =
  process.env.NEXT_PUBLIC_DEMO_MODE ?? (process.env.DATABASE_URL ? "false" : "true");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_DEMO_MODE: demoDefault },
  // A production build writes into the same .next the dev server is serving
  // from, which leaves dev throwing "Cannot find module './331.js'" until the
  // directory is deleted. Setting NEXT_DIST_DIR lets a verification build go
  // somewhere else while `next dev` keeps running.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Both packages ship large barrel files. Without this, importing three
  // Phosphor glyphs pulls the whole icon set into the route bundle, which put
  // /menu over the performance budget.
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    // Route changes cross-fade via the View Transitions API (styled in
    // globals.css). Browsers without it navigate with a hard cut, as before.
    viewTransition: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
