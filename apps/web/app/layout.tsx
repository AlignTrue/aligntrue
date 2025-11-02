import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BrandLogo } from "@aligntrue/ui";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b border-neutral-200 px-6 py-4">
          <nav className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <BrandLogo />
            </Link>
            <div className="flex gap-6 text-sm">
              <Link
                href="/catalog"
                className="text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Catalog
              </Link>
              <Link
                href="/docs"
                className="text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Docs
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
