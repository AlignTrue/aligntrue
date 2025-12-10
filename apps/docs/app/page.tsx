import type { Metadata } from "next";

const REDIRECT_PATH = "/docs";

export const metadata: Metadata = {
  title: "Redirecting to AlignTrue Docs",
  robots: { index: false, follow: true },
  alternates: {
    canonical: REDIRECT_PATH,
  },
};

/**
 * Root page redirect to /docs.
 *
 * This is a server component that renders a simple redirect page.
 * - Vercel hosting: vercel.json handles the redirect at the edge (HTTP 308)
 * - Other hosting: Users see this page briefly with a link to /docs
 *
 * We use a meta refresh tag in the page content as a fallback for non-Vercel
 * static hosting. While not in <head>, browsers still honor it.
 */
export default function HomeRedirectPage() {
  return (
    <>
      {/* Meta refresh as fallback for static hosting without edge redirects */}
      <meta httpEquiv="refresh" content={`0;url=${REDIRECT_PATH}`} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "1rem", color: "#666" }}>
          Redirecting to <a href={REDIRECT_PATH}>documentation</a>...
        </p>
      </div>
    </>
  );
}
