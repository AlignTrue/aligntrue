import { randomUUID } from "node:crypto";
import { hashCanonical } from "./hash.js";

/**
 * Generate a stable identifier from content.
 */
export function deterministicId(value: unknown): string {
  return hashCanonical(value);
}

/**
 * Generate a time-friendly random id (UUID v4 fallback for Phase 0).
 */
export function randomId(): string {
  return randomUUID();
}

export function generateEventId(payload: unknown): string {
  return deterministicId(payload);
}

export function generateCommandId(payload: unknown): string {
  return deterministicId(payload);
}
