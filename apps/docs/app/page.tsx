import type { Metadata } from "next";

const REDIRECT_PATH = "/docs";

export const metadata: Metadata = {
  title: "AlignTrue Documentation",
  robots: { index: false, follow: true },
  alternates: {
    canonical: REDIRECT_PATH,
  },
};

/**
 * Root page fallback for /docs.
 *
 * Redirect handling:
 * - Vercel: vercel.json handles redirect at edge (HTTP 308) before this page loads.
 * - Other static hosts: this page renders a simple link to /docs.
 */
export default function HomeRedirectPage() {
  return (
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
        Continue to <a href={REDIRECT_PATH}>documentation</a>.
      </p>
    </div>
  );
}
