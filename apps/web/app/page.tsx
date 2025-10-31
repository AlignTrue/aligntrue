import { QuickstartSection } from "@/components/home/QuickstartSection";

export default function Home() {
  return (
    <>
      {/* Hero quickstart section */}
      <QuickstartSection />

      {/* What is AlignTrue section */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">
              What is AlignTrue?
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              AlignTrue is an AI-native rules and alignment platform that turns
              small, composable YAML rules ("Aligns") into deterministic bundles
              and agent-ready exports so developers and code agents stay aligned
              across projects and teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Composable rules
              </h3>
              <p className="text-sm text-neutral-600">
                Small, focused YAML packs that combine to create comprehensive
                agent behavior. Mix and match to fit your workflow.
              </p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🔄</div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Multi-agent support
              </h3>
              <p className="text-sm text-neutral-600">
                Export to 28+ AI coding agents including Cursor, Claude Code,
                Windsurf, and more. Write once, deploy everywhere.
              </p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="text-2xl mb-3">✅</div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Deterministic outputs
              </h3>
              <p className="text-sm text-neutral-600">
                Byte-identical exports for identical inputs. Perfect for CI/CD
                pipelines and team collaboration.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
