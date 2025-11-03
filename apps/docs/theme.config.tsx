import React from "react";

const config = {
  logo: <span style={{ fontWeight: 600 }}>AlignTrue</span>,
  project: {
    link: "https://github.com/AlignTrue/aligntrue",
  },
  docsRepositoryBase:
    "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
  footer: {
    text: `© ${new Date().getFullYear()} AlignTrue. MIT License.`,
  },
  feedback: {
    content: "Question? Give us feedback →",
    labels: "documentation",
  },
  toc: {
    backToTop: true,
  },
  search: {
    placeholder: "Search documentation...",
  },
};

export default config;
