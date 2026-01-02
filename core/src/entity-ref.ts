// Canonical entity references used across ops-core.
// Format: "{type}:{id}" where type is a known EntityType and id has no colon.
//
import { ValidationError } from "./errors.js";

export type EntityType =
  | "email_thread"
  | "email_message"
  | "slack_thread"
  | "task"
  | "note"
  | "voice_call";

export function entityRef(type: EntityType, id: string): string {
  if (!id || id.includes(":")) {
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
