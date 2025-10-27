# Privacy & Telemetry

AlignTrue respects your privacy and operates with transparency.

## Telemetry Overview

Telemetry in AlignTrue is:
- **Opt-in only** - Disabled by default
- **Anonymous** - Uses a randomly generated UUID, not tied to your identity
- **Local-first** - Stored locally in Phase 1, with optional sending in Phase 2+
- **Minimal** - Only collects aggregate usage data, never your code or files

## What We Collect

When telemetry is enabled, we collect:

1. **Command names** - Which AlignTrue commands you run (e.g., `init`, `sync`, `team`)
2. **Export targets** - Which agent exporters you use (e.g., `cursor`, `agents-md`)
3. **Rule content hashes** - SHA-256 hashes of your rules (for understanding usage patterns, not content)

### Example Event

```json
{
  "timestamp": "2025-10-27T12:00:00.000Z",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "command_name": "sync",
  "export_target": "cursor,agents-md",
  "align_hashes_used": ["abc12345", "def67890"]
}
```

## What We Never Collect

We explicitly **never** collect:

- ❌ Repository names or paths
- ❌ File paths or directory structures
- ❌ Rule content or guidance text
- ❌ Code snippets or implementations
- ❌ Environment variables or secrets
- ❌ User names, emails, or identities
- ❌ IP addresses (Phase 2+ when sending is added)
- ❌ Any personally identifiable information (PII)

## Privacy Guarantees

### Validation

AlignTrue validates every telemetry event before recording:
- Rejects events containing file paths (forward/backward slashes)
- Rejects events containing code keywords (`function`, `const`, `let`, etc.)
- Rejects suspiciously long strings that might contain code

### Local Storage (Phase 1)

In Phase 1, all telemetry is stored **locally only**:
- Location: `.aligntrue/telemetry-events.json`
- Rotation: Automatically keeps only the last 1,000 events
- Deletion: Simply remove the file to delete all events
- Network: No data sent anywhere

### Future Sending (Phase 2+)

When we add the ability to send telemetry to our servers in Phase 2+:

1. **Explicit opt-in required** - Separate consent from enabling telemetry
2. **Clear disclosure** - You'll see exactly what will be sent before agreeing
3. **Granular control** - Options to adjust what data is included
4. **Revocable** - You can stop sending at any time
5. **Transparency** - Full visibility into what was sent

## Data Retention

### Local (Phase 1)

- **Storage**: `.aligntrue/telemetry-events.json` in your project
- **Rotation**: Automatically limited to 1,000 most recent events
- **Deletion**: 
  - Delete the file manually: `rm .aligntrue/telemetry-events.json`
  - Disable telemetry: `aligntrue telemetry off` (stops new events)

### Server-side (Phase 2+)

When sending is implemented:
- Events will be retained for 90 days maximum
- You can request deletion via `aligntrue telemetry delete`
- UUIDs can be rotated to start fresh

## How Telemetry Helps

Anonymous usage data helps us:

1. **Prioritize features** - Understand which commands and exporters are most used
2. **Improve reliability** - Identify patterns in failures or edge cases
3. **Optimize performance** - See where users spend the most time
4. **Support decisions** - Decide which agents to prioritize for new features

## Enabling/Disabling

### Enable Telemetry

```bash
aligntrue telemetry on
```

This generates a one-time anonymous UUID and begins recording events locally.

### Disable Telemetry

```bash
aligntrue telemetry off
```

This stops recording new events. Existing events remain in the file until you delete it.

### Check Status

```bash
aligntrue telemetry status
```

Shows current telemetry state (enabled/disabled).

## Viewing Your Data

To see what data has been collected locally:

```bash
cat .aligntrue/telemetry-events.json | jq .
```

This shows the exact events that have been recorded.

## Questions or Concerns

If you have questions about privacy or telemetry:

- **GitHub Issues**: [AlignTrue/aligntrue/issues](https://github.com/AlignTrue/aligntrue/issues)
- **Documentation**: [docs/](https://github.com/AlignTrue/aligntrue/tree/main/docs)

## Compliance

AlignTrue's telemetry approach is designed to be compliant with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- Enterprise privacy policies

Because we:
- Collect no PII
- Provide explicit opt-in
- Store locally by default
- Allow complete deletion
- Disclose clearly what is collected

---

**Last Updated**: 2025-10-27  
**Policy Version**: 1.0 (Phase 1 - Local-only)

