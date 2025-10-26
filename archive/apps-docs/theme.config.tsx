import React from "react"
import { DocsThemeConfig } from "nextra-theme-docs"

const config: DocsThemeConfig = {
  logo: <span>AlignTrue Documentation</span>,
  project: {
    link: "https://github.com/AlignTrue/aligntrue"
  },
  docsRepositoryBase: "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
  footer: {
    text: "AlignTrue Documentation"
  },
  useNextSeoProps() {
    return {
      titleTemplate: "%s – AlignTrue"
    }
  }
}

export default config

