import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: { default: "AlignTrue", template: "%s – AlignTrue" },
  description:
    "Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.",
  keywords: [
    "AI agents",
    "Cursor rules",
    "GitHub Copilot",
    "Claude",
    "team collaboration",
    "developer tools",
    "AI coding",
  ],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    title: "AlignTrue",
    description:
      "Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.",
    url: "https://aligntrue.ai",
    siteName: "AlignTrue",
    images: [
      {
        url: "/aligntrue-og-image.png",
        width: 1800,
        height: 945,
        alt: "AlignTrue - Sync AI rules across agents and teams",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlignTrue",
    description:
      "Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.",
    images: ["/aligntrue-og-image.png"],
  },
  metadataBase: new URL("https://aligntrue.ai"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
