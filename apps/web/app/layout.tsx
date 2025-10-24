import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
          <BrandLogo />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
