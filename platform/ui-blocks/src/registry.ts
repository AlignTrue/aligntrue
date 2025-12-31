import type { BlockActionSchema, BlockManifest } from "@aligntrue/ui-contracts";
import { deterministicId } from "@aligntrue/ui-contracts";
import type { BlockRegistry } from "@aligntrue/ui-renderer";
import { createBlockRegistry } from "@aligntrue/ui-renderer";
import type { RegistryLike } from "@aligntrue/ui-renderer";
import {
  EntityTable,
  entityTableManifest,
} from "./blocks/EntityTable/index.js";
import {
  ApprovalGate,
  approvalGateManifest,
} from "./blocks/ApprovalGate/index.js";
import {
  ReceiptTimeline,
  receiptTimelineManifest,
} from "./blocks/ReceiptTimeline/index.js";
import {
  FormSurface,
  formSurfaceManifest,
} from "./blocks/FormSurface/index.js";
import {
  ActionProposalCard,
  actionProposalCardManifest,
} from "./blocks/ActionProposalCard/index.js";
import { DiffViewer, diffViewerManifest } from "./blocks/DiffViewer/index.js";
import {
  InboxThread,
  inboxThreadManifest,
} from "./blocks/InboxThread/index.js";
import { NoteList, noteListManifest } from "./blocks/NoteList/index.js";
import { TaskList, taskListManifest } from "./blocks/TaskList/index.js";
import { DataPanel, dataPanelManifest } from "./blocks/DataPanel/index.js";
import {
  StatusIndicator,
  statusIndicatorManifest,
} from "./blocks/StatusIndicator/index.js";
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
