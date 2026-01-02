// apps/docs/theme.config.tsx
import { AlignTrueLogo } from "@aligntrue/ui";

const config = {
  logo: <AlignTrueLogo size="md" />,
  logoLink: "https://aligntrue.ai",
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",

  // Table of contents configuration
  toc: {
    backToTop: true,
  },
};

export default config;
