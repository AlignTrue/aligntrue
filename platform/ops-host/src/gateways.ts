/**
 * Placeholder gateways for ingress/egress coordination.
 * These will wrap ops-core egress evaluation and pack dispatch.
 */
export interface GatewayContext {
  correlationId?: string;
}

export function initializeGateways(_ctx?: GatewayContext): void {
  // No-op placeholder; real implementation will wire connectors and egress.
}
