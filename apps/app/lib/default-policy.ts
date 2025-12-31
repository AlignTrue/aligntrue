import { hashCanonical } from "@aligntrue/ops-core";
import {
  taskListManifest,
  formSurfaceManifest,
  noteListManifest,
} from "@aligntrue/ui-blocks";
import type { CompilerPolicy } from "./plan-compiler";

const basePolicy = {
  policy_id: "ui-default",
  version: "0.0.1",
  required_surfaces_by_intent: {
    list: ["tasks_list", "notes_list", "create_task_form", "create_note_form"],
    create: [
      "tasks_list",
      "notes_list",
      "create_task_form",
      "create_note_form",
    ],
    dashboard: ["tasks_list", "notes_list"],
    detail: ["tasks_list", "notes_list"],
    triage: ["tasks_list", "notes_list"],
  },
  default_layout: "single",
  surface_to_block: {
    tasks_list: {
      block_type: taskListManifest.block_id,
      version: taskListManifest.version,
      manifest_hash: taskListManifest.manifest_hash,
      slot: "main",
      default_props: { title: "Tasks" },
    },
    notes_list: {
      block_type: noteListManifest.block_id,
      version: noteListManifest.version,
      manifest_hash: noteListManifest.manifest_hash,
      slot: "main",
      default_props: { title: "Notes" },
    },
    create_task_form: {
      block_type: formSurfaceManifest.block_id,
      version: formSurfaceManifest.version,
      manifest_hash: formSurfaceManifest.manifest_hash,
      slot: "main",
      default_props: {
        form_id: "form-create-task",
        title: "New Task",
        submit_label: "Add Task",
        fields: [{ name: "title", label: "What needs to be done?" }],
        submit: {
          allowed_command_types: ["tasks.create"],
          default_command_type: "tasks.create",
        },
      },
    },
    create_note_form: {
      block_type: formSurfaceManifest.block_id,
      version: formSurfaceManifest.version,
      manifest_hash: formSurfaceManifest.manifest_hash,
      slot: "main",
      default_props: {
        form_id: "form-create-note",
        title: "New Note",
        submit_label: "Add Note",
        fields: [{ name: "title", label: "Note title" }],
        submit: {
          allowed_command_types: ["notes.create"],
          default_command_type: "notes.create",
        },
      },
    },
  },
} satisfies Omit<CompilerPolicy, "policy_hash">;

export const DEFAULT_POLICY: CompilerPolicy = {
  ...basePolicy,
  policy_hash: hashCanonical(basePolicy),
};
