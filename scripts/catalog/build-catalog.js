#!/usr/bin/env node
/**
 * Build catalog index with extended metadata and exporter previews (Phase 4)
 *
 * Pipeline:
 * 1. Read catalog/packs.yaml (manual curation list)
 * 2. For each pack:
 *    - Compute canonical SHA
 *    - Validate schema only (no test execution)
 *    - Run abuse controls (size, binaries)
 *    - Extract rules_index if overlay-friendly
 *    - Generate all exporter previews with cache-busting URLs
 *    - Extract required_plugs for copy blocks
 *    - Validate namespace ownership
 * 3. Build catalog/index.json with extended entries
 * 4. Build catalog/search_v1.json (Fuse.js index)
 * 5. Report summary
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import YAML from "yaml";
import { parseYamlToJson, computeHash, validateAlign } from "@aligntrue/schema";
import { ExporterRegistry } from "@aligntrue/exporters";
import {
  runPackAbuseControls,
  checkPreviewSize,
  checkCatalogSize,
} from "./abuse-controls.js";
import {
  loadNamespaceRegistry,
  validateNamespace,
} from "./validate-namespace.js";
import { validateSourceRepoUrl } from "./validate-source-repo.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Extract required plugs from pack
 */
function extractRequiredPlugs(pack) {
  const requiredPlugs = [];
  if (pack.plugs) {
    for (const [key, slot] of Object.entries(pack.plugs)) {
      if (slot.required === true) {
        requiredPlugs.push({
          key,
          description: slot.description || `Configuration for ${key}`,
          type:
            typeof slot.default === "number"
              ? "number"
              : typeof slot.default === "boolean"
                ? "boolean"
                : "string",
          default:
            slot.default !== undefined ? String(slot.default) : undefined,
        });
      }
    }
  }
  return requiredPlugs;
}
/**
 * Extract rules index from pack (if overlay-friendly)
 */
function extractRulesIndex(pack) {
  const rulesIndex = [];
  if (pack.rules) {
    for (const rule of pack.rules) {
      if (rule.id) {
        // Compute rule content hash (for overlay tracking)
        const ruleContent = JSON.stringify(rule);
        const contentSha = computeHash(ruleContent);
        rulesIndex.push({
          id: rule.id,
          path: rule.path,
          content_sha: contentSha,
        });
      }
    }
  }
  // Only return rules_index if pack has stable rule IDs
  return rulesIndex.length > 0 ? rulesIndex : undefined;
}
/**
 * Generate exporter previews for all formats
 */
async function generateExporterPreviews(pack, canonicalSha, engineVersion) {
  const renderedAt = new Date().toISOString();
  const previews = [];
  // Initialize exporter registry
  const registry = new ExporterRegistry();
  await registry.discoverAll();
  // Export formats for catalog (prioritize common ones)
  const formats = [
    "yaml",
    "agents-md",
    "cursor",
    "warp-md",
    "vscode-mcp",
    // Add more as needed
  ];
  for (const format of formats) {
    try {
      const exporter = registry.get(format);
      if (!exporter || !exporter.export) {
        console.warn(`Exporter not found: ${format}, skipping`);
        continue;
      }
      // Generate preview
      const previewContent = exporter.export(pack);
      // Check preview size
      const sizeViolation = checkPreviewSize(previewContent, format);
      if (sizeViolation) {
        console.error(`Preview size violation: ${format}`);
        console.error(`  ${sizeViolation.message}`);
        continue; // Skip oversized previews
      }
      previews.push({
        format,
        preview: previewContent,
        preview_meta: {
          engine_version: engineVersion,
          canonical_yaml_sha: canonicalSha,
          rendered_at: renderedAt,
        },
      });
    } catch (err) {
      console.error(`Failed to generate ${format} preview:`, err);
      // Continue with other formats
    }
  }
  return previews;
}
/**
 * Build catalog entry from pack
 */
async function buildCatalogEntry(packEntry, options, namespaceRegistry) {
  const packPath = join(options.repoRoot, packEntry.path);
  console.log(`\nProcessing: ${packEntry.id}@${packEntry.version}`);
  // 1. Load and parse pack
  if (!existsSync(packPath)) {
    console.error(`  ❌ Pack file not found: ${packPath}`);
    return null;
  }
  const packYaml = readFileSync(packPath, "utf8");
  const packJson = parseYamlToJson(packYaml);
  // 2. Validate schema
  const validation = validateAlign(packJson);
  if (!validation.valid) {
    console.error(`  ❌ Schema validation failed:`);
    validation.errors?.forEach((err) => {
      console.error(`     ${err.path}: ${err.message}`);
    });
    return null;
  }
  const pack = packJson;
  // 3. Compute canonical SHA
  const canonicalSha = computeHash(JSON.stringify(pack));
  // 4. Run abuse controls
  const packDir = dirname(packPath);
  const abuseViolations = runPackAbuseControls(packPath, packDir);
  if (abuseViolations.length > 0) {
    console.error(`  ❌ Abuse control violations:`);
    abuseViolations.forEach((v) => {
      console.error(`     ${v.type}: ${v.message}`);
    });
    return null;
  }
  // 5. Validate namespace ownership
  const namespaceValidation = validateNamespace(
    packEntry.id,
    packEntry.namespace_owner,
    namespaceRegistry,
  );
  if (!namespaceValidation.valid) {
    console.error(
      `  ❌ Namespace validation failed: ${namespaceValidation.error}`,
    );
    return null;
  }
  // 6. Validate source repo (if provided)
  let sourceLinked = false;
  if (packEntry.source_repo) {
    const repoValidation = validateSourceRepoUrl(packEntry.source_repo);
    if (!repoValidation.valid) {
      console.warn(`  ⚠️  Invalid source_repo URL: ${repoValidation.error}`);
    } else {
      sourceLinked = true;
    }
  }
  // 7. Extract required plugs
  const requiredPlugs = extractRequiredPlugs(pack);
  // 8. Extract rules index (if overlay-friendly)
  const rulesIndex = extractRulesIndex(pack);
  const overlayFriendly = rulesIndex !== undefined && rulesIndex.length > 0;
  // 9. Generate exporter previews
  console.log(`  Generating previews...`);
  const exporters = await generateExporterPreviews(
    pack,
    canonicalSha,
    options.engineVersion,
  );
  if (exporters.length === 0) {
    console.error(`  ❌ No exporter previews generated`);
    return null;
  }
  // 10. Build catalog entry
  const entry = {
    // Core identity
    id: packEntry.id,
    version: packEntry.version,
    name: packEntry.name,
    slug: packEntry.slug,
    description: packEntry.description,
    summary_bullets: packEntry.summary_bullets,
    content_sha256: canonicalSha,
    // Discovery
    categories: packEntry.categories,
    tags: packEntry.tags,
    compatible_tools: packEntry.compatible_tools,
    license: packEntry.license,
    // Author
    maintainer: packEntry.maintainer,
    // Trust signals
    last_updated: new Date().toISOString(),
    source_repo: packEntry.source_repo,
    namespace_owner: namespaceValidation.owner,
    source_linked: sourceLinked,
    // Usage stats (placeholder - Phase 4.6 will track real usage)
    stats: {
      copies_7d: 0,
    },
    // Customization
    has_plugs:
      requiredPlugs.length > 0 ||
      (pack.plugs !== undefined && Object.keys(pack.plugs).length > 0),
    overlay_friendly: overlayFriendly,
    required_plugs_count: requiredPlugs.length,
    required_plugs: requiredPlugs.length > 0 ? requiredPlugs : undefined,
    rules_index: rulesIndex,
    // Exporters
    exporters,
  };
  console.log(
    `  ✅ Entry built (${exporters.length} previews, ${requiredPlugs.length} required plugs)`,
  );
  return entry;
}
/**
 * Build search index from catalog entries
 */
function buildSearchIndex(entries) {
  return {
    version: "1.0.0",
    entries: entries.map((e) => ({
      id: e.id,
      version: e.version,
      slug: e.slug,
      name: e.name,
      description: e.description,
      summary_bullets: e.summary_bullets,
      categories: e.categories,
      tags: e.tags,
      compatible_tools: e.compatible_tools,
    })),
  };
}
/**
 * Write catalog files with atomic operations
 */
function writeCatalogFiles(index, searchIndex, outputDir) {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  // Write index.json
  const indexPath = join(outputDir, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
  console.log(`\n✅ Wrote ${indexPath}`);
  // Write search_v1.json
  const searchPath = join(outputDir, "search_v1.json");
  writeFileSync(searchPath, JSON.stringify(searchIndex, null, 2), "utf8");
  console.log(`✅ Wrote ${searchPath}`);
  // Check total catalog size with warning threshold
  const sizeResult = checkCatalogSize(outputDir);
  if (sizeResult.violation) {
    console.error(`\n❌ ${sizeResult.violation.message}`);
    process.exit(1);
  }
  if (sizeResult.warning) {
    console.warn(`\n⚠️  ${sizeResult.warning}`);
  }
  console.log(
    `\nCatalog size: ${(sizeResult.totalSize / 1024 / 1024).toFixed(2)}MB (${(sizeResult.percentUsed * 100).toFixed(1)}% of ${(500).toFixed(0)}MB budget)`,
  );
}
/**
 * Main build pipeline
 */
async function buildCatalog(options) {
  console.log("Building catalog...\n");
  console.log(`Engine version: ${options.engineVersion}`);
  console.log(`Output directory: ${options.outputDir}`);
  // Load pack list
  const packsPath = join(options.repoRoot, "catalog", "packs.yaml");
  if (!existsSync(packsPath)) {
    throw new Error(
      `Pack list not found: ${packsPath}\nCreate catalog/packs.yaml with manual curation.`,
    );
  }
  const packsYaml = readFileSync(packsPath, "utf8");
  const packsList = YAML.parse(packsYaml);
  console.log(`\nFound ${packsList.packs.length} pack(s) to process\n`);
  // Load namespace registry
  const namespaceRegistryPath = join(
    options.repoRoot,
    "catalog",
    "namespaces.yaml",
  );
  const namespaceRegistry = loadNamespaceRegistry(namespaceRegistryPath);
  // Build catalog entries
  const entries = [];
  let successCount = 0;
  let failCount = 0;
  for (const packEntry of packsList.packs) {
    try {
      const entry = await buildCatalogEntry(
        packEntry,
        options,
        namespaceRegistry,
      );
      if (entry) {
        entries.push(entry);
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(
        `  ❌ Build failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      failCount++;
    }
  }
  // Build catalog index
  const catalogIndex = {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    engine_version: options.engineVersion,
    packs: entries,
  };
  // Build search index
  const searchIndex = buildSearchIndex(entries);
  // Write output files
  writeCatalogFiles(catalogIndex, searchIndex, options.outputDir);
  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Build complete: ${successCount} success, ${failCount} failed`);
  console.log(`Total packs in catalog: ${entries.length}`);
  console.log(`${"=".repeat(60)}\n`);
  if (failCount > 0) {
    process.exit(1);
  }
}
// CLI entry point
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = process.cwd();
  const outputDir = join(repoRoot, "apps", "web", "public", "catalog");
  const packageJsonPath = join(repoRoot, "packages", "cli", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const engineVersion = packageJson.version || "0.1.0";
  buildCatalog({
    repoRoot,
    outputDir,
    engineVersion,
    verifyRepos: process.argv.includes("--verify-repos"),
  }).catch((err) => {
    console.error(
      `\n❌ Build failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}
export { buildCatalog };
