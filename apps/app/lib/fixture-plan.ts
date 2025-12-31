import type { RenderPlan, PlanCore } from "@aligntrue/ui-contracts";
import {
  taskListManifest,
  statusIndicatorManifest,
  formSurfaceManifest,
  noteListManifest,
} from "@aligntrue/ui-blocks";
import { TASK_COMMAND_TYPES } from "@aligntrue/pack-tasks";
import { NOTE_COMMAND_TYPES } from "@aligntrue/pack-notes";
import { upsertPlan } from "./db";
import { readTasksProjection } from "./projections/tasks";
import { readNotesProjection } from "./projections/notes";
import { buildTasksViewModel, buildNotesViewModel } from "./ui-context";

const FIXTURE_PLAN_ID = "fixture-plan-1";

export async function ensureFixturePlan(): Promise<{
  plan_id: string;
  plan: RenderPlan;
}> {
  const tasksProjection = await readTasksProjection();
  const tasksVM = buildTasksViewModel(tasksProjection);
  const notesProjection = await readNotesProjection();
  const notesVM = buildNotesViewModel(notesProjection);

  const core: PlanCore = {
    layout_template: "single",
    input_refs: [],
    policy_version: "ui@0.0.1",
    blocks: [
      {
        block_instance_id: "tasklist-main",
        block_type: taskListManifest.block_id,
        block_version: taskListManifest.version,
        manifest_hash: taskListManifest.manifest_hash,
        slot: "main",
        props: {
          title: "Tasks",
          tasks: tasksVM.items,
        },
      },
      {
        block_instance_id: "status-indicator-main",
        block_type: statusIndicatorManifest.block_id,
        block_version: statusIndicatorManifest.version,
        manifest_hash: statusIndicatorManifest.manifest_hash,
        slot: "main",
        props: {
          label: "Tasks ok",
          state: "ok",
        },
      },
      {
        block_instance_id: "form-create-task",
        block_type: formSurfaceManifest.block_id,
        block_version: formSurfaceManifest.version,
        manifest_hash: formSurfaceManifest.manifest_hash,
        slot: "main",
        props: {
          form_id: "form-create-task",
          fields: [{ name: "title", label: "Task title" }],
          submit: {
            allowed_command_types: [TASK_COMMAND_TYPES.Create],
            default_command_type: TASK_COMMAND_TYPES.Create,
          },
        },
      },
      {
        block_instance_id: "notelist-main",
        block_type: noteListManifest.block_id,
        block_version: noteListManifest.version,
        manifest_hash: noteListManifest.manifest_hash,
        slot: "main",
        props: {
          title: "Notes",
          notes: notesVM.items,
        },
      },
      {
        block_instance_id: "form-create-note",
        block_type: formSurfaceManifest.block_id,
        block_version: formSurfaceManifest.version,
        manifest_hash: formSurfaceManifest.manifest_hash,
        slot: "main",
        props: {
          form_id: "form-create-note",
          fields: [{ name: "title", label: "Note title" }],
          submit: {
            allowed_command_types: [NOTE_COMMAND_TYPES.Create],
            default_command_type: NOTE_COMMAND_TYPES.Create,
          },
        },
      },
    ],
  };

  const plan_id = FIXTURE_PLAN_ID;
  const created_at = new Date().toISOString();
  const plan: RenderPlan = {
    plan_id,
    core,
    meta: {
      request_id: FIXTURE_PLAN_ID,
      actor: { actor_id: "system", actor_type: "service" },
      correlation_id: FIXTURE_PLAN_ID,
      created_at,
    },
  };

  upsertPlan({
    plan_id,
    core: plan.core,
    meta: plan.meta,
    status: "approved",
    created_at,
  });

  return { plan_id, plan };
}
