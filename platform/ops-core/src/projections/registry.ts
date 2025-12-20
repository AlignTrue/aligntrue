import type { ProjectionDefinition } from "./definition.js";

export const projectionKey = (name: string, version: string): string =>
  `${name}@${version}`;

export class ProjectionRegistry {
  private readonly definitions = new Map<
    string,
    ProjectionDefinition<unknown>
  >();

  register(def: ProjectionDefinition<unknown>): this {
    const key = projectionKey(def.name, def.version);
    this.definitions.set(key, def);
    return this;
  }

  get(key: string): ProjectionDefinition<unknown> | undefined {
    return this.definitions.get(key);
  }

  getAll(): ProjectionDefinition<unknown>[] {
    return Array.from(this.definitions.values());
  }
}

export const defaultRegistry = new ProjectionRegistry();
