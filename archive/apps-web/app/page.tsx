import { QuickstartSection } from "@/components/home/QuickstartSection";

export default function Home() {
  return (
    <>
      {/* Hero quickstart section */}
      <QuickstartSection />

      {/* Why AlignTrue section */}
      <section className="bg-[var(--bgColor-default)]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-[var(--fgColor-default)]">
              Write once, sync everywhere
            </h2>
            <p className="text-lg max-w-3xl mx-auto text-[var(--fgColor-muted)]">
              One markdown file generates agent-specific formats for 28+ AI
              coding tools. Keep your personal AI rules consistent across
              projects and machines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-lg p-6 bg-[var(--bgColor-muted)] border border-[var(--borderColor-default)]">
              <div className="text-2xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold mb-2 text-[var(--fgColor-default)]">
                60-second setup
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                Auto-detects your agents and creates starter rules in under a
                minute. No configuration required.
              </p>
            </div>

            <div className="rounded-lg p-6 bg-[var(--bgColor-muted)] border border-[var(--borderColor-default)]">
              <div className="text-2xl mb-3">🔄</div>
              <h3 className="text-lg font-semibold mb-2 text-[var(--fgColor-default)]">
                Two-way sync
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                Edit rules OR agent files - changes flow both directions
                automatically. Stay aligned without manual copying.
              </p>
            </div>

            <div className="rounded-lg p-6 bg-[var(--bgColor-muted)] border border-[var(--borderColor-default)]">
              <div className="text-2xl mb-3">🌐</div>
              <h3 className="text-lg font-semibold mb-2 text-[var(--fgColor-default)]">
                28+ agents supported
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                Cursor, GitHub Copilot, Claude, Aider, Windsurf, VS Code MCP,
                and 22+ more through 43 specialized exporters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="bg-[var(--bgColor-muted)] border-t border-b border-[var(--borderColor-default)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-[var(--fgColor-default)]">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold bg-[var(--bgColor-accent-emphasis)] text-[var(--fgColor-onEmphasis)]">
                1
              </div>
              <h3 className="font-semibold mb-2 text-[var(--fgColor-default)]">
                Write rules
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                In <code>.aligntrue/rules.md</code> using simple markdown
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold bg-[var(--bgColor-accent-emphasis)] text-[var(--fgColor-onEmphasis)]">
                2
              </div>
              <h3 className="font-semibold mb-2 text-[var(--fgColor-default)]">
                Run sync
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                AlignTrue detects installed agents automatically
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold bg-[var(--bgColor-accent-emphasis)] text-[var(--fgColor-onEmphasis)]">
                3
              </div>
              <h3 className="font-semibold mb-2 text-[var(--fgColor-default)]">
                Agent exports
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                Each agent gets its native format (.mdc, .json, .yml)
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold bg-[var(--bgColor-accent-emphasis)] text-[var(--fgColor-onEmphasis)]">
                4
              </div>
              <h3 className="font-semibold mb-2 text-[var(--fgColor-default)]">
                Stay aligned
              </h3>
              <p className="text-sm text-[var(--fgColor-muted)]">
                Edit markdown or agent files - sync keeps everything consistent
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
