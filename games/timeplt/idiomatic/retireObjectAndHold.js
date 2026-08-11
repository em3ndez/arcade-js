// SPDX-License-Identifier: GPL-3.0-only
/** retireObjectAndHold — take an object out of play together with everything riding on it, then hold the
 * slot rather than release it. Six bytes go to zero: the head byte of the record a caller points
 * at AND of the record one stride on, both coordinates of the sprite entry the caller points at,
 * and both coordinates of one FIXED entry that no argument selects. A seventh byte of the
 * caller's record is then set to a non-zero constant instead of being cleared, so it is
 * deliberately not part of the wipe; what it gates is not decided here.
 * LIVE-OUT: those seven bytes. */

import { ERA_OBJECT_ENTRY_SLOT1 } from "./names.js";
const RECORD_STRIDE = 16;
const SECOND_AXIS_OFFSET = 49;
const HELD_BYTE = 14;
const HELD_AT = 128;

export function retireObjectAndHold(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[record + RECORD_STRIDE] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[ERA_OBJECT_ENTRY_SLOT1 + SECOND_AXIS_OFFSET] = 0;
  mem8[ERA_OBJECT_ENTRY_SLOT1] = 0;
  mem8[record + HELD_BYTE] = HELD_AT;
}
