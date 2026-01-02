import {
  OPS_GMAIL_MUTATIONS_ENABLED,
  Contracts,
  Identity,
  Emails,
} from "@aligntrue/core";
import { createHost, Storage, type Host } from "@aligntrue/host";
import manifestJson from "../app.manifest.json";
import { Mutations as GmailMutations } from "@aligntrue/connector-google-gmail";

const manifest = manifestJson as unknown as Contracts.AppManifest;
let hostInstance: Host | null = null;

export async function getHost(): Promise<Host> {
  if (!hostInstance) {
    hostInstance = await createHost({ manifest });
  }
  return hostInstance;
}

export function getEventStore(path?: string): Storage.JsonlEventStore {
  if (path) {
    return new Storage.JsonlEventStore(path);
  }
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
  opts?: { title?: string; body_md?: string; source_ref?: string },
) {
  if (!hostInstance) {
    throw new Error("Host not initialized. Call getHost() first.");
  }
  const command = buildConvertCommand(kind, messageId, actor, opts);
  const outcome = await hostInstance.runtime.dispatchCommand(command);
  return { command, outcome };
}

export function getConversionService(
  eventStore: Storage.JsonlEventStore,
  _commandLog: Storage.JsonlCommandLog,
) {
  return {
    async convertEmailToTask({
      source_ref,
      actor,
    }: {
      source_ref: string;
      actor: Contracts.ActorRef;
    }) {
      if (!hostInstance) {
        throw new Error("Host not initialized");
      }

      // Try to find the email to get the canonical source_ref and message_id
      let canonical_ref = source_ref;
      let canonical_message_id = source_ref;
      for await (const event of eventStore.stream()) {
        if (event.event_type !== Emails.EMAIL_EVENT_TYPES.EmailMessageIngested)
          continue;
        const payload = event.payload as Emails.EmailMessageIngestedPayload;
        if (
          payload.source_ref === source_ref ||
          payload.message_id === source_ref
        ) {
          canonical_ref = payload.source_ref;
          canonical_message_id = payload.message_id;
          break;
        }
      }

      const task_id = Identity.deterministicId({
        source_ref: canonical_ref,
        op: "to_task",
      });

      const command = buildConvertCommand("task", canonical_message_id, actor, {
        source_ref: canonical_ref,
      });

      const outcome = await hostInstance.runtime.dispatchCommand(command);

      return {
        created_id: task_id,
        source_ref: canonical_ref,
        outcome,
      };
    },
  };
}

export function getGmailMutationExecutor(
  eventStore: Storage.JsonlEventStore,
): GmailMutations.GmailMutationExecutor {
  const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

  const getAccessToken = (accessToken?: string): string => {
    const token =
      accessToken ?? process.env["GMAIL_MUTATION_ACCESS_TOKEN"] ?? undefined;
    if (!token) {
      throw new Error("GMAIL_MUTATION_ACCESS_TOKEN is not set");
    }
    return token;
  };

  const applyLabel = async (
    messageId: string,
    labelId: string,
    accessToken?: string,
  ): Promise<{ destination_ref: string }> => {
    const token = getAccessToken(accessToken);
    const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds: [labelId] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`applyLabel failed: ${res.status} ${text}`);
    }
    return { destination_ref: `label:${labelId}` };
  };

  const archiveThread = async (
    threadId: string,
    accessToken?: string,
  ): Promise<{ destination_ref: string }> => {
    const token = getAccessToken(accessToken);
    const res = await fetch(`${GMAIL_API_BASE}/threads/${threadId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`archive failed: ${res.status} ${text}`);
    }
    return { destination_ref: `thread:${threadId}` };
  };

  return new GmailMutations.GmailMutationExecutor(eventStore, {
    flagEnabled: OPS_GMAIL_MUTATIONS_ENABLED,
    performer: {
      async perform(op, input) {
        if (op === "APPLY_LABEL") {
          const labelId = input.label_id;
          if (!labelId) {
            throw new Error("label_id is required for APPLY_LABEL");
          }
          return applyLabel(input.message_id, labelId);
        }
        if (op === "ARCHIVE") {
          return archiveThread(input.thread_id);
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
  opts?: { title?: string; body_md?: string; source_ref?: string },
): Contracts.CommandEnvelope {
  const command_id = Identity.randomId();
  const command_type =
    kind === "task"
      ? Contracts.CONVERT_COMMAND_TYPES.EmailToTask
      : Contracts.CONVERT_COMMAND_TYPES.EmailToNote;

  // Use source_ref for idempotency if provided, else fall back to messageId
  const stable_ref = opts?.source_ref ?? messageId;
  const idempotency_key = Identity.generateCommandId({
    source_type: "email",
    source_ref: stable_ref,
    op: command_type,
  });

  const payload =
    kind === "task"
      ? ({
          message_id: messageId,
          source_ref: opts?.source_ref,
          title: opts?.title,
          conversion_method: "user_action",
        } satisfies Contracts.ConvertEmailToTaskPayload)
      : ({
          message_id: messageId,
          source_ref: opts?.source_ref,
          title: opts?.title,
          body_md: opts?.body_md,
          conversion_method: "user_action",
        } satisfies Contracts.ConvertEmailToNotePayload);

  return {
    command_id,
    idempotency_key,
    command_type,
    payload,
    target_ref: `email:${stable_ref}`,
    dedupe_scope: "target",
    correlation_id: command_id,
    actor,
    requested_at: new Date().toISOString(),
    capability_id: command_type,
  };
}
