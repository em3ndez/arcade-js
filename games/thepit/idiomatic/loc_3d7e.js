// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3d7e — advance the byte at BOARD_MODE, keeping bit 3 clear, then paint it
 *            down a column of cells.  ROM 0x3d7e.
 *
 * Reads the byte at BOARD_MODE, adds one, and forces bit 3 (the 8s bit) to stay
 * clear on every step. When the byte is kept in 0..7 this cycles it 0,1,...,7 and
 * back to 0 — an eight-step wrap — while any higher bits ride through untouched
 * (so it is a bit-3 clear, not a plain modulo-8). The advanced byte is stored
 * back, then handed to the column-fill routine (still the frozen oracle), which
 * stamps that same byte straight down a column of cells. That fill routine's
 * return is this routine's return — nothing runs after it (the hand-off is a
 * tail call, so the fill's exit lands back in this routine's caller).
 *
 * Reached only from the fixed-screen display loop loc_3ba8, which calls it once
 * per pass to re-tint one column; a plain boot/attract run never enters it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3d7e.test.js.
 * GATE:     crafted-entry — attract never dispatches this routine, so it is gated
 *           on a real captured attract state with BOARD_MODE poked across the
 *           whole mask-relevant domain, oracle vs idiomatic on identical clones.
 * LIVE-OUT: memory-only — the BOARD_MODE store; the column fill plus any register
 *           residual are produced by the still-oracle column-fill callee and are
 *           identical on both sides.
 * NAMES:    BOARD_MODE (0x8057).
 */

import { BOARD_MODE } from "./ram.js";

export function loc_3d7e(m) {
  const { mem } = m;

  // Advance one step but hold bit 3 (the 8s bit) clear, so a value kept in 0..7
  // wraps back to 0 after 7.
  mem.write8(BOARD_MODE, (mem.read8(BOARD_MODE) + 1) & 0xf7);

  // Hand off to the column-fill routine; its return becomes this routine's return.
  return m.call(0x3e01);
}
