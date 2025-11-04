// apps/docs/app/layout.tsx
import "nextra-theme-docs/style.css";
import "@aligntrue/ui/nextra/nextra.css";
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Head } from "nextra/components";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: {
    default: "AlignTrue",
    template: "%s – AlignTrue",
  },
  description:
    "Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.",
  openGraph: {
    type: "website",
    title: "AlignTrue",
    url: "https://aligntrue.ai",
  },
  metadataBase: new URL("https://aligntrue.ai"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head faviconGlyph=":">
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
