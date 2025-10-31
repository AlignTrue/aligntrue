/**
 * Pack detail page (Phase 4, Session 3)
 *
 * Dynamic route for catalog pack details with exporter previews,
 * copy blocks, and installation instructions.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Metadata } from "next";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import { trackDetailView } from "@/lib/analytics";
import { ExporterPreview } from "@/components/catalog/ExporterPreview";
import { CopyBlock } from "@/components/catalog/CopyBlock";
import { RelatedPacks } from "@/components/catalog/RelatedPacks";
import { PlugsPanel } from "@/components/catalog/PlugsPanel";
import { OverlayInfo } from "@/components/catalog/OverlayInfo";
import { InstallButton } from "@/components/catalog/InstallButton";
import { InstallModal } from "@/components/catalog/InstallModal";
import { ShareButton } from "@/components/catalog/ShareButton";

/**
 * Format date for display (e.g., "2025-10-31" → "Oct 31, 2025")
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Badge component for inline labels
 */
function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "info";
}) {
  const colors = {
    default: "bg-neutral-100 text-neutral-700",
    success: "bg-green-100 text-green-800",
    info: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

/**
 * Pack detail page component
 */
export default function PackDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [pack, setPack] = useState<CatalogEntryExtended | null>(null);
  const [allPacks, setAllPacks] = useState<CatalogEntryExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  // Load catalog data
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        // Load full catalog index (adjust path for production)
        const response = await fetch("/catalog/index.json");
        if (!response.ok) {
          throw new Error(`Failed to load catalog: ${response.statusText}`);
        }

        const data = await response.json();

        if (!mounted) return;

        const packs = data.packs as CatalogEntryExtended[];
        setAllPacks(packs);

        // Find pack by slug
        const foundPack = packs.find((p) => p.slug === slug);
        if (!foundPack) {
          setError("Pack not found");
        } else {
          setPack(foundPack);
          // Track detail view
          trackDetailView(foundPack.slug, foundPack.version);
        }
      } catch (err) {
        if (!mounted) return;

        console.error("Failed to load pack:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load pack. Please try again later.",
        );
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading pack...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !pack) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            {error || "Pack not found"}
          </h2>
          <p className="text-sm text-red-700 mb-4">
            The pack you're looking for doesn't exist or has been removed.
          </p>
          <a
            href="/catalog"
            className="text-sm text-red-800 hover:text-red-900 underline focus:outline-none"
          >
            ← Back to catalog
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Structured data for SEO */}
      {pack && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: (() => {
              const url =
                typeof window !== "undefined" ? window.location.origin : "";
              const structuredData = {
                "@context": "https://schema.org",
                "@type": "SoftwareSourceCode",
                name: pack.name,
                description: pack.description,
                version: pack.version,
                identifier: pack.id,
                url: `${url}/catalog/${pack.slug}`,
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
                keywords: [...pack.categories, ...pack.compatible_tools].join(
                  ", ",
                ),
                programmingLanguage: "YAML",
              };
              return JSON.stringify(structuredData);
            })(),
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {pack.name}
              </h1>
              <p className="text-lg text-neutral-600">v{pack.version}</p>
            </div>
            <div className="flex flex-col items-end gap-3 ml-6">
              <div className="flex gap-2">
                <ShareButton packSlug={pack.slug} packName={pack.name} />
                <InstallButton onClick={() => setInstallModalOpen(true)} />
              </div>
              <div className="flex flex-col items-end gap-2">
                {pack.source_linked && (
                  <Badge variant="success">Source Linked</Badge>
                )}
                {pack.overlay_friendly && (
                  <Badge variant="info">Overlay Friendly</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Summary bullets */}
          {pack.summary_bullets && pack.summary_bullets.length > 0 && (
            <div className="mb-4">
              <ul className="list-disc list-inside text-neutral-700 space-y-1">
                {pack.summary_bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Full description */}
          <p className="text-neutral-700 mb-6">{pack.description}</p>

          {/* Stats row */}
          <div className="flex items-center gap-6 text-sm text-neutral-600 pb-6 border-b border-neutral-200">
            <div>
              <span className="font-medium">
                {pack.stats.copies_7d > 0
                  ? `${pack.stats.copies_7d} copies/7d`
                  : "New"}
              </span>
            </div>
            <div>
              <span className="font-medium">{pack.license}</span>
            </div>
            <div>
              <span>
                {pack.maintainer.name}
                {pack.maintainer.github && (
                  <>
                    {" • "}
                    <a
                      href={`https://github.com/${pack.maintainer.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 hover:text-neutral-700 hover:underline"
                      aria-label={`View ${pack.maintainer.name} on GitHub`}
                    >
                      @{pack.maintainer.github}
                    </a>
                  </>
                )}
              </span>
            </div>
            <div>
              <span>Updated {formatDate(pack.last_updated)}</span>
            </div>
            {pack.source_repo && (
              <div>
                <a
                  href={pack.source_repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-500 hover:text-neutral-700 hover:underline"
                  aria-label="View source repository"
                >
                  Source repo →
                </a>
              </div>
            )}
          </div>

          {/* Categories and tools */}
          <div className="mt-4 flex flex-wrap gap-2">
            {pack.categories.map((cat) => (
              <Badge key={cat}>{cat.replace(/-/g, " ")}</Badge>
            ))}
          </div>

          {/* Compatible tools */}
          <div className="mt-3">
            <p className="text-sm text-neutral-600 mb-2">Compatible with:</p>
            <div className="flex flex-wrap gap-2">
              {pack.compatible_tools.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center px-2 py-1 rounded-full bg-neutral-50 text-sm text-neutral-700 border border-neutral-200"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Main content: 2-column layout on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Exporter previews + overlay info (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            {pack.overlay_friendly && pack.rules_index && (
              <OverlayInfo rulesIndex={pack.rules_index} packId={pack.id} />
            )}
            <ExporterPreview pack={pack} />
          </div>

          {/* Right column: Copy block + plugs + related packs (1/3 width) */}
          <div className="space-y-8">
            <CopyBlock pack={pack} />
            {pack.required_plugs && pack.required_plugs.length > 0 && (
              <PlugsPanel
                plugs={pack.required_plugs.map((p) => ({
                  ...p,
                  default: p.default,
                  required: true,
                }))}
              />
            )}
            <RelatedPacks currentPack={pack} allPacks={allPacks} />
          </div>
        </div>

        {/* Install modal */}
        <InstallModal
          pack={pack}
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
        />
      </div>
    </>
  );
}
