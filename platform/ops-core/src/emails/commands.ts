import {
  type EmailStatusChangedPayload,
  validateStatusChangePayload,
  buildEmailStatusChangedEvent,
} from "./events.js";
import { ValidationError, PreconditionFailed } from "../errors.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import { initialState, reduceEvent } from "./state-machine.js";
import type { EmailLedgerState } from "./state-machine.js";

export type EmailCommandType = "email.status_change";
export type EmailCommandPayload = EmailStatusChangedPayload;

export type EmailCommandEnvelope = CommandEnvelope<
  EmailCommandType,
  EmailCommandPayload
>;

export interface EmailCommandContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly now?: () => string;
}

export class EmailLedger {
  private readonly now: () => string;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandLog: CommandLog,
    opts?: { now?: () => string },
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  async execute(command: EmailCommandEnvelope): Promise<CommandOutcome> {
    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) return existing;

    await this.commandLog.record(command);
    const state = await this.loadState();
    const { events, outcomeStatus, reason } = this.applyCommand(command, state);

    for (const event of events) {
      await this.eventStore.append(event);
    }

    const outcome: CommandOutcome = {
      command_id: command.command_id,
      status:
        outcomeStatus ?? (events.length > 0 ? "accepted" : "already_processed"),
      produced_events: events.map((e) => e.event_id),
      completed_at: this.now(),
      ...(reason ? { reason } : {}),
    };

    await this.commandLog.recordOutcome(outcome);
    return outcome;
  }

  private applyCommand(
    command: EmailCommandEnvelope,
    state: EmailLedgerState,
  ): {
    events: EventEnvelope[];
    outcomeStatus?: CommandOutcome["status"];
    reason?: string;
  } {
    switch (command.command_type) {
      case "email.status_change":
        return this.handleStatusChange(command.payload, state);
      default:
        throw new ValidationError(`Unknown command ${command.command_type}`);
    }
  }

  private handleStatusChange(
    payload: EmailStatusChangedPayload,
    state: EmailLedgerState,
  ): {
    events: EventEnvelope[];
    outcomeStatus?: CommandOutcome["status"];
    reason?: string;
  } {
    validateStatusChangePayload(payload);
    const existing = state.emails.get(payload.source_ref);
    if (!existing) {
      if (payload.from_status !== "inbox") {
        throw new PreconditionFailed("inbox", "missing");
      }
    } else if (existing.status !== payload.from_status) {
      throw new PreconditionFailed(payload.from_status, existing.status);
    }

    const event = buildEmailStatusChangedEvent(payload, this.now(), this.now());
    return { events: [event as EventEnvelope] };
  }

  private async loadState(): Promise<EmailLedgerState> {
    const state = initialState();
    for await (const event of this.eventStore.stream()) {
      reduceEvent(state, event);
    }
    return state;
  }
}
