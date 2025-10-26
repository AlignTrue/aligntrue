/**
 * Hybrid adapter registry (manifest.json + optional handler)
 */

import type { Exporter } from './types.js';

export interface AdapterManifest {
  name: string;
  version: string;
  description: string;
  outputs: string[];
  handler?: string;
}

export class ExporterRegistry {
  private exporters = new Map<string, Exporter>();
  
  register(exporter: Exporter): void {
    this.exporters.set(exporter.name, exporter);
  }
  
  get(name: string): Exporter | undefined {
    return this.exporters.get(name);
  }
  
  list(): string[] {
    return Array.from(this.exporters.keys());
  }
}

