// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_CELL_TIMERS } from "./names.js";
/**
 * tickRopeCellFrameTimer — decrement one of the four rope-cell frame timers.
 *
 * ROM 0x2e45. Grounding: [seen].
 *
 * Pooyan's play field is built around ropes that carry the enemies up and down; the machine
 * keeps a small bank of FOUR per-rope-cell frame timers at ROPE_CELL_TIMERS (0x8f28), one
 * per cell, laid out two bytes apart. This helper ticks exactly ONE of them.
 *
 * Which one is chosen by the low two bits of the caller's index — the low byte of the index
 * register (IXL). Bits above bit1 are ignored, so the selector is always one of the four
 * cells; multiplying by the two-byte stride turns that 0..3 selector into the cell's address
 * in the bank.
 *
 * A plain leaf: it reads and writes one timer byte and calls nothing.
 *
 * LIVE-OUT: HL = the selected timer's address (callers store through it) and the Z flag =
 * reached-zero (callers `ret nz` while it has not), both bridged for the frozen rope-cell
 * handlers at ROM 0x2e64 / 0x2ecb / 0x2f04 / 0x2f2f.
 */

const TIMER_STRIDE = 2;

export function tickRopeCellFrameTimer(m, ixl = m.regs.ix & 0xff) {
  const { mem8 } = m;

  // Pick the cell: (IXL & 3) selects one of the four timers, and each timer occupies
  // TIMER_STRIDE (2) bytes from the ROPE_CELL_TIMERS (0x8f28) base.
  const timer = ROPE_CELL_TIMERS + TIMER_STRIDE * (ixl & 0x03);

  // Count that cell's frame timer down one, wrapping at the byte boundary, and store it back.
  const ticked = (mem8[timer] - 1) & 0xff;
  mem8[timer] = ticked;

  // Hand back the timer's address (in HL) and whether it just reached zero (the Z flag), the
  // two values the rope-cell handlers read after this tick.
  return [(m.regs.hl = timer), (m.regs.fZ = ticked === 0)];
}
