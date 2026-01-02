import { AlignTrueLogo } from "@aligntrue/ui";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-0">
      <div className="h-px w-full bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30" />
      <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between text-center md:text-left">
        <div className="space-y-3 w-full md:w-auto">
          <div className="text-foreground flex justify-center md:justify-start">
            <AlignTrueLogo size="md" />
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-foreground">
            <a href="/docs" className="hover:underline">
              Docs
            </a>
            <a href="/docs/04-reference/features" className="hover:underline">
              Features
            </a>
            <a href="/docs/about" className="hover:underline">
              About
            </a>
            <a
              href="https://github.com/AlignTrue/aligntrue"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
          </div>
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
          <p className="text-muted-foreground">
            Made with ❤️ + hash determinism.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-center md:justify-end">
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
              loading="lazy"
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
              loading="lazy"
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
              loading="lazy"
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
              loading="lazy"
              className="h-5 block"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
