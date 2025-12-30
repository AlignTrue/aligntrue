Test helpers expect commands to include:

- `idempotency_key`
- `dedupe_scope` in {"actor","target","app","global"}
  Ensure buildSuggestionCommand uses `dedupe_scope: "target"` and unique command_id.
