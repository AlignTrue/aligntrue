import {
  OPS_MODEL_EGRESS_ENABLED,
  OPS_MODEL_MAX_CALLS_PER_RUN,
} from "../config.js";
import { BudgetTracker } from "../execution/budget.js";
import {
  type EgressGatewayDecision,
  type EgressGatewayRequest,
  type EgressReceipt,
} from "./types.js";

const budgetTracker = new BudgetTracker();
// Serialize budget updates to avoid races when multiple requests arrive at once.
let budgetMutex: Promise<unknown> = Promise.resolve();

async function withBudgetLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = budgetMutex.then(() => fn());
  // Ensure the mutex chain always resolves, but do not swallow caller errors.
  budgetMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function evaluateEgress(
  request: EgressGatewayRequest,
): Promise<EgressGatewayDecision> {
  if (!OPS_MODEL_EGRESS_ENABLED) {
    const receipt: EgressReceipt = {
      envelope: request.envelope,
      approved: false,
      decisionReason: "model_egress_disabled",
      timestamp: new Date().toISOString(),
    };
    return { allowed: false, reason: "model_egress_disabled", receipt };
  }

  const modelCtx = request.context?.modelCall;
  if (!modelCtx) {
    const receipt: EgressReceipt = {
      envelope: request.envelope,
      approved: false,
      decisionReason: "missing_model_call_context",
      timestamp: new Date().toISOString(),
    };
    return {
      allowed: false,
      reason: "missing_model_call_context",
      receipt,
    };
  }

  const check = await withBudgetLock(() =>
    budgetTracker.checkAndRecord(
      {
        run_id: modelCtx.run_id ?? "unknown",
        ...(modelCtx.step_id !== undefined
          ? { step_id: modelCtx.step_id }
          : {}),
        ...(modelCtx.model_id !== undefined
          ? { model_id: modelCtx.model_id }
          : {}),
        ...(modelCtx.tokens_in !== undefined
          ? { tokens_in: modelCtx.tokens_in }
          : {}),
        ...(modelCtx.tokens_out !== undefined
          ? { tokens_out: modelCtx.tokens_out }
          : {}),
      },
      {
        actor:
          modelCtx.actor ??
          ({
            actor_id: "system",
            actor_type: "service",
          } as const),
        correlation_id: modelCtx.correlation_id ?? "egress",
        now: () => Date.now(),
      },
    ),
  );

  if (!check.allowed) {
    const receipt: EgressReceipt = {
      envelope: request.envelope,
      approved: false,
      decisionReason: check.reason ?? "budget_exceeded",
      timestamp: new Date().toISOString(),
    };
    return {
      allowed: false,
      reason: check.reason ?? "budget_exceeded",
      receipt,
    };
  }

  const receipt: EgressReceipt = {
    envelope: request.envelope,
    approved: true,
    decisionReason: modelCtx
      ? `within_budget:max_calls_per_run=${OPS_MODEL_MAX_CALLS_PER_RUN}`
      : "no_model_budget_applied",
    timestamp: new Date().toISOString(),
  };

  return { allowed: true, receipt };
}
