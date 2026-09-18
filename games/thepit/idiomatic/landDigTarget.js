// SPDX-License-Identifier: GPL-3.0-only
/**
 * landDigTarget — land the descending dig/capture target when it reaches terrain. The caller
 * steps the target one row down each frame; when the tile just ahead is solid terrain the
 * target has hit ground and stops. This sounds the arrival cue, stamps the finished-target
 * tile one cell ahead of where it stopped, then resets the target's state block:
 * HAZARD_ACTIVE_COUNT reopens the spawn gate, HAZARD_X clears, HAZARD_STATE takes the done
 * code and HAZARD_TYPE its fixed colour. It then hands off to the record builder that composes
 * the 4-byte sprite record. The map-cell pointer arrives from the caller as a parameter
 * defaulting to that register; the stamp lands one cell before it, matching the probe offset.
 */

import { requestSound17 } from "./requestSound17.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { HAZARD_X, HAZARD_STATE, HAZARD_TYPE, HAZARD_ACTIVE_COUNT } from "./names.js";

export function landDigTarget(m, targetCell = m.regs.ix) {
  const { mem8 } = m;

  // Arrival cue for the target reaching terrain.
  requestSound17(m);

  // Stamp the finished-target tile into the map cell one ahead of where the target stopped.
  mem8[targetCell - 31] = 65;

  // Settle the target's state block into its finished configuration (see the header).
  mem8[HAZARD_ACTIVE_COUNT] = 0;
  mem8[HAZARD_X] = 0;
  mem8[HAZARD_STATE] = 9;
  mem8[HAZARD_TYPE] = 7;

  // Build the target's sprite record from the block just written, then continue the frame.
  return stageDigObjectSpriteRecord(m);
}
