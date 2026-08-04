// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoDigitField — stamp a two-digit number's tile pair into its on-screen field: the
 * high-digit tile into one cell, the low-digit tile into the cell one column over.  ROM 0x0689.
 *
 * PURPOSE [code]: the field is the two-digit board-derived readout that task entry 10 builds —
 * it divides BONUS_START (= min(BOARD*10 + 0x28, 0x50)) by ten into BONUS_DISPLAY, and its writer
 * renderBonusDisplay splits that byte into a high-digit tile and a low-digit tile.
 * ★ THE INHERITED CAVEAT IS DISCHARGED (pass 13). Pass 12 rated this [guess] because the
 * two-nibble packed-BCD READING of BONUS_DISPLAY was code-derived rather than observed. Pass 13
 * observed it on the real dkong ROM under MAME 0.288 (scratchpad/pass13-grounding.md §3a): over
 * 99,367 comparable frames spanning BONUS 0..80, BONUS_DISPLAY == BCD(BONUS) against the
 * separately-[seen] binary counter BONUS (0x62B1) with ZERO mismatches, the low nibble never
 * exceeded 9, and the BCD borrow is directly visible (0x50 -> 0x49, 0x40 -> 0x39 while the quantity
 * drops by 1). So the digit-pair interpretation this stamp rests on is grounded, and the rating
 * rises to [code] — the remaining gap is not the encoding but THIS routine's own field: which
 * on-screen cells 0x74E6/0x74C6 are has never been checked against pixels (pass 13 ran -video
 * none). HONEST FLOOR on the encoding: it is confirmed over the whole REACHABLE range, not over all
 * 256 byte values — a nibble of 0xA-0xF is UNREACHABLE rather than merely unobserved, because the
 * ROM clamps BONUS_START to 80 so the display can never exceed 0x80.
 * This is renderBonusDisplay's shared stamp tail: both its arms (the high-nibble-nonzero arm, and the
 * leading-zero-suppress arm that enters with the high tile forced to a blank 0x10) funnel here
 * to place the pair. Only the register VALUES the arms bring differ; the two writes are the same.
 *
 * The high-digit tile (incoming A) is written FIRST, into the higher-address cell (0x74E6), then
 * the low-digit tile (incoming B) into 0x74C6 — one screen column earlier on the rotated tilemap
 * (the two cells are 0x20 apart). The high cell is deliberately written before the low cell to
 * match the oracle's store order. A straight-line leaf: no branch, no RAM read, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0689.test.js.
 * GATE:     strict/whole-contract over real captured dispatches (~12 in a 2000-frame attract, the
 *           task-10 field rendering, spanning distinct high/low digit pairs) + crafted entries for
 *           the leading-zero-suppress value (high tile A = 0x10) and an arbitrary A != B sentinel
 *           pair, reposed on a real capture. Whole contract each time: RAM − STACK_SCRATCH + pc +
 *           SP. Teeth: a wrong-cell twin (writes the high tile one cell off) and a duplicate twin
 *           (writes the high tile into both cells instead of the low tile), each caught.
 * LIVE-OUT: memory-only — the two video-RAM cells 0x74E6 and 0x74C6. No live registers/flags:
 *           A ends = B (the tile move) but the caller (renderBonusDisplay's caller, the task loop) reads no
 *           register before overwriting it, and this routine sets no flag, so the oracle's residual
 *           registers/flags are dead ABI. SP/PC are the single net return the JS call stack
 *           replaces (the harness supplies one m.ret() to line them up).
 * NAMES:    none imported — the two cells are video-RAM tile addresses (0x7400–0x77FF), which
 *           names.js does not name (it covers work RAM only), so they stay hex. The two tiles arrive
 *           in registers from renderBonusDisplay.
 */

// The two cells of the display field, one screen column apart on the rotated tilemap (0x20).
const HIGH_DIGIT_CELL = 0x74e6; // written first (matches the oracle's store order)
const LOW_DIGIT_CELL = 0x74c6;

export function stampTwoDigitField(m) {
  const { regs, mem } = m;

  // High-digit tile (A) into the high cell, then low-digit tile (B) into the low cell.
  mem.write8(HIGH_DIGIT_CELL, regs.a);
  regs.a = regs.b;
  mem.write8(LOW_DIGIT_CELL, regs.a);
}
