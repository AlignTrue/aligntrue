import type { ActorRef } from "../envelopes/actor.js";
import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import {
  OPS_MODEL_MAX_CALLS_PER_DAY,
  OPS_MODEL_MAX_CALLS_PER_RUN,
  OPS_MODEL_MAX_TOKENS_PER_DAY,
  OPS_MODEL_MAX_TOKENS_PER_RUN,
  OPS_MODEL_MIN_INTERVAL_MS,
} from "../config.js";
import type { UsageReceiptContent, RunId, StepId } from "./types.js";

interface RunUsage {
  calls: number;
  tokens: number;
  lastCallAt?: number;
}

interface DayUsage {
  calls: number;
  tokens: number;
  windowStart: number;
}

export class BudgetTracker {
  private readonly runUsage = new Map<RunId, RunUsage>();
  private dayUsage: DayUsage = {
    calls: 0,
    tokens: 0,
    windowStart: Date.now(),
  };

  checkAndRecord(
    input: {
      run_id: RunId;
      step_id?: StepId;
      model_id?: string;
      tokens_in?: number;
      tokens_out?: number;
    },
    opts: { actor: ActorRef; correlation_id: string; now: () => number },
  ): {
    allowed: boolean;
    reason?: string;
    receipt: UsageReceiptContent & { receipt_id: string; content_hash: string };
  } {
    this.rotateDayWindowIfNeeded(opts.now());
    const run =
      this.runUsage.get(input.run_id) ??
      ({
        calls: 0,
        tokens: 0,
      } as RunUsage);

    const tokens = (input.tokens_in ?? 0) + (input.tokens_out ?? 0);
    const nowMs = opts.now();

    const violations: string[] = [];
    if (run.calls + 1 > OPS_MODEL_MAX_CALLS_PER_RUN) {
      violations.push("max_calls_per_run");
    }
    if (run.tokens + tokens > OPS_MODEL_MAX_TOKENS_PER_RUN) {
      violations.push("max_tokens_per_run");
    }
    if (this.dayUsage.calls + 1 > OPS_MODEL_MAX_CALLS_PER_DAY) {
      violations.push("max_calls_per_day");
    }
    if (this.dayUsage.tokens + tokens > OPS_MODEL_MAX_TOKENS_PER_DAY) {
      violations.push("max_tokens_per_day");
    }
    if (
      run.lastCallAt !== undefined &&
      nowMs - run.lastCallAt < OPS_MODEL_MIN_INTERVAL_MS
    ) {
      violations.push("min_interval");
    }

    const allowed = violations.length === 0;
    if (allowed) {
      run.calls += 1;
      run.tokens += tokens;
      run.lastCallAt = nowMs;
      this.dayUsage.calls += 1;
      this.dayUsage.tokens += tokens;
      this.runUsage.set(input.run_id, run);
    }

    const created_at = new Date(nowMs).toISOString();
    const reason = allowed ? undefined : violations.join(",");
    const content: UsageReceiptContent = {
      run_id: input.run_id,
      allowed,
      created_at,
      created_by: opts.actor,
      correlation_id: opts.correlation_id,
      ...(input.step_id !== undefined ? { step_id: input.step_id } : {}),
      ...(input.model_id !== undefined ? { model_id: input.model_id } : {}),
      ...(input.tokens_in !== undefined ? { tokens_in: input.tokens_in } : {}),
      ...(input.tokens_out !== undefined
        ? { tokens_out: input.tokens_out }
        : {}),
      ...(reason ? { reason } : {}),
    };

    const content_hash = deterministicId(canonicalize(content));
    const receipt_id = content_hash;
    return {
      allowed,
      ...(reason ? { reason } : {}),
      receipt: { ...content, receipt_id, content_hash },
    };
  }

  private rotateDayWindowIfNeeded(nowMs: number): void {
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (nowMs - this.dayUsage.windowStart >= DAY_MS) {
      this.dayUsage = { calls: 0, tokens: 0, windowStart: nowMs };
    }
  }
}
