import {
  OPS_CORE_ENABLED,
  Identity,
  Storage,
  WorkLedger,
  Projections,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

export const CLI_ACTOR: WorkLedger.WorkCommandEnvelope["actor"] = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
};

export function ensureOpsCoreEnabled(): void {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable work ledger commands",
    });
  }
}

export function createLedger(): WorkLedger.WorkLedger {
  const eventStore = new Storage.JsonlEventStore(
    WorkLedger.DEFAULT_WORK_LEDGER_PATH,
  );
  const commandLog = new Storage.JsonlCommandLog();
  return new WorkLedger.WorkLedger(eventStore, commandLog);
}

export function buildCommand<T extends WorkLedger.WorkCommandType>(
  command_type: T,
  payload: WorkLedger.WorkCommandPayload,
): WorkLedger.WorkCommandEnvelope<T> {
  const idempotency_key = Identity.generateCommandId({ command_type, payload });
  return {
    command_id: Identity.randomId(),
    idempotency_key,
    command_type,
    payload,
    target_ref: "work-ledger",
    dedupe_scope: "work-ledger",
    correlation_id: Identity.randomId(),
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } as WorkLedger.WorkCommandEnvelope<T>;
}

export async function readProjections() {
  return Projections.rebuildWorkLedger(
    new Storage.JsonlEventStore(WorkLedger.DEFAULT_WORK_LEDGER_PATH),
  );
}
