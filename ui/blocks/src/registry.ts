import type { BlockActionSchema, BlockManifest } from "@aligntrue/ui-contracts";
import { deterministicId } from "@aligntrue/ui-contracts";
import type { BlockRegistry } from "@aligntrue/ui-renderer";
import { createBlockRegistry } from "@aligntrue/ui-renderer";
import type { RegistryLike } from "@aligntrue/ui-renderer";
import { EntityTable } from "./blocks/EntityTable/index.js";
import { entityTableManifest } from "./blocks/EntityTable/manifest.js";
import { ApprovalGate } from "./blocks/ApprovalGate/index.js";
import { approvalGateManifest } from "./blocks/ApprovalGate/manifest.js";
import { ReceiptTimeline } from "./blocks/ReceiptTimeline/index.js";
import { receiptTimelineManifest } from "./blocks/ReceiptTimeline/manifest.js";
import { FormSurface } from "./blocks/FormSurface/index.js";
import { formSurfaceManifest } from "./blocks/FormSurface/manifest.js";
import { ActionProposalCard } from "./blocks/ActionProposalCard/index.js";
import { actionProposalCardManifest } from "./blocks/ActionProposalCard/manifest.js";
import { DiffViewer } from "./blocks/DiffViewer/index.js";
import { diffViewerManifest } from "./blocks/DiffViewer/manifest.js";
import { InboxThread } from "./blocks/InboxThread/index.js";
import { inboxThreadManifest } from "./blocks/InboxThread/manifest.js";
import { NoteList } from "./blocks/NoteList/index.js";
import { noteListManifest } from "./blocks/NoteList/manifest.js";
import { TaskList } from "./blocks/TaskList/index.js";
import { taskListManifest } from "./blocks/TaskList/manifest.js";
import { DataPanel } from "./blocks/DataPanel/index.js";
import { dataPanelManifest } from "./blocks/DataPanel/manifest.js";
import { StatusIndicator } from "./blocks/StatusIndicator/index.js";
import { statusIndicatorManifest } from "./blocks/StatusIndicator/manifest.js";
import { withUiDefaults, UI_DEFAULTS } from "./ui/defaults.js";

export interface ActionSchemaEntry {
  readonly manifest: BlockManifest;
  readonly schema: BlockActionSchema;
}

export interface PlatformRegistry extends RegistryLike {
  readonly blocks: BlockRegistry;
  readonly getActionSchema: (
    blockType: string,
    actionType: string,
  ) => ActionSchemaEntry | undefined;
  readonly manifestsHash: string;
}

export function createPlatformRegistry(): PlatformRegistry {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const blocks = createBlockRegistry([
    {
      manifest: {
        ...entityTableManifest,
        ui: withUiDefaults(entityTableManifest.ui),
      },
      Component: EntityTable as any,
    },
    {
      manifest: {
        ...approvalGateManifest,
        ui: withUiDefaults(approvalGateManifest.ui),
      },
      Component: ApprovalGate as any,
    },
    {
      manifest: {
        ...receiptTimelineManifest,
        ui: withUiDefaults(receiptTimelineManifest.ui),
      },
      Component: ReceiptTimeline as any,
    },
    {
      manifest: {
        ...formSurfaceManifest,
        ui: withUiDefaults(formSurfaceManifest.ui),
      },
      Component: FormSurface as any,
    },
    {
      manifest: {
        ...actionProposalCardManifest,
        ui: withUiDefaults(actionProposalCardManifest.ui),
      },
      Component: ActionProposalCard as any,
    },
    {
      manifest: {
        ...diffViewerManifest,
        ui: withUiDefaults(diffViewerManifest.ui),
      },
      Component: DiffViewer as any,
    },
    {
      manifest: {
        ...inboxThreadManifest,
        ui: withUiDefaults(inboxThreadManifest.ui),
      },
      Component: InboxThread as any,
    },
    {
      manifest: {
        ...noteListManifest,
        ui: withUiDefaults(noteListManifest.ui),
      },
      Component: NoteList as any,
    },
    {
      manifest: {
        ...taskListManifest,
        ui: withUiDefaults(taskListManifest.ui),
      },
      Component: TaskList as any,
    },
    {
      manifest: {
        ...dataPanelManifest,
        ui: withUiDefaults(dataPanelManifest.ui),
      },
      Component: DataPanel as any,
    },
    {
      manifest: {
        ...statusIndicatorManifest,
        ui: withUiDefaults(statusIndicatorManifest.ui),
      },
      Component: StatusIndicator as any,
    },
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const actionIndex = new Map<string, ActionSchemaEntry>();
  for (const [, entry] of blocks.entries()) {
    for (const action of entry.manifest.actions ?? []) {
      actionIndex.set(`${entry.manifest.block_id}::${action.action_type}`, {
        manifest: entry.manifest,
        schema: action,
      });
    }
  }

  return Object.freeze({
    blocks,
    getManifest: (blockType: string) => blocks.get(blockType)?.manifest,
    validateProps: (blockType: string, props: unknown) => {
      const entry = blocks.get(blockType);
      return (
        entry?.validate(props) ?? {
          valid: false,
          errors: ["Unknown block type"],
        }
      );
    },
    getActionSchema: (blockType: string, actionType: string) =>
      actionIndex.get(`${blockType}::${actionType}`),
    manifestsHash: deterministicId(
      Array.from(blocks.values()).map((entry) => entry.manifest),
    ),
  });
}

export { UI_DEFAULTS };
