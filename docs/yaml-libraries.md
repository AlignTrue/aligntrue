# YAML Libraries in AlignTrue

AlignTrue uses two different YAML libraries across its packages: `yaml` and `js-yaml`. This document explains why we maintain both, when to use each, and when we might consolidate in the future.

## TL;DR

- **`yaml` package (^2.6.1)**: Used in CLI and markdown-parser for user-facing YAML operations
- **`js-yaml` package (^4.1.0)**: Used in core, exporters, and schema for internal operations
- **Why both?**: Different APIs, different use cases, zero consolidation benefit, 1082 tests at risk

---

## Package usage overview

| Package                      | Library   | Version | Files | Use Case                                                        |
| ---------------------------- | --------- | ------- | ----- | --------------------------------------------------------------- |
| `@aligntrue/cli`             | `yaml`    | ^2.6.1  | 3     | Config generation, team mode toggling, MD commands              |
| `@aligntrue/markdown-parser` | `yaml`    | ^2.6.1  | 5     | Literate markdown parsing, YAML block extraction, IR generation |
| `@aligntrue/testkit`         | `yaml`    | ^2.3.4  | 2     | Test vector generation                                          |
| `@aligntrue/core`            | `js-yaml` | ^4.1.0  | 2     | Config loading, IR loading from YAML files                      |
| `@aligntrue/schema`          | `js-yaml` | ^4.1.0  | 1     | Canonicalization (YAML → JSON)                                  |
| `@aligntrue/exporters`       | `js-yaml` | ^4.1.0  | 3     | Aider config export, test fixtures                              |

**Total**: 8 files use `yaml`, 6 files use `js-yaml`

---

## Key API differences

### `yaml` Package (Modern API)

```typescript
import * as yaml from "yaml";
import { parse, stringify } from "yaml";

// Parse YAML string
const doc = yaml.parse(yamlString);

// Stringify with options
const output = yaml.stringify(obj, {
  indent: 2,
  lineWidth: 0,
  defaultKeyType: "PLAIN",
  defaultStringType: "QUOTE_DOUBLE",
});

// Document model for manipulation
const doc = yaml.parseDocument(yamlString);
doc.get("key"); // Access values
```

**Characteristics:**

- Modern ESM-first design
- Document model API for manipulation
- More control over output formatting
- Better TypeScript support
- Active development

### `js-yaml` Package (Mature API)

```typescript
import * as yaml from "js-yaml";
import { load, dump } from "js-yaml";

// Parse YAML string
const obj = yaml.load(yamlString);

// Stringify with options
const output = yaml.dump(obj, {
  indent: 2,
  lineWidth: -1,
  noRefs: true,
});

// Schema support for custom types
const obj = yaml.load(yamlString, { schema: yaml.JSON_SCHEMA });
```

**Characteristics:**

- Mature, battle-tested (10+ years)
- Simple parse/dump API
- Wide ecosystem adoption
- Stable, predictable behavior
- Excellent error messages

---

## Rationale for Dual-Library Approach

### Why not consolidate?

We evaluated consolidating to a single library during Phase 2, Stage 1.5b (October 2025). Here's why we decided to keep both:

#### 1. Different Use Cases

**`yaml` in CLI and markdown-parser:**

- **User-facing operations**: Config generation, starter templates, interactive prompts
- **Literate markdown workflows**: Parsing fenced blocks, round-trip conversion
- **Output formatting matters**: Generated configs need consistent, readable formatting
- **API advantage**: Document model useful for manipulating YAML structure

**`js-yaml` in core and schema:**

- **Internal operations**: Loading existing configs, parsing IR from files
- **Canonicalization pipeline**: YAML → JSON conversion for hashing
- **Battle-tested reliability**: Core operations need predictable, stable parsing
- **Simple requirements**: Just parse/dump, no complex manipulation needed

#### 2. API Differences Matter

The libraries have different philosophies:

- `yaml.parse()` vs `yaml.load()` - subtle behavior differences
- `yaml.stringify()` vs `yaml.dump()` - different formatting defaults
- Document model vs plain objects - affects how code is written
- Error handling differs - different exception types

**Migration effort**: Converting 6-8 files would require:

- Updating all import statements
- Adjusting API calls (parse/load, stringify/dump)
- Testing for subtle parsing differences
- Verifying output formatting matches expectations
- Risk of breaking 1082 passing tests

#### 3. Zero Clear Benefits

**What consolidation would give us:**

- One less dependency (~500KB saved)
- Slightly simpler mental model

**What consolidation would cost:**

- 3-5k tokens of migration work
- Risk to 100% test pass rate (1082/1082 tests)
- Potential subtle behavioral changes
- Time better spent on user-facing features

**Verdict**: The cost/benefit ratio doesn't justify consolidation.

#### 4. Both Libraries Are Stable

- **`yaml` ^2.6.1**: Active development, modern API, excellent TypeScript support
- **`js-yaml` ^4.1.0**: Mature, stable, widely used (10M+ weekly downloads)

Both are:

- Well-maintained with regular security updates
- Have excellent documentation
- Have strong community support
- Have predictable, stable behavior

---

## Usage guidelines

### When to Use `yaml` Package

Use in **user-facing code** where output formatting matters:

```typescript
import { stringify as stringifyYaml } from "yaml";

// Generate config for user
const config = {
  version: "1",
  mode: "solo",
  exporters: ["cursor", "agents-md"],
};

const output = stringifyYaml(config);
// Output has consistent, readable formatting
```

**Packages**: `@aligntrue/cli`, `@aligntrue/markdown-parser`

### When to Use `js-yaml` Package

Use in **internal operations** where simplicity and reliability matter:

```typescript
import { load as parseYaml } from "js-yaml";

// Load existing config
const content = readFileSync(".aligntrue/config.yaml", "utf8");
const config = parseYaml(content);
// Simple, reliable parsing
```

**Packages**: `@aligntrue/core`, `@aligntrue/schema`, `@aligntrue/exporters`

---

## Examples from Codebase

### Example 1: Config Generation (CLI - uses `yaml`)

```typescript
// packages/cli/src/commands/init.ts
import * as yaml from "yaml";

function generateConfig(exporters: string[]): string {
  const config = {
    version: "1",
    exporters,
  };

  return yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
  });
}
```

**Why `yaml`?** User sees this output. Formatting consistency matters.

### Example 2: Config Loading (Core - uses `js-yaml`)

```typescript
// packages/core/src/config/index.ts
import * as yaml from "js-yaml";

export function loadConfig(configPath: string): AlignTrueConfig {
  const content = readFileSync(configPath, "utf8");
  const parsed = yaml.load(content);
  // Validate and return
  return validateConfig(parsed);
}
```

**Why `js-yaml`?** Internal operation. Simple parse is all we need.

### Example 3: Markdown Block Parsing (Parser - uses `yaml`)

```typescript
// packages/markdown-parser/src/ir-builder.ts
import { parse as parseYaml } from "yaml";

export function buildIR(blocks: FencedBlock[]): IRDocument {
  const block = blocks[0];
  const doc = parseYaml(block.content);
  // Build IR from parsed YAML
  return doc as IRDocument;
}
```

**Why `yaml`?** Part of literate markdown workflow. Modern API fits better.

### Example 4: Canonicalization (Schema - uses `js-yaml`)

```typescript
// packages/schema/src/canonicalize.ts
import { load as parseYaml } from "js-yaml";

export function parseYamlToJson(yaml: string): unknown {
  return parseYaml(yaml);
}
```

**Why `js-yaml`?** Critical path for hashing. Mature, predictable, battle-tested.

---

## Future considerations

### When might we consolidate?

We would revisit this decision if any of these occur:

1. **Major version bump (2.0+)**
   - Breaking changes already required
   - Good opportunity to streamline dependencies
   - User migration path already needed

2. **Test failures related to YAML parsing**
   - If subtle differences cause production issues
   - If one library has security vulnerabilities
   - If maintenance burden becomes significant

3. **Clear user pain**
   - If developers are confused by dual approach
   - If contribution friction is high
   - If documentation burden is significant

4. **Significant new features**
   - If one library adds critical features we need
   - If one library becomes unmaintained
   - If ecosystem shifts dramatically

### How would we consolidate?

If we decide to consolidate in the future:

**Option A: Migrate to `yaml`**

- Pros: Modern API, better TypeScript, active development
- Cons: Need to adjust core/schema critical paths
- Effort: ~3-5k tokens, 6 files to migrate
- Risk: Medium (core operations affected)

**Option B: Migrate to `js-yaml`**

- Pros: Mature, stable, widely adopted
- Cons: Need to adjust CLI/parser user-facing code
- Effort: ~3-5k tokens, 8 files to migrate
- Risk: Medium (output formatting may change)

**Current stance**: Neither option is compelling enough to justify the work.

---

## Decision record

**Decision**: Keep both `yaml` and `js-yaml` libraries

**Date**: October 29, 2025 (Phase 2, Stage 1.5b)

**Status**: Accepted

**Context**:

- Two libraries emerged naturally during Phase 1-2 development
- Different packages used different libraries based on use case
- No user complaints about the dual approach
- 1082/1082 tests passing (100% pass rate)

**Decision**:

- Maintain both libraries serving different purposes
- Document architectural rationale (this document)
- Revisit only if clear triggers occur (major version, test failures, user pain)

**Rationale**:

- Different use cases justify different libraries
- API differences matter for the code written
- Zero consolidation benefit (no user-visible improvement)
- Migration risk to stable test suite
- Both libraries are stable and well-maintained

**Alternatives Considered**:

1. Consolidate to `yaml` - rejected (risk to core operations)
2. Consolidate to `js-yaml` - rejected (user-facing formatting would change)
3. Do nothing and don't document - rejected (lack of clarity for contributors)

**Consequences**:

- One extra dependency (~500KB)
- Developers need to know which library to use (documented in READMEs)
- New packages follow existing patterns (user-facing → `yaml`, internal → `js-yaml`)

---

## For contributors

### Adding new code

**Rule of thumb**: Follow the pattern of the package you're working in.

- **Working in `@aligntrue/cli`?** → Use `yaml`
- **Working in `@aligntrue/markdown-parser`?** → Use `yaml`
- **Working in `@aligntrue/core`?** → Use `js-yaml`
- **Working in `@aligntrue/schema`?** → Use `js-yaml`
- **Working in `@aligntrue/exporters`?** → Use `js-yaml`

**Creating a new package?**

Ask:

1. Is this user-facing with output formatting needs? → Use `yaml`
2. Is this internal operations with simple parse/dump? → Use `js-yaml`

When in doubt, check with maintainers or follow the pattern of the most similar existing package.

---

## See also

- `packages/cli/README.md` - CLI YAML usage notes
- `packages/core/README.md` - Core config loading patterns
- `packages/markdown-parser/README.md` - Literate markdown parsing
- `.cursor/rules/phase2_implementation.mdc` - Stage 1.5b completion summary
