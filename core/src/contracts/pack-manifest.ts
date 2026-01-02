/**
 * Pack manifest contract. Packs are behavior bundles that depend on core + shared.
 */

export interface PackDependency {
  readonly name: string;
  readonly version: string; // semver
}

export interface PackManifest {
  readonly pack_id: string; // namespaced id, e.g., pack.personal-crm
  readonly version: string; // semver
  /**
   * Optional integrity hash of the built pack artifact.
   * When present, hosts should record it in receipts.
   */
  readonly integrity?: string;
  readonly required_core: string; // semver range for ops-core
  readonly required_contracts?: PackDependency[]; // contract module versions
  readonly required_models?: PackDependency[]; // model/tool versions pinned

  readonly schemas?: string[]; // schema files or identifiers owned by this pack
  readonly migrations?: string[]; // migration identifiers owned by this pack

  readonly public_events?: string[]; // event types this pack publishes as contract surface
  readonly public_commands?: string[]; // command types this pack accepts as contract surface

  readonly projections?: string[]; // projections provided by the pack
  readonly ui_routes?: string[]; // optional UI surfaces

  readonly capabilities_requested?: string[]; // optional capability requests
}

export interface PackRegistration {
  readonly manifest: PackManifest;
  readonly location: string; // fs path or package name
}

export function validatePackEventType(
  packId: string,
  eventType: string,
): boolean {
  const prefix = `pack.${packId}.`;
  return eventType.startsWith(prefix);
}
