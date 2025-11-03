// apps/docs/app/layout.tsx
import "nextra-theme-docs/style.css";
import "@aligntrue/ui/styles/tokens.css";
import "@aligntrue/ui/nextra/nextra.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Layout, Navbar, Footer } from "nextra-theme-docs";
import { Head, Banner } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { createAlignTrueNextraTheme } from "@aligntrue/ui/nextra";
import { ThemeScript } from "@aligntrue/ui";

export const metadata: Metadata = {
  title: {
    default: "AlignTrue Documentation",
    template: "%s – AlignTrue",
  },
  description:
    "Compile YAML rules into deterministic bundles and agent-ready exports for AI coding agents.",
  openGraph: {
    type: "website",
    title: "AlignTrue Documentation",
    url: "https://aligntrue.ai/docs",
  },
  metadataBase: new URL("https://aligntrue.ai"),
};

export default async function RootLayout({
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

  // If this docs app serves at the site root, use getPageMap()
  // If your docs live under /docs in a combined app, use: await getPageMap('/docs')
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <Head
        // Adjust theme colors or favicon glyph as desired
        faviconGlyph=":"
      >
        <ThemeScript />
      </Head>
      <body>
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
                <p>Made with ❤️ and hash determinism.</p>
                <p className="mt-2">
                  © {new Date().getFullYear()} AlignTrue contributors. Docs{" "}
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
                <p className="mt-2">
                  <a
                    href="https://github.com/AlignTrue/aligntrue"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    aligntrue
                  </a>
                  {" · "}
                  <a
                    href="https://github.com/AlignTrue/aligns"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    aligns
                  </a>
                </p>
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
      </body>
    </html>
  );
}
