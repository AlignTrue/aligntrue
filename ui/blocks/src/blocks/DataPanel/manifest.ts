import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const dataPanelManifest: BlockManifest = finalizeManifest({
  block_id: "block.DataPanel",
  display_name: "Data Panel",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
          required: ["label", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["entries"],
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
