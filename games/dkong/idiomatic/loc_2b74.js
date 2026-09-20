// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b74 — the reject arm of the tile-probe cascade: zero the probe's two result registers and
 * unwind two levels; in direct-call form the non-local exit is the boolean false. The two zeros
 * are LIVE: the consumer reads them straight back (decrementing the first for its branch, the
 * second on a sibling arm), so they are written as registers. LIVE-OUT: the two zero registers
 * plus the boolean; residual HL and flags are dead.
 */

export function loc_2b74(m) {
  const { regs } = m;

  return (regs.a = 0, regs.b = 0, false);
}
