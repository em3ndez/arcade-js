// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchKongWalkFrame — every frame, clear object #1's reversal flag, then route the moving
 * sprite group to bounce, slide or hand-off by record #2's X and object #1's travel direction.
 * Pre-clearing the reverse timer makes the arm choice the whole bounce decision.
 *
 * LIVE-OUT: memory-only.
 */

import { M50_OBJ1_REVERSE_TIMER, M50_OBJ1_STEP, SPRITE_OBJ_REC2_X } from "./names.js";
import { loc_16d0 } from "./loc_16d0.js";
import { stepKongWalk } from "./stepKongWalk.js";
import { endKongWalkAndAdvanceInterlude } from "./endKongWalkAndAdvanceInterlude.js";

export function dispatchKongWalkFrame(m) {
  const { mem8 } = m;

  mem8[M50_OBJ1_REVERSE_TIMER] = 0x00;

  const stepByte = mem8[M50_OBJ1_STEP];
  const recordX = mem8[SPRITE_OBJ_REC2_X];

  // At or above the rail region: hand to the second-stage dispatcher.
  if (recordX >= 90) {
    endKongWalkAndAdvanceInterlude(m, recordX, stepByte);
    return;
  }

  // Below the rail region: step negative (into the near edge) -> bounce; positive -> slide.
  const stepIsNegative = (stepByte & 0x80) !== 0;
  if (stepIsNegative) {
    loc_16d0(m);
  } else {
    stepKongWalk(m);
  }
}
