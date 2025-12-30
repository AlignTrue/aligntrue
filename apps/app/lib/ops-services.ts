import {
  OPS_GMAIL_MUTATIONS_ENABLED,
  Contracts,
  Identity,
} from "@aligntrue/ops-core";
import { createHost, Storage, type Host } from "@aligntrue/ops-host";
import manifestJson from "../app.manifest.json";
import { Mutations as GmailMutations } from "@aligntrue/ops-shared-google-gmail";
import * as GmailApi from "./gmail-api";

const manifest = manifestJson as unknown as Contracts.AppManifest;
let hostInstance: Host | null = null;

export async function getHost(): Promise<Host> {
  if (!hostInstance) {
    hostInstance = await createHost({ manifest });
  }
  return hostInstance;
}

export function getEventStore(_path?: string): Storage.JsonlEventStore {
  if (!hostInstance) {
    throw new Error("Host not initialized. Call getHost() first.");
  }
  // Host uses JsonlEventStore under the hood in this phase
  return hostInstance.eventStore as Storage.JsonlEventStore;
}

export function getCommandLog(
  _commandsPath?: string,
  _outcomesPath?: string,
): Storage.JsonlCommandLog {
  if (!hostInstance) {
    throw new Error("Host not initialized. Call getHost() first.");
  }
  return hostInstance.commandLog as Storage.JsonlCommandLog;
}

export async function dispatchConvertCommand(
  kind: "task" | "note",
  messageId: string,
  actor: Contracts.ActorRef,
  opts?: { title?: string; body_md?: string },
) {
  if (!hostInstance) {
    throw new Error("Host not initialized. Call getHost() first.");
  }
  const command = buildConvertCommand(kind, messageId, actor, opts);
  const outcome = await hostInstance.runtime.dispatchCommand(command);
  return { command, outcome };
}

export function getGmailMutationExecutor(
  eventStore: Storage.JsonlEventStore,
): GmailMutations.GmailMutationExecutor {
  return new GmailMutations.GmailMutationExecutor(eventStore, {
    flagEnabled: OPS_GMAIL_MUTATIONS_ENABLED,
    performer: {
      async perform(op, input) {
        if (op === "APPLY_LABEL") {
          const labelId = input.label_id;
          if (!labelId) {
            throw new Error("label_id is required for APPLY_LABEL");
          }
          await GmailApi.applyLabel(input.message_id, labelId);
          return { destination_ref: `label:${labelId}` };
        }
        if (op === "ARCHIVE") {
          await GmailApi.archive(input.thread_id);
          return { destination_ref: `thread:${input.thread_id}` };
        }
        const exhaustiveCheck: never = op;
        throw new Error(`Unsupported operation: ${exhaustiveCheck}`);
      },
    },
  });
}

function buildConvertCommand(
  kind: "task" | "note",
  messageId: string,
  actor: Contracts.ActorRef,
  opts?: { title?: string; body_md?: string },
): Contracts.CommandEnvelope {
  const command_id = Identity.randomId();
  const command_type =
    kind === "task"
      ? Contracts.CONVERT_COMMAND_TYPES.EmailToTask
      : Contracts.CONVERT_COMMAND_TYPES.EmailToNote;
  const idempotency_key = Identity.generateCommandId({
    source_type: "email",
    source_ref: messageId,
    op: command_type,
  });

  const payload =
    kind === "task"
      ? ({
          message_id: messageId,
          title: opts?.title,
          conversion_method: "user_action",
        } satisfies Contracts.ConvertEmailToTaskPayload)
      : ({
          message_id: messageId,
          title: opts?.title,
          body_md: opts?.body_md,
          conversion_method: "user_action",
        } satisfies Contracts.ConvertEmailToNotePayload);

  return {
    command_id,
    idempotency_key,
    command_type,
    payload,
    target_ref: `email:${messageId}`,
    dedupe_scope: "target",
    correlation_id: command_id,
    actor,
    requested_at: new Date().toISOString(),
    capability_id: command_type,
  };
}
