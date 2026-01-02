import type { Metadata } from "next";
import { InstallPageClient } from "./InstallPageClient";

const title = "Install | AlignTrue CLI";
const description =
  "Install AlignTrue CLI to sync AI rules across agents. Works with npm, yarn, pnpm, or bun.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/install",
  },
  openGraph: {
    title,
    description,
    url: "https://aligntrue.ai/install",
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

export default function InstallPage() {
  return <InstallPageClient />;
}
