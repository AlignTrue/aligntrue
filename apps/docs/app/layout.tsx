import { Layout } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import themeConfig from "../theme.config";

export const metadata: Metadata = {
  title: {
    template: "%s – AlignTrue",
    default: "AlignTrue Documentation",
  },
  description:
    "Compile YAML rules into deterministic bundles and agent-ready exports for AI coding agents.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AlignTrue Documentation",
    title: "AlignTrue Documentation",
    description:
      "Compile YAML rules into deterministic bundles and agent-ready exports for AI coding agents.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* @ts-expect-error - Nextra v4 type mismatch */}
        <Layout pageMap={pageMap} {...themeConfig}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
