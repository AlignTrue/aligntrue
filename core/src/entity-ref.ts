// Canonical entity references used across ops-core.
// Format: "{type}:{id}" where type is a known EntityType; ids may include colons
// as part of provider-specific identifiers (e.g., GitHub refs).
//
import { ValidationError } from "./errors.js";

export type EntityType =
  | "email_thread"
  | "email_message"
  | "slack_thread"
  | "task"
  | "note"
  | "voice_call"
  | "trajectory"
  // GitHub entities
  | "gh_repo"
  | "gh_pr"
  | "gh_issue"
  | "gh_commit"
  | "gh_file"
  | "gh_workflow"
  | "gh_actor";

export function entityRef(type: EntityType, id: string): string {
  if (!id) {
    throw new ValidationError(`Invalid entity id: ${id}`, { id, type });
  }
  return `${type}:${id}`;
}

export function parseEntityRef(
  ref: string,
): { type: EntityType; id: string } | null {
  const idx = ref.indexOf(":");
  if (idx === -1) return null;
  const type = ref.slice(0, idx) as EntityType;
  const id = ref.slice(idx + 1);
  if (!id) return null;
  return { type, id };
}

export type EntityRef = string; // {type}:{id}
export type ArtifactRef = string; // artifact:{artifact_type}:{artifact_id}
export type ExternalRef = string; // ext:{provider}:{external_id}@{version_hint}

export function artifactRef(
  artifact_type: string,
  artifact_id: string,
): ArtifactRef {
  if (!artifact_type || artifact_type.includes(":")) {
    throw new ValidationError("Invalid artifact_type", { artifact_type });
  }
  if (!artifact_id || artifact_id.includes(":")) {
    throw new ValidationError("Invalid artifact_id", { artifact_id });
  }
  return `artifact:${artifact_type}:${artifact_id}`;
}

export function externalRef(
  provider: string,
  external_id: string,
  version_hint?: string,
): ExternalRef {
  if (!provider || provider.includes(":") || provider.includes("@")) {
    throw new ValidationError("Invalid provider", { provider });
  }
  if (!external_id || external_id.includes("@")) {
    throw new ValidationError("Invalid external_id", { external_id });
  }
  return version_hint
    ? `ext:${provider}:${external_id}@${version_hint}`
    : `ext:${provider}:${external_id}`;
}

export function parseArtifactRef(
  ref: string,
): { artifact_type: string; artifact_id: string } | null {
  if (!ref.startsWith("artifact:")) return null;
  const rest = ref.slice("artifact:".length);
  const idx = rest.indexOf(":");
  if (idx === -1) return null;
  const artifact_type = rest.slice(0, idx);
  const artifact_id = rest.slice(idx + 1);
  if (!artifact_type || !artifact_id) return null;
  return { artifact_type, artifact_id };
}

export function parseExternalRef(ref: string): {
  provider: string;
  external_id: string;
  version_hint?: string | undefined;
} | null {
  if (!ref.startsWith("ext:")) return null;
  const rest = ref.slice("ext:".length);
  const atIdx = rest.indexOf("@");
  const main = atIdx === -1 ? rest : rest.slice(0, atIdx);
  const providerIdx = main.indexOf(":");
  if (providerIdx === -1) return null;
  const provider = main.slice(0, providerIdx);
  const external_id = main.slice(providerIdx + 1);
  if (!provider || !external_id) return null;
  const version_hint = atIdx === -1 ? undefined : rest.slice(atIdx + 1);
  return { provider, external_id, version_hint };
}
