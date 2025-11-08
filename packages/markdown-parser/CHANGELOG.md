# @aligntrue/markdown-parser

## Unreleased

### Security

- Fixed polynomial ReDoS vulnerability in HTML comment format parser. Replaced complex regex with linear split-based parsing to prevent catastrophic backtracking on malformed input.

## 0.1.1-alpha.3

### Patch Changes

- 247c721: Major breaking changes to IR format and multi-agent support. Includes new Gemini MD exporter, hybrid agent detection, auto-backup by default, and automatic rule ID fixing on import.
- Updated dependencies [247c721]
  - @aligntrue/schema@0.1.1-alpha.3
