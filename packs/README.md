# Packs Overview

This directory contains packs that implement the PackModule contract from `@aligntrue/core`.

## Authoring a Pack

1. Create a package under `packs/<pack-name>/` with `@aligntrue/core` as a dependency.
2. Define a `PackManifest` in `src/manifest.ts` with a `pack_id` (e.g., `hello-world`), version, required_core range, and public event/command types (namespaced `pack.<pack_id>.`).
3. Implement a `PackModule` in `src/index.ts` that exports:

- `manifest`
- optional `handlers`: Record of event type -> handler
- optional `projections`: array of `ProjectionDefinition`
- optional `init` / `dispose` lifecycle hooks

4. Keep all imports through public `@aligntrue/core` exports (no deep imports).
5. Namespaces: all pack events and commands MUST start with `pack.<pack_id>.`.

## Example: hello-world

- Manifest: `pack_id = "hello-world"`, event type `pack.hello-world.greeting.emitted`
- Handlers: no-op handler proving dispatch works
- Projection: counts greeting events

## Testing

Use `@aligntrue/host` PackRuntime to load/unload packs and dispatch events. A minimal test pack should load with:

```ts
await runtime.loadPack("@aligntrue/pack-hello-world");
```

Use `projectionRegistry` to verify projections are registered/unregistered.
