# Stack-Specific Paths Scenario

**Keywords:** config file paths, stack-specific locations, different file locations, path customization

## Problem

Your shared rule pack references configuration file paths:

- Config file: `[[plug:config.file]]`
- Environment file: `[[plug:env.file]]`
- Build output: `[[plug:build.output]]`

Different stacks use different locations:

- Next.js: `next.config.js`, `.env.local`, `.next/`
- Node.js: `config/default.json`, `.env`, `dist/`
- Python: `config.yaml`, `.env`, `build/`

## Solution

Use plugs to specify stack-specific paths:

```yaml
plugs:
  fills:
    config.file: "next.config.js"
    env.file: ".env.local"
    build.output: ".next"
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Rules reference file paths via plugs
- Each stack uses appropriate locations
- No path assumptions in shared packs
- Easy to adapt to different project structures

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Test command customization
- Organization metadata
