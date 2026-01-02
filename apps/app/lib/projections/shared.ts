import fs from "node:fs";

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
