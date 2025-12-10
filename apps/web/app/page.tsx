import type { Metadata } from "next";
import { HomePageClient } from "./HomePageClient";

const title = "AlignTrue | Sync AI rules across agents, repos & teams";
const description =
  "Write once, sync everywhere. Works with 20+ agents. Start in 60 seconds.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [
      {
        url: "/aligntrue-og-image.png",
        width: 1200,
        height: 630,
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

export default function HomePage() {
  return <HomePageClient />;
}
