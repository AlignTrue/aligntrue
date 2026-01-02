import type { CapabilityGrant } from "@aligntrue/core";
import type { JSONSchema7 } from "./json-schema.js";
import type { BlockActionSchema } from "./block-action.js";
import type { RedactionPolicy } from "./redaction.js";

export interface BlockUIHints {
  readonly tone?: "neutral" | "info" | "success" | "warning" | "danger";
  readonly density?: "compact" | "comfortable";
  readonly emphasis?: "flat" | "raised";
  readonly chrome?: "card" | "panel" | "none";
  readonly interaction?: "static" | "interactive";
}

export interface BlockManifest {
  readonly block_id: string;
  readonly version: string;
  readonly display_name?: string;
  readonly manifest_hash: string; // hash of manifest content

  // Props schema (JSON Schema draft-2020-12)
  readonly props_schema: JSONSchema7;
  readonly props_schema_hash: string;

  // Actions this block can emit
  readonly actions?: BlockActionSchema[];

  // Security
  readonly risk_rating: "low" | "medium" | "high";
  readonly required_capability: string; // e.g., "ui.render.medium"

  // Audit + redaction
  readonly audit_tags: string[];
  readonly redaction_policy: RedactionPolicy;

  // Optional capability bindings (for richer PDP contexts)
  readonly capabilities?: CapabilityGrant[];

  // Optional UI hints for renderer variants
  readonly ui?: BlockUIHints;
}
