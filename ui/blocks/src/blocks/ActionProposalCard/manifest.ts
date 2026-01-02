import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const actionProposalCardManifest: BlockManifest = finalizeManifest({
  block_id: "block.ActionProposalCard",
  display_name: "Action Proposal Card",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      title: { type: "string" },
      rationale: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["title"],
    additionalProperties: false,
  },
  risk_rating: "medium",
  required_capability: "ui.render.medium",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "allow",
    require_annotation_for_strings: true,
  },
});
