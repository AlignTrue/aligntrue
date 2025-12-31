import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const statusIndicatorManifest: BlockManifest = finalizeManifest({
  block_id: "block.StatusIndicator",
  display_name: "Status Indicator",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      label: { type: "string" },
      state: { enum: ["ok", "warning", "error"] },
    },
    required: ["label", "state"],
    additionalProperties: false,
  },
  risk_rating: "low",
  required_capability: "ui.render.low",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "allow",
    require_annotation_for_strings: true,
  },
});
