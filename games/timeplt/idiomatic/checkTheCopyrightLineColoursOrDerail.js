// SPDX-License-Identifier: GPL-3.0-only
/** checkTheCopyrightLineColoursOrDerail — read the colour of thirteen cells along one line and derail if any of them has been
 * changed. It starts at the caption's own first cell and follows it in the same direction the
 * caption is painted, a fixed stride each time; every cell must hold one
 * of exactly two colours. The first cell holding anything else ends the walk on a transfer that
 * never comes back. It leaves the offending colour, the cell it was read from and the count still
 * owed standing in registers; what becomes of them is NOT established here, because the transfer's
 * target is a caption record that merely decodes as instructions. Thirteen good cells return with
 * nothing done.
 * LIVE-OUT: memory; on the derail, everything the transfer leaves behind as well. */

import { u16 } from "../../../core/int.js";
import { loc_49fa, loc_a2bc } from "./names.js";

const CELLS = 13;
const STRIDE_BACK = 0xffe0;
const EITHER_COLOUR = [0x10, 0x05];

export function checkTheCopyrightLineColoursOrDerail(m) {
  const { regs, mem8 } = m;
  let cell = loc_a2bc;
  for (let owed = CELLS; owed > 0; owed--) {
    const colour = mem8[cell];
    if (!EITHER_COLOUR.includes(colour)) {
      regs.a = colour;
      regs.hl = cell;
      regs.b = owed;
      return m.call(loc_49fa);
    }
    regs.de = STRIDE_BACK;
    cell = u16(cell + STRIDE_BACK);
  }
}
