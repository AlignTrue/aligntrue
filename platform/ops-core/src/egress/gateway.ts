/**
 * DR-009 Governed-IO-Enforcement-and-Egress-Receipts gateway boundary (stub).
 * No-op decision logic allows future enforcement without changing callers.
 */
import {
  EgressGatewayDecision,
  EgressGatewayRequest,
  EgressReceipt,
} from "./types.js";

export async function evaluateEgress(
  request: EgressGatewayRequest,
): Promise<EgressGatewayDecision> {
  const receipt: EgressReceipt = {
    envelope: request.envelope,
    approved: true,
    timestamp: new Date().toISOString(),
  };

  return { allowed: true, receipt };
}
