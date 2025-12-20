import { ValidationError } from "../errors.js";
import type { ActorRef } from "../envelopes/actor.js";
import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";

export interface DerivedArtifact {
  readonly artifact_id: string;
  readonly artifact_type: "derived";
  readonly input_query_ids: string[];
  readonly input_hashes: string[];
  readonly policy_version: string;
  readonly output_type: string;
  readonly output_data: unknown;
  readonly assumptions?: string[];
  readonly confidence?: number;
  readonly explanation?: string;
  readonly created_at: string;
  readonly created_by: ActorRef;
  readonly correlation_id: string;
  readonly content_hash: string;
}

export interface DerivedArtifactInput {
  readonly input_query_ids: string[];
  readonly input_hashes: string[];
  readonly policy_version: string;
  readonly output_type: string;
  readonly output_data: unknown;
  readonly assumptions?: string[];
  readonly confidence?: number;
  readonly explanation?: string;
  readonly created_at: string;
  readonly created_by: ActorRef;
  readonly correlation_id: string;
}

export function buildDerivedArtifact(
  input: DerivedArtifactInput,
): DerivedArtifact {
  const input_query_ids = dedupeAndSort(input.input_query_ids);
  const input_hashes = dedupeAndSort(input.input_hashes);

  if (input_query_ids.length === 0) {
    throw new ValidationError(
      "DerivedArtifact requires at least one input query id",
    );
  }
  if (input_hashes.length === 0) {
    throw new ValidationError(
      "DerivedArtifact requires at least one input hash",
    );
  }
  if (!input.policy_version) {
    throw new ValidationError("DerivedArtifact requires a policy_version");
  }
  if (!input.output_type) {
    throw new ValidationError("DerivedArtifact requires an output_type");
  }
  if (input.confidence !== undefined) {
    if (input.confidence < 0 || input.confidence > 1) {
      throw new ValidationError(
        "DerivedArtifact confidence must be between 0 and 1",
      );
    }
  }

  const assumptions = input.assumptions
    ? dedupeAndSort(input.assumptions)
    : undefined;

  const content = {
    artifact_type: "derived" as const,
    input_query_ids,
    input_hashes,
    policy_version: input.policy_version,
    output_type: input.output_type,
    output_data: input.output_data,
    ...(assumptions !== undefined && { assumptions }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    ...(input.explanation !== undefined && { explanation: input.explanation }),
    created_at: input.created_at,
    created_by: input.created_by,
    correlation_id: input.correlation_id,
  };

  const content_hash = deterministicId(canonicalize(content));

  return {
    ...content,
    artifact_id: content_hash,
    content_hash,
    ...(assumptions !== undefined && { assumptions }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    ...(input.explanation !== undefined && { explanation: input.explanation }),
  };
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
