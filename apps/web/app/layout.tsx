import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AlignTrueLogo, SiteFooter } from "@aligntrue/ui";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="px-6 py-4 border-b border-[var(--borderColor-default)] bg-[var(--bgColor-default)]">
          <nav className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <AlignTrueLogo size="md" />
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/catalog"
                className="transition-colors text-[var(--fgColor-muted)] hover:text-[var(--fgColor-default)]"
              >
                Catalog
              </Link>
              <Link
                href="/docs"
                className="transition-colors text-[var(--fgColor-muted)] hover:text-[var(--fgColor-default)]"
              >
                Docs
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
