// SPDX-License-Identifier: GPL-3.0-only
/** checkTheCopyrightLineColoursOrDerail — read the colour of thirteen cells along one line and derail if any of them has been
 * changed. It starts at the caption's own first cell and follows it in the same direction the
 * caption is painted, a fixed stride each time; every cell must hold one
 * of exactly two colours. The first cell holding anything else ends the walk on a transfer that
 * never comes back. It leaves the offending colour, the flags of the comparison that rejected it,
 * the cell it was read from and the count still owed standing in registers; what becomes of them is
 * NOT established here, because the transfer's target is a caption record that merely decodes as
 * instructions. Thirteen good cells return with the last colour, the walked-off pointer, a spent
 * count and the stride still standing, and the flags the walk's final step left.
 * LIVE-OUT: memory; the walk's registers; on the derail, everything the transfer leaves behind as well. */

import { u16 } from "../../../core/int.js";
import { F_S, F_Z, F_H, F_F5, F_C, F_N, F_PV } from "../../../core/cpu/z80.js";
import { loc_49fa, COPYRIGHT_LINE_FIRST_COLOUR_CELL } from "./names.js";

const CELLS = 13;
const STRIDE_BACK = -0x20;
const EITHER_COLOUR = [0x10, 0x05];
const REJECT_AGAINST = 0x05;

// The flags standing when the thirteenth good cell has been walked off. The last accepted colour
// leaves the compare with zero difference (Z set, sign and overflow clear); the stride add that
// follows carries out of both nibble and word, so half-carry, carry and the high copy of bit 5
// survive with N clear.
const CLEAN_EXIT_FLAGS = F_Z | F_H | F_F5 | F_C;

// The flags a rejected colour leaves: the compare against the second accepted colour, with the
// colour in the accumulator. The comparand carries no bit 3 or 5, so those stay clear.
function rejectFlags(colour) {
  const diff = colour - REJECT_AGAINST;
  const res = diff & 0xff;
  return (res & 0x80 ? F_S : 0) |
    (res === 0 ? F_Z : 0) |
    F_N |
    (diff < 0 ? F_C : 0) |
    (((colour ^ REJECT_AGAINST ^ res) & 0x10) ? F_H : 0) |
    (((colour ^ REJECT_AGAINST) & (colour ^ res) & 0x80) ? F_PV : 0);
}

export function checkTheCopyrightLineColoursOrDerail(m) {
  const { regs, mem8 } = m;
  let cell = COPYRIGHT_LINE_FIRST_COLOUR_CELL;
  let colour;
  for (let owed = CELLS; owed > 0; owed--) {
    colour = mem8[cell];
    if (!EITHER_COLOUR.includes(colour)) {
      return (regs.a = colour, regs.f = rejectFlags(colour), regs.hl = cell, regs.b = owed, m.call(loc_49fa));
    }
    // The stride is laid down before the pointer advances, so a rejection on the very first cell
    // leaves it untouched while every later exit hands it on.
    regs.de = u16(STRIDE_BACK);
    cell = u16(cell + STRIDE_BACK);
  }
  return (regs.a = colour, regs.f = CLEAN_EXIT_FLAGS, regs.hl = cell, regs.b = 0);
}
