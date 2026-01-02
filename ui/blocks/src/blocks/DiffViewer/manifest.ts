import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";

export const diffViewerManifest: BlockManifest = finalizeManifest({
  block_id: "block.DiffViewer",
  display_name: "Diff Viewer",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      before: { type: "string" },
      after: { type: "string" },
    },
    additionalProperties: false,
  },
  risk_rating: "low",
  required_capability: "ui.render.low",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "warn",
    require_annotation_for_strings: true,
  },
});
