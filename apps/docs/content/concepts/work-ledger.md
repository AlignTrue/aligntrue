---
description: Local, deterministic work ledger for ops-core Phase 0
---

# Work ledger

The ops-core work ledger tracks local work items with an auditable event trail and rebuildable projections. It is fully local and gated by `OPS_CORE_ENABLED=1`.

## Event model

- `work_item_created` – adds a work item (initial status `pending`)
- `work_item_updated` – updates title/description/status (no `completed` via update)
- `work_item_completed` – marks an item done (idempotent)
- `work_item_blocked` / `work_item_unblocked` – toggles blocked state
- `work_dependency_added` / `work_dependency_removed` – manages blockers

All events are envelopes with correlation/causation IDs and schema version 1.

## State machine

- Status flow: `pending → in_progress → completed`
- Any status can be blocked; unblock returns to the prior non-blocked state
- Completing twice is a no-op (outcome `already_processed`)

## Projections

- `work_items`: current snapshot keyed by ID
- `ready_queue`: items that are not completed, not blocked, and have no incomplete blockers
- Replay is deterministic: hashing `work_items + ready_queue` yields the same value across replays

## Storage

- Event log: `./data/ops-core-work-ledger.jsonl`
- Command/outcome log: shared JSONL command log from ops-core

## CLI usage (local only)

Set `OPS_CORE_ENABLED=1`, then:

```bash
aligntrue work create "Rewrite importer" --desc "M3 ledger dogfood"
aligntrue work dep add task-b task-a
aligntrue work ready
aligntrue work block task-b "waiting on task-a"
aligntrue work complete task-a
aligntrue work ready
```
