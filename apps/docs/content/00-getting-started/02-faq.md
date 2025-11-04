---
title: FAQ
description: Frequently asked questions about AlignTrue
---

# Frequently asked questions

## General

### What is AlignTrue?

AlignTrue is a tool that syncs AI coding rules across multiple agents. Write rules once in `.aligntrue/rules.md`, and AlignTrue generates agent-specific formats for Cursor, GitHub Copilot, Claude Code, and 25+ other agents.

### Why do I need AlignTrue?

If you use multiple AI coding agents, you're probably copy-pasting rules between different config formats. AlignTrue eliminates this by maintaining a single source of truth and syncing to all agents automatically.

### Is AlignTrue free?

Yes! AlignTrue is MIT-licensed open source. The CLI and all core features are free forever.

### What agents does AlignTrue support?

28+ agents through 43 specialized exporters:

- Cursor, GitHub Copilot, Claude Code, Aider, Windsurf
- VS Code MCP, Amazon Q, Firebase Studio, OpenHands, Zed
- And 18+ more

[View full compatibility matrix →](/docs/03-reference/agent-support)

## Getting started

### How long does setup take?

Under 60 seconds:

```bash
npx aligntrue init  # Auto-detects agents, creates config
aligntrue sync      # Generates agent files
```

### Do I need to install anything?

Just Node.js 20+ and the AlignTrue CLI:

```bash
npm install -g @aligntrue/cli
```

### Can I try AlignTrue without installing?

Yes! Use npx:

```bash
npx @aligntrue/cli init
```

### What if I already have agent configs?

AlignTrue can import existing configs:

```bash
aligntrue init  # Detects existing configs, offers import
```

See [Migration guide](/docs/01-guides/02-migration) for details.

## Usage

### Where do I write rules?

In `.aligntrue/rules.md` (markdown format) or `.aligntrue.yaml` (YAML format). Most users prefer markdown for readability.

### How do I sync rules to agents?

```bash
aligntrue sync
```

This generates agent-specific files like `.cursor/rules/*.mdc`, `AGENTS.md`, etc.

### Can I edit agent files directly?

Yes! AlignTrue supports two-way sync. Edit either:

- `.aligntrue/rules.md` (default workflow)
- Agent files like `.cursor/*.mdc` (with auto-pull enabled)

See [Workflows guide](/docs/01-guides/01-workflows) for choosing your workflow.

### Do I need to run sync every time?

Only when rules change. Set up auto-sync with file watchers if you want automatic syncing on save.

See [File watcher setup](/docs/03-reference/file-watcher-setup).

### What if I have conflicts?

AlignTrue detects conflicts when both rules.md and agent files are edited. You'll be prompted to choose which version to keep.

Configure workflow mode to avoid prompts:

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "ir_source" # Always keep rules.md
  # or "native_format"  # Always keep agent files
```

## Team usage

### Can teams use AlignTrue?

Yes! Enable team mode for lockfiles, drift detection, and allow lists:

```bash
aligntrue team enable
```

See [Team mode guide](/docs/02-concepts/team-mode).

### How do teams share rules?

Three ways:

1. **Git** - Commit `.aligntrue/` directory to your repo
2. **Git sources** - Pull rules from separate repository
3. **Vendoring** - Use git submodules/subtrees

See [Git workflows](/docs/02-concepts/git-workflows).

### What's a lockfile?

A lockfile (`.aligntrue.lock.json`) pins rule versions with SHA-256 hashes. Teams use lockfiles to ensure everyone has identical rules.

### What's drift detection?

Drift detection monitors when upstream rules change. Useful for teams pulling rules from external sources.

```bash
aligntrue drift --gates  # Fail CI if drift detected
```

See [Drift detection guide](/docs/02-concepts/drift-detection).

## Technical

### Does AlignTrue require network access?

No! AlignTrue works completely offline. Network access is only needed for:

- Pulling rules from git repositories (optional)
- Fetching from catalog (optional)

You'll be prompted for consent before any network operation.

### Where does AlignTrue store data?

- **Config:** `.aligntrue/config.yaml`
- **Rules:** `.aligntrue/rules.md`
- **Lockfile:** `.aligntrue.lock.json` (team mode)
- **Cache:** `.aligntrue/.cache/` (git sources)

### Can I use AlignTrue in CI?

Yes! Validate rules in CI:

```bash
aligntrue check --ci  # Schema validation
aligntrue drift --gates  # Drift detection
```

See [CI/CD integration guide](/docs/01-guides/03-ci-cd-integration).

### What's the IR (Intermediate Representation)?

The IR is AlignTrue's internal format that all exporters use. When you write rules in `.aligntrue/rules.md`, they're parsed to IR, then exported to agent-specific formats.

### How does AlignTrue handle agent-specific features?

Agent-specific features are preserved in the `vendor.*` namespace:

```yaml
vendor:
  cursor:
    session: "my-session"
```

These fields are excluded from hashing but preserved on round-trips.

## Troubleshooting

### AlignTrue command not found

Install globally:

```bash
npm install -g @aligntrue/cli
```

Or use npx:

```bash
npx @aligntrue/cli --help
```

### Config file not found

Run init first:

```bash
aligntrue init
```

### Rules not showing in my agent

1. Check agent is enabled: `cat .aligntrue/config.yaml | grep exporters`
2. Run sync: `aligntrue sync`
3. Restart your IDE

### Lockfile always out of sync

Mark volatile fields in config:

```yaml
vendor:
  _meta:
    volatile: ["cursor.timestamp"]
```

### More issues?

See [Troubleshooting guide](/docs/04-troubleshooting) for comprehensive solutions.

## Privacy & security

### Does AlignTrue collect telemetry?

Only if you opt in. Telemetry is disabled by default:

```bash
aligntrue telemetry status  # Check status
aligntrue telemetry on      # Enable (optional)
```

See [Privacy policy](/docs/06-policies/privacy).

### What data is collected (if enabled)?

- Command names (init, sync, check)
- Export targets (cursor, agents-md)
- Rule hashes (SHA-256, no content)
- Anonymous UUID

**Never collected:**

- File paths or repo names
- Code or rule content
- Personal information

### Can I use AlignTrue with private rules?

Yes! AlignTrue works completely offline. Your rules never leave your machine unless you explicitly push to git or enable telemetry.

### Is AlignTrue secure for enterprise use?

Yes:

- Local-first (no cloud required)
- MIT license (permissive)
- Deterministic hashing (SHA-256)
- Audit trails (git integration)
- No external dependencies at runtime

See [Security policy](/docs/06-policies/index).

## Contributing

### Can I add support for my agent?

Yes! See [Adding exporters guide](/docs/05-contributing/adding-exporters).

### Can I contribute rule packs?

Yes! See [Creating packs guide](/docs/05-contributing/creating-packs).

### Where do I report bugs?

[GitHub Issues](https://github.com/AlignTrue/aligntrue/issues)

### Where do I ask questions?

[GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

## Still have questions?

- [Quickstart guide](/docs/00-getting-started/00-quickstart) - Get started in 60 seconds
- [Troubleshooting](/docs/04-troubleshooting) - Common issues
- [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions) - Ask the community
