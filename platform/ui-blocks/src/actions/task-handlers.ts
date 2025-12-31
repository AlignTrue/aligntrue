import { deterministicId } from "@aligntrue/ops-core";
import { TASK_COMMAND_TYPES } from "@aligntrue/pack-tasks";
import type { BlockAction, BlockManifest } from "@aligntrue/ui-contracts";
import type { CommandEnvelope } from "@aligntrue/ops-core";
import type { ActionDispatcher } from "../action-dispatcher.js";
import type { CommandDispatcher } from "./common.js";

interface FormSubmitPayload {
  form_id?: string;
  command_type?: string;
  values?: Record<string, unknown>;
}

export function registerTaskHandlers(
  dispatcher: ActionDispatcher,
  manifest: BlockManifest,
  commandDispatcher: CommandDispatcher,
): void {
  dispatcher.registerFromManifest(
    manifest,
    "form.submitted",
    async (action: BlockAction) => {
      const payload = action.payload as FormSubmitPayload;
      if (payload.command_type !== TASK_COMMAND_TYPES.Create) {
        return { command_envelope: null };
      }

      const title = payload.values?.["title"] as string | undefined;
      const command_id = deterministicId({
        plan_id: action.plan_id,
        actor_id: action.actor.actor_id,
        idempotency_key: action.idempotency_key,
      });

      const envelope: CommandEnvelope = {
        command_id,
        idempotency_key: command_id,
        command_type: TASK_COMMAND_TYPES.Create,
        payload: {
          task_id: deterministicId({ title }),
          title,
          bucket: "today",
          status: "open",
        },
        target_ref: `plan:${action.plan_id}`,
        dedupe_scope: "target",
        correlation_id: action.correlation_id,
        actor: action.actor,
        requested_at: new Date().toISOString(),
        causation_type: "user_action",
        causation_id: action.action_id,
        metadata: { block_instance_id: action.block_instance_id },
      };

      const outcome = await commandDispatcher(envelope);
      return { command_envelope: envelope, outcome };
    },
  );
}
