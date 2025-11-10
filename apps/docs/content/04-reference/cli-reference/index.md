# CLI reference

Complete reference for all AlignTrue CLI commands.

## Common commands

Most users only need these commands:

- `aligntrue init` - Initialize project
- `aligntrue sync` - Sync rules to agents
- `aligntrue check` - Validate rules

**Advanced users** may use markdown commands (`md lint`, `md compile`) or team commands (`team enable`, `drift`).

---

## Command categories

Browse commands by category:

- [Basic commands](./basic) - Daily development (init, import, sync, check, backup)
- [Development commands](./development) - Markdown authoring and adapter management
- [Plugs commands](./plugs) - Stack-agnostic variable management
- [Overlay commands](./overlays) - Selective rule modifications
- [Team mode commands](./team) - Collaboration and drift detection
- [Settings commands](./settings) - Configuration and privacy

---

## All commands

Quick lookup table for all CLI commands:

| Command                     | Description                             | Category                                                                    |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `aligntrue init`            | Initialize project with agent detection | [Basic](./basic#aligntrue-init)                                             |
| `aligntrue sync`            | Sync rules to agents                    | [Basic](./basic#aligntrue-sync)                                             |
| `aligntrue check`           | Validate rules                          | [Basic](./basic#aligntrue-check)                                            |
| `aligntrue backup`          | Backup management                       | [Basic](./basic#aligntrue-backup)                                           |
| `aligntrue adapters`        | Manage exporters                        | [Development](./development#aligntrue-adapters)                             |
| `aligntrue md lint`         | Lint markdown                           | [Development](./development#aligntrue-md-lint)                              |
| `aligntrue md format`       | Format markdown                         | [Development](./development#aligntrue-md-format)                            |
| `aligntrue md compile`      | Compile to IR                           | [Development](./development#aligntrue-md-compile)                           |
| `aligntrue md generate`     | Generate markdown                       | [Development](./development#aligntrue-md-generate)                          |
| `aligntrue plugs audit`     | List slots and fills                    | [Plugs](./plugs#aligntrue-plugs-audit)                                      |
| `aligntrue plugs resolve`   | Preview resolution                      | [Plugs](./plugs#aligntrue-plugs-resolve)                                    |
| `aligntrue plugs set`       | Set fill value                          | [Plugs](./plugs#aligntrue-plugs-set)                                        |
| `aligntrue override add`    | Create overlay                          | [Overlays](./overlays#aligntrue-override-add)                               |
| `aligntrue override status` | View overlays                           | [Overlays](./overlays#aligntrue-override-status)                            |
| `aligntrue override diff`   | Show overlay effects                    | [Overlays](./overlays#aligntrue-override-diff)                              |
| `aligntrue override remove` | Remove overlay                          | [Overlays](./overlays#aligntrue-override-remove)                            |
| `aligntrue drift`           | Detect drift                            | [Team](./team#aligntrue-drift)                                              |
| `aligntrue update`          | Apply updates                           | [Team](./team#aligntrue-update)                                             |
| `aligntrue onboard`         | Developer onboarding                    | [Team](./team#aligntrue-onboard)                                            |
| `aligntrue team enable`     | Enable team mode                        | [Team](./team#aligntrue-team-enable)                                        |
| `aligntrue scopes`          | List scopes                             | [Team](./team#aligntrue-scopes)                                             |
| `aligntrue pull`            | Pull from git                           | [Team](./team#aligntrue-pull)                                               |
| `aligntrue link`            | Vendor packs                            | [Team](./team#aligntrue-link)                                               |
| `aligntrue config`          | View or edit configuration              | [Settings](./settings#aligntrue-config-showedit)                            |
| `aligntrue migrate`         | Schema migration (pre-1.0)              | [Settings](./settings#aligntrue-migrate)                                    |
| `aligntrue team`            | Team mode management                    | [Settings](./settings#aligntrue-team-enablestatusapprovelist-allowedremove) |
| `aligntrue telemetry`       | Telemetry control                       | [Settings](./settings#aligntrue-telemetry-onoffstatus)                      |
| `aligntrue privacy`         | Privacy consents                        | [Settings](./settings#aligntrue-privacy-auditrevoke)                        |

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
