import {
  OPS_TASKS_ENABLED,
  OPS_NOTES_ENABLED,
  OPS_GMAIL_MUTATIONS_ENABLED,
  Contracts,
  Identity,
} from "@aligntrue/core";
import { Mutations as GmailMutations } from "@aligntrue/connector-google-gmail";
import { createHost, type Host } from "@aligntrue/host";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const manifestJson = require("../../../cli.manifest.json");
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { CLI_ACTOR } from "../../utils/cli-actor.js";
import { defineCommand } from "../../utils/command-router.js";

const manifest = manifestJson as unknown as Contracts.AppManifest;
let hostInstance: Host | null = null;

export const convert = defineCommand({
  name: "convert",
  subcommands: {
    "email-to-task": {
      handler: convertEmailToTask,
      description: "Convert an email to a task",
    },
    "email-to-note": {
      handler: convertEmailToNote,
      description: "Convert an email to a note",
    },
  },
});

async function convertEmailToTask(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [{ flag: "label-archive", type: "boolean" }];
  const parsed = parseArgs(args, spec);
  const messageId = parsed.positional[0];
  const labelArchive = !!parsed.flags["label-archive"];

  if (!messageId) {
    exitWithError(2, "message_id is required", {
      hint: "Usage: aligntrue convert email-to-task <message_id> [--label-archive]",
    });
  }

  if (!OPS_TASKS_ENABLED) {
    exitWithError(1, "Tasks are disabled", {
      hint: "Set OPS_TASKS_ENABLED=1",
    });
  }

  const host = await getHost();
  const command = buildConvertCommand("task", messageId, CLI_ACTOR, {});
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
  const parsed = parseArgs(args, []);
  const messageId = parsed.positional[0];

  if (!messageId) {
    exitWithError(2, "message_id is required", {
      hint: "Usage: aligntrue convert email-to-note <message_id>",
    });
  }

  if (!OPS_NOTES_ENABLED) {
    exitWithError(1, "Notes are disabled", {
      hint: "Set OPS_NOTES_ENABLED=1",
    });
  }

  const host = await getHost();
  const command = buildConvertCommand("note", messageId, CLI_ACTOR, {});
  const outcome = await host.runtime.dispatchCommand(command);

  console.log(`Converted email ${messageId} -> note (${outcome.status})`);
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

  const payload: Contracts.ConvertCommandPayload =
    kind === "task"
      ? {
          message_id: messageId,
          conversion_method: "user_action",
          ...(opts.title ? { title: opts.title } : {}),
        }
      : {
          message_id: messageId,
          conversion_method: "user_action",
          ...(opts.title ? { title: opts.title } : {}),
          ...(opts.body_md ? { body_md: opts.body_md } : {}),
        };

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
