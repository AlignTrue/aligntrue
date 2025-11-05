// apps/docs/app/docs/layout.tsx
// Standard Nextra docs theme layout following https://nextra.site/docs/docs-theme/start
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { AlignTrueLogo } from "@aligntrue/ui";
import type { ReactNode } from "react";

const navbar = (
  <Navbar
    logo={<AlignTrueLogo size="md" />}
    projectLink="https://github.com/AlignTrue/aligntrue"
  />
);

const footer = <Footer>MIT {new Date().getFullYear()} © AlignTrue.</Footer>;

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout
      navbar={navbar}
      pageMap={await getPageMap()}
      docsRepositoryBase="https://github.com/AlignTrue/aligntrue/tree/main/apps/docs"
      footer={footer}
    >
      {children}
    </Layout>
  );
}
