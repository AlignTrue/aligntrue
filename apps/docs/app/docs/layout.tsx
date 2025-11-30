import "nextra-theme-docs/style.css";
import type { ReactNode } from "react";
import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { PageMapItem } from "nextra";
import themeConfig from "../../theme.config";
import { BetaBanner } from "../components/BetaBanner";
import { PagefindSearch } from "../components/PagefindSearch";

/**
 * DocsFooter Component (Docs-specific)
 *
 * Simple footer for AlignTrue docs site using Nextra theming.
 * Independent from homepage footer.
 */
function DocsFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: "1px solid var(--nextra-border, #e5e7eb)",
        marginTop: "4rem",
        padding: "2rem 1.5rem",
        textAlign: "center",
        fontSize: "0.875rem",
        color: "var(--nextra-fg-muted, #6b7280)",
      }}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        <p>
          © {currentYear} AlignTrue.{" "}
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "underline" }}
          >
            MIT License
          </a>
          .
        </p>
        <p style={{ marginTop: "0.5rem" }}>Made with ❤️ + hash determinism.</p>

        {/* Build & Status Badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            marginTop: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a
            href="https://github.com/AlignTrue/aligntrue/actions"
            target="_blank"
            rel="noopener noreferrer"
            title="CI Status"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI"
              alt="CI Status"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://www.npmjs.com/package/aligntrue"
            target="_blank"
            rel="noopener noreferrer"
            title="npm version"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/npm/v/aligntrue?color=CB3837&logo=npm"
              alt="npm version"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://nodejs.org/"
            target="_blank"
            rel="noopener noreferrer"
            title="Node.js 20+"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js&logoColor=white"
              alt="Node.js Version"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/security/code-scanning"
            target="_blank"
            rel="noopener noreferrer"
            title="Security Scan"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/codeql.yml?label=security&logo=github"
              alt="Security Scan Status"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/commits/main"
            target="_blank"
            rel="noopener noreferrer"
            title="Last commit"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/last-commit/AlignTrue/aligntrue?color=9ca3af&logo=github"
              alt="Last commit"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            title="MIT License"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-blue?logo=github"
              alt="MIT License"
              style={{ height: "20px", display: "block" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Get page map and prefix all routes with /docs since we're in a nested route
  const rawPageMap = await getPageMap();

  // Recursively add /docs prefix to all route paths
  const prefixRoutes = (
    items: PageMapItem[],
    prefix: string,
  ): PageMapItem[] => {
    return items.map((item) => {
      if ("route" in item && item.route) {
        item = { ...item, route: prefix + item.route };
      }
      if ("children" in item && item.children) {
        item = { ...item, children: prefixRoutes(item.children, prefix) };
      }
      return item;
    });
  };

  const pageMap = prefixRoutes(rawPageMap, "/docs");

  return (
    <>
      <BetaBanner />
      <Layout
        pageMap={pageMap}
        navbar={
          <Navbar
            logo={themeConfig.logo}
            projectLink={themeConfig.project.link}
          />
        }
        search={<PagefindSearch placeholder="Search documentation..." />}
        footer={<DocsFooter />}
        sidebar={{
          defaultMenuCollapseLevel: 1,
          autoCollapse: true,
          toggleButton: true,
        }}
      >
        {children}
      </Layout>
    </>
  );
}
