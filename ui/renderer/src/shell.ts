import type { ComponentType, ReactNode } from "react";
import type { BlockManifest, BlockUIHints } from "@aligntrue/ui-contracts";

export interface BlockShellProps {
  manifest: BlockManifest;
  ui?: BlockUIHints | undefined;
  children: ReactNode;
}

export interface BlockHeaderProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}

export interface BlockStateProps {
  state: "loading" | "empty" | "error" | "ready";
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export interface BlockShell {
  Frame: ComponentType<BlockShellProps>;
  Header: ComponentType<BlockHeaderProps>;
  Body: ComponentType<{ children: ReactNode }>;
  Footer?: ComponentType<{ children: ReactNode }>;
  State: ComponentType<BlockStateProps>;
}
