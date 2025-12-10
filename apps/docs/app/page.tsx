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
 * Redirect handling:
 * - Vercel: vercel.json handles redirect at edge (HTTP 308) before this page loads
 * - Other static hosts: meta refresh in head triggers instant redirect
 *
 * Note: Next.js App Router hoists <meta> tags from page components into <head>.
 */
export default function HomeRedirectPage() {
  return (
    <>
      {/* Next.js hoists this into <head> for static export */}
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
