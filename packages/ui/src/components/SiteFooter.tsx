import { AlignTrueLogo } from "./AlignTrueLogo";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t py-8 mt-16"
      style={{
        borderColor: "var(--borderColor-default)",
        backgroundColor: "var(--bgColor-default)",
        color: "var(--fgColor-default)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Logo and tagline */}
          <div className="flex flex-col gap-3">
            <AlignTrueLogo size="sm" />
            <p className="text-sm" style={{ color: "var(--fgColor-muted)" }}>
              Made with ❤️ and hash determinism.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--fgColor-default)" }}
            >
              Resources
            </h3>
            <a
              href="https://github.com/AlignTrue/aligntrue"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: "var(--fgColor-muted)" }}
            >
              aligntrue (MIT)
            </a>
            <a
              href="https://github.com/AlignTrue/aligns"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: "var(--fgColor-muted)" }}
            >
              aligns (CC0)
            </a>
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-3">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--fgColor-default)" }}
            >
              Status
            </h3>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://www.npmjs.com/package/@aligntrue/cli"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://img.shields.io/npm/v/@aligntrue/cli.svg"
                  alt="npm version"
                  className="h-5"
                />
              </a>
              <a
                href="https://github.com/AlignTrue/aligntrue"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://img.shields.io/badge/tests-1842%20passing-brightgreen"
                  alt="Tests passing"
                  className="h-5"
                />
              </a>
              <a
                href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://img.shields.io/badge/License-MIT-blue.svg"
                  alt="MIT License"
                  className="h-5"
                />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div
          className="mt-8 pt-6 border-t text-sm text-center"
          style={{
            borderColor: "var(--borderColor-default)",
            color: "var(--fgColor-muted)",
          }}
        >
          © {currentYear} AlignTrue. MIT Licensed.
        </div>
      </div>
    </footer>
  );
}
