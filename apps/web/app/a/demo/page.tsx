import { AlignDetailClient } from "../[id]/AlignDetailClient";
import type { AlignRecord } from "@/lib/aligns/types";

const demoAlign: AlignRecord = {
  id: "demo-align",
  url: "https://github.com/AlignTrue/examples/blob/main/aligns/sample.mdc",
  normalizedUrl:
    "https://github.com/AlignTrue/examples/blob/main/aligns/sample.mdc",
  provider: "github",
  kind: "rule",
  title: "Sample Align for Demo",
  description: "Demo rules showing how to sync, preview, and copy commands.",
  author: "@aligntrue",
  fileType: "markdown",
  createdAt: new Date().toISOString(),
  lastViewedAt: new Date().toISOString(),
  viewCount: 0,
  installClickCount: 0,
};

const demoContent = `# Demo Align

- Keep responses concise.
- Prefer actionable bullet points.
- Avoid speculative claims; cite sources when possible.
`;

export default function DemoAlignPage() {
  return (
    <AlignDetailClient
      align={demoAlign}
      content={{ kind: "single", content: demoContent }}
    />
  );
}
