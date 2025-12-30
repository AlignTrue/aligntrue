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

export function createPlatformBlockRegistry(): BlockRegistry {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return createBlockRegistry([
    { manifest: entityTableManifest, Component: EntityTable as any },
    { manifest: approvalGateManifest, Component: ApprovalGate as any },
    { manifest: receiptTimelineManifest, Component: ReceiptTimeline as any },
    { manifest: formSurfaceManifest, Component: FormSurface as any },
    {
      manifest: actionProposalCardManifest,
      Component: ActionProposalCard as any,
    },
    { manifest: diffViewerManifest, Component: DiffViewer as any },
    { manifest: inboxThreadManifest, Component: InboxThread as any },
    { manifest: taskListManifest, Component: TaskList as any },
    { manifest: dataPanelManifest, Component: DataPanel as any },
    { manifest: statusIndicatorManifest, Component: StatusIndicator as any },
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
