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
  editLink: {
    text: "Edit this page on GitHub",
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
  useNextSeoProps() {
    return {
      titleTemplate: "%s – AlignTrue",
      description:
        "Compile YAML rules into deterministic bundles and agent-ready exports for AI coding agents.",
      openGraph: {
        type: "website",
        locale: "en_US",
        siteName: "AlignTrue Documentation",
      },
    };
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="AlignTrue Documentation" />
      <meta
        property="og:description"
        content="Compile YAML rules into deterministic bundles and agent-ready exports for AI coding agents."
      />
    </>
  ),
};

export default config;
