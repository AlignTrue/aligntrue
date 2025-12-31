import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const approvalGateManifest: BlockManifest = finalizeManifest({
  block_id: "block.ApprovalGate",
  display_name: "Approval Gate",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      request_id: { type: "string" },
      status: { enum: ["pending", "approved", "rejected"] },
      reason: { type: "string" },
    },
    required: ["request_id", "status"],
    additionalProperties: false,
  },
  risk_rating: "high",
  required_capability: "ui.render.high",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "allow",
    require_annotation_for_strings: true,
  },
});
