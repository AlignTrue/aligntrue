// apps/docs/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

export const metadata: Metadata = {
  title: {
    default: "AlignTrue",
    template: "%s – AlignTrue",
  },
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
    url: BASE_URL,
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
  metadataBase: new URL(BASE_URL),
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlignTrue",
  description: "Instantly sync rules across agents, people, projects and teams",
  url: BASE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Windows, Linux",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify(structuredData)}
        </Script>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
