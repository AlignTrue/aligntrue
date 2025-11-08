// apps/docs/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Head } from "nextra/components";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";

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
    url: "https://aligntrue.ai",
    siteName: "AlignTrue",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
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
    images: ["/og-image.png"],
  },
  metadataBase: new URL("https://aligntrue.ai"),
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlignTrue",
  description: "Instantly sync rules across agents, people, projects and teams",
  url: "https://aligntrue.ai",
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
      <Head faviconGlyph=":">
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body {
            margin: 0;
            padding: 0;
          }
        `}</style>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}');
                `,
              }}
            />
          </>
        )}
      </Head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
