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

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginTop: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a
            href="https://github.com/AlignTrue/aligntrue/actions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI&logo=github"
              alt="CI status"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://www.npmjs.com/package/aligntrue"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/npm/v/aligntrue.svg"
              alt="npm version"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://nodejs.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/node-%3E%3D20-brightgreen"
              alt="Node 20+"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-blue"
              alt="MIT License"
              style={{ height: "20px", display: "block" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
