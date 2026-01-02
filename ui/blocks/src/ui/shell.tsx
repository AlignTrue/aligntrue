import type { BlockShell } from "@aligntrue/ui-renderer";
import { BlockBody } from "./BlockBody.js";
import { BlockFooter } from "./BlockFooter.js";
import { BlockFrame } from "./BlockFrame.js";
import { BlockHeader } from "./BlockHeader.js";
import { BlockState } from "./BlockState.js";

export const platformShell: BlockShell = {
  Frame: BlockFrame,
  Header: BlockHeader,
  Body: BlockBody,
  Footer: BlockFooter,
  State: BlockState,
};
