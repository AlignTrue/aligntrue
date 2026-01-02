import type {
  PolicyContent,
  PolicyUpsertedPayload,
} from "../contracts/policy.js";
import { POLICY_EVENT_TYPES } from "../contracts/policy.js";
import type { EventEnvelope } from "../envelopes/index.js";
import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";

export interface ActivePolicyState {
  active_policy_id: string;
  surfaces_by_intent: PolicyContent["surfaces_by_intent"];
  updated_at: string;
  previous_policy_id?: string | undefined;
}

export interface ActivePolicyProjection extends ProjectionFreshness {
  by_user: Map<string, ActivePolicyState>;
}

export const ActivePolicyProjectionDef: ProjectionDefinition<ActivePolicyProjection> =
  {
    name: "active_policy_by_user",
    version: "1.0.0",
    init(): ActivePolicyProjection {
      return {
        by_user: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ActivePolicyProjection,
      event: EventEnvelope,
    ): ActivePolicyProjection {
      if (event.event_type !== POLICY_EVENT_TYPES.Upserted) {
        return state;
      }

      const payload = event.payload as PolicyUpsertedPayload;
      const next = new Map(state.by_user);
      next.set(payload.scope.user_id, {
        active_policy_id: payload.policy_id,
        surfaces_by_intent: payload.content.surfaces_by_intent,
        updated_at: event.ingested_at,
        previous_policy_id: payload.previous_policy_id,
      });

      return {
        by_user: next,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: ActivePolicyProjection): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildActivePolicyProjectionFromState(
  state: ActivePolicyProjection,
): ActivePolicyProjection {
  return state;
}
