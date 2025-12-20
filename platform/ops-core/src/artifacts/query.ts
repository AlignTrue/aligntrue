import { ValidationError } from "../errors.js";
import type { ActorRef } from "../envelopes/actor.js";
import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";

export interface QueryArtifact {
  readonly artifact_id: string;
  readonly artifact_type: "query";
  readonly referenced_entities: string[];
  readonly referenced_fields: string[];
  readonly filters?: Record<string, unknown>;
  readonly projection_version?: string;
  readonly snapshot_id?: string;
  readonly created_at: string;
  readonly created_by: ActorRef;
  readonly correlation_id: string;
  readonly content_hash: string;
}

export interface QueryArtifactInput {
  readonly referenced_entities: string[];
  readonly referenced_fields: string[];
  readonly filters?: Record<string, unknown>;
  readonly projection_version?: string;
  readonly snapshot_id?: string;
  readonly created_at: string;
  readonly created_by: ActorRef;
  readonly correlation_id: string;
}

export function buildQueryArtifact(input: QueryArtifactInput): QueryArtifact {
  const referenced_entities = dedupeAndSort(input.referenced_entities);
  const referenced_fields = dedupeAndSort(input.referenced_fields);

  if (referenced_entities.length === 0) {
    throw new ValidationError(
      "QueryArtifact must reference at least one entity",
    );
  }
  if (referenced_fields.length === 0) {
    throw new ValidationError(
      "QueryArtifact must reference at least one field",
    );
  }

  const content = {
    artifact_type: "query" as const,
    referenced_entities,
    referenced_fields,
    filters: input.filters ?? {},
    projection_version: input.projection_version ?? null,
    snapshot_id: input.snapshot_id ?? null,
    created_at: input.created_at,
    created_by: input.created_by,
    correlation_id: input.correlation_id,
  };

  const content_hash = deterministicId(canonicalize(content));

  return {
    ...content,
    artifact_id: content_hash,
    content_hash,
    filters: input.filters,
    projection_version: input.projection_version,
    snapshot_id: input.snapshot_id,
  };
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
