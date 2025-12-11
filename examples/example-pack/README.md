# Example Starter Pack

This is an example `.align.yaml` pack that bundles multiple rules together for easy sharing and installation.

## Contents

This pack includes 3 foundational rules:

- `rules/global.md` - Global baseline for AI-assisted repos
- `rules/testing.md` - Testing baseline with determinism focus
- `rules/typescript.md` - TypeScript strict mode guide

## Usage

### Via Catalog

Submit this pack URL to the AlignTrue catalog:

```
https://github.com/AlignTrue/aligntrue/tree/main/examples/example-pack
```

### Via CLI

```bash
aligntrue init --source https://github.com/AlignTrue/aligntrue/tree/main/examples/example-pack
```

Or add as a source to an existing project:

```bash
aligntrue add source https://github.com/AlignTrue/aligntrue/tree/main/examples/example-pack
aligntrue sync
```

## Pack Structure

```
examples/example-pack/
  .align.yaml          # manifest defining the pack
  rules/
    global.md          # global baseline rules
    testing.md         # testing standards
    typescript.md      # TypeScript conventions
```

## Testing

This pack is used in integration tests to verify pack resolution and import functionality works correctly.
