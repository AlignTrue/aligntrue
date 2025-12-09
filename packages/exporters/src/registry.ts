/**
 * Hybrid exporter registry (manifest.json + optional handler)
 * Supports community-scalable exporter contributions with declarative manifests
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import Ajv, { type ErrorObject } from "ajv";
import type { AnySchemaObject } from "ajv";
import addFormats from "ajv-formats";
import type {
  ExporterPlugin,
  ExporterManifest,
} from "@aligntrue/plugin-contracts";

// Determine schema path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = join(__dirname, "../schema/manifest.schema.json");

/**
 * Registry for exporter plugins with hybrid manifest + handler support
 *
 * Supports two registration modes:
 * 1. Programmatic: register(exporter) for tests and mocks
 * 2. Manifest-based: registerFromManifest(path) for production exporters
 */
export class ExporterRegistry {
  private exporters = new Map<string, ExporterPlugin>();
  private manifests = new Map<string, ExporterManifest>();
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(this.ajv);

    // Load and add manifest schema
    const manifestSchema = JSON.parse(
      readFileSync(schemaPath, "utf-8"),
    ) as AnySchemaObject;
    this.ajv.addSchema(manifestSchema, "manifest");
  }

  /**
   * Register an exporter programmatically (for tests/mocks)
   */
  register(exporter: ExporterPlugin): void {
    if (!exporter.name || !exporter.version) {
      throw new Error("Exporter must have name and version properties");
    }
    this.exporters.set(exporter.name, exporter);
  }

  /**
   * Load and validate manifest from file
   */
  loadManifest(manifestPath: string): ExporterManifest {
    try {
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content) as ExporterManifest;

      // Validate against schema
      const validate = this.ajv.getSchema("manifest");
      if (!validate) {
        throw new Error("Manifest schema not loaded");
      }

      if (!validate(manifest)) {
        const errors = validate.errors
          ?.map((err: ErrorObject) => {
            const params = err.params;
            const missingProp =
              params &&
              typeof params === "object" &&
              "missingProperty" in params
                ? (params as Record<string, unknown>)["missingProperty"]
                : undefined;
            const field = err.instancePath || missingProp || "unknown";
            return `${field}: ${err.message ?? "invalid value"}`;
          })
          .join(", ");

        throw new Error(`Invalid manifest: ${errors}`);
      }

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in manifest: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load handler module dynamically
   */
  async loadHandler(handlerPath: string): Promise<ExporterPlugin> {
    try {
      // Convert to absolute path
      let absolutePath = resolve(handlerPath);

      // Normalize path separators for cross-platform support
      const normalizedPath = absolutePath.replace(/\\/g, "/");
      const { existsSync } = await import("node:fs");

      // Ensure we load the built .js artifact
      // If the manifest points to .ts (dev source), always swap to .js (built artifact)
      // We rely on 'pnpm build' to generate these artifacts before use.
      if (absolutePath.endsWith(".ts")) {
        absolutePath = absolutePath.replace(/\.ts$/, ".js");
      }

      // Verify file exists
      if (!existsSync(absolutePath)) {
        // Try to find it in dist/ if we are in a monorepo source context
        // This helps when running tests against built artifacts
        if (
          normalizedPath.includes("/src/") &&
          !normalizedPath.includes("/dist/")
        ) {
          // Replace src/ with dist/ using the normalized path, then convert back to platform-specific
          const distNormalizedPath = normalizedPath.replace(
            /\/src\//,
            "/dist/",
          );
          // Convert forward slashes back to platform separator (\ on Windows, / on Unix)
          const distPath = distNormalizedPath.split("/").join(sep);
          if (existsSync(distPath)) {
            absolutePath = distPath;
          }
        }

        if (!existsSync(absolutePath)) {
          throw new Error(
            `Handler file not found: ${absolutePath}\n` +
              `Make sure to build the project before running: pnpm build`,
          );
        }
      }

      const fileUrl = pathToFileURL(absolutePath).href;
      const module = await import(fileUrl);

      // Look for default export or named exports
      const ExporterClass =
        module.default ||
        module.CursorExporter ||
        module.AgentsExporter ||
        module.VsCodeMcpExporter ||
        module.AntigravityExporter;

      if (!ExporterClass) {
        throw new Error(
          "Handler must export a default or named exporter class",
        );
      }

      // Instantiate if it's a class
      const exporter =
        typeof ExporterClass === "function"
          ? new ExporterClass()
          : ExporterClass;

      if (!exporter.name || !exporter.version || !exporter.export) {
        throw new Error(
          "Handler must export an ExporterPlugin-compatible class",
        );
      }

      return exporter as ExporterPlugin;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load handler: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Register exporter from manifest + optional handler
   */
  async registerFromManifest(manifestPath: string): Promise<void> {
    const manifest = this.loadManifest(manifestPath);
    this.manifests.set(manifest.name, manifest);

    // If handler specified, load and register it
    if (manifest.handler) {
      const manifestDir = dirname(manifestPath);
      const handlerPath = join(manifestDir, manifest.handler);
      const exporter = await this.loadHandler(handlerPath);

      // Verify name matches manifest
      if (exporter.name !== manifest.name) {
        throw new Error(
          `Handler name "${exporter.name}" doesn't match manifest name "${manifest.name}"`,
        );
      }

      this.exporters.set(exporter.name, exporter);
    }
  }

  /**
   * Discover all manifest.json files in directory
   */
  discoverExporters(searchPath: string): string[] {
    const manifests: string[] = [];

    try {
      const entries = readdirSync(searchPath);

      for (const entry of entries) {
        const fullPath = join(searchPath, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Look for manifest.json in subdirectory
          const manifestPath = join(fullPath, "manifest.json");
          try {
            statSync(manifestPath);
            manifests.push(manifestPath);
          } catch {
            // No manifest in this directory, skip
          }
        } else if (entry === "manifest.json") {
          // Found manifest in search path itself
          manifests.push(fullPath);
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(`Search path not found: ${searchPath}`);
      }
      throw error;
    }

    return manifests;
  }

  /**
   * Get exporter by name
   */
  get(name: string): ExporterPlugin | undefined {
    return this.exporters.get(name);
  }

  /**
   * Get manifest by name
   */
  getManifest(name: string): ExporterManifest | undefined {
    return this.manifests.get(name);
  }

  /**
   * List all registered exporter names
   */
  list(): string[] {
    return Array.from(this.exporters.keys());
  }

  /**
   * List all registered manifests
   */
  listManifests(): ExporterManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Check if exporter is registered
   */
  has(name: string): boolean {
    return this.exporters.has(name);
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.exporters.clear();
    this.manifests.clear();
  }
}
