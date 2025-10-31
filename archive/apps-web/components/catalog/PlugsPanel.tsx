import { useState } from "react";

export interface Plug {
  key: string;
  description: string;
  type?: string;
  default?: unknown;
  scope?: string;
  required?: boolean;
}

interface PlugsPanelProps {
  plugs: Plug[];
}

export function PlugsPanel({ plugs }: PlugsPanelProps) {
  const [expandedPlugs, setExpandedPlugs] = useState<Set<string>>(new Set());

  const requiredPlugs = plugs.filter((p) => p.required);
  const optionalPlugs = plugs.filter((p) => !p.required);

  const toggleExpand = (key: string) => {
    setExpandedPlugs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (plugs.length === 0) {
    return (
      <section
        className="bg-white border border-gray-200 rounded-lg p-6"
        aria-labelledby="plugs-heading"
      >
        <h2 id="plugs-heading" className="text-lg font-semibold mb-4">
          Customization
        </h2>
        <p className="text-gray-600 text-sm mb-2">
          This pack has no plugs. It works as-is without customization.
        </p>
        <a
          href="/docs/plugs"
          className="text-blue-600 hover:text-blue-800 text-sm underline"
          aria-label="Learn about plugs"
        >
          Learn about plugs
        </a>
      </section>
    );
  }

  return (
    <section
      className="bg-white border border-gray-200 rounded-lg p-6"
      aria-labelledby="plugs-heading"
    >
      <h2 id="plugs-heading" className="text-lg font-semibold mb-4">
        Customization ({plugs.length} {plugs.length === 1 ? "plug" : "plugs"})
      </h2>

      {requiredPlugs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Required Plugs
          </h3>
          <div className="space-y-2">
            {requiredPlugs.map((plug) => (
              <PlugCard
                key={plug.key}
                plug={plug}
                expanded={expandedPlugs.has(plug.key)}
                onToggle={() => toggleExpand(plug.key)}
              />
            ))}
          </div>
        </div>
      )}

      {optionalPlugs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Optional Plugs
          </h3>
          <div className="space-y-2">
            {optionalPlugs.map((plug) => (
              <PlugCard
                key={plug.key}
                plug={plug}
                expanded={expandedPlugs.has(plug.key)}
                onToggle={() => toggleExpand(plug.key)}
              />
            ))}
          </div>
        </div>
      )}

      <a
        href="/docs/plugs"
        className="text-blue-600 hover:text-blue-800 text-sm underline mt-4 inline-block"
        aria-label="Learn about plugs"
      >
        Learn about plugs
      </a>
    </section>
  );
}

interface PlugCardProps {
  plug: Plug;
  expanded: boolean;
  onToggle: () => void;
}

function PlugCard({ plug, expanded, onToggle }: PlugCardProps) {
  const hasDetails = plug.type || plug.default !== undefined || plug.scope;

  return (
    <div
      className="border border-gray-200 rounded p-3 hover:border-gray-300 transition-colors"
      role="article"
      aria-labelledby={`plug-${plug.key}-name`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4
            id={`plug-${plug.key}-name`}
            className={`text-sm font-mono ${
              plug.required ? "font-bold" : "font-normal"
            } text-gray-900 mb-1`}
          >
            {plug.key}
            {plug.required && (
              <span
                className="ml-2 text-xs font-sans font-normal text-red-600"
                aria-label="Required plug"
              >
                (required)
              </span>
            )}
          </h4>
          <p className="text-sm text-gray-700">{plug.description}</p>
        </div>
        {hasDetails && (
          <button
            onClick={onToggle}
            className="ml-2 text-blue-600 hover:text-blue-800 text-sm flex-shrink-0"
            aria-expanded={expanded}
            aria-controls={`plug-${plug.key}-details`}
            aria-label={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <dl
          id={`plug-${plug.key}-details`}
          className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-1"
        >
          {plug.type && (
            <div className="flex">
              <dt className="font-medium text-gray-600 w-20">Type:</dt>
              <dd className="text-gray-900 font-mono">{plug.type}</dd>
            </div>
          )}
          {plug.default !== undefined && (
            <div className="flex">
              <dt className="font-medium text-gray-600 w-20">Default:</dt>
              <dd className="text-gray-900 font-mono">
                {JSON.stringify(plug.default)}
              </dd>
            </div>
          )}
          {plug.scope && (
            <div className="flex">
              <dt className="font-medium text-gray-600 w-20">Scope:</dt>
              <dd className="text-gray-900 font-mono">{plug.scope}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
