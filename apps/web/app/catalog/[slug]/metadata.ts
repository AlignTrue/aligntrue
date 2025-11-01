/**
 * Dynamic metadata generation for pack detail pages (Phase 4, Session 6)
 *
 * Generates meta tags, OpenGraph cards, and structured data for SEO.
 */

import type { Metadata } from "next";
import type { CatalogEntryExtended } from "@aligntrue/schema";

/**
 * Generate metadata for a pack detail page
 */
export async function generatePackMetadata(slug: string): Promise<Metadata> {
  try {
    // Load catalog index
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/catalog/index.json`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      return generateFallbackMetadata(slug);
    }

    const data = await response.json();
    const pack = data.packs.find((p: CatalogEntryExtended) => p.slug === slug);

    if (!pack) {
      return generateFallbackMetadata(slug);
    }

    const title = `${pack.name} v${pack.version} - AlignTrue Catalog`;
    const description =
      pack.description || `AI-native rules pack for ${pack.name}`;
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/catalog/${slug}`;

    // Note: OG image generation (/api/og) not yet implemented
    // Leaving it out for now to avoid 404 errors
    // TODO: Add OG image generation API route in future

    // Keywords from categories and tools
    const keywords = [
      ...pack.categories,
      ...pack.compatible_tools,
      "aligntrue",
      "ai-rules",
      "code-agent",
    ];

    return {
      title,
      description,
      keywords: keywords.join(", "),
      authors: [{ name: pack.maintainer.name }],
      openGraph: {
        title,
        description,
        url,
        siteName: "AlignTrue Catalog",
        type: "article",
        publishedTime: pack.published_at,
        modifiedTime: pack.last_updated,
        authors: [pack.maintainer.name],
        tags: keywords,
        // images commented out until /api/og is implemented
        // images: [
        //   {
        //     url: ogImage,
        //     width: 1200,
        //     height: 630,
        //     alt: `${pack.name} - AlignTrue Pack`,
        //   },
        // ],
      },
      twitter: {
        card: "summary",
        title,
        description,
        // images commented out until /api/og is implemented
        // images: [ogImage],
      },
      alternates: {
        canonical: url,
      },
      other: {
        version: pack.version,
        license: pack.license,
      },
    };
  } catch (error) {
    console.error("Failed to generate metadata:", error);
    return generateFallbackMetadata(slug);
  }
}

/**
 * Generate fallback metadata when pack data unavailable
 */
function generateFallbackMetadata(slug: string): Metadata {
  return {
    title: `${slug} - AlignTrue Catalog`,
    description: "AI-native rules and alignment pack",
    keywords: "aligntrue, ai-rules, code-agent",
  };
}

/**
 * Generate JSON-LD structured data for a pack
 */
export function generatePackStructuredData(pack: CatalogEntryExtended): string {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/catalog/${pack.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: pack.name,
    description: pack.description,
    version: pack.version,
    identifier: pack.id,
    url,
    datePublished: pack.published_at,
    dateModified: pack.last_updated,
    license: pack.license,
    author: {
      "@type": "Person",
      name: pack.maintainer.name,
      ...(pack.maintainer.github && {
        url: `https://github.com/${pack.maintainer.github}`,
      }),
    },
    ...(pack.source_repo && {
      codeRepository: pack.source_repo,
    }),
    keywords: [...pack.categories, ...pack.compatible_tools].join(", "),
    programmingLanguage: "YAML",
    aggregateRating:
      pack.stats.copies_7d > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: 5,
            reviewCount: pack.stats.copies_7d,
          }
        : undefined,
  };

  return JSON.stringify(structuredData, null, 2);
}
