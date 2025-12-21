import { describe, expect, it, vi } from "vitest";

describe("egress gateway budget concurrency", () => {
  const prevEgressEnabled = process.env["OPS_MODEL_EGRESS_ENABLED"];
  const prevMaxCalls = process.env["OPS_MODEL_MAX_CALLS_PER_RUN"];

  it("serializes budget checks so only one runs at a time", async () => {
    process.env["OPS_MODEL_EGRESS_ENABLED"] = "1";
    process.env["OPS_MODEL_MAX_CALLS_PER_RUN"] = "1";
    vi.resetModules();

    let maxInflight = 0;

    vi.doMock("../src/execution/budget.js", () => {
      class BudgetTracker {
        private inflight = 0;
        async checkAndRecord() {
          this.inflight += 1;
          maxInflight = Math.max(maxInflight, this.inflight);
          await new Promise((resolve) => setTimeout(resolve, 5));
          this.inflight -= 1;
          return {
            allowed: true,
            receipt: {
              run_id: "run-lock",
              allowed: true,
              created_at: new Date().toISOString(),
              created_by: { actor_id: "tester", actor_type: "human" } as const,
              correlation_id: "corr-lock",
              receipt_id: "receipt",
              content_hash: "hash",
            },
          };
        }
      }
      return { BudgetTracker };
    });

    const { evaluateEgress } = await import("../src/egress/gateway.js");

    const request = {
      envelope: { destination: "test" },
      context: {
        modelCall: {
          run_id: "run-lock",
          step_id: "step-1",
          model_id: "model-1",
          correlation_id: "corr-lock",
          tokens_in: 10,
          tokens_out: 5,
        },
      },
    };

    await Promise.all([evaluateEgress(request), evaluateEgress(request)]);

    expect(maxInflight).toBe(1);
  });

  it("propagates budget errors without swallowing and releases lock", async () => {
    process.env["OPS_MODEL_EGRESS_ENABLED"] = "1";
    vi.resetModules();

    let attempts = 0;

    vi.doMock("../src/execution/budget.js", () => {
      class BudgetTracker {
        async checkAndRecord() {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("budget-failed");
          }
          return {
            allowed: true,
            receipt: {
              run_id: "run-lock",
              allowed: true,
              created_at: new Date().toISOString(),
              created_by: { actor_id: "tester", actor_type: "human" } as const,
              correlation_id: "corr-lock",
              receipt_id: "receipt",
              content_hash: "hash",
            },
          };
        }
      }
      return { BudgetTracker };
    });

    const { evaluateEgress } = await import("../src/egress/gateway.js");

    const request = {
      envelope: { destination: "test" },
      context: {
        modelCall: {
          run_id: "run-lock",
          step_id: "step-1",
          model_id: "model-1",
          correlation_id: "corr-lock",
          tokens_in: 10,
          tokens_out: 5,
        },
      },
    };

    await expect(evaluateEgress(request)).rejects.toThrow("budget-failed");
    const result = await evaluateEgress(request);

    expect(result.allowed).toBe(true);
    expect(attempts).toBe(2);
  });

  afterEach(() => {
    process.env["OPS_MODEL_EGRESS_ENABLED"] = prevEgressEnabled;
    process.env["OPS_MODEL_MAX_CALLS_PER_RUN"] = prevMaxCalls;
    vi.resetModules();
    vi.doUnmock("../src/execution/budget.js");
  });
});
