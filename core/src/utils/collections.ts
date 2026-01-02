export function cloneSet<T>(source: Set<T>): Set<T> {
  return new Set(source);
}

export function cloneMapShallow<K, V extends object>(
  source: Map<K, V>,
): Map<K, V> {
  return new Map(
    Array.from(source.entries()).map(([key, value]) => [
      key,
      { ...value } as V,
    ]),
  );
}

export function cloneMapWith<K, V, O>(
  source: Map<K, V>,
  mapper: (value: V) => O,
): Map<K, O> {
  return new Map(
    Array.from(source.entries()).map(([key, value]) => [key, mapper(value)]),
  );
}
