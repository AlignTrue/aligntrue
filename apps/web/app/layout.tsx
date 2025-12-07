import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: {
    default: "AlignTrue",
    template: "%s – AlignTrue",
  },
  description: "AlignTrue Align Catalog",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, fontFamily: "Inter, sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <style>{`
            :root {
              --bg-default: #ffffff;
              --bg-muted: #f6f8fa;
              --border-color: #d1d9e0;
              --fg-default: #1f2328;
              --fgColor-default: #1f2328;
              --fg-muted: #59636e;
              --text-secondary: #59636e;
              --bg-secondary: #f6f8fa;
              --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
                "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif,
                "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
                "Noto Color Emoji";
              --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
                "Liberation Mono", monospace;
            }

            :root.dark {
              --bg-default: #0d1117;
              --bg-muted: #161b22;
              --border-color: #30363d;
              --fg-default: #f0f6fc;
              --fgColor-default: #f0f6fc;
              --fg-muted: #9198a1;
              --text-secondary: #9198a1;
              --bg-secondary: #161b22;
            }

            body {
              font-family: var(--font-sans);
              background-color: var(--bg-default);
              color: var(--fg-default);
            }

            code,
            pre {
              font-family: var(--font-mono);
            }
          `}</style>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
