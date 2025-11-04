# Privacy & telemetry

AlignTrue respects your privacy and operates with transparency.

## Privacy-first by default

AlignTrue operates **offline-first** and respects your privacy:

- **No network calls by default** - Local rules only, zero external requests
- **Telemetry opt-in** - Disabled by default, must explicitly enable
- **Transparent network operations** - You approve what connects where
- **Anonymous when enabled** - Uses randomly generated UUID, not tied to identity
- **Local-first storage** - Data stays on your machine

## Telemetry overview

Telemetry in AlignTrue is:

- **Opt-in only** - Disabled by default
- **Anonymous** - Uses a randomly generated UUID, not tied to your identity
- **Local-first** - Stored locally, with optional sending when enabled
- **Minimal** - Only collects aggregate usage data, never your code or files

## What we collect

When telemetry is enabled, we collect:

1. **Command names** - Which AlignTrue commands you run (e.g., `init`, `sync`, `team`)
2. **Export targets** - Which agent exporters you use (e.g., `cursor`, `agents-md`)
3. **Rule content hashes** - SHA-256 hashes of your rules (for understanding usage patterns, not content)

### Example event

```json
{
  "timestamp": "2025-10-27T12:00:00.000Z",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "command_name": "sync",
  "export_target": "cursor,agents-md",
  "align_hashes_used": ["abc12345", "def67890"]
}
```

## What we never collect

We explicitly **never** collect:

- ❌ Repository names or paths
- ❌ File paths or directory structures
- ❌ Rule content or guidance text
- ❌ Code snippets or implementations
- ❌ Environment variables or secrets
- ❌ User names, emails, or identities
- ❌ IP addresses
- ❌ Any personally identifiable information (PII)

## Privacy guarantees

### Validation

AlignTrue validates every telemetry event before recording:

- Rejects events containing file paths (forward/backward slashes)
- Rejects events containing code keywords (`function`, `const`, `let`, etc.)
- Rejects suspiciously long strings that might contain code

### Local storage

Currently, all telemetry is stored **locally only**:

- Location: `.aligntrue/telemetry-events.json`
- Rotation: Automatically keeps only the last 1,000 events
- Deletion: Simply remove the file to delete all events
- Network: No data sent anywhere

### Optional sending

If you choose to enable telemetry sending in the future:

1. **Explicit opt-in required** - Separate consent from enabling telemetry
2. **Clear disclosure** - You'll see exactly what will be sent before agreeing
3. **Granular control** - Options to adjust what data is included
4. **Revocable** - You can stop sending at any time
5. **Transparency** - Full visibility into what was sent

## Data retention

### Local storage

- **Storage**: `.aligntrue/telemetry-events.json` in your project
- **Rotation**: Automatically limited to 1,000 most recent events
- **Deletion**:
  - Delete the file manually: `rm .aligntrue/telemetry-events.json`
  - Disable telemetry: `aligntrue telemetry off` (stops new events)

### Server-side (when enabled)

When sending is implemented:

- Events will be retained for 90 days maximum
- You can request deletion via `aligntrue telemetry delete`
- UUIDs can be rotated to start fresh

## How telemetry helps

Anonymous usage data helps us:

1. **Prioritize features** - Understand which commands and exporters are most used
2. **Improve reliability** - Identify patterns in failures or edge cases
3. **Optimize performance** - See where users spend the most time
4. **Support decisions** - Decide which agents to prioritize for new features

## Enabling/disabling

### Enable telemetry

```bash
aligntrue telemetry on
```

This generates a one-time anonymous UUID and begins recording events locally.

### Disable telemetry

```bash
aligntrue telemetry off
```

This stops recording new events. Existing events remain in the file until you delete it.

### Check status

```bash
aligntrue telemetry status
```

Shows current telemetry state (enabled/disabled).

## Viewing your data

To see what data has been collected locally:

```bash
cat .aligntrue/telemetry-events.json | jq .
```

This shows the exact events that have been recorded.

## Questions or concerns

If you have questions about privacy or telemetry:

- **GitHub Issues**: [AlignTrue/aligntrue/issues](https://github.com/AlignTrue/aligntrue/issues)
- **Documentation**: [docs/](https://github.com/AlignTrue/aligntrue/tree/main/docs)

## Network operations

AlignTrue operates **offline-first** and only makes network calls when explicitly configured.

### Default (no network) ✅

By default, AlignTrue makes **zero network requests**:

- ✅ Local rules (`.aligntrue/rules.md`)
- ✅ Telemetry storage (local-only)
- ✅ All sync operations
- ✅ All exporter outputs
- ✅ Validation and checks
- ✅ Init, migrate, and other commands

### Requires network (explicit opt-in) 🌐

Network calls only occur when you explicitly configure these sources:

#### Git sources

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
```

- Fetches from specified repository
- **First-time consent:** Same consent flow as catalog
- Clear disclosure of external repository URL

See [Git Sources Guide](/reference/git-sources) for full documentation on configuration, caching, and troubleshooting.

#### Telemetry sending (when implemented)

- Separate opt-in required (beyond enabling telemetry)
- Explicit consent with clear disclosure
- Shows exactly what data will be sent
- Revocable at any time

### First-time consent

When you add a network source, AlignTrue prompts for consent before the first network operation:

**How it works:**

1. **Detect** network operations needed (catalog or git sources)
2. **Prompt** for permission with clear description
3. **Store** consent in `.aligntrue/privacy-consent.json` (git-ignored)
4. **Remember** - no prompts on subsequent syncs
5. **Allow** revocation at any time

The consent check happens when a provider attempts a network operation. If consent hasn't been granted, you'll see a clear error with instructions.

### Privacy controls

#### Audit consents

```bash
aligntrue privacy audit
```

Shows all granted consents with timestamps and details.

**Example output:**

```
Privacy Consents

  ✓ git        Granted Oct 29, 2025 at 11:45 AM

Use 'aligntrue privacy revoke <operation>' to revoke
```

#### Revoke consent

```bash
aligntrue privacy revoke git        # Revoke git consent
aligntrue privacy revoke --all      # Revoke everything
```

Removes consent; future syncs will prompt again when network is needed.

#### Offline mode

```bash
aligntrue sync --offline
```

Skips all network operations, uses cache only, fails gracefully if network required.

### Viewing your data

All locally stored data is in plain JSON:

**Telemetry events:**

```bash
cat .aligntrue/telemetry-events.json | jq .
```

**Privacy consents:**

```bash
cat .aligntrue/privacy-consent.json | jq .
```

**Example consent file:**

```json
{
  "git": {
    "granted": true,
    "granted_at": "2025-10-29T11:45:00.000Z"
  }
}
```

**Git cache:**

```bash
ls .aligntrue/.cache/git/
```

## Compliance

AlignTrue's privacy approach is designed to be compliant with:

- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- Enterprise privacy policies

Because we:

- Collect no PII
- Provide explicit opt-in for all network operations
- Store locally by default with no external requests
- Allow complete deletion and consent revocation
- Disclose clearly what is collected and when
- Give users full control over their data

---

**Last Updated**: 2025-10-29  
**Policy Version**: 1.1
