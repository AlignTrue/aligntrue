# Organization Metadata Scenario

**Keywords:** company name, organization URLs, author names, team metadata, company-specific values

## Problem

Your team uses shared rule packs that reference organization-specific metadata:

- Company name: `[[plug:org.name]]`
- Documentation URL: `[[plug:docs.url]]`
- Support email: `[[plug:support.email]]`
- Default author: `[[plug:author.name]]`

Each project needs to fill these with your organization's values.

## Solution

Use plugs to provide organization metadata:

```yaml
plugs:
  fills:
    org.name: "Acme Corp"
    docs.url: "https://docs.acme.com"
    support.email: "support@acme.com"
    author.name: "Acme Engineering Team"
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Rules reference organization metadata via plugs
- All projects use consistent values
- Easy to update across all projects
- No hardcoded company-specific values in packs

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Test command customization
- Stack-specific paths
