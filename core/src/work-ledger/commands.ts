import { BaseLedger } from "../ledger/base-ledger.js";
import { PreconditionFailed, ValidationError } from "../errors.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/index.js";
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

export class WorkLedger extends BaseLedger<
  WorkLedgerState,
  CommandEnvelope<WorkCommandType, WorkCommandPayload>,
  WorkLedgerEvent
> {
  constructor(
    eventStore: EventStore,
    commandLog: CommandLog,
    opts?: { now?: () => string },
  ) {
    super(eventStore, commandLog, opts);
  }

  protected override initialState(): WorkLedgerState {
    return initialState();
  }

  protected override reduceEvent(
    state: WorkLedgerState,
    event: WorkLedgerEvent,
  ): WorkLedgerState {
    return reduceEvent(state, event);
  }

  protected override envelopeVersion(): number {
    return WORK_LEDGER_ENVELOPE_VERSION;
  }

  protected override payloadSchemaVersion(): number {
    return WORK_LEDGER_SCHEMA_VERSION;
  }

  protected override async onDuplicate(
    command: CommandEnvelope<WorkCommandType, WorkCommandPayload>,
    outcome: CommandOutcome,
  ): Promise<CommandOutcome> {
    if (command.command_type === "work.complete") {
      return {
        command_id: command.command_id,
        status: "already_processed",
        reason: "Work item already completed",
        ...(outcome.produced_events
          ? { produced_events: outcome.produced_events }
          : {}),
      };
    }
    return outcome;
  }

  protected override applyCommand(
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
}

export function isWorkItemReady(
  item: WorkItemState,
  state: WorkLedgerState,
): boolean {
  return isReady(item, state);
}

export type { WorkItemState, WorkLedgerState, WorkStatus };
