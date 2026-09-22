// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2118 — one object record; splits on vertical position (OBJ_Y). Below 224, hands to a
 * continuation that computes the next-arc setup there. At 224 or above, installs a fixed launch
 * state and hands to a different continuation. Both arms converge on a tail that clears the
 * arc-frames field (+20) and the two coordinate fractions (+4, +6).
 *
 * LIVE-OUT: the tail's return value, propagated; and a zero accumulator into the 224-and-above
 * tail, which stores it into the record's +20, +4 and +6.
 */

import { loc_2146 } from "./loc_2146.js";
import { loc_2153 } from "./loc_2153.js";
import { OBJ_SPRITE_CODE, OBJ_Y } from "./names.js";

const Y_SPLIT = 224;

export function loc_2118(m, record = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[record + OBJ_Y] < Y_SPLIT) return loc_2146(m);

  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255; // horizontal velocity = -256, high byte first
  mem8[record + 17] = 0;
  mem8[record + 18] = 0; // launch vertical speed = 176, high byte first
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;

  return (m.regs.a = 0, loc_2153(m));
}
