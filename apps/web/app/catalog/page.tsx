import type { Metadata } from "next";
import { CatalogPageClient } from "./CatalogPageClient";

const title = "Catalog | AlignTrue";
const description =
  "Import Aligns and browse the AlignTrue catalog. Search, filter, and preview rule packs before syncing.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/catalog",
  },
  openGraph: {
    title,
    description,
    url: "https://aligntrue.ai/catalog",
    images: [
      {
        url: "/aligntrue-og-image.png",
        width: 1800,
        height: 945,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/aligntrue-og-image.png"],
  },
};

export default function CatalogPage() {
  return <CatalogPageClient />;
}
