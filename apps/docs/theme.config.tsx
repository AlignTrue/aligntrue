import { AlignTrueLogo } from "@aligntrue/ui";
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <div className="flex items-center gap-2">
      <AlignTrueLogo size="md" />
      <span className="font-semibold">AlignTrue</span>
    </div>
  ),
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
  footer: {
    content: <span>MIT {new Date().getFullYear()} © AlignTrue.</span>,
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
};

export default config;
