#!/usr/bin/env node
/**
 * Validates all .align.yaml manifests in examples/ directory.
 * Ensures example packs have valid structure and required fields.
 *
 * Uses simple YAML parsing without external dependencies.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const EXAMPLES_DIR = "examples";

/**
 * Simple YAML parser for manifest validation.
 * Only handles the subset of YAML used in .align.yaml files.
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split("\n");
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith("#") || line.trim() === "") continue;

    // Check for array item
    const arrayMatch = line.match(/^(\s+)-\s*"?([^"]*)"?\s*$/);
    if (arrayMatch && currentArray) {
      currentArray.push(arrayMatch[2].trim());
      continue;
    }

    // Check for nested key (indented)
    const nestedMatch = line.match(/^(\s+)(\w+):\s*(.*)$/);
    if (nestedMatch) {
      const [, indent, key, value] = nestedMatch;
      if (indent.length >= 2 && currentKey) {
        if (typeof result[currentKey] !== "object") {
          result[currentKey] = {};
        }
        if (value.trim() === "") {
          // Array or nested object follows
          result[currentKey][key] = [];
          currentArray = result[currentKey][key];
        } else {
          result[currentKey][key] = value.replace(/^["']|["']$/g, "").trim();
          currentArray = null;
        }
      }
      continue;
    }

    // Check for top-level key
    const topMatch = line.match(/^(\w+):\s*(.*)$/);
    if (topMatch) {
      const [, key, value] = topMatch;
      currentKey = key;
      if (value.trim() === "") {
        // Object or array follows
        result[key] = {};
        currentArray = null;
      } else {
        result[key] = value.replace(/^["']|["']$/g, "").trim();
        currentArray = null;
      }
    }
  }

  return result;
}

/**
 * Recursively find all .align.yaml files
 */
function findManifests(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findManifests(fullPath, files);
    } else if (entry.name === ".align.yaml" || entry.name === ".align.yml") {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Validate a manifest has required fields
 */
function validateManifest(filePath) {
  const errors = [];
  const content = readFileSync(filePath, "utf-8");

  let manifest;
  try {
    manifest = parseSimpleYaml(content);
  } catch (e) {
    errors.push(`Failed to parse YAML: ${e.message}`);
    return errors;
  }

  if (Object.keys(manifest).length === 0) {
    errors.push("Manifest must be a non-empty YAML object");
    return errors;
  }

  // Required fields
  if (!manifest.id) {
    errors.push("Missing required field: id");
  } else if (typeof manifest.id !== "string") {
    errors.push("Field 'id' must be a string");
  }

  if (!manifest.version) {
    errors.push("Missing required field: version");
  } else if (typeof manifest.version !== "string") {
    errors.push("Field 'version' must be a string");
  }

  // Validate includes structure if present
  if (manifest.includes) {
    if (typeof manifest.includes !== "object") {
      errors.push("Field 'includes' must be an object");
    } else {
      const validKeys = ["rules", "skills", "mcp"];
      for (const key of Object.keys(manifest.includes)) {
        if (!validKeys.includes(key)) {
          errors.push(
            `Unknown includes key: ${key} (expected: ${validKeys.join(", ")})`,
          );
        } else if (!Array.isArray(manifest.includes[key])) {
          errors.push(`includes.${key} must be an array`);
        }
      }
    }
  }

  // Warn on non-standard id format
  if (manifest.id && typeof manifest.id === "string") {
    const idPattern = /^[a-z0-9-]+\/[a-z0-9-]+$/;
    if (!idPattern.test(manifest.id)) {
      console.log(
        `  Warning: Non-standard id format: ${manifest.id} (recommended: author/name, lowercase)`,
      );
    }
  }

  return errors;
}

// Main
console.log("Validating example pack manifests...\n");

const examplesExists = statSync(EXAMPLES_DIR, { throwIfNoEntry: false });
if (!examplesExists?.isDirectory()) {
  console.log("No examples/ directory found, skipping.");
  process.exit(0);
}

const manifests = findManifests(EXAMPLES_DIR);

if (manifests.length === 0) {
  console.log("No .align.yaml files found in examples/");
  process.exit(0);
}

let hasErrors = false;

for (const manifestPath of manifests) {
  const relPath = relative(".", manifestPath);
  const errors = validateManifest(manifestPath);

  if (errors.length > 0) {
    console.log(`✗ ${relPath}`);
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    hasErrors = true;
  } else {
    console.log(`✓ ${relPath}`);
  }
}

console.log(`\nValidated ${manifests.length} manifest(s)`);

if (hasErrors) {
  console.error("\nValidation failed. Fix errors above.");
  process.exit(1);
}

console.log("All manifests valid.");
