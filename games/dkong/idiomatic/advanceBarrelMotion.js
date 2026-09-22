import { stepBarrelRight } from "./stepBarrelRight.js";
import { stepBarrelLeft } from "./stepBarrelLeft.js";
import { advanceFallingBarrel } from "./advanceFallingBarrel.js";
import { loc_1fac } from "./loc_1fac.js";
import { loc_2053 } from "./loc_2053.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelMotion — move a live barrel one frame, dispatching to one of five motion arms
 * chosen from two record bytes. The select byte (+1) is tested first for equality with 1 and
 * outranks the mode bits (+2, low three bits, lowest set wins). Every arm is a tail call, so
 * this routine's return IS the chosen arm's return.
 *
 * LIVE-OUT: memory-only plus the chosen arm's return value, propagated unchanged.
 */

const BRANCH_SELECT = 1; // tested for equality with 1, and outranks the mode bits
const BRANCH_MODE_BITS = 2; // low three bits, lowest first, first set bit wins

export function advanceBarrelMotion(m, record = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[record + BRANCH_SELECT] === 1) return advanceFallingBarrel(m);

  const mode = mem8[record + BRANCH_MODE_BITS];
  if (mode & 1) return loc_1fac(m);
  if (mode & 2) return stepBarrelRight(m);
  if (mode & 4) return stepBarrelLeft(m);

  return loc_2053(m);
}
