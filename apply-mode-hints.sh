#!/bin/bash

# Apply mode hints shared utilities to remaining exporters
# This script applies the same pattern to all remaining directory-based exporters

exporters=("kilocode" "kiro" "firebase-studio" "junie" "trae-ai" "openhands")

for exporter in "${exporters[@]}"; do
  echo "Applying mode hints to $exporter..."

  # 1. Add imports to the top of the file
  sed -i '' '/import { AtomicFileWriter } from '\''@aligntrue\/file-utils'\''/a\
import { \
  extractModeConfig, \
  applyRulePrioritization, \
  generateSessionPreface, \
  wrapRuleWithMarkers, \
  shouldIncludeRule \
} from '\''../utils/index.js'\''

' "packages/exporters/src/$exporter/index.ts"

  # 2. Update export method signature and config extraction
  sed -i '' 's/const { outputDir, dryRun = false } = options/const { outputDir, dryRun = false, config } = options/g' "packages/exporters/src/$exporter/index.ts"

  # 3. Add config extraction after outputPath setup
  sed -i '' '/const outputPath = /a\
\
    const { modeHints, maxBlocks, maxTokens } = extractModeConfig(this.name, config)\
    const { content, warnings } = this.generateRuleContent(scope, rules, modeHints, maxBlocks, maxTokens)

' "packages/exporters/src/$exporter/index.ts"

  # 4. Update generateRuleContent call
  sed -i '' 's/const content = this.generateRuleContent(scope, rules)/const content = this.generateRuleContent(scope, rules, modeHints, maxBlocks, maxTokens).content/g' "packages/exporters/src/$exporter/index.ts"

  # 5. Add warnings handling
  sed -i '' '/if (fidelityNotes.length > 0) {/,/result.fidelityNotes = fidelityNotes/a\
    if (warnings.length > 0) {\
      result.warnings = warnings\
    }\
\
    if (fidelityNotes.length > 0) {' "packages/exporters/src/$exporter/index.ts"

  # 6. Update generateRuleContent method signature
  sed -i '' 's/private generateRuleContent(scope: ResolvedScope, rules: AlignRule\[\]): string {/private generateRuleContent(scope: ResolvedScope, rules: AlignRule[], modeHints: string, maxBlocks: number, maxTokens: number): { content: string; warnings: string[] } {/g' "packages/exporters/src/$exporter/index.ts"

  # 7. Add prioritization and session preface to generateRuleContent
  sed -i '' '/lines.push(`# /a\
\
    // Add session preface if needed\
    lines.push(...generateSessionPreface(modeHints))\
\
    // Apply prioritization\
    const { includedIds, warnings } = applyRulePrioritization(rules, modeHints, maxBlocks, maxTokens)\
\
    // Generate rule sections\
    rules.forEach(rule => {\
      if (!shouldIncludeRule(rule.id, includedIds)) {\
        return\
      }\
\
      // Build rule content\
      const ruleLines: string[] = []\
      ruleLines.push(`## Rule: ${rule.id}`)\
      ruleLines.push('\''\''\
      ruleLines.push(`**Severity:** ${rule.severity}`)\
      ruleLines.push('\''\''\
\
      if (rule.applies_to && rule.applies_to.length > 0) {\
        ruleLines.push(`**Applies to:**`)\
        rule.applies_to.forEach(pattern => {\
          ruleLines.push(`- `\`${pattern}\``)\
        })\
        ruleLines.push('\''\''\
      }\
\
      if (rule.guidance) {\
        ruleLines.push(rule.guidance.trim())\
        ruleLines.push('\''\''\
      }\
      ruleLines.push('\''---'\''\
\
      // Wrap with markers and add to output\
      const ruleContent = ruleLines.join('\''\n'\'')\
      lines.push(wrapRuleWithMarkers(rule, ruleContent, modeHints))\
      lines.push('\''\''\
    })\
' "packages/exporters/src/$exporter/index.ts"

  # 8. Replace the old rules.forEach loop with the new one
  sed -i '' '/rules.forEach(rule => {/,/})/c\
' "packages/exporters/src/$exporter/index.ts"

  # 9. Update return statement
  sed -i '' 's/return lines.join('\''\n'\'')/return { content: lines.join('\''\n'\''), warnings }/g' "packages/exporters/src/$exporter/index.ts"

  echo "✓ Completed $exporter"
done

echo "All exporters updated successfully!"
