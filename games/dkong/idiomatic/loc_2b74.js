// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b74 — the reject arm of the tile-probe cascade: zero the probe's two result registers and
 * unwind two levels, splicing past the probe's caller so the rest of that pass is skipped. In
 * direct-call form the non-local exit is the boolean false — the caller-skip "abort, no result".
 *
 * The two zeros are LIVE: after the unwind the consumer reads them straight back (decrementing the
 * first for its branch, the second on a sibling arm), which is why they are written as registers.
 * A leaf: reads nothing, writes no memory, calls nothing. The neutral name stands because what the
 * (0, 0) result MEANS to the game is not established here. LIVE-OUT: the two zero registers plus
 * the boolean; residual HL and flags are dead.
 */

export function loc_2b74(m) {
  const { regs } = m;

  regs.a = 0;
  regs.b = 0;

  return false;
}
