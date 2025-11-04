/**
 * SiteFooter Component
 *
 * Simple center-aligned footer for AlignTrue homepage and docs site.
 * Displays copyright, licensing info, and tagline.
 */

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-color)",
        marginTop: "4rem",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          padding: "2rem 1.5rem",
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--fg-muted)",
        }}
      >
        <p>
          © {currentYear} AlignTrue.{" "}
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "underline" }}
          >
            MIT License
          </a>
          .
        </p>
        <p style={{ marginTop: "0.5rem" }}>Made with ❤️ + hash determinism.</p>
      </div>
    </footer>
  );
}
