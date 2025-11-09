// apps/docs/theme.config.tsx
import type { DocsThemeConfig } from "nextra-theme-docs";
import { AlignTrueLogo } from "@aligntrue/ui";

const config: DocsThemeConfig = {
  logo: <AlignTrueLogo size="md" />,
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",

  // Search configuration
  search: {
    placeholder: "Search documentation...",
  },

  // Sidebar configuration
  sidebar: {
    defaultMenuCollapseLevel: 2,
    autoCollapse: false,
    toggleButton: true,
  },

  // Table of contents configuration
  toc: {
    backToTop: true,
  },
};

export default config;
