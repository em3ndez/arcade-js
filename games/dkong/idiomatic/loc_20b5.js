// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20b5 — send an object off at one pixel per frame to the LEFT, unless its horizontal step
 * already has a whole-pixel part, in which case the mirror arm sends it right instead; then hand
 * the record on to the shared launch tail. The branch is a zero test on the whole-pixel byte, not
 * a sign test: only the sub-pixel-rightward records (0 ≤ step < 1.0) get the leftward pixel here.
 *
 * LIVE-OUT: memory, plus the propagated return value.
 */

import { u16 } from "../../../core/int.js";
import { loc_20e1 } from "./loc_20e1.js";
import { loc_20c3 } from "./loc_20c3.js";

const STEP_WHOLE = 16;
const STEP_FRACTION = 17;

// One whole pixel per frame leftward: 255 is the whole-pixel half of −1.0 in signed big-endian form.
const LEFTWARD_ONE_PIXEL_WHOLE = 255;
const LEFTWARD_ONE_PIXEL_FRACTION = 0;

export function loc_20b5(m, cur, ix = m.regs.ix) {
  const { mem8 } = m;
  const at = (offset) => u16(ix + offset);

  if (mem8[at(STEP_WHOLE)] !== 0) return loc_20e1(m, cur);

  mem8[at(STEP_FRACTION)] = LEFTWARD_ONE_PIXEL_FRACTION;
  mem8[at(STEP_WHOLE)] = LEFTWARD_ONE_PIXEL_WHOLE;

  return loc_20c3(m, cur);
}
