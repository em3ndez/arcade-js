// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_CELL_TIMERS } from "./names.js";
/**
 * tickRopeCellFrameTimer — tick down one of the four rope-cell frame timers.
 *
 * The low two bits of IXL select a timer (stride 2 from the table base); the routine
 * decrements that timer cell in place.
 *
 * LIVE-OUT: HL = the selected timer's address (callers store through it) and the Z flag
 * = reached-zero (callers `ret nz` while it has not), both bridged for the frozen
 * rope-cell handlers.
 */

const TIMER_STRIDE = 2;

export function tickRopeCellFrameTimer(m, ixl = m.regs.ix & 0xff) {
  const { mem8 } = m;
  const timer = ROPE_CELL_TIMERS + TIMER_STRIDE * (ixl & 0x03);
  const ticked = (mem8[timer] - 1) & 0xff;
  mem8[timer] = ticked;
  return [(m.regs.hl = timer), (m.regs.fZ = ticked === 0)];
}
