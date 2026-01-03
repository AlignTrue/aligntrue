import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const taskListManifest: BlockManifest = finalizeManifest({
  block_id: "block.TaskList",
  display_name: "Task List",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      title: { type: "string" },
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            bucket: { type: "string" },
            status: { type: "string" },
            due_at: { type: "string" },
          },
          required: ["id", "title"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "tasks"],
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
