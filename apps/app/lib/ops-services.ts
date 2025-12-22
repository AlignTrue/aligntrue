import {
  Convert,
  GmailMutations,
  OPS_GMAIL_MUTATIONS_ENABLED,
  Storage,
} from "@aligntrue/ops-core";
import * as GmailApi from "./gmail-api";

export function getEventStore(path?: string): Storage.JsonlEventStore {
  return new Storage.JsonlEventStore(path);
}

export function getCommandLog(
  commandsPath?: string,
  outcomesPath?: string,
): Storage.JsonlCommandLog {
  return new Storage.JsonlCommandLog(commandsPath, outcomesPath);
}

export function getConversionService(): Convert.ConversionService {
  const eventStore = getEventStore();
  const commandLog = getCommandLog();
  return new Convert.ConversionService(eventStore, commandLog);
}

export function getGmailMutationExecutor(
  eventStore: Storage.JsonlEventStore = getEventStore(),
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
