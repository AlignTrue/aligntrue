// apps/docs/app/docs/layout.tsx
import "nextra-theme-docs/style.css";
import type { ReactNode } from "react";
import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { createAlignTrueNextraTheme } from "@aligntrue/ui/nextra";
import { SiteFooter } from "@aligntrue/ui";

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

  // Get page map and prefix all routes with /docs since we're in a nested route
  const rawPageMap = await getPageMap();

  // Recursively add /docs prefix to all route paths
  const prefixRoutes = (items: any[], prefix: string): any[] => {
    return items.map((item) => {
      if (item.route) {
        item = { ...item, route: prefix + item.route };
      }
      if (item.children) {
        item = { ...item, children: prefixRoutes(item.children, prefix) };
      }
      return item;
    });
  };

  const pageMap = prefixRoutes(rawPageMap, "/docs");

  return (
    <Layout
      pageMap={pageMap}
      navbar={
        <Navbar
          logo={themeConfig.logo}
          projectLink="https://github.com/AlignTrue/aligntrue"
        />
      }
      footer={<SiteFooter />}
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
