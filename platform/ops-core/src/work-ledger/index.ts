import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import {
  WORK_EVENT_TYPES,
  WORK_LEDGER_SCHEMA_VERSION,
  type WorkLedgerEvent,
  type WorkLedgerEventType,
  type WorkStatus,
} from "./events.js";
import { WorkLedger } from "./commands.js";

export { WORK_EVENT_TYPES, WORK_LEDGER_SCHEMA_VERSION };
export type { WorkLedgerEvent, WorkLedgerEventType, WorkStatus };
export { WorkLedger };
export * from "./state-machine.js";
export * from "./events.js";
export * from "./commands.js";

export const DEFAULT_WORK_LEDGER_PATH = "./data/ops-core-work-ledger.jsonl";

export function createJsonlWorkLedger(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  now?: () => string;
}): WorkLedger {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_WORK_LEDGER_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
  );
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new WorkLedger(eventStore, commandLog, ledgerOpts);
}
