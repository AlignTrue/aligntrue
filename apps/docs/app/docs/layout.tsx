// apps/docs/app/docs/layout.tsx
// Standard Nextra docs theme layout following https://nextra.site/docs/docs-theme/start
import { Layout, Footer, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { AlignTrueLogo } from "@aligntrue/ui";
import type { ReactNode } from "react";

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout
      pageMap={await getPageMap()}
      navbar={
        <Navbar
          logo={<AlignTrueLogo size="md" />}
          projectLink="https://github.com/AlignTrue/aligntrue"
        />
      }
      docsRepositoryBase="https://github.com/AlignTrue/aligntrue/tree/main/apps/docs"
      footer={<Footer>MIT {new Date().getFullYear()} © AlignTrue.</Footer>}
    >
      {children}
    </Layout>
  );
}
