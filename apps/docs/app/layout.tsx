import { Layout } from "nextra-theme-docs";
import type { ReactNode } from "react";

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{}>;
}) {
  await params; // Await params as required by Next.js 15+

  // Pass children directly to the Layout
  // Nextra's Layout will handle pageMap and other requirements internally
  return children;
}
