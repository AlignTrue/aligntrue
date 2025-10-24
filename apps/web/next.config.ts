import type { NextConfig } from "next";

/**
 * Next.js configuration for AlignTrue catalog site
 * 
 * Configured for hybrid rendering (default Next.js behavior):
 * - Static generation (SSG) where possible for fast performance
 * - Server features available when needed (API routes, dynamic rendering)
 * - This is not a one-way door - we can adjust as requirements evolve
 */
const nextConfig: NextConfig = {
  // Use default hybrid rendering mode
  // Static pages are generated at build time
  // Dynamic features work when needed
};

export default nextConfig;
