import { Layout, Navbar, Footer } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { ReactNode } from "react";
import themeConfig from "../../theme.config";

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <Layout
      navbar={<Navbar logo={themeConfig.logo} />}
      footer={<Footer>{themeConfig.footer.content}</Footer>}
      pageMap={pageMap}
    >
      {children}
    </Layout>
  );
}
