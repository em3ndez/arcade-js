// SPDX-License-Identifier: GPL-3.0-only
/** stepSevenCraftSlots — work seven fixed object slots in one fixed order, each through the entry that seats
 * its own pair of cursors. The order is the whole of what this file decides; nothing here reads or
 * writes a slot itself. The last two stand down while the mother-ship cell is set.
 *
 * ★ THE RESUME POINT IS A DEBT. Each entry below hands over to an arm that lifts one value off the
 * stack before it finishes, so one is laid down for it first — except for the two that stand down,
 * which reach no arm and lift nothing, so nothing is laid down for them either.
 * LIVE-OUT: memory, and whatever the last slot worked leaves behind. */

import { MOTHER_SHIP_ARMED } from "./names.js";
import { loc_28b7 } from "./loc_28b7.js";
import { loc_28c2 } from "./loc_28c2.js";
import { loc_28cd } from "./loc_28cd.js";
import { loc_28d8 } from "./loc_28d8.js";
import { loc_28e3 } from "./loc_28e3.js";
import { loc_28ee } from "./loc_28ee.js";
import { loc_28fe } from "./loc_28fe.js";

const CHAIN = [
  [loc_28b7, 0x28a4, false],
  [loc_28c2, 0x28a7, false],
  [loc_28cd, 0x28aa, false],
  [loc_28d8, 0x28ad, false],
  [loc_28e3, 0x28b0, false],
  [loc_28ee, 0x28b3, true],
  [loc_28fe, 0x28b6, true],
];

export function stepSevenCraftSlots(m) {
  for (const [workSlot, resumePoint, standsDown] of CHAIN) {
    if (!standsDown || m.mem8[MOTHER_SHIP_ARMED] === 0) m.push16(resumePoint);
    workSlot(m);
  }
}
