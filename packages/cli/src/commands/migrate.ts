/**
 * Stub migration command (pre-1.0)
 * 
 * Migration tooling will be added when we have 50+ active users or 10+ orgs.
 * Until then, schema may change without automated migrations.
 */

export async function migrate(): Promise<void> {
  console.log(`
⚠️  Migration tooling not yet available

AlignTrue is in pre-1.0 status (spec_version: "1").
Schema may change between releases without automated migration tooling.

Migration framework will be added when we reach:
• 50+ active repositories using AlignTrue, OR
• 10+ organizations with multiple repos, OR
• A planned breaking change that significantly impacts users

For now:
• Check CHANGELOG.md for breaking changes
• Follow migration guides for each release
• Pin CLI version if you need stability

See: .internal_docs/pre-1.0-policy.md for details

Current approach: Manual updates with clear guides
Future approach: Automated migrations with --write safeguard
  `);
  
  process.exit(0);
}

