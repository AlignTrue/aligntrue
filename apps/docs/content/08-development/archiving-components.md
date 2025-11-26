---
title: Archiving components
description: Checklist for safely archiving components to prevent CI failures and maintain clean codebase
---

# Archiving components checklist

This checklist prevents issues like the transpile validation CI failure that occurred when `apps/web` was archived but scripts still referenced it.

## When to use

Follow this checklist when moving any component (app, package, or major module) to the `archive/` directory.

## Pre-archive checklist

### 1. Search for references

Search the entire codebase for references to the component being archived:

```bash
# Replace "path/to/component" with the actual path
grep -r "path/to/component" scripts/
grep -r "path/to/component" .github/workflows/
grep -r "path/to/component" package.json
grep -r "path/to/component" pnpm-workspace.yaml
```

**Example (archiving apps/web):**

```bash
grep -r "apps/web" scripts/
grep -r "apps/web" .github/workflows/
grep -r "apps/web" package.json
```

### 2. Update or remove scripts

For each script that references the archived component:

- **Delete if component-specific** - Script only exists for the archived component
- **Add existsSync() guards** - Script handles multiple components, some archived
- **Update paths** - Component relocated but still active

**Example (validation script with guard):**

```javascript
const configPath = join(rootDir, "apps/web/next.config.ts");
const config = existsSync(configPath) ? loadConfig(configPath) : null;

if (config !== null) {
  // Validate active component
} else {
  console.log("📦 apps/web (skipped - archived)");
}
```

### 3. Test affected scripts

Run all scripts that might be affected:

```bash
# Run validation scripts
node scripts/validate-*.mjs

# Build packages
pnpm build:packages

# Run tests
pnpm test
```

### 4. Update CI workflow

Check `.github/workflows/` for steps that reference the archived component:

- Remove build steps for archived apps
- Remove deployment steps for archived apps
- Remove test steps specific to archived component
- Update validation steps to skip archived components

### 5. Update package configuration

Check and update:

- `package.json` - Remove scripts referencing archived component
- `pnpm-workspace.yaml` - Remove archived workspace paths
- `tsconfig.json` - Remove path mappings to archived component
- `vercel.json` - Remove rewrites/redirects to archived apps

### 6. Document in CHANGELOG

Add entry explaining:

- What was archived and why
- When it was archived
- Migration path (if applicable)
- Restoration triggers (if applicable)

**Example:**

```markdown
### Archived

- **apps/web (Catalog website)** - Archived to simplify pre-launch. Static catalog page in docs site replaces it. Restoration triggers: 50+ active users OR 20+ curated aligns.
```

### 7. Update future features documentation

Document the archived feature with:

- What was built and why it was archived
- Current approach or workaround
- Clear restoration triggers (objective, measurable)
- Estimated restoration effort
- Implementation notes for future restoration

## Post-archive verification

### 1. Local validation

```bash
# Ensure all validation scripts pass
node scripts/validate-ui-tsconfig.mjs
node scripts/validate-transpile-packages.mjs

# Build all active packages
pnpm build:packages

# Run test suite
pnpm test

# Check for untracked files created by scripts
git status
```

### 2. CI validation

Push to a feature branch and verify:

- All CI jobs pass
- No references to archived component in logs
- Build completes successfully
- Tests pass on all platforms

### 3. Documentation review

Verify documentation is updated:

- CHANGELOG.md has archive entry
- Future features doc has restoration guide
- Development docs reference current structure
- README (if applicable) updated

## Common pitfalls

### Hardcoded paths

**Problem:** Scripts assume directory structure without checking existence

**Solution:** Always use `existsSync()` before accessing paths

```javascript
// BAD
const config = readFileSync(configPath);

// GOOD
if (existsSync(configPath)) {
  const config = readFileSync(configPath);
}
```

### Validation scripts

**Problem:** Validators check archived components and fail

**Solution:** Skip archived components gracefully with clear messaging

```javascript
if (!existsSync(componentPath)) {
  console.log(`📦 ${componentName} (skipped - archived)`);
  continue;
}
```

### Build scripts

**Problem:** Build scripts create archived directories

**Solution:** Delete component-specific build scripts, update paths in shared scripts

### CI workflows

**Problem:** CI runs steps for archived components

**Solution:** Remove archived component steps from workflow files

## Example: Archiving apps/web

This real example shows the process:

1. **Search:** Found references in `scripts/catalog/build-catalog.ts`, `scripts/validate-transpile-packages.mjs`, `scripts/validate-ui-tsconfig.mjs`

2. **Update:**
   - Deleted `scripts/catalog/build-catalog.ts` (component-specific)
   - Updated `validate-transpile-packages.mjs` with existsSync() guard
   - Verified `validate-ui-tsconfig.mjs` already had guards

3. **Test:** Ran all validation scripts and build - passed ✅

4. **CI:** Verified no CI steps reference apps/web - clean ✅

5. **Document:**
   - Added CHANGELOG entry
   - Updated future features doc with restoration triggers
   - Created this checklist

6. **Verify:** Pushed to CI, all checks passed ✅

## Related documentation

- [CI failure prevention](/docs/08-development/ci-failures)
- [Development setup](/docs/08-development/setup)
- [CHANGELOG](/CHANGELOG.md)
