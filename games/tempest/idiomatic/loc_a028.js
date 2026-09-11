// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2d, loc_111, loc_140, loc_2b9, loc_2cc, loc_28a, loc_3ac, loc_60da } from "./names.js";

// Pick a new segment for slot x: scan the 16-column depth table starting at a random
// column, keeping the column that holds the largest depth (an empty column counts as
// maximal). The last column is skipped while the gate is on. Record the winner and its
// successor for the slot and clear bit7 of the slot flag.
export function loc_a028(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_2d] = 0;
  mem8[loc_140] = 0x0f;
  let y = mem8[loc_60da] & 0x0f;
  for (;;) {
    const gated = y === 0x0f && mem8[loc_111] !== 0;
    if (!gated) {
      let depth = mem8[u16(loc_3ac + y)];
      if (depth === 0) depth = 0xff;
      if (depth >= mem8[loc_2d]) {
        mem8[loc_2d] = depth;
        mem8[loc_29] = y;
      }
    }
    y = (y - 1) & 0x0f;
    const cnt = (mem8[loc_140] - 1) & 0xff;
    mem8[loc_140] = cnt;
    if (cnt & 0x80) break;
  }
  const winner = mem8[loc_29];
  mem8[u16(loc_2b9 + x)] = winner;
  mem8[u16(loc_2cc + x)] = (winner + 1) & 0x0f;
  const flag = u16(loc_28a + x);
  mem8[flag] = mem8[flag] & 0x7f;
}
