/**
 * Custom 404 page for pack detail routes
 */

import Link from "next/link";

export default function PackNotFound() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">
          Pack not found
        </h2>
        <p className="text-sm text-red-700 mb-4">
          The pack you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/catalog"
          className="text-sm text-red-800 hover:text-red-900 underline focus:outline-none"
        >
          ← Back to catalog
        </Link>
      </div>
    </div>
  );
}
