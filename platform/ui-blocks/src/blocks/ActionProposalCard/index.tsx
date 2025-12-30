import React from "react";
import { actionProposalCardManifest } from "./manifest.js";

export interface ActionProposalCardProps {
  title: string;
  rationale?: string;
  confidence?: number;
}

export function ActionProposalCard({
  title,
  rationale,
  confidence,
}: ActionProposalCardProps) {
  return (
    <div data-block="action-proposal-card">
      <h4>{title}</h4>
      {rationale ? <p>{rationale}</p> : null}
      {confidence !== undefined ? (
        <small>Confidence: {Math.round(confidence * 100)}%</small>
      ) : null}
    </div>
  );
}

export { actionProposalCardManifest };
