import { OPS_GMAIL_MUTATIONS_ENABLED } from "@aligntrue/core";
import type { EventStore } from "@aligntrue/core";
import type { GmailMutationRequest, GmailMutationReceipt } from "./types.js";
import {
  GMAIL_MUTATION_EVENT_TYPES,
  buildMutationEvent,
  type GmailMutationEvent,
} from "./events.js";
import type { GmailMutationOp } from "./types.js";

export interface GmailMutationPerformer {
  perform(
    operation: GmailMutationOp,
    input: { message_id: string; thread_id: string; label_id?: string },
  ): Promise<{ destination_ref?: string }>;
}

export interface GmailMutationExecutorOpts {
  now?: () => string;
  performer?: GmailMutationPerformer;
  flagEnabled?: boolean;
}

export class GmailMutationExecutor {
  private readonly now: () => string;
  private readonly performer: GmailMutationPerformer | undefined;
  private readonly flagEnabled: boolean;

  constructor(
    private readonly eventStore: EventStore,
    opts?: GmailMutationExecutorOpts,
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.performer = opts?.performer;
    this.flagEnabled =
      opts?.flagEnabled ?? OPS_GMAIL_MUTATIONS_ENABLED ?? false;
  }

  async execute(
    request: GmailMutationRequest,
  ): Promise<{ receipts: GmailMutationReceipt[]; disabled: boolean }> {
    const receipts: GmailMutationReceipt[] = [];
    const timestamp = this.now();

    await this.appendIfNew(
      buildMutationEvent(
        GMAIL_MUTATION_EVENT_TYPES.GmailMutationRequested,
        {
          mutation_id: request.mutation_id,
          provider: request.provider,
          message_id: request.message_id,
          thread_id: request.thread_id,
          operations: request.operations,
          ...(request.label_id ? { label_id: request.label_id } : {}),
        },
        {
          occurred_at: timestamp,
          ingested_at: timestamp,
          correlation_id: request.mutation_id,
          causation_id: request.mutation_id,
        },
      ),
    );

    for (const operation of request.operations) {
      const alreadySucceeded = await this.findExistingSuccess(
        request.mutation_id,
        operation,
      );
      if (alreadySucceeded) {
        const completed_at =
          alreadySucceeded.payload.completed_at ?? alreadySucceeded.occurred_at;
        const destination_ref = alreadySucceeded.payload.destination_ref;
        receipts.push({
          mutation_id: request.mutation_id,
          operation,
          approved: true,
          reason: "already_succeeded",
          ...(destination_ref !== undefined ? { destination_ref } : {}),
          completed_at,
        });
        continue;
      }

      if (!this.flagEnabled) {
        const failed = buildMutationEvent(
          GMAIL_MUTATION_EVENT_TYPES.GmailMutationFailed,
          {
            mutation_id: request.mutation_id,
            operation,
            provider: request.provider,
            message_id: request.message_id,
            thread_id: request.thread_id,
            ...(request.label_id ? { label_id: request.label_id } : {}),
            reason: "mutations_disabled",
            completed_at: timestamp,
          },
          {
            occurred_at: timestamp,
            ingested_at: timestamp,
            correlation_id: request.mutation_id,
            causation_id: request.mutation_id,
          },
        );
        await this.appendIfNew(failed);
        receipts.push({
          mutation_id: request.mutation_id,
          operation,
          approved: false,
          reason: "mutations_disabled",
          completed_at: timestamp,
        });
        continue;
      }

      const attempted = buildMutationEvent(
        GMAIL_MUTATION_EVENT_TYPES.GmailMutationAttempted,
        {
          mutation_id: request.mutation_id,
          operation,
          provider: request.provider,
          message_id: request.message_id,
          thread_id: request.thread_id,
          ...(request.label_id ? { label_id: request.label_id } : {}),
          requested_at: timestamp,
        },
        {
          occurred_at: timestamp,
          ingested_at: timestamp,
          correlation_id: request.mutation_id,
          causation_id: request.mutation_id,
        },
      );
      await this.appendIfNew(attempted);

      try {
        const performer = this.performer;
        if (!performer) {
          throw new Error("Gmail mutation performer is not configured");
        }

        const result = await performer.perform(operation, {
          message_id: request.message_id,
          thread_id: request.thread_id,
          ...(request.label_id ? { label_id: request.label_id } : {}),
        });
        const destination_ref = result?.destination_ref;
        const succeeded = buildMutationEvent(
          GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded,
          {
            mutation_id: request.mutation_id,
            operation,
            provider: request.provider,
            message_id: request.message_id,
            thread_id: request.thread_id,
            ...(request.label_id ? { label_id: request.label_id } : {}),
            ...(destination_ref !== undefined ? { destination_ref } : {}),
            completed_at: this.now(),
          },
          {
            occurred_at: this.now(),
            ingested_at: this.now(),
            correlation_id: request.mutation_id,
            causation_id: request.mutation_id,
          },
        );
        await this.appendIfNew(succeeded);
        const succeededPayload = succeeded as Extract<
          GmailMutationEvent,
          {
            event_type: (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationSucceeded"];
          }
        >;
        const completed_at = succeededPayload.payload.completed_at;
        receipts.push({
          mutation_id: request.mutation_id,
          operation,
          approved: true,
          ...(destination_ref !== undefined ? { destination_ref } : {}),
          ...(completed_at !== undefined ? { completed_at } : {}),
        });
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : "mutation_failed_unknown";
        const failed = buildMutationEvent(
          GMAIL_MUTATION_EVENT_TYPES.GmailMutationFailed,
          {
            mutation_id: request.mutation_id,
            operation,
            provider: request.provider,
            message_id: request.message_id,
            thread_id: request.thread_id,
            ...(request.label_id ? { label_id: request.label_id } : {}),
            reason,
            completed_at: this.now(),
          },
          {
            occurred_at: this.now(),
            ingested_at: this.now(),
            correlation_id: request.mutation_id,
            causation_id: request.mutation_id,
          },
        );
        await this.appendIfNew(failed);
        const failedPayload = failed as Extract<
          GmailMutationEvent,
          {
            event_type: (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationFailed"];
          }
        >;
        const completed_at = failedPayload.payload.completed_at;
        receipts.push({
          mutation_id: request.mutation_id,
          operation,
          approved: false,
          reason,
          ...(completed_at !== undefined ? { completed_at } : {}),
        });
      }
    }

    return { receipts, disabled: !this.flagEnabled };
  }

  private async appendIfNew(event: GmailMutationEvent): Promise<void> {
    const existing = await this.eventStore.getById(event.event_id);
    if (existing) return;
    await this.eventStore.append(event);
  }

  private async findExistingSuccess(
    mutation_id: string,
    operation: GmailMutationOp,
  ): Promise<Extract<
    GmailMutationEvent,
    {
      event_type: (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationSucceeded"];
    }
  > | null> {
    for await (const event of this.eventStore.stream()) {
      if (
        event.event_type === GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded
      ) {
        const successEvent = event as Extract<
          GmailMutationEvent,
          {
            event_type: (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationSucceeded"];
          }
        >;
        if (
          successEvent.payload.mutation_id === mutation_id &&
          successEvent.payload.operation === operation
        ) {
          return successEvent;
        }
      }
    }
    return null;
  }
}
