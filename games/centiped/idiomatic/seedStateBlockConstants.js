// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_ef, loc_f0, loc_f1, loc_f2, loc_f3, loc_f4, loc_f5, loc_f6, loc_f7, loc_f8,
  loc_bd, loc_bf, FLIP_SCREEN, loc_2400,
} from "./names.js";

/**
 * seedStateBlockConstants — stamp the $ef-$f8 state block back to its fixed
 * startup constants, set the flip-screen latch, and clear the $bd/$bf pair.
 * Straight-line seeder: no branches, no sub-calls, no input.  [code]
 */
export function seedStateBlockConstants(m) {
  const { mem8 } = m;
  mem8[loc_f0] = 0xf8;
  mem8[loc_f3] = 0xff;
  mem8[loc_f4] = 0xfe;
  mem8[loc_f8] = 0xfc;
  mem8[loc_f1] = 0xe0;
  mem8[loc_ef] = 0xc0;
  mem8[loc_f2] = 0x40;
  mem8[loc_f5] = 0xbf;
  mem8[loc_f7] = 0x03;
  mem8[loc_f6] = 0x3f;
  mem8[FLIP_SCREEN] = 0x80; // flip-screen latch: bit7 set
  mem8[loc_2400] = 0x80; // dead store, ignored by the board
  mem8[loc_bd] = 0x00;
  mem8[loc_bf] = 0x00;
}
