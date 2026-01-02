import { OPS_CORE_ENABLED } from "@aligntrue/core";
import { Projections, Identity } from "@aligntrue/core";
import type { ProjectionDefinition } from "@aligntrue/core";
import type { Host, HostConfig } from "@aligntrue/host";
import { createHost } from "@aligntrue/host";
import { type Contracts } from "@aligntrue/core";
import { exitWithError } from "./command-utilities.js";

interface PackHostOptions<TState, TProjection> {
  pack: Contracts.PackReference;
  capabilities: string[];
  domainEnabled: boolean;
  domainName: string;
  projection: {
    def: ProjectionDefinition<TState>;
    build: (state: TState) => TProjection;
    hash?: (projection: TProjection) => string;
    version?: string;
  };
}

export interface ProjectionResult<TProjection> {
  projection: TProjection;
  hash?: string;
  version?: string;
}

export function createPackHost<TState, TProjection>(
  options: PackHostOptions<TState, TProjection>,
) {
  let hostPromise: Promise<Host> | null = null;

  function ensureEnabled(): void {
    if (!OPS_CORE_ENABLED) {
      exitWithError(1, "ops-core is disabled", {
        hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
      });
    }
    if (!options.domainEnabled) {
      exitWithError(1, `${options.domainName} are disabled`, {
        hint: `Set OPS_${options.domainName.toUpperCase()}_ENABLED=1`,
      });
    }
  }

  async function getHost(): Promise<Host> {
    if (!hostPromise) {
      const config: HostConfig = {
        manifest: {
          name: "@aligntrue/cli",
          version: "0.9.3",
          packs: [options.pack],
          capabilities: options.capabilities,
        },
      };
      hostPromise = createHost(config);
    }
    return hostPromise;
  }

  async function readProjection(): Promise<ProjectionResult<TProjection>> {
    const host = await getHost();
    const rebuilt = await Projections.rebuildOne(
      options.projection.def,
      host.eventStore,
    );
    const projection = options.projection.build(
      rebuilt.data as TState,
    ) as TProjection;
    const hash = options.projection.hash
      ? options.projection.hash(projection)
      : undefined;
    return {
      projection,
      ...(hash ? { hash } : {}),
      version: options.projection.version ?? options.projection.def.version,
    };
  }

  return {
    ensureEnabled,
    getHost,
    readProjection,
    generateCommandId: Identity.generateCommandId,
  };
}
