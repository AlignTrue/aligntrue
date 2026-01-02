import React from "react";
import { BlockKvp } from "../../ui/BlockKvp.js";
import { dataPanelManifest } from "./manifest.js";

export interface DataPanelProps {
  entries: Array<{ label: string; value: string }>;
}

export function DataPanel({ entries }: DataPanelProps) {
  return (
    <BlockKvp>
      {entries.map((entry) => (
        <React.Fragment key={entry.label}>
          <dt className="text-xs font-medium text-muted-foreground">
            {entry.label}
          </dt>
          <dd className="text-sm text-foreground">{entry.value}</dd>
        </React.Fragment>
      ))}
    </BlockKvp>
  );
}

export { dataPanelManifest };
