// apps/docs/theme.config.tsx
import { AlignTrueLogo } from "@aligntrue/ui";

const config = {
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
    defaultMenuCollapseLevel: 1,
    autoCollapse: true,
    toggleButton: true,
  },

  // Table of contents configuration
  toc: {
    backToTop: true,
  },
};

export default config;
