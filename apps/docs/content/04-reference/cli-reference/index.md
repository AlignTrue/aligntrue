---
title: "CLI reference"
description: "Complete reference for AlignTrue CLI commands with usage, flags, and examples."
---

# CLI reference

Complete reference for all AlignTrue CLI commands organized by user workflow.

## Getting started

New to AlignTrue? Start here:

1. **[Init](./core#aligntrue-init)** - Set up your project (`aligntrue init`)
2. **[Sync](./core#aligntrue-sync)** - Export rules to agents (`aligntrue sync`)
3. **[Check](./core#aligntrue-check)** - Validate your rules (`aligntrue check`)

---

## Command categories

Browse commands by category:

- **[Core commands](./core)** - Essential daily workflow (init, sync, check, status, watch, doctor)
- **[Sources](./sources)** - Manage rule imports and git sources (add, remove, sources)
- **[Exporters](./exporters)** - Manage agents (list, enable, disable, detect, ignore)
- **[Plugs](./plugs)** - Stack-agnostic variable management (list, resolve, set)
- **[Overlays](./overlays)** - Customize rules without forking (add, status, diff, remove)
- **[Team mode](./team)** - Collaboration and governance (drift, onboard, team, scopes, link)
- **[Backups](./backup)** - Backup and recovery (create, list, restore, cleanup, revert)
- **[Settings](./settings)** - Configuration and privacy (config, privacy)
- **[Migration](./migrate)** - Schema migration and imports (migrate)

---

## All commands quick reference

| Command                     | Description                             | Category                                             |
| --------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `aligntrue init`            | Initialize project with agent detection | [Core](./core#aligntrue-init)                        |
| `aligntrue sync`            | Sync rules to agents                    | [Core](./core#aligntrue-sync)                        |
| `aligntrue check`           | Validate rules                          | [Core](./core#aligntrue-check)                       |
| `aligntrue status`          | Show current status and exporters       | [Core](./core#aligntrue-status)                      |
| `aligntrue doctor`          | Run health checks and verification      | [Core](./core#aligntrue-doctor)                      |
| `aligntrue add`             | Add rules from URL or path              | [Sources](./sources#aligntrue-add)                   |
| `aligntrue remove`          | Remove a linked source                  | [Sources](./sources#aligntrue-remove)                |
| `aligntrue sources`         | Manage rule sources                     | [Sources](./sources#aligntrue-sources)               |
| `aligntrue exporters`       | Manage exporters                        | [Exporters](./exporters#aligntrue-exporters)         |
| `aligntrue plugs list`      | List slots and fills                    | [Plugs](./plugs#aligntrue-plugs-list)                |
| `aligntrue plugs resolve`   | Preview resolution                      | [Plugs](./plugs#aligntrue-plugs-resolve)             |
| `aligntrue plugs set`       | Set fill value                          | [Plugs](./plugs#aligntrue-plugs-set)                 |
| `aligntrue override add`    | Create overlay                          | [Overlays](./overlays#aligntrue-override-add)        |
| `aligntrue override status` | View overlays                           | [Overlays](./overlays#aligntrue-override-status)     |
| `aligntrue override diff`   | Show overlay effects                    | [Overlays](./overlays#aligntrue-override-diff)       |
| `aligntrue override remove` | Remove overlay                          | [Overlays](./overlays#aligntrue-override-remove)     |
| `aligntrue drift`           | Detect drift                            | [Team](./team#aligntrue-drift)                       |
| `aligntrue onboard`         | Developer onboarding                    | [Team](./team#aligntrue-onboard)                     |
| `aligntrue team enable`     | Enable team mode                        | [Team](./team#aligntrue-team-enable)                 |
| `aligntrue scopes`          | List scopes                             | [Team](./team#aligntrue-scopes)                      |
| `aligntrue link`            | Vendor rules                            | [Team](./team#aligntrue-link)                        |
| `aligntrue backup`          | Backup management                       | [Backups](./backup#aligntrue-backup)                 |
| `aligntrue revert`          | Restore files from backup               | [Backups](./backup#aligntrue-revert)                 |
| `aligntrue config`          | View or edit configuration              | [Settings](./settings#aligntrue-config-showedit)     |
| `aligntrue privacy`         | Privacy consents                        | [Settings](./settings#aligntrue-privacy-auditrevoke) |
| `aligntrue migrate`         | Schema migration                        | [Migration](./migrate)                               |

---

## Quick examples

**Initialize a new project:**

```bash
aligntrue init
```

**Sync rules to all configured agents:**

```bash
aligntrue sync
```

**Check rules for errors:**

```bash
aligntrue check
```

**Enable team mode:**

```bash
aligntrue team enable
```

For detailed documentation on each command, browse the categories above or use the command table to jump directly to specific commands.
