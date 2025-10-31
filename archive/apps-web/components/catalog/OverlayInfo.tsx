interface OverlayInfoProps {
  rulesIndex?: Record<string, { id: string; summary?: string }>;
  packId: string;
}

export function OverlayInfo({ rulesIndex, packId }: OverlayInfoProps) {
  const rulesCount = rulesIndex ? Object.keys(rulesIndex).length : 0;

  return (
    <section
      className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"
      aria-labelledby="overlay-heading"
    >
      <div className="flex items-start">
        <div
          className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mr-4"
          aria-hidden="true"
        >
          ⚡
        </div>
        <div className="flex-1">
          <h2 id="overlay-heading" className="text-lg font-semibold mb-2">
            Overlay-Friendly Pack
          </h2>
          <p className="text-gray-700 mb-4">
            This pack supports <strong>overlays</strong> — a non-destructive way
            to customize rules without forking. Override specific rules while
            staying synced with upstream updates.
          </p>

          {rulesCount > 0 && (
            <p className="text-sm text-gray-600 mb-4">
              This pack provides{" "}
              <strong>
                {rulesCount} customizable {rulesCount === 1 ? "rule" : "rules"}
              </strong>{" "}
              via its rules index.
            </p>
          )}

          <details className="mb-4">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
              Example overlay snippet
            </summary>
            <pre
              className="mt-3 bg-white border border-gray-300 rounded p-4 text-xs overflow-x-auto"
              aria-label="Example overlay configuration"
            >
              <code>{`# .aligntrue.yaml
spec_version: "1"
rules:
  base:
    - source: "catalog:${packId}"
      version: "latest"

overlays:
  - target_rule: "security/input-validation"
    severity: error
    add_content: |
      # Custom validation rules for our API
      - Validate all user inputs at boundaries
      - Use schema validation (Zod/Yup)
      - Reject unknown fields`}</code>
            </pre>
          </details>

          <a
            href="/docs/overlays"
            className="text-blue-600 hover:text-blue-800 text-sm underline font-medium"
            aria-label="Learn more about overlays"
          >
            Learn more about overlays →
          </a>
        </div>
      </div>
    </section>
  );
}
