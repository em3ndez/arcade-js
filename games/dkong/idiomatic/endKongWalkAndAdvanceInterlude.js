// SPDX-License-Identifier: GPL-3.0-only
/**
 * endKongWalkAndAdvanceInterlude — once the moving sprite group reaches its rail region,
 * either reinitialize it or bounce/slide it by its current step sign.
 *
 * Second stage of the pair that walks a group of ten sprites back and forth during a
 * between-boards interlude. The first stage hands control here, with the group's leading
 * record X and the object's published signed per-frame step, once X reaches the rail. Three
 * outcomes: X short of 93 reinitializes the object block and advances the interlude step; X
 * at/past 93 with a POSITIVE step (heading into the rail) schedules a reversal then slides
 * (bounce); X at/past 93 with a NEGATIVE step (moving away) just slides. A reversal is
 * scheduled only while the group is still travelling INTO the rail. This stage touches no
 * work RAM; the chosen handler does all the memory work.
 */

import { loc_16d0 } from "./loc_16d0.js";
import { stepKongWalk } from "./stepKongWalk.js";
import { reloadObjectBlockAndAdvanceStep } from "./reloadObjectBlockAndAdvanceStep.js";

export function endKongWalkAndAdvanceInterlude(m, recordX, stepByte) {
  if (recordX < 93) {
    reloadObjectBlockAndAdvanceStep(m);
    return;
  }

  const stepIsNegative = (stepByte & 0x80) !== 0;

  if (!stepIsNegative) {
    loc_16d0(m);
  } else {
    stepKongWalk(m);
  }
}
