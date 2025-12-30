import React from "react";
import { diffViewerManifest } from "./manifest.js";

export interface DiffViewerProps {
  before?: string;
  after?: string;
}

export function DiffViewer({ before, after }: DiffViewerProps) {
  return (
    <div data-block="diff-viewer">
      <pre>{before ?? ""}</pre>
      <pre>{after ?? ""}</pre>
    </div>
  );
}

export { diffViewerManifest };
