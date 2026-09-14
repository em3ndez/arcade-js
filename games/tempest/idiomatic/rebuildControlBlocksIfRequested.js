// SPDX-License-Identifier: GPL-3.0-only
import { PENDING_WORK_FLAGS } from "./names.js";
import { requestRebuildIfSwitchesChanged } from "./requestRebuildIfSwitchesChanged.js";
import { noRebuildRequestReturn } from "./noRebuildRequestReturn.js";
import { rebuildControlBlocksFromTemplate } from "./rebuildControlBlocksFromTemplate.js";

/**
 * rebuildControlBlocksIfRequested — guarded front for the control-block rebuilder. ROM 0xaba2.
 *
 * Role in the machine: the cheap per-frame entry the main loop calls. The full rebuild
 * (rebuildControlBlocksFromTemplate) reshapes the per-lane control/glyph blocks and is comparatively
 * expensive, so it must run only when a rebuild is actually pending. This front refreshes the switch
 * snapshot (which may itself raise a request on a switch change) and then gates on the request bits: no
 * request => a do-nothing tail; any request => hand off to the full rebuild body.
 *
 * Behaviour: call requestRebuildIfSwitchesChanged to refresh the snapshot and possibly arm a request bit.
 * Test the low two bits of the pending-work flags cell 0x1c9; if both clear, return via the no-op tail.
 * Otherwise tail-call the rebuild body.
 *
 * Live-out: nothing of its own — it only refreshes the snapshot and dispatches; any block/flag changes
 * come from the callee. Grounding: [seen].
 */
export function rebuildControlBlocksIfRequested(m) {
  const { mem8 } = m;
  requestRebuildIfSwitchesChanged(m); // refresh snapshot; may arm a request on a switch change
  // No rebuild pending in the low two request bits of 0x1c9 => cheap no-op return.
  if ((mem8[PENDING_WORK_FLAGS] & 0x03) === 0) return noRebuildRequestReturn();
  return rebuildControlBlocksFromTemplate(m); // a request is set => run the full rebuild
}
