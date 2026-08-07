// SPDX-License-Identifier: GPL-3.0-only
/** isScoreBelow — answer whether one three-byte number is below another. Both are read most
 * significant byte first, from the two addresses given and DOWNWARD, and the first byte that
 * differs settles it; all three equal counts as not below. The answer is the whole product —
 * nothing is written, and it is mirrored into carry for a caller that reads it there.
 * LIVE-OUT: the boolean. */

import { u16 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";

const BYTES = 3;

export function isScoreBelow(m, candidate = m.regs.de, standing = m.regs.hl) {
  const { mem8, regs } = m;
  let below = false;
  for (let i = 0; i < BYTES; i++) {
    const a = mem8[u16(candidate - i)];
    const b = mem8[u16(standing - i)];
    if (a !== b) {
      below = a < b;
      break;
    }
  }
  regs.f = (regs.f & ~F_C) | (below ? F_C : 0);
  return below;
}
