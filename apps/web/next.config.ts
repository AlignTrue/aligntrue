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
};

export default nextConfig;
