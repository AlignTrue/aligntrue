import { finalizeManifest } from "../manifest-utils.js";
import type { BlockManifest, JSONSchema7 } from "@aligntrue/ui-contracts";
import { JSON_SCHEMA_DRAFT } from "@aligntrue/ui-contracts";
import { SafetyClass } from "@aligntrue/core/safety-classes";

export const formSurfaceManifest: BlockManifest = finalizeManifest({
  block_id: "block.FormSurface",
  display_name: "Form Surface",
  version: "0.1.0",
  props_schema: {
    $schema: JSON_SCHEMA_DRAFT,
    type: "object",
    properties: {
      form_id: { type: "string" },
      title: { type: "string" },
      submit_label: { type: "string" },
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
      submit: {
        type: "object",
        required: ["allowed_command_types"],
        properties: {
          allowed_command_types: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          default_command_type: { type: "string" },
        },
      },
    },
    required: ["form_id", "fields", "submit"],
    additionalProperties: false,
  } as unknown as JSONSchema7,
  risk_rating: "high",
  required_capability: "ui.render.high",
  audit_tags: ["ui.block.rendered"],
  redaction_policy: {
    default_for_unannotated: "warn",
    require_annotation_for_strings: true,
  },
  actions: [
    {
      action_type: "form.submitted",
      payload_schema: {
        $schema: JSON_SCHEMA_DRAFT,
        type: "object",
        required: ["form_id", "command_type", "values"],
        properties: {
          form_id: { type: "string" },
          command_type: { type: "string" },
          values: { type: "object" },
        },
        additionalProperties: false,
      } as unknown as JSONSchema7,
      safety_class: SafetyClass.WriteInternal,
      triggers: { ui_state: false, plan_regen: true },
    },
  ],
});
