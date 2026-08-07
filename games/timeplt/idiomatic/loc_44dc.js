// SPDX-License-Identifier: GPL-3.0-only
/** loc_44dc — give an object the two shapes of a two-frame flutter, picked by one bit of a counter
 * cell rather than by anything the object holds: one bit clear selects one pair of shape codes,
 * set selects the pair two higher. The two codes go into two slots of the same sprite entry, so a
 * single object is drawn from two shapes at once. Which pair is live changes only as fast as that
 * bit does; nothing here advances it. LIVE-OUT: memory, two bytes. */

import { u16 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";

const ALTERNATION_BIT = 0x04;
const FIRST_SHAPE = 0xd5;
const SECOND_SHAPE = 0xd4;
const SHAPE_STEP = 2;
const FIRST_SLOT = 1;
const SECOND_SLOT = 3;

export function loc_44dc(m, sprite = m.regs.iy) {
  const { mem8 } = m;
  const flutter = (mem8[FRAME_TICK] & ALTERNATION_BIT) === 0 ? SHAPE_STEP : 0;
  mem8[u16(sprite + FIRST_SLOT)] = FIRST_SHAPE + flutter;
  mem8[u16(sprite + SECOND_SLOT)] = SECOND_SHAPE + flutter;
}
