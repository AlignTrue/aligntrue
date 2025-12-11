---
description: Manage remote push destinations (status and push)
---

# `aligntrue remotes`

Manage remote destinations for rule sync. Use this when you want explicit control over pushes (e.g., with `auto: false`) or to see routing diagnostics.

## `aligntrue remotes status`

Show configured remotes, routing (by scope/pattern), and last push info.

**Usage:**

```bash
aligntrue remotes status
```

**Behavior:**

- Solo mode: all rules route to `remotes.personal` unless a rule is `scope: shared` and a shared remote exists.
- Team/enterprise: `scope: personal` → `remotes.personal`; `scope: shared` → `remotes.shared`; `scope: team` stays in repo. Custom remotes are additive in all modes.
- Detects conflicts where a URL is both a source and a remote.

## `aligntrue remotes push`

Push rules to configured remotes. Useful when you set `auto: false` on a remote or want an explicit push outside `aligntrue sync`.

**Usage:**

```bash
aligntrue remotes push [options]
```

**Options:**

| Flag        | Description                          | Default |
| ----------- | ------------------------------------ | ------- |
| `--dry-run` | Preview without pushing              | `false` |
| `--force`   | Push even if no changes are detected | `false` |

**Notes:**

- By default remotes push during `aligntrue sync` unless you set `auto: false` on the remote.
- Files can go to multiple remotes when `remotes.custom` patterns match.
- For routing details, see [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy).
