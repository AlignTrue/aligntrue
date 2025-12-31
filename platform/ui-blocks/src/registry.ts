import type { BlockRegistry } from "@aligntrue/ui-renderer";
import { createBlockRegistry } from "@aligntrue/ui-renderer";
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
import { TaskList, taskListManifest } from "./blocks/TaskList/index.js";
import { DataPanel, dataPanelManifest } from "./blocks/DataPanel/index.js";
import {
  StatusIndicator,
  statusIndicatorManifest,
} from "./blocks/StatusIndicator/index.js";
import { withUiDefaults, UI_DEFAULTS } from "./ui/defaults.js";

export function createPlatformBlockRegistry(): BlockRegistry {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return createBlockRegistry([
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
}

export { UI_DEFAULTS };
