<!-- AUTO-GENERATED from apps/docs/content - DO NOT EDIT DIRECTLY -->
<!-- Edit the source files in apps/docs/content and run 'pnpm generate:repo-files' -->

# AlignTrue Registry Policy

This document defines the governance rules for the AlignTrue registry of Align packs.

## Namespacing

All Align packs must follow the namespacing convention to maintain clarity and avoid collisions.

### Namespace structure

- `packs/base/*` - Foundation packs applicable across stacks
  - Example: `packs/base/base-testing`, `packs/base/base-security`
  - Use for: Rules that apply universally regardless of stack or framework

- `packs/stacks/*` - Stack-specific packs
  - Example: `packs/stacks/nextjs-app-router`, `packs/stacks/react-frontend`
  - Use for: Rules specific to a framework, library, or tech stack

- `packs/templates/*` - Template and example packs
  - Example: `packs/templates/starter`
  - Use for: Educational templates and examples for contributors

- `packs/org/<org-name>/*` - Organization-specific packs (future)
  - Reserved namespace for future use
  - Will enable organizations to publish private or public org-specific packs

### Naming conventions

- Use kebab-case for all IDs: `base-testing` not `base_testing` or `baseTesting`
- Be descriptive but concise: prefer `base-docs` over `base-documentation-rules`
- Avoid redundancy: `packs/base/base-testing` not `packs/base/testing-base`

## Verified authorship

Packs are marked as verified based on their source repository.

### Current verification

- **Automatic verification**: All packs in the `AlignTrue/aligns` repository are automatically verified
- **Verified badge**: Verified packs display a badge in the catalog
- **Trust signal**: Verification indicates the pack comes from a known, trusted source

### Future enhancements

Cryptographic signing via Sigstore may be added in the future.

## Contribution requirements

All contributions to the registry must meet these requirements:

### Technical requirements

1. **Schema validation**: Pack must pass validation against the Align Spec v1 JSON Schema
2. **Deterministic integrity hash**: Integrity hash must be computed using JCS canonicalization and SHA-256
3. **CI passing**: All CI checks must pass, including schema validation and testkit conformance

### Content requirements

1. **Machine-checkable rules**: All rules must use one of the 5 supported check types
   - `file_presence`
   - `path_convention`
   - `manifest_policy`
   - `regex`
   - `command_runner`

2. **Actionable evidence**: Evidence messages must clearly explain what failed and where
   - Bad: "Validation failed"
   - Good: "Missing test file for src/utils/format.ts"

3. **Concrete autofix hints**: When provided, autofix hints must include specific commands or steps
   - Bad: "Fix the issue"
   - Good: "Run `pnpm test --init src/utils/format.test.ts`"

4. **Clear scope**: Pack summary must clearly state what the pack validates and where it applies

## Quality bar

Contributions are expected to meet a quality bar that ensures value for users.

### Scope clarity

- Pack summary should clearly state purpose in one sentence
- `scope.applies_to` should narrow applicability when relevant (backend, frontend, cli, etc.)
- Dependencies should be minimal and justified

### Severity appropriateness

- **MUST**: Use for blocking issues that break builds or cause errors
  - Example: uninstalled imports, syntax errors, security vulnerabilities

- **SHOULD**: Use for warnings that indicate problems but don't block
  - Example: missing tests, incomplete documentation, deprecated patterns

- **MAY**: Use for suggestions and style preferences
  - Example: console.log statements, TODO comments, formatting preferences

### False positive rate

- Packs should target less than 5% false positive rate
- Rules should be objective and deterministic where possible
- Subjective or context-dependent rules should be MAY severity

## Yanking packs

Packs may be yanked (marked as deprecated or unsafe) but not deleted to maintain hash stability.

### Yanking process

1. **Open issue**: Create an issue in `AlignTrue/aligns` with rationale
   - Security vulnerability
   - High false positive rate
   - Broken or non-deterministic behavior
   - Superseded by better pack

2. **Discussion period**: Allow community feedback (minimum 48 hours for non-security issues)

3. **Mark as yanked**: Submit PR to mark pack as yanked in `catalog/index.json`
   - Pack remains in repository
   - Hash remains valid for reproducibility
   - Catalog shows warning and suggests alternatives

4. **Update documentation**: Add note to pack file explaining yank reason and pointing to replacement

### Yank implications

- Yanked packs remain accessible by hash for reproducibility
- Website catalog displays prominent warning
- CLI shows warning when validating or bundling with yanked pack
- Yanked packs excluded from search results and recommendations

## Future governance

This policy covers the essential governance needed for Phase 1. Additional governance will be added when needed.

### What's deferred

The following governance elements are explicitly deferred:

- **Formal dispute resolution**: Will be added when first external dispute arises
- **Maintainer SLAs**: Will be added when 10+ active external contributors participate
- **Security advisory system**: Full CVE-style system deferred until community size warrants it

### Governance evolution

This policy will evolve based on community needs. Proposed changes should:

- Be discussed in GitHub Discussions or issues before implementation
- Maintain backward compatibility where possible
- Document rationale and migration path for breaking changes
- Reflect actual community experience, not theoretical concerns

## Questions and feedback

- **Documentation**: See [full documentation](/) for details
- **Discussions**: Use [GitHub Discussions](https://github.com/AlignTrue/aligns/discussions) for questions and proposals
- **Issues**: Open [issues](https://github.com/AlignTrue/aligns/issues) for bugs, problems, or policy concerns
- **Contributing**: See [creating packs](https://aligntrue.ai/docs/contributing/creating-packs) for how to submit packs

---

**Version**: 1.0.0  
**Last updated**: 2025-10-24  
**Applies to**: AlignTrue Align Spec v1


---

**This file is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs).**  
**To propose changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`.**
