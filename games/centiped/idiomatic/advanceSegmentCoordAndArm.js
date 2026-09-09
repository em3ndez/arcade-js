// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { armSlotWhenObjectInRange } from "./armSlotWhenObjectInRange.js";
import { returnImmediately } from "./returnImmediately.js";
import { loc_44, loc_54, loc_64 } from "./names.js";
import { advanceSegmentLoopIndex } from "./advanceSegmentLoopIndex.js";
import { reverseSegmentDeltaAndStepCoord } from "./reverseSegmentDeltaAndStepCoord.js";

/**
 * advanceSegmentCoordAndArm -- step handler for segment X: advance its coordinate by its own
 * delta, then probe whether the segment now sits in range of the reference point. When the probe
 * arms it (carry clear) the segment is done; otherwise the low 3 bits of its state field pick the
 * next stage -- value 4 flips the delta and re-steps the coordinate, anything else moves on to the
 * next segment. [code]
 */
export function advanceSegmentCoordAndArm(m, x = m.regs.x) {
  const { mem8 } = m;
  const coord = (loc_54 + x) & 0xff;
  mem8[coord] = u8(mem8[coord] + mem8[(loc_44 + x) & 0xff]); // advance by the segment delta
  const outOfRange = armSlotWhenObjectInRange(m, x);         // carry set == still out of range
  if (!outOfRange) return returnImmediately(m);             // in range -> armed, segment done
  if ((mem8[(loc_64 + x) & 0xff] & 0x07) !== 0x04) return advanceSegmentLoopIndex(m, x); // -> next segment
  return reverseSegmentDeltaAndStepCoord(m, x);              // aligned -> flip-and-step stage
}
