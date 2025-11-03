import { Layout } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import themeConfig from "../theme.config";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* @ts-expect-error - Nextra v4 type mismatch, will be fixed in future update */}
        <Layout pageMap={pageMap} {...themeConfig}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
