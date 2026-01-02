/**
 * Capability lifecycle is event-sourced for time-relative audit.
 */

export type CapabilityEventType =
  | "CapabilityGranted"
  | "CapabilityScopeChanged"
  | "CapabilityRevoked"
  | "CapabilityExpired";

export interface CapabilityGrant {
  readonly capability_id: string;
  readonly granted_to: string; // ActorRef id
  readonly scope: string[];
  readonly expires_at?: string;
  readonly issued_at: string;
}

export interface CapabilityEventBase {
  readonly event_type: CapabilityEventType;
  readonly capability_id: string;
  readonly occurred_at: string;
  readonly actor: string;
}

export interface CapabilityGrantedEvent extends CapabilityEventBase {
  readonly event_type: "CapabilityGranted";
  readonly granted_to: string;
  readonly scope: string[];
  readonly expires_at?: string;
}

export interface CapabilityScopeChangedEvent extends CapabilityEventBase {
  readonly event_type: "CapabilityScopeChanged";
  readonly scope: string[];
}

export interface CapabilityRevokedEvent extends CapabilityEventBase {
  readonly event_type: "CapabilityRevoked";
  readonly reason?: string;
}

export interface CapabilityExpiredEvent extends CapabilityEventBase {
  readonly event_type: "CapabilityExpired";
}

export type CapabilityEvent =
  | CapabilityGrantedEvent
  | CapabilityScopeChangedEvent
  | CapabilityRevokedEvent
  | CapabilityExpiredEvent;
