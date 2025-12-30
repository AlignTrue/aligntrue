import {
  Convert,
  OPS_GMAIL_MUTATIONS_ENABLED,
  Contracts,
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

export function getConversionService(
  eventStore: Storage.JsonlEventStore,
  commandLog: Storage.JsonlCommandLog,
): Convert.ConversionService {
  // For now, continue using core conversion service; pack integration will follow in Phase 3.
  return new Convert.ConversionService(eventStore, commandLog);
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
