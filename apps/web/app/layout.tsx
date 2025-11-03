import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  AlignTrueLogo,
  SiteFooter,
  ThemeProvider,
  ThemeScript,
  ThemeToggle,
} from "@aligntrue/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlignTrue",
  description: "AI-native rules and alignment platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider defaultTheme="system">
          <header
            className="px-6 py-4"
            style={{
              borderBottom: "1px solid var(--borderColor-default)",
              backgroundColor: "var(--bgColor-default)",
            }}
          >
            <nav className="max-w-7xl mx-auto flex items-center justify-between">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <AlignTrueLogo size="md" />
              </Link>
              <div className="flex items-center gap-6 text-sm">
                <Link
                  href="/catalog"
                  className="transition-colors"
                  style={{ color: "var(--fgColor-muted)" }}
                >
                  Catalog
                </Link>
                <Link
                  href="/docs"
                  className="transition-colors"
                  style={{ color: "var(--fgColor-muted)" }}
                >
                  Docs
                </Link>
                <ThemeToggle variant="icon" />
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
