import { ValidationError } from "../errors.js";
import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { ActorRef } from "../envelopes/actor.js";
import {
  artifactRef,
  externalRef,
  parseArtifactRef,
  parseExternalRef,
  type EntityRef,
  type ArtifactRef,
  type ExternalRef,
} from "../entity-ref.js";

/**
 * Provenance link types describe how a reference was established.
 */
export type RefLinkType = "observed" | "inferred" | "asserted";

export interface RefLink<T> {
  ref: T;
  link: RefLinkType;
  confidence?: number;
  evidence?: ArtifactRef[];
}

export interface TrajectoryRefs {
  entity_refs: RefLink<EntityRef>[];
  artifact_refs: RefLink<ArtifactRef>[];
  external_refs: RefLink<ExternalRef>[];
}

export function validateRefs(refs: TrajectoryRefs): void {
  if (!refs) {
    throw new ValidationError("refs is required");
  }
  const { entity_refs, artifact_refs, external_refs } = refs;
  if (
    !Array.isArray(entity_refs) ||
    !Array.isArray(artifact_refs) ||
    !Array.isArray(external_refs)
  ) {
    throw new ValidationError("refs arrays are required");
  }
  for (const entry of [...entity_refs, ...artifact_refs, ...external_refs]) {
    if (!entry.ref) throw new ValidationError("ref missing");
    if (
      entry.link !== "observed" &&
      entry.link !== "inferred" &&
      entry.link !== "asserted"
    ) {
      throw new ValidationError("invalid ref link type", { link: entry.link });
    }
    if (
      entry.confidence !== undefined &&
      (entry.confidence < 0 || entry.confidence > 1)
    ) {
      throw new ValidationError("ref confidence must be between 0 and 1");
    }
    if (entry.evidence !== undefined && !Array.isArray(entry.evidence)) {
      throw new ValidationError("ref evidence must be an array when provided");
    }
  }
}

/**
 * Build a stable content hash for refs to allow deterministic comparisons.
 */
export function hashRefs(refs: TrajectoryRefs): string {
  validateRefs(refs);
  const normalized = {
    entity_refs: sortRefLinks(refs.entity_refs),
    artifact_refs: sortRefLinks(refs.artifact_refs),
    external_refs: sortRefLinks(refs.external_refs),
  };
  return deterministicId(canonicalize(normalized));
}

function sortRefLinks<
  T extends {
    ref: string;
    link: RefLinkType;
    confidence?: number;
    evidence?: ArtifactRef[];
  },
>(links: T[]): T[] {
  return [...links].sort((a, b) => {
    if (a.ref === b.ref) return a.link.localeCompare(b.link);
    return a.ref.localeCompare(b.ref);
  });
}

/**
 * Minimal metadata for provenance when needed by artifacts.
 */
export interface RefActorContext {
  actor: ActorRef;
  correlation_id: string;
  created_at: string;
}

export {
  artifactRef,
  externalRef,
  parseArtifactRef,
  parseExternalRef,
  type EntityRef,
  type ArtifactRef,
  type ExternalRef,
};
