/**
 * 404 Not Found page (Phase 4, Session 6)
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 text-center">
      <div className="mb-8">
        <h1 className="text-6xl font-bold text-neutral-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-neutral-700 mb-2">
          Page not found
        </h2>
        <p className="text-neutral-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          Go home
        </Link>
        <Link
          href="/catalog"
          className="px-6 py-3 bg-neutral-100 text-neutral-900 rounded-lg font-medium hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          Browse catalog
        </Link>
      </div>

      {/* Popular packs suggestion */}
      <div className="mt-12 pt-8 border-t border-neutral-200">
        <p className="text-sm text-neutral-600 mb-4">
          Or explore these popular packs:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/catalog/base-global"
            className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            base-global
          </Link>
          <Link
            href="/catalog/typescript-strict"
            className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            typescript-strict
          </Link>
          <Link
            href="/catalog/security-best-practices"
            className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            security-best-practices
          </Link>
        </div>
      </div>
    </div>
  );
}
