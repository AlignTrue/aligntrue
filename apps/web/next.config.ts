import type { NextConfig } from "next";

/**
 * Next.js configuration for AlignTrue catalog site
 *
 * Configured for hybrid rendering (default Next.js behavior):
 * - Static generation (SSG) where possible for fast performance
 * - Server features available when needed (API routes, dynamic rendering)
 * - This is not a one-way door - we can adjust as requirements evolve
 *
 * Note: Using webpack for production builds due to Tailwind CSS v4 compatibility.
 * Turbopack is still used for dev mode (faster hot reload).
 */
const nextConfig: NextConfig = {
  // Use default hybrid rendering mode
  // Static pages are generated at build time
  // Dynamic features work when needed

  // Rewrite docs requests to external Nextra docs site
  // Note: Rewrites only work in production. In development mode, /docs will return 404.
  // This is expected Next.js behavior - external rewrites don't resolve locally.
  async rewrites() {
    return [
      {
        source: "/docs/:path*",
        destination: "https://aligntrue-docs.vercel.app/docs/:path*",
      },
      {
        source: "/sitemap.docs.xml",
        destination: "https://aligntrue-docs.vercel.app/sitemap.docs.xml",
      },
    ];
  },
};

export default nextConfig;
