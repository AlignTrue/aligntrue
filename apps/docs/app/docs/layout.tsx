// apps/docs/app/docs/layout.tsx
import "nextra-theme-docs/style.css";
import "@aligntrue/ui/nextra/nextra.css";
import type { ReactNode } from "react";
import { Layout, Navbar, Footer } from "nextra-theme-docs";
import { Banner } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { createAlignTrueNextraTheme } from "@aligntrue/ui/nextra";

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Create branded Nextra theme config
  const themeConfig = createAlignTrueNextraTheme({
    docsRepositoryBase:
      "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
    logoSize: "md",
  });

  // Get page map - the route structure already puts this at /docs
  const pageMap = await getPageMap();

  return (
    <Layout
      pageMap={pageMap}
      navbar={
        <Navbar
          logo={themeConfig.logo}
          projectLink="https://github.com/AlignTrue/aligntrue"
        />
      }
      footer={
        <Footer>
          <div className="text-sm">
            <p className="mt-2">
              © {new Date().getFullYear()} AlignTrue. Docs{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                CC BY 4.0
              </a>
              . Code{" "}
              <a
                href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                MIT
              </a>
              . Aligns registry{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                CC0
              </a>
              .
            </p>
            <p>Made with ❤️ and hash determinism.</p>
          </div>
        </Footer>
      }
      banner={
        <Banner dismissible storageKey="aligntrue-docs-banner-2025-11-03">
          AlignTrue is under active development.{" "}
          <a
            href="https://github.com/AlignTrue/aligntrue"
            target="_blank"
            rel="noreferrer"
          >
            Star the repo
          </a>{" "}
          to follow updates.
        </Banner>
      }
      docsRepositoryBase={themeConfig.docsRepositoryBase}
      editLink="Edit this page on GitHub"
      navigation
      sidebar={themeConfig.sidebar}
      toc={themeConfig.toc}
    >
      {children}
    </Layout>
  );
}
