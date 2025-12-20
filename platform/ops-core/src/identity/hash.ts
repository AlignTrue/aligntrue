import { createHash } from "node:crypto";
import { canonicalize } from "./canonicalize.js";

export function hashCanonical(value: unknown): string {
  const canonical = canonicalize(value as never);
  return createHash("sha256").update(canonical).digest("hex");
}
