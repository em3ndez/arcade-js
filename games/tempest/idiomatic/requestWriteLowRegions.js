// SPDX-License-Identifier: GPL-3.0-only
import { queueEaromRequestAtIndexZero } from "./queueEaromRegionSave.js";

/**
 * requestWriteLowRegions — queue a save of the two low NVRAM regions. ROM 0xddf7.
 *
 * Role in the machine: Tempest persists high scores and settings to a serial EAROM. This
 * cue requests a (non-blanked) write of the two low NVRAM regions by handing the fixed
 * region mask 0x03 to the shared merge tail — the low two region bits set means "these two
 * regions are dirty, flush them".
 *
 * Behavior: call queueEaromRequestAtIndexZero with mask 0x03. That shared tail ORs the mask
 * into the region-pending cell (loc_1c7) and the direction cell (loc_1c8) while forcing the
 * blank-index cell (loc_1c6) to zero — i.e. index 0, not a blanking pass.
 *
 * Live-out: none directly; the pending/direction/blank cells are updated inside the tail.
 * Grounding: [seen].
 */
export function requestWriteLowRegions(m) {
  // Mask 0x03 = the two low regions; the zeroed-index tail marks them pending for the EAROM.
  queueEaromRequestAtIndexZero(m, 0x03);
}
