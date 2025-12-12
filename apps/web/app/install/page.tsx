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
};

export default function InstallPage() {
  return <InstallPageClient />;
}
