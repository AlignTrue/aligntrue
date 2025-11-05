// apps/docs/app/docs/layout.tsx
"use client";

import { ReactNode } from "react";

export default function DocsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Record<string, unknown>>;
}) {
  return children;
}
