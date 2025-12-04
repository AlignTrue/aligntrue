---
title: Conventions
description: Recommended plug keys and overlay patterns for template authors and community standardization
---

# Recommended conventions

Standardized plug keys and overlay patterns help template authors create consistent, interoperable rule aligns. Users benefit by reusing fills across multiple templates.

Using these conventions is optional but recommended.

## Plug key conventions

Plug keys should follow these patterns to maximize interoperability across templates.

### Build and test commands

| Key          | Format  | Description      | Example       |
| ------------ | ------- | ---------------- | ------------- |
| `test.cmd`   | command | Run tests        | `pnpm test`   |
| `build.cmd`  | command | Build project    | `pnpm build`  |
| `lint.cmd`   | command | Run linter       | `pnpm lint`   |
| `format.cmd` | command | Format code      | `pnpm format` |
| `dev.cmd`    | command | Start dev server | `pnpm dev`    |
| `ci.cmd`     | command | Run CI checks    | `pnpm ci`     |

### Project metadata

| Key             | Format | Description            | Example                       |
| --------------- | ------ | ---------------------- | ----------------------------- |
| `org.name`      | text   | Organization name      | `Acme Corp`                   |
| `author.name`   | text   | Primary author or team | `Jane Smith`                  |
| `repo.url`      | url    | Repository URL         | `https://github.com/org/repo` |
| `docs.url`      | url    | Documentation site     | `https://docs.example.com`    |
| `support.email` | text   | Support contact        | `support@example.com`         |

### Configuration and file paths

| Key             | Format | Description            | Example                |
| --------------- | ------ | ---------------------- | ---------------------- |
| `config.file`   | file   | Main config file       | `config/settings.json` |
| `env.file`      | file   | Environment file       | `.env.local`           |
| `tsconfig.file` | file   | TypeScript config      | `tsconfig.json`        |
| `build.output`  | file   | Build output directory | `dist/`                |

### Naming rules

- Use lowercase letters, numbers, dots, hyphens, underscores: `^[a-z0-9._-]+$`
- Use dots for namespacing: `test.cmd`, `docs.url`, `author.name`
- Do NOT start with `stack.` or `sys.` (reserved for AlignTrue system use)
- Be descriptive: prefer `docs.url` over just `url`

### Supported plug formats

- `command` — Single-line shell command; avoid pipes/`&&`. Prefer a package script (for example, `pnpm test`) over chained commands.
- `text` — Single-line UTF-8 text
- `file` — Repo-relative POSIX path (no `..`, no absolute paths)
- `url` — Must start with `http://` or `https://`

## Overlay pattern conventions

Overlays customize upstream rules. These patterns are commonly used:

### Common severity adjustments

| Rule ID                      | Purpose               | Common Override                    |
| ---------------------------- | --------------------- | ---------------------------------- |
| `no-console-log`             | Console logging       | Upgrade to `error` for CI          |
| `no-any` / `no-explicit-any` | TypeScript `any` type | Upgrade to `error` for type safety |
| `prefer-const`               | Use const over let    | Keep as warning or disable autofix |
| `max-complexity`             | Cyclomatic complexity | Adjust `check.inputs.threshold`    |
| `max-lines`                  | File length           | Adjust `check.inputs.max`          |

Example severity override:

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

### Selector naming

- Use kebab-case for rule IDs: `no-console-log`, `prefer-const`, `max-complexity`
- Use dot notation for nested properties: `check.inputs.threshold`, `check.inputs.max`
- Example selector: `rule[id=max-complexity]`
- Example override:
  ```yaml
  overlays:
    overrides:
      - selector: "rule[id=max-complexity]"
        set:
          "check.inputs.threshold": 15
  ```

## When to use conventions

### Use standard keys when:

- Creating a new template align
- Adding plugs to an existing align
- Documenting plugs in your README
- Contributing to community packages

### Safe to deviate when:

- Your specific use case has no standard equivalent
- You need a more specific namespace (e.g., `backend.test.cmd` for backend-specific tests)
- Your project has established internal conventions (document them in your README)

## Best practices for rule authors

1. **Reference conventions first** - Check if a standard key exists before creating a new one
2. **Use descriptive names** - Be clear about what the plug is for
3. **Provide examples** - Always include an example value for required plugs
4. **Document your plugs** - Add a section in your align's README explaining custom plugs
5. **Test with real fills** - Before publishing, set fills and verify output
6. **Consider your users** - Will they recognize standard keys like `test.cmd`?

## Future: Template library integration

When a community template library is built, conventions will:

- Help users discover compatible templates
- Enable automatic compatibility scoring
- Surface popular patterns to new authors
- Suggest standard keys to prevent duplication

For now, following these conventions in your aligns creates an immediate benefit: users can reuse the same fills across multiple templates from different authors.

## Examples

### Simple align with standard plugs

```yaml
id: my-testing-align
version: "1"
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pnpm test"
    docs.url:
      description: "Documentation URL"
      format: url
      required: false
```

For commands, keep the value to a single, safe invocation (for example, `pnpm test`). Use a package script for complex pipelines instead of chaining with `&&` or pipes.

User configures once:

```bash
aligntrue plugs set test.cmd "pnpm test"
aligntrue plugs set docs.url "https://docs.example.com"
```

Both fills work across any align using these standard keys.

### Custom namespace for domain-specific plugs

When no standard fits, use a namespace:

```yaml
backend.db.host:
  description: "Backend database host"
  format: text
  example: "localhost"

backend.db.port:
  description: "Backend database port"
  format: text
  example: "5432"
```

Document these in your README so users understand.

## References

- [Plugs guide](/docs/02-customization/plugs) - Complete plugs documentation
- [Overlays guide](/docs/02-customization/overlays) - Complete overlays documentation
- [Creating aligns](/docs/07-contributing/creating-aligns) - How to author aligns
