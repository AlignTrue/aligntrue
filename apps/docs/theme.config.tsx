// apps/docs/theme.config.tsx
import { AlignTrueLogo } from "@aligntrue/ui-base";

const config = {
  logo: <AlignTrueLogo size="md" />,
  logoLink: "https://aligntrue.ai",
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
  editLink: {
    content: "Edit this page on GitHub",
  },
  feedback: {
    content: "Questions? Give us feedback →",
    labels: "documentation",
  },

  // Table of contents configuration
  toc: {
    backToTop: true,
  },
};

export default config;
