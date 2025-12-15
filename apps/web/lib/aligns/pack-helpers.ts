import type { AlignRecord } from "./types";

export function isCatalogPack(align: AlignRecord): boolean {
  return align.source === "catalog" && align.kind === "pack";
}
