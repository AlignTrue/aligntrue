import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest, JSONSchema7 } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const inboxThreadManifest: BlockManifest = finalizeManifest({
  block_id: "block.InboxThread",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      subject: { type: "string" },
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            sender: { type: "string" },
            body: {
              type: "string",
              "x-sensitive": true,
              "x-redaction": "hash",
            },
          },
          required: ["id", "sender", "body"],
          additionalProperties: false,
        },
      },
    },
    required: ["subject", "messages"],
    additionalProperties: false,
  } as unknown as JSONSchema7,
  risk_rating: "medium",
  required_capability: "ui.render.medium",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "allow",
    require_annotation_for_strings: true,
  },
});
