export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
        <p>
          © {currentYear} AlignTrue.{" "}
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            MIT License
          </a>
          .
        </p>
        <p className="mt-2">Made with ❤️ + hash determinism.</p>

        <div className="flex justify-center gap-4 mt-6 flex-wrap items-center">
          <a
            href="https://github.com/AlignTrue/aligntrue/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI&logo=github"
              alt="CI status"
              className="h-5 block"
            />
          </a>
          <a
            href="https://www.npmjs.com/package/aligntrue"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/npm/v/aligntrue.svg"
              alt="npm version"
              className="h-5 block"
            />
          </a>
          <a
            href="https://nodejs.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/node-%3E%3D20-brightgreen"
              alt="Node 20+"
              className="h-5 block"
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-blue"
              alt="MIT License"
              className="h-5 block"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
