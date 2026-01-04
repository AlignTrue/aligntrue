# Repository structure

| Area            | Location                                  | Purpose                                              |
| --------------- | ----------------------------------------- | ---------------------------------------------------- |
| Platform kernel | `core/`                                   | Contracts, envelopes, identity, storage              |
| Pack runtime    | `host/`                                   | Pack loading, dispatch, capability enforcement       |
| Packs           | `packs/*`                                 | Domain behavior (tasks, notes, convert, suggestions) |
| Connectors      | `connectors/*`                            | Provider integrations (e.g., Google, GitHub)         |
| Shared          | `packages/ui-base`, `packages/file-utils` | Shared UI/tooling                                    |
| UI Contracts    | `ui/contracts`                            | Generative UI contracts (OSS)                        |
| UI Renderer     | `ui/renderer`                             | Block rendering engine (OSS)                         |
| UI Blocks       | `ui/blocks`                               | Platform-specific blocks                             |
| Apps            | `apps/docs`, `apps/web`, `apps/app`       | Web properties (app = ops dogfood)                   |
| Platform CLI    | `cli/`                                    | Ops CLI commands dispatching via host                |
