import {
  OPS_TASKS_ENABLED,
  OPS_NOTES_ENABLED,
  OPS_GMAIL_MUTATIONS_ENABLED,
  Contracts,
  Identity,
} from "@aligntrue/ops-core";
import { Mutations as GmailMutations } from "@aligntrue/ops-shared-google-gmail";
import { createHost, type Host } from "@aligntrue/ops-host";
import manifestJson from "../../../cli.manifest.json" assert { type: "json" };
import { exitWithError } from "../../utils/command-utilities.js";

const HELP = `
Usage:
  aligntrue convert email-to-task <message_id>
  aligntrue convert email-to-note <message_id>
`;

const manifest = manifestJson as unknown as Contracts.AppManifest;
let hostInstance: Host | null = null;

export async function convert(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    console.log(HELP.trim());
    return;
  }

  switch (sub) {
    case "email-to-task":
      await convertEmailToTask(rest);
      return;
    case "email-to-note":
      await convertEmailToNote(rest);
      return;
    default:
      exitWithError(2, `Unknown convert subcommand: ${sub}`, {
        hint: "Use email-to-task or email-to-note",
      });
  }
}

async function convertEmailToTask(args: string[]): Promise<void> {
  const { messageId, labelArchive } = parseArgs(args);
  if (!OPS_TASKS_ENABLED) {
    exitWithError(1, "Tasks are disabled", {
      hint: "Set OPS_TASKS_ENABLED=1",
    });
  }

  const host = await getHost();
  const command = buildConvertCommand("task", messageId, cliActor(), {
    title: undefined,
  });
  const outcome = await host.runtime.dispatchCommand(command);

  console.log(`Converted email ${messageId} -> task (${outcome.status})`);

  if (labelArchive && !OPS_GMAIL_MUTATIONS_ENABLED) {
    console.warn(
      "OPS_GMAIL_MUTATIONS_ENABLED is not set; skipping Gmail label/archive mutation",
    );
  } else if (labelArchive) {
    const threadId = process.env["GMAIL_MUTATION_THREAD_ID"];
    if (!threadId) {
      console.warn(
        "GMAIL_MUTATION_THREAD_ID not set; skipping Gmail label/archive mutation because thread_id is required",
      );
      return;
    }

    const labelId = process.env["GMAIL_MUTATION_LABEL_ID"];
    const executor = new GmailMutations.GmailMutationExecutor(host.eventStore, {
      flagEnabled: OPS_GMAIL_MUTATIONS_ENABLED,
    });
    const mutationId = Identity.randomId();
    const operations: GmailMutations.GmailMutationOp[] = labelId
      ? ["APPLY_LABEL", "ARCHIVE"]
      : ["ARCHIVE"];
    const mutationRequest: GmailMutations.GmailMutationRequest = {
      mutation_id: mutationId,
      provider: "google_gmail",
      message_id: messageId,
      thread_id: threadId,
      operations,
      ...(labelId ? { label_id: labelId } : {}),
    };
    if (!labelId) {
      console.warn(
        "GMAIL_MUTATION_LABEL_ID not set; performing ARCHIVE without APPLY_LABEL",
      );
    }
    const mutation = await executor.execute({
      ...mutationRequest,
    });
    console.log(
      `Gmail mutation (${mutationId}): ${mutation.disabled ? "mutations disabled" : "executed"} ${
        mutation.receipts.length
      } receipts`,
    );
  }
}

async function convertEmailToNote(args: string[]): Promise<void> {
  const { messageId } = parseArgs(args);
  if (!OPS_NOTES_ENABLED) {
    exitWithError(1, "Notes are disabled", {
      hint: "Set OPS_NOTES_ENABLED=1",
    });
  }

  const host = await getHost();
  const command = buildConvertCommand("note", messageId, cliActor(), {});
  const outcome = await host.runtime.dispatchCommand(command);

  console.log(`Converted email ${messageId} -> note (${outcome.status})`);
}

function parseArgs(args: string[]): {
  messageId: string;
  labelArchive: boolean;
} {
  let messageId: string | undefined;
  let labelArchive = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args.at(i);
    if (arg === "--label-archive") {
      labelArchive = true;
      continue;
    }
    if (!messageId && arg) {
      messageId = arg;
    }
  }
  if (!messageId) {
    exitWithError(2, "message_id is required", {
      hint: HELP.trim(),
    });
  }
  return { messageId, labelArchive };
}

function cliActor(): Contracts.ActorRef {
  return {
    actor_id: process.env["USER"] || "cli-user",
    actor_type: "human",
    display_name: process.env["USER"] || "CLI User",
  };
}

async function getHost(): Promise<Host> {
  if (!hostInstance) {
    hostInstance = await createHost({ manifest });
  }
  return hostInstance;
}

function buildConvertCommand(
  kind: "task" | "note",
  messageId: string,
  actor: Contracts.ActorRef,
  opts: { title?: string; body_md?: string },
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
          title: opts.title,
          conversion_method: "user_action",
        } satisfies Contracts.ConvertEmailToTaskPayload)
      : ({
          message_id: messageId,
          title: opts.title,
          body_md: opts.body_md,
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
