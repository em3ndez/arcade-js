// SPDX-License-Identifier: GPL-3.0-only
import { PENDING_WORK_FLAGS } from "./names.js";
import { requestRebuildIfSwitchesChanged } from "./requestRebuildIfSwitchesChanged.js";
import { noRebuildRequestReturn } from "./noRebuildRequestReturn.js";
import { rebuildControlBlocksFromTemplate } from "./rebuildControlBlocksFromTemplate.js";

// Refresh the control state, then branch on the low two request bits: idle takes the
// no-op tail, otherwise run the rebuild/copy path.
export function loc_aba2(m) {
  const { mem8 } = m;
  requestRebuildIfSwitchesChanged(m);
  if ((mem8[PENDING_WORK_FLAGS] & 0x03) === 0) return noRebuildRequestReturn();
  return rebuildControlBlocksFromTemplate(m);
}
