---
description: Focused AI-driven CLI testing playbook with 7 exploration areas covering all 24 commands
enabled: false
---

# CLI Testing Playbook

**Purpose:** Validate AlignTrue CLI by exploring real user workflows like an AI-driven test would. Find issues that automated tests miss.

**When to use:** Before releases, or when explicitly asked to test the CLI comprehensively.

**Key principle:** AI acts like a user—exploring features, discovering issues, reporting findings. Not a script to execute mechanically.

---

## Before you start

### Safety rules

**⚠️ CRITICAL: Never test in workspace root**

- Always create test directories in `/tmp/`
- AlignTrue will detect existing `.aligntrue/` config and use it
- Testing in workspace root risks corrupting your local setup
- Create new test dir: `mkdir /tmp/aligntrue-test-$(date +%s) && cd $_`
- Some commands do not support `--yes` (e.g., `plugs set`, `override add`, certain revert flows). Be ready to run them interactively.

### Setup

1. **Build the CLI:**

   ```bash
   cd /path/to/aligntrue
   pnpm build
   ```

2. **Create test directory:**

   ```bash
   cd /tmp
   TEST_DIR="aligntrue-test-$(date +%s)"
   mkdir "$TEST_DIR" && cd "$TEST_DIR"
   ```

3. **Use absolute path to CLI:**
   ```bash
   CLI="/path/to/aligntrue/packages/cli/dist/index.js"
   $CLI --version  # Verify it works
   ```

---

## Seven exploration areas

Complete each area sequentially. After finishing each area, record findings before moving to the next.

### Area 1: Core Workflow

**Goal:** Test basic solo developer setup and sync.

**Commands:** `init`, `sync`, `check`, `status`

**What to try:**

1. Fresh init (solo mode):

   ```bash
   $CLI init --mode solo --yes
   ```

   - Does `.aligntrue/config.yaml` get created?
   - Does `.aligntrue/rules/` directory exist?
   - Do exporters get auto-detected?

2. Create a rule and sync:

   ```bash
   echo "## Test Rule

   This is a test." > .aligntrue/rules/test.md
   $CLI sync
   ```

   - Does AGENTS.md get created?
   - Do Cursor files appear in `.cursor/rules/`?
   - Does backup get created automatically?

3. Check command:

   ```bash
   $CLI check
   ```

   - Does it validate the config?
   - Are errors clear?

4. Status command:

   ```bash
   $CLI status
   ```

   - Does it show sync health?
   - Are exporters listed correctly?

5. (Watch command removed) Skip watch; use repeat syncs to validate idempotency.

6. Content modes (if multiple exporters):

   ```bash
   $CLI sync --content-mode inline
   $CLI sync --content-mode links
   ```

   - Does content mode affect exports?

**Report findings:**

- [ ] All files created correctly
- [ ] Backups created on sync
- [ ] Status shows accurate info
- [ ] Any errors or unexpected behaviors?

---

### Area 2: Source Management

**Goal:** Test multi-source rules and targeting.

**Commands:** `add`, `remove`, `sources`, `rules`

**What to try:**

1. List sources:

   ```bash
   $CLI sources list
   ```

   - Shows local rules directory?
   - Section counts accurate?

2. Add an external source (one-time import; use `add source <url>` for linked sources):

   ```bash
   $CLI add https://github.com/AlignTrue/examples/blob/main/aligns/global.md --yes
   ```

   - Does it fetch the file?
   - Is it added to config?

3. List rules by agent:

   ```bash
   $CLI rules --by-agent
   ```

   - Shows rules per agent?
   - Accurate counts?

4. Per-rule targeting (create rule with targeting):

   ```bash
   cat > .aligntrue/rules/cursor-only.md <<'EOF'
   ---
   title: Cursor Only Rule
   export_only_to:
     - cursor
   ---

   ## This rule only appears in Cursor

   Content here.
   EOF
   $CLI sync
   ```

   - Does rule only appear in `.cursor/rules/`?
   - Does AGENTS.md exclude it?

5. Remove a source:

   ```bash
   $CLI remove <source-name> --yes
   ```

   - Is it removed from config?

**Report findings:**

- [ ] Sources list works
- [ ] Add fetches correctly
- [ ] Targeting rules respected
- [ ] Remove works
- [ ] Any errors?

---

### Area 3: Team Collaboration

**Goal:** Test team mode, lockfiles, and drift detection.

**Note:** Team mode uses two config files:

- `config.team.yaml` - Team settings (committed)
- `config.yaml` - Personal settings (gitignored)

**Commands:** `team`, `drift`

**What to try:**

1. Enable team mode:

   ```bash
   $CLI team enable --yes
   ```

   - Does `.aligntrue/config.team.yaml` get created?
   - Does `.aligntrue/lock.json` get created?
   - Is `.aligntrue/config.yaml` added to `.gitignore`?
   - Team settings (mode, lockfile) in `config.team.yaml`?

2. Team status:

   ```bash
   $CLI team status
   ```

   - Shows current approval status?

3. Simulate drift (edit rule, check drift):

   ```bash
   echo "### Unapproved change" >> .aligntrue/rules/test.md
   $CLI drift --gates
   ```

   - Does it detect the change?
   - Does exit code indicate drift?

4. Update lockfile (approve changes via sync):

   ```bash
   $CLI sync
   ```

   - Does lockfile get updated?

5. Verify no drift after sync:

   ```bash
   $CLI drift --gates
   ```

   - Should pass (no drift)?

**Report findings:**

- [ ] Lockfile created and valid
- [ ] Drift detection works
- [ ] Sync updates lockfile
- [ ] Git modes work (if testing git)
- [ ] Any errors?

---

### Area 4: Customization

**Goal:** Test scopes, plugs, and overlays.

**Commands:** `scopes`, `plugs`, `override`

**What to try:**

1. Configure scopes for monorepo:
   ```bash
   mkdir -p apps/web packages/api
   cat > .aligntrue/config.yaml <<'EOF'
   mode: solo
   scopes:
     - path: apps/web
       rulesets: []
     - path: packages/api
       rulesets: []
   exporters:
     - cursor
     - agents
   EOF
   ```
2. List scopes:

   ```bash
   $CLI scopes
   ```

   - Shows all scopes?
   - Paths correct?

3. Test plugs (config-only fills, strict required plugs):

   ```bash
   cat > .aligntrue/rules/with-plugs.md <<'EOF'
   ---
   title: Rule with Plugs
   plugs:
     slots:
       test.cmd:
         description: Test command
         format: command
         required: true
   ---

   ## Testing

   Run: [[plug:test.cmd]]
   EOF
   $CLI sync && echo "FAIL: sync should fail when required plug missing"

   # Fill required plug (formats: command, text; file/url deprecated and treated as text)
   $CLI plugs set test.cmd "pnpm test"
   $CLI plugs
   $CLI sync
   ```

   - Does status show required plugs filled? Does sync succeed after fill?

4. Test overlays (selectors limited, conflicts fail by default):

   ```bash
   $CLI override add --selector "rule[id=some-rule]" --set "severity=error"
   $CLI override  # default status + diff
   ```

   - Conflicts should fail unless `--allow-overlay-conflicts` is provided.

**Report findings:**

- [ ] Scopes resolve correctly
- [ ] Plugs audit works
- [ ] Plugs set saves fills
- [ ] Overlays apply
- [ ] Any errors?

---

### Area 5: Config & Exporters

**Goal:** Test configuration management and agent detection.

**Commands:** `config`, `exporters`, `doctor`

**What to try:**

1. Show config:

   ```bash
   $CLI config show
   ```

   - Does it display full config?

2. Get single value:

   ```bash
   $CLI config get mode
   ```

   - Returns correct value?

3. Set value:

   ```bash
   $CLI config set mode solo --yes
   ```

   - Persists to file?

4. List exporters:

   ```bash
   $CLI exporters
   ```

   - Shows all 50+ exporters?
   - Indicates which are enabled?

5. Detect new agents:

   ```bash
   mkdir -p .aider/rules
   echo "test" > .aider/rules/test.md
   $CLI exporters detect
   ```

   - Detects new `.aider/` directory?

6. Run doctor:

   ```bash
   $CLI doctor
   ```

   - Runs health checks?
   - Reports any issues?

**Report findings:**

- [ ] Config commands work
- [ ] Exporters list accurate
- [ ] Detection works
- [ ] Doctor finds issues or clears status
- [ ] Any errors?

---

### Area 6: Safety & Recovery

**Goal:** Test backups, recovery, and onboarding.

**Commands:** `backup`, `revert`, `doctor`, `onboard`

**What to try:**

1. Verify backups after sync:

   ```bash
   ls -la .aligntrue/.backups/
   ```

   - Backups created automatically?
   - Timestamps present?

2. List backups:

   ```bash
   $CLI backup list
   ```

   - Shows all backups?
   - Timestamps readable?

3. Create deliberate change and revert:

   ```bash
   echo "DELETED CONTENT" > .aligntrue/rules/test.md
   $CLI revert --latest --yes
   ```

   - Does revert restore the file?
   - Was backup used?

4. Run onboard wizard:

   ```bash
   echo "n" | $CLI onboard  # Skip interactive
   ```

   - Does it provide checklist?

**Report findings:**

- [ ] Backups created on every sync
- [ ] Backup list shows all
- [ ] Revert restores correctly
- [ ] Onboard runs without errors
- [ ] Any issues?

---

### Area 7: Edge Cases & Privacy

**Goal:** Test unusual scenarios, error handling, privacy.

**Commands:** `privacy`, `migrate`

**What to try:**

1. Privacy audit:

   ```bash
   $CLI privacy audit
   ```

   - Shows consent status?

2. Grant privacy consent:

   ```bash
   $CLI privacy grant git --yes
   ```

   - Updates consent state?

3. Edge cases:
   - Empty rule file:

     ```bash
     touch .aligntrue/rules/empty.md
     $CLI sync
     ```

     - Error or skip gracefully?

   - Invalid YAML frontmatter:
     ```bash
     echo "---
     invalid: [yaml
     ```

   ***

   Content" > .aligntrue/rules/bad.md
   $CLI sync

   ````
   - Error message helpful?

   - Very large file (>100KB):
   ```bash
   python3 -c "print('## Large Rule\n\n' + 'x' * 150000)" > .aligntrue/rules/large.md
   $CLI sync
   ````

   - Handles large files?

**Report findings:**

- [ ] Privacy commands work
- [ ] Edge cases handled gracefully
- [ ] Error messages clear
- [ ] No crashes on invalid input
- [ ] Any issues?

---

## Recording findings

After each area, summarize:

### Area [N] - [Name]

**Tests completed:**

- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

**Issues found:**

- (Describe any critical/medium/low severity issues)

**Doc/behavior mismatches:**

- (Note any where docs don't match actual behavior)

**Confidence:** [Thorough / Partial / Skipped]

---

## Coverage matrix

Mark each command as tested:

| Command   | Tested | Notes |
| --------- | ------ | ----- |
| init      | [ ]    |       |
| sync      | [ ]    |       |
| check     | [ ]    |       |
| status    | [ ]    |       |
| add       | [ ]    |       |
| remove    | [ ]    |       |
| sources   | [ ]    |       |
| rules     | [ ]    |       |
| team      | [ ]    |       |
| drift     | [ ]    |       |
| scopes    | [ ]    |       |
| plugs     | [ ]    |       |
| override  | [ ]    |       |
| config    | [ ]    |       |
| exporters | [ ]    |       |
| backup    | [ ]    |       |
| revert    | [ ]    |       |
| doctor    | [ ]    |       |
| onboard   | [ ]    |       |
| privacy   | [ ]    |       |
| migrate   | [ ]    |       |

---

## Final report

After completing all areas:

1. **Commands test report:** X / 22
2. **Issues found:** X critical, X medium, X low
3. **Tests that failed:** (List any)
4. **Doc mismatches:** (List any)
5. **Overall confidence:** Single run **%, 3 runs **%, 5 runs \_\_%

---

## Cleanup

When finished:

```bash
cd /tmp
rm -rf aligntrue-test-*
```

All test data deleted. Original AlignTrue setup untouched.
