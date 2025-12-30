import { PreconditionFailed, ValidationError } from "../errors.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import { generateEventId } from "../identity/id.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import {
  WORK_EVENT_TYPES,
  WORK_LEDGER_SCHEMA_VERSION,
  type DependencyAddedPayload,
  type DependencyRemovedPayload,
  type WorkItemBlockedPayload,
  type WorkItemCompletedPayload,
  type WorkItemCreatedPayload,
  type WorkItemUnblockedPayload,
  type WorkItemUpdatedPayload,
  type WorkLedgerEvent,
  type WorkStatus,
} from "./events.js";
import {
  initialState,
  isReady,
  reduceEvent,
  type WorkItemState,
  type WorkLedgerState,
} from "./state-machine.js";

const WORK_LEDGER_ENVELOPE_VERSION = 1;

export type WorkCommandType =
  | "work.create"
  | "work.update"
  | "work.complete"
  | "work.block"
  | "work.unblock"
  | "work.dep.add"
  | "work.dep.remove";

export type WorkCommandPayload =
  | WorkItemCreatedPayload
  | WorkItemUpdatedPayload
  | WorkItemCompletedPayload
  | WorkItemBlockedPayload
  | WorkItemUnblockedPayload
  | DependencyAddedPayload
  | DependencyRemovedPayload;

export type WorkCommandEnvelope<T extends WorkCommandType = WorkCommandType> =
  CommandEnvelope<T, WorkCommandPayload>;

export interface WorkCommandContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly now?: () => string;
}

export class WorkLedger {
  private readonly now: () => string;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandLog: CommandLog,
    opts?: { now?: () => string },
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  async execute(
    command: CommandEnvelope<WorkCommandType, WorkCommandPayload>,
  ): Promise<CommandOutcome> {
    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) {
      if (
        command.command_type === "work.complete" &&
        existing.status === "accepted"
      ) {
        // Recompute to surface "already_processed" once completion has been applied.
      } else {
        return existing;
      }
    }

    await this.commandLog.record(command);
    const state = await this.loadState();
    const { events, reason, outcomeStatus } = this.applyCommand(command, state);

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
    command: CommandEnvelope<WorkCommandType, WorkCommandPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string | undefined;
    outcomeStatus?: CommandOutcome["status"] | undefined;
  } {
    switch (command.command_type) {
      case "work.create":
        return this.handleCreate(
          command as CommandEnvelope<"work.create", WorkItemCreatedPayload>,
          state,
        );
      case "work.update":
        return this.handleUpdate(
          command as CommandEnvelope<"work.update", WorkItemUpdatedPayload>,
          state,
        );
      case "work.complete":
        return this.handleComplete(
          command as CommandEnvelope<"work.complete", WorkItemCompletedPayload>,
          state,
        );
      case "work.block":
        return this.handleBlock(
          command as CommandEnvelope<"work.block", WorkItemBlockedPayload>,
          state,
        );
      case "work.unblock":
        return this.handleUnblock(
          command as CommandEnvelope<"work.unblock", WorkItemUnblockedPayload>,
          state,
        );
      case "work.dep.add":
        return this.handleDepAdd(
          command as CommandEnvelope<"work.dep.add", DependencyAddedPayload>,
          state,
        );
      case "work.dep.remove":
        return this.handleDepRemove(
          command as CommandEnvelope<
            "work.dep.remove",
            DependencyRemovedPayload
          >,
          state,
        );
      default:
        throw new ValidationError(
          `Unsupported command type: ${command.command_type}`,
        );
    }
  }

  private handleCreate(
    command: CommandEnvelope<"work.create", WorkItemCreatedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    if (state.items.has(command.payload.work_id)) {
      throw new PreconditionFailed("missing", "exists");
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.WorkItemCreated,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleUpdate(
    command: CommandEnvelope<"work.update", WorkItemUpdatedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }

    if (
      command.payload.title === undefined &&
      command.payload.description === undefined &&
      command.payload.status === undefined
    ) {
      return { events: [], outcomeStatus: "already_processed" };
    }

    if (
      command.payload.status &&
      command.payload.status !== "pending" &&
      command.payload.status !== "in_progress" &&
      command.payload.status !== "completed"
    ) {
      throw new PreconditionFailed(
        "pending|in_progress",
        command.payload.status,
      );
    }

    if (command.payload.status === "completed") {
      throw new PreconditionFailed(
        "complete-via-command",
        "complete-via-update",
      );
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.WorkItemUpdated,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleComplete(
    command: CommandEnvelope<"work.complete", WorkItemCompletedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (item.blocked) {
      throw new PreconditionFailed("unblocked", "blocked");
    }
    if (item.status === "completed") {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Work item already completed",
      };
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.WorkItemCompleted,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleBlock(
    command: CommandEnvelope<"work.block", WorkItemBlockedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (item.blocked) {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Work item already blocked",
      };
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.WorkItemBlocked,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleUnblock(
    command: CommandEnvelope<"work.unblock", WorkItemUnblockedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (!item.blocked) {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Work item already unblocked",
      };
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.WorkItemUnblocked,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleDepAdd(
    command: CommandEnvelope<"work.dep.add", DependencyAddedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (command.payload.work_id === command.payload.depends_on) {
      throw new PreconditionFailed("distinct-dependency", "self");
    }
    if (item.dependencies.has(command.payload.depends_on)) {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Dependency already added",
      };
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.DependencyAdded,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleDepRemove(
    command: CommandEnvelope<"work.dep.remove", DependencyRemovedPayload>,
    state: WorkLedgerState,
  ): {
    events: WorkLedgerEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const item = state.items.get(command.payload.work_id);
    if (!item) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (!item.dependencies.has(command.payload.depends_on)) {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Dependency not present",
      };
    }

    const event = this.buildEvent(
      command,
      WORK_EVENT_TYPES.DependencyRemoved,
      command.payload,
    ) as WorkLedgerEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private async loadState(): Promise<WorkLedgerState> {
    const state = initialState();
    for await (const event of this.eventStore.stream()) {
      // We only expect work-ledger events in this store
      reduceEvent(state, event as WorkLedgerEvent);
    }
    return state;
  }

  private buildEvent<TPayload>(
    command: CommandEnvelope<WorkCommandType, WorkCommandPayload>,
    eventType: WorkLedgerEvent["event_type"],
    payload: TPayload,
  ): EventEnvelope<WorkLedgerEvent["event_type"], TPayload> {
    const timestamp = this.now();
    const capability_id = command.capability_id;
    return {
      event_id: generateEventId({ eventType, payload }),
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
      actor: command.actor,
      ...(capability_id !== undefined ? { capability_id } : {}),
      envelope_version: WORK_LEDGER_ENVELOPE_VERSION,
      payload_schema_version: WORK_LEDGER_SCHEMA_VERSION,
    };
  }
}

export function isWorkItemReady(
  item: WorkItemState,
  state: WorkLedgerState,
): boolean {
  return isReady(item, state);
}

export type { WorkItemState, WorkLedgerState, WorkStatus };
