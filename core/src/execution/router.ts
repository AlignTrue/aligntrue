import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { ActorRef } from "../envelopes/actor.js";
import { SafetyClass } from "../safety-classes/types.js";
import type {
  RouterDecision,
  RouterInput,
  RouterReceiptContent,
} from "./types.js";

const ROUTER_POLICY_VERSION = "router_v0";

export function routeStep(
  input: RouterInput,
  opts: { actor: ActorRef; correlation_id: string; now: () => string },
): {
  decision: RouterDecision;
  receipt: RouterReceiptContent & { receipt_id: string; content_hash: string };
} {
  const route = chooseRoute(input);
  const inputs_hash = deterministicId(
    canonicalize({
      run_id: input.run_id,
      step_id: input.step_id,
      kind: input.kind,
      safety_class: input.safety_class,
      metadata: input.metadata ?? {},
      policy_version: ROUTER_POLICY_VERSION,
    }),
  );

  const decision: RouterDecision = {
    route,
    reason:
      route === "DETERMINISTIC_REQUIRED"
        ? "default_deterministic_first"
        : "model_allowed_kind",
    policy_version: ROUTER_POLICY_VERSION,
    inputs_hash,
  };

  const created_at = opts.now();
  const content: RouterReceiptContent = {
    run_id: input.run_id,
    step_id: input.step_id,
    kind: input.kind,
    decision,
    created_at,
    created_by: opts.actor,
    correlation_id: opts.correlation_id,
  };
  const content_hash = deterministicId(canonicalize(content));
  const receipt_id = content_hash;

  return { decision, receipt: { ...content, receipt_id, content_hash } };
}

function chooseRoute(input: RouterInput): RouterDecision["route"] {
  if (input.safety_class === SafetyClass.WriteExternalSideEffect) {
    return "DETERMINISTIC_REQUIRED";
  }
  const kind = input.kind.toLowerCase();
  switch (kind) {
    case "classify":
    case "summarize":
    case "generate":
      return "MODEL_ALLOWED";
    case "lookup":
    case "transform":
    case "validate":
      return "DETERMINISTIC_REQUIRED";
    default:
      return "DETERMINISTIC_REQUIRED";
  }
}
