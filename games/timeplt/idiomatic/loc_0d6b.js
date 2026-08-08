// SPDX-License-Identifier: GPL-3.0-only
/** loc_0d6b — fix the three arguments of the six-digit packed-decimal readout printer and fall
 * straight into it: the tally to print, taken from its highest byte because the printer walks
 * downward; the cell its leftmost digit lands in; and the colour every digit is given. Choosing
 * that triple is the whole of this entry, and whatever a caller held in those registers is
 * discarded. LIVE-OUT: memory — the digits and their colours, written by the printer. */

import { loc_0d73 } from "./loc_0d73.js";

const TALLY_TOP_BYTE = 0xa98d;
const FIRST_DIGIT_CELL = 0xa641;
const DIGIT_COLOUR = 0x10;

export function loc_0d6b(m) {
  const { regs } = m;
  regs.de = FIRST_DIGIT_CELL;
  regs.hl = TALLY_TOP_BYTE;
  regs.c = DIGIT_COLOUR;
  return loc_0d73(m);
}
