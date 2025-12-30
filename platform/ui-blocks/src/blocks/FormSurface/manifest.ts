import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest, JSONSchema7 } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const formSurfaceManifest: BlockManifest = finalizeManifest({
  block_id: "block.FormSurface",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            label: { type: "string" },
            value: {
              type: "string",
              "x-sensitive": true,
              "x-redaction": "hash",
            },
          },
          required: ["name", "label"],
          additionalProperties: false,
        },
      },
    },
    required: ["fields"],
    additionalProperties: false,
  } as unknown as JSONSchema7,
  risk_rating: "high",
  required_capability: "ui.render.high",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "warn",
    require_annotation_for_strings: true,
  },
});
