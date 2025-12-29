# AlignTrue Ops Platform Constitution

This constitution defines the non-negotiable boundaries for the AlignTrue ops platform. It encodes trust, determinism, and auditability so that violations are impossible, not just discouraged.

## Section 0: Core Invariants (Ring A)

These are one-way doors. Do not violate them.

### A1: Event Envelope (Time + Causality)

- Fields: `event_id` (deterministic), `event_type` (namespaced), `payload`
- Time: `occurred_at`, `ingested_at`, optional `effective_at`
- Causality: `correlation_id`, `causation_id`, `causation_type`, `source_ref`, `source_sequence?`
- Actor + capability: `actor`, `capability_id`
- Versions: `envelope_version` (Core-owned, rare), `payload_schema_version` (per type)

### A2: Command Envelope (Concurrency)

- Fields: `command_id` (deterministic idempotency key), `command_type` (namespaced), `payload`, `target_ref`, `dedupe_scope` (typed), `correlation_id`, `causation_id`, `causation_type`, `actor`, `requested_at`
- Outcomes: explicit `accepted` / `rejected` + reason
- `causation_id` references exactly one of: `{event_id | command_id | derived_artifact_id | user_action_id}`; `causation_type` is required.

### A3: At-Least-Once

- Outbox for dispatch; handlers must be idempotent.
- Idempotency keys are deterministic or content-addressed; no random UUIDs.
- Dedupe scope typed: `('connector', connector_id, stream)` | `('egress', destination, tenant_id)` | `('command', aggregate_ref)`.

### A4: Actor + Capabilities

- Every action records actor (human/service/agent).
- Capabilities: issued, scoped, time-bounded, revocable.
- Capability state is event-sourced: `CapabilityGranted`, `CapabilityScopeChanged`, `CapabilityRevoked`, `CapabilityExpired` (with `occurred_at`).
- Gateways evaluate scope as-of action time; current scope for enforcement, historical for audit.
- Receipts include `capability_id` + `capability_state_ref` (grant event id or version). No stale scope snapshots.
- Delegation allowed with reduced scope; inherits bounds and revocation.

### A5: Action Safety Classes

- `READ`, `WRITE_INTERNAL`, `WRITE_EXTERNAL_SIDE_EFFECT`.
- External side effects require approval (manual or policy), quotas, kill switch, compensation hook, receipt.
- Egress receipt must include approving actor OR approving policy id + version.

### A6: Projection Invariant

- Write truth = event log (append-only). Read truth = projections (rebuildable, versioned).
- Canonical ordering tuple: `(occurred_at, source_ref, source_sequence?, event_id)`. If `source_sequence` absent: `(occurred_at, source_ref, event_id)`.
- `event_id` deterministic from `hash(source_ref, source_native_id, payload_hash, occurred_at)`.
- Projections declare ordering dependence (default canonical). Replay in canonical order produces identical state.

### A7: Deterministic Identity

- Content-addressed IDs + semver for governed artifacts: packs, policies, contract modules, tool manifests, query/derived/eval artifacts.

### A8: Baseline Connector Expectations (Ingress-Only)

- Connectors are read/sync only; emit events. No outbound side effects.
- Idempotent ingestion, cursor + watermarks, replay determinism (same cursor → same events/ids), backfill semantics.
- Schema drift detection, rate-limit/retry models.
- Deletes emit tombstone events, not silent drops.

### A9: Atomicity + Multi-Step Consistency

- Atomic: single event append; batch append from one command; egress request enqueue (outbox).
- Not atomic: external side-effect completion; cross-aggregate coordination.
- Coordination: outbox + saga-style state machines.
- Multi-step processes emit explicit states: `pending` → `approved` → `dispatched` → `executed` / `failed`.
- Crash recovery: replay + outbox reprocess; intermediate states are durable and visible.

## Section 1: Structural Boundaries

- Event/command type namespacing:
  - Pack: `pack.<pack_id>.<domain>.<Name>`
  - Shared: `shared.<pkg>.<Name>`
  - Core: `core.<Name>`
  - Contract modules export registries; CI diffs registries.
- Versioning tracks:
  - `envelope_version` (Core, structural, rare)
  - `payload_schema_version` (per type)
  - Contract semver (package surface)
- Events: owner = definer; private by default; public via contract module; consumers declare dependency; payloads versioned or append-only.
- Commands: only owner handles; cross-pack requires contract dependency.
- IDs/entities: identity primitives in Core; cross-pack IDs in shared domain; foreign entities treated as external refs with provenance.
- Schema/migrations: Core tables only in Core; each pack owns `pack_<packid>_*`; shared owns nothing by default; migrations live with owner.

## Section 2: Governance Boundaries

- Policies: lifecycle draft → simulated → approved → active → deprecated; pack-owned; promotion gates; receipts record version; rollback explicit.
- Connectors: ingress-only; may initiate egress requests but writes go through Egress.
- Egress: all outbound side effects fenced; receipts; idempotency; holds; reversibility class. Approvals manual or policy; receipt links to approver or policy id+version.
- Ingress: at-least-once; dedupe scope per connector/entity; quarantine; reconciliation events on conflicts; watermarks; replay determinism; tombstones for deletes.
- Auth/redaction: enforced in Core gateways; projections store full state; redaction primarily at query; redaction-at-rest where needed; capability checked per gateway.
- Reconciliation: interface in Core; implementations in shared domain; conflicts are events.

## Section 3: Supply Chain

- Artifact identity: content hash + semver.
- Dependency pinning for promotion: core version, contract versions, model/tool versions.
- Signing: declared (optional now, required before active later); verification before activation.
- Promotion gates: eval artifact required and must pass thresholds; model-change impact check required; rollback explicit.
- EvalArtifact contract: inputs_hash, policy_version, tool_versions, model_config, metrics, thresholds, passed, run_at, environment, correlation_id, eval_id (hash).

## Section 4: Contract Compatibility

- Semver + CI contract tests + type registry diff.
- Public contract modules export machine-readable schemas (e.g., Zod/JSON Schema) for event/command payloads; CI diffs schemas for breaking changes.
- Published contracts: append-only or versioned with upcasters; breaking = new major + parallel window + migration path.
- Pack manifest contract: major bump on shape change.

## Section 5: Lineage & Trust

- Query artifacts: `snapshot_id`, `projection_version`, `freshness_at`, access scope required; content-addressed.
- Derived artifacts: required `input_hashes`, `policy_version`, `tool_versions`, `model_config`; link to `eval_id`; content-addressed.
- Feedback events: accepted/rejected/edited/overridden/snoozed tied to artifact_id.

## Section 6: Execution & Operations

- Projection freshness: `max_lag_ms`, `freshness_slo`; surface SLO violations.
- Budgets: per-run/per-day; tokens/calls; rate limit; receipts for decisions.
- Priority lanes: interactive > background > batch.
- Scheduling: preemption (interactive > background > batch); starvation prevention; fairness (per-actor → per-tenant later); queue ordering = priority → arrival → deterministic tie-break.

## Section 7: Dependency Graph

- `ops-core` → nothing.
- `ops-shared/*` → `ops-core`.
- `packs/*` → `ops-core` + optional `ops-shared/*` + contract modules.
- `ops-host` → all above.
- Hard rule: ops-core cannot import from ops-shared or packs.

## Section 8: Layer Responsibilities

- Local (Phase 0/1): local promotion gates; env vars + SecretsProvider; local budgets; workspace packs.
- Cloud (later): canonical promotion + signing; Vault/KMS; multi-tenant governance; hosted registry; hosted execution; audit. No product domain logic in cloud.

## Section 9: Enforcement

- ESLint `no-restricted-imports` for dependency graph.
- Depcruise (or equivalent) for graph in CI.
- Contract tests: envelope correctness.
- Projection rebuild determinism tests.
- Type registry + schema diff in CI.
- “No cheating” tests: no egress bypass; no raw DB writes from packs; no cross-pack imports without contract; no raw credential access from packs.

## Section 10: Acceptance Test

- Delete a pack: ops-core builds/tests pass; host runs (fewer features); no code changes elsewhere; dependency failures happen at install time, not runtime.
- Uninstall does not delete historical events; projections/tables may be orphaned/archived; truth remains append-only; events remain queryable.

## Section 11: Retention and PII

- Retention policies explicit for projections, receipts, artifacts.
- Right to delete: tombstone + redaction with receipts; no silent deletion.
- Redaction: at query time primarily; at rest via governed process.
- Append-only truth with crypto-shredding: event log is append-only; sensitive fields may be encrypted; deletion = key destruction + `RedactionApplied` event (fields, reason, actor, time). If crypto-shredding absent, tombstones + restricted raw log access is minimum.

## Section 12: Secrets Custody

- SecretsProvider owned by Core/Host; packs never see raw credentials.
- Refresh tokens/API keys live only in SecretsProvider.
- Access tokens are scoped, time-bounded, audience-bound; issuance is receipted.
- Secret access receipt: `capability_id`, `token_type`, `handle_id?`, `secret_id` (class, not value), `audience`, `scope`, `issued_at`, `expires_at`, `requester`, `correlation_id`.
- Revocation enforced by SecretsProvider; handles invalidated; revocation receipts emitted.
