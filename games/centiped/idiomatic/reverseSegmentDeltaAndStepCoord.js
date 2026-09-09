// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { negateA } from "./negateA.js";
import { loc_44, loc_54, loc_74 } from "./names.js";
import { advanceSegmentLoopIndex } from "./advanceSegmentLoopIndex.js";

/**
 * reverseSegmentDeltaAndStepCoord -- step handler for segment X that flips its travel direction.
 * The segment delta is negated in place. When the neighbour link is already set the segment just
 * moves on; otherwise the link is seeded with the negative magnitude of the flipped delta and the
 * coordinate is nudged +/-4 following that delta's sign. Falls through to the next-segment step. [code]
 */
export function reverseSegmentDeltaAndStepCoord(m, x = m.regs.x) {
  const { mem8 } = m;
  const deltaAddr = (loc_44 + x) & 0xff;
  const flipped = negateA(m, mem8[deltaAddr]); // reverse travel direction
  mem8[deltaAddr] = flipped;

  const linkAddr = (loc_74 + x) & 0xff;
  if (mem8[linkAddr] !== 0) return advanceSegmentLoopIndex(m, x); // neighbour already linked -> next segment

  // Seed the link with the negative magnitude of the flipped delta.
  mem8[linkAddr] = (flipped & 0x80) ? flipped : negateA(m, flipped);

  // Nudge the coordinate one step in the flipped delta's direction.
  const coordAddr = (loc_54 + x) & 0xff;
  mem8[coordAddr] = u8(mem8[coordAddr] + ((flipped & 0x80) ? -4 : 4));
  return advanceSegmentLoopIndex(m, x); // fall through to the next-segment step
}
