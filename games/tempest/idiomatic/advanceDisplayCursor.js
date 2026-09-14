// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

// Advance the little-endian 16-bit cursor by the stride argument plus one,
// carrying into the high byte on overflow. Exit A (live-out) is the new low
// byte of the cursor -- (mem[$74] + y + 1) & 0xff -- the value the accumulator
// holds once the cursor has advanced.
export function advanceDisplayCursor(m, y = m.regs.y) {
  const { mem8 } = m;

  const sum = mem8[DRAW_CURSOR_LO] + y + 1;

  mem8[DRAW_CURSOR_LO] = sum;

  if (sum > 0xff) mem8[DRAW_CURSOR_HI] = mem8[DRAW_CURSOR_HI] + 1;

  return (m.regs.a = sum & 0xff);
}
