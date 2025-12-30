import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const receiptTimelineManifest: BlockManifest = finalizeManifest({
  block_id: "block.ReceiptTimeline",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      receipts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            occurred_at: { type: "string", format: "date-time" },
            summary: { type: "string" },
          },
          required: ["id", "occurred_at", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["receipts"],
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
