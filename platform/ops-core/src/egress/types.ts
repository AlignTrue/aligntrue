/**
 * DR-009 Governed-IO-Enforcement-and-Egress-Receipts contract stubs.
 * Defines envelopes and receipts without wiring runtime gateways yet.
 */
export interface EgressEnvelope {
  destination: string;
  classification?: string;
  payloadHash?: string;
  correlationId?: string;
  actionId?: string;
}

export interface EgressReceipt {
  envelope: EgressEnvelope;
  approved: boolean;
  decisionReason?: string;
  timestamp?: string;
}

export interface AllowedDestination {
  name: string;
  classificationsAllowed?: string[];
  requiresApproval?: boolean;
}

export interface EgressGatewayRequest {
  envelope: EgressEnvelope;
  context?: Record<string, unknown> & {
    modelCall?: ModelCallContext;
  };
}

export interface EgressGatewayDecision {
  allowed: boolean;
  reason?: string;
  receipt?: EgressReceipt;
}

export interface ModelCallContext {
  run_id?: string;
  step_id?: string;
  model_id?: string;
  tokens_in?: number;
  tokens_out?: number;
  actor?: import("../envelopes/actor.js").ActorRef;
  correlation_id?: string;
}
