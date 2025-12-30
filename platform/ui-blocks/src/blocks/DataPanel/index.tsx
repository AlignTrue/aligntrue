import React from "react";
import { dataPanelManifest } from "./manifest.js";

export interface DataPanelProps {
  entries: Array<{ label: string; value: string }>;
}

export function DataPanel({ entries }: DataPanelProps) {
  return (
    <div data-block="data-panel">
      <dl>
        {entries.map((entry) => (
          <React.Fragment key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

export { dataPanelManifest };
