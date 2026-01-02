import fs from "node:fs";
import { Projections } from "@aligntrue/core";
import type { ProjectionDefinition } from "@aligntrue/core";

export interface ProjectionCache<T> {
  head: string | null;
  data: T;
}

export function computeHead(path: string): string | null {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stat = fs.statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

export function createCachedProjectionReader<TProjection, TState>(options: {
  def: ProjectionDefinition<TState>;
  build: (state: TState) => TProjection;
  eventsPath: string;
  getEventStore: (eventsPath: string) => unknown;
  beforeRead?: () => Promise<void>;
}) {
  let cache: ProjectionCache<TProjection> | null = null;

  return async (): Promise<TProjection | null> => {
    if (options.beforeRead) {
      await options.beforeRead();
    }

    const head = computeHead(options.eventsPath);
    if (cache && cache.head === head) {
      return cache.data;
    }

    const rebuilt = await Projections.rebuildOne(
      options.def,
      options.getEventStore(options.eventsPath),
    );
    const projection = options.build(rebuilt.data as TState);
    cache = { head, data: projection };
    return projection;
  };
}
