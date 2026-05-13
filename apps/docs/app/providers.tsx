"use client";

import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
