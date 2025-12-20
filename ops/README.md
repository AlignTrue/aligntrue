# .internal_docs

**Purpose:** Internal development documentation for AlignTrue  
**Audience:** AI agents, maintainers, and contributors  
**Status:** Active reference documentation

---

## Overview

This directory contains internal documentation that guides development but is not intended for public consumption. These are working files that:

- Document architectural decisions and rationale
- Provide testing playbooks for AI agents
- Record user research and perception tests
- Define UX guidelines and security standards

**Note:** Public-facing documentation lives in `docs/`, not here.

---

## Related Documentation

### Public Documentation

- `docs/` - User-facing documentation (quickstart, commands, troubleshooting)
- `README.md` - Project README
- `CHANGELOG.md` - User-facing changelog

### Development Rules

- `.cursor/rules/*.mdc` - AI agent development rules and guidelines. For editing, edit the source in `.aligntrue/rules/*.md`

---

## Principles

> **CHANGELOG + User docs = Enough**
> Everything else is temporary and must be deleted before merge.

This directory follows that principle:

- **CHANGELOG.md** tracks what changed (for users)
- **docs/** explains how to use features (for users)
- **.internal_docs/** explains why and how decisions were made (for developers/AI)

Keep this directory lean. When features complete, update CHANGELOG and docs/, then delete or archive the internal tracking files.
