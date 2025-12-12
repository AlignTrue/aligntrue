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
};

export default function CatalogPage() {
  return <CatalogPageClient />;
}
