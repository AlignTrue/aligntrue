/**
 * Pack detail page (Phase 4, Session 3 - Refactored for SSR)
 *
 * Server-side rendered page for catalog pack details with proper 404 handling
 * and dynamic metadata generation.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import { generatePackMetadata } from "./metadata";
import { PackDetailClient } from "./PackDetailClient";

/**
 * Generate metadata for the pack detail page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return generatePackMetadata(slug);
}

/**
 * Generate static params for known packs at build time
 */
export async function generateStaticParams() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/catalog/index.json`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return data.packs.map((pack: CatalogEntryExtended) => ({
      slug: pack.slug,
    }));
  } catch {
    return [];
  }
}

/**
 * Pack detail page component (Server Component)
 */
export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    // Load catalog data server-side
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/catalog/index.json`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      throw new Error(`Failed to load catalog: ${response.statusText}`);
    }

    const data = await response.json();
    const packs = data.packs as CatalogEntryExtended[];

    // Find pack by slug
    const pack = packs.find((p) => p.slug === slug);

    // Trigger 404 if pack not found
    if (!pack) {
      notFound();
    }

    // Render client component with server-fetched data
    return <PackDetailClient pack={pack} allPacks={packs} />;
  } catch (error) {
    // Only log if not a not-found error
    if (!(error instanceof Error && error.message === "NEXT_NOT_FOUND")) {
      console.error("Failed to load pack:", error);
    }
    notFound();
  }
}
