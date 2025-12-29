/**
 * Governed outbound side effects. Writes are fenced; receipts are required.
 */

export type HoldState = "none" | "held" | "released";
export type ReversibilityClass =
  | "reversible"
  | "compensatable"
  | "irreversible";

export interface EgressEnvelope {
  readonly destination: string; // e.g., gmail.send, http.webhook:foo
  readonly classification?: string;
  readonly payload_hash?: string;
  readonly correlation_id?: string;
  readonly action_id?: string;
  readonly idempotency_key: string; // per destination, deterministic
  readonly hold_state?: HoldState;
  readonly reversibility_class?: ReversibilityClass;
  readonly capability_id?: string;
  readonly approving_actor?: string;
  readonly approving_policy_id?: string;
  readonly approving_policy_version?: string;
}

export interface EgressReceipt {
  readonly envelope: EgressEnvelope;
  readonly approved: boolean;
  readonly decision_reason?: string;
  readonly timestamp: string;
  readonly approving_actor?: string;
  readonly approving_policy_id?: string;
  readonly approving_policy_version?: string;
}
