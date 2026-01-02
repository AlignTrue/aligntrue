import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import type { CommandLog } from "../storage/index.js";
import type { EventStore } from "../storage/interfaces.js";
import { computeScopeKey } from "../envelopes/command.js";
import { Identity } from "../identity/index.js";

export interface ApplyResult<TEvent extends EventEnvelope> {
  events: TEvent[];
  reason?: string | undefined;
  outcomeStatus?: CommandOutcome["status"] | undefined;
}

export abstract class BaseLedger<
  TState,
  TCommand extends CommandEnvelope = CommandEnvelope,
  TEvent extends EventEnvelope = EventEnvelope,
> {
  private readonly nowFn: () => string;
  private readonly appName?: string | undefined;

  protected constructor(
    protected readonly eventStore: EventStore,
    protected readonly commandLog: CommandLog,
    opts?: { now?: () => string; appName?: string },
  ) {
    this.nowFn = opts?.now ?? (() => new Date().toISOString());
    this.appName = opts?.appName;
  }

  protected abstract initialState(): TState;
  protected abstract applyCommand(
    command: TCommand,
    state: TState,
  ): Promise<ApplyResult<TEvent>> | ApplyResult<TEvent>;
  protected abstract reduceEvent(state: TState, event: TEvent): TState;
  protected abstract envelopeVersion(): number;
  protected abstract payloadSchemaVersion(): number;

  /**
   * Hook for domain-specific duplicate handling (e.g., return already_processed).
   */

  protected async onDuplicate(
    _command: TCommand,
    outcome: CommandOutcome,
  ): Promise<CommandOutcome> {
    return outcome;
  }

  /**
   * Hook for domain-specific in-flight handling.
   */

  protected async onInFlight(command: TCommand): Promise<CommandOutcome> {
    return {
      command_id: command.command_id,
      status: "already_processing",
      reason: "Command in flight",
    };
  }

  async execute(command: TCommand): Promise<CommandOutcome> {
    const start = await this.commandLog.tryStart({
      command_id: command.command_id,
      idempotency_key: command.idempotency_key,
      dedupe_scope: command.dedupe_scope,
      scope_key: computeScopeKey(command.dedupe_scope, command, this.appName),
    });

    if (start.status === "duplicate") {
      return this.onDuplicate(command, start.outcome);
    }
    if (start.status === "in_flight") {
      return this.onInFlight(command);
    }

    const state = await this.loadState();
    const { events, reason, outcomeStatus } = await this.applyCommand(
      command,
      state,
    );

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

    await this.commandLog.complete(command.command_id, outcome);
    return outcome;
  }

  protected buildEvent<TPayload>(
    command: TCommand,
    eventType: TEvent["event_type"],
    payload: TPayload,
  ): TEvent {
    const timestamp = this.now();
    const capability_id = command.capability_id ?? command.command_type;
    return {
      event_id: Identity.generateEventId({ eventType, payload }),
      event_type: eventType,
      payload,
      occurred_at: command.requested_at ?? timestamp,
      ingested_at: timestamp,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      causation_type: "command",
      ...(command.target_ref !== undefined
        ? { source_ref: command.target_ref }
        : {}),
      ...(capability_id !== undefined ? { capability_id } : {}),
      actor: command.actor,
      envelope_version: this.envelopeVersion(),
      payload_schema_version: this.payloadSchemaVersion(),
    } as TEvent;
  }

  private async loadState(): Promise<TState> {
    const state = this.initialState();
    for await (const event of this.eventStore.stream()) {
      this.reduceEvent(state, event as TEvent);
    }
    return state;
  }

  protected now(): string {
    return this.nowFn();
  }
}
