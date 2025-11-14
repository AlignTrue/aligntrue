---
"@aligntrue/cli": patch
"@aligntrue/core": patch
"@aligntrue/exporters": patch
"@aligntrue/schema": patch
"@aligntrue/sources": patch
"@aligntrue/file-utils": patch
"@aligntrue/plugin-contracts": patch
"@aligntrue/testkit": patch
"aligntrue": patch
---

Fix release process and sync repo state with NPM

- Fixed duplicate warning messages in solo mode with team features enabled
- Security: Use secure temp directory for backup files (CodeQL alert fix)
- Fixed documentation accuracy validation
- Fixed Windows performance test thresholds for CI stability
- Fixed IR loader timeouts for large files
- Synced aligntrue package version with NPM (0.1.0-alpha.5)
- Repaired corrupted .changeset/pre.json configuration
