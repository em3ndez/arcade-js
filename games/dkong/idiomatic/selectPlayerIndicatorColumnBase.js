// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerIndicatorColumnBase — map a player selector (0 = player 1, else player 2) to the
 * video-RAM column-base address of that player's on-screen indicator column. A pure leaf.
 *
 * LIVE-OUT: the returned column-base address, a video-RAM pointer. Writes no work RAM.
 */
import { P1_INDICATOR_COLUMN_BASE, P2_INDICATOR_COLUMN_BASE } from "./names.js";

export function selectPlayerIndicatorColumnBase(playerSelector) {
  return playerSelector === 0 ? P1_INDICATOR_COLUMN_BASE : P2_INDICATOR_COLUMN_BASE;
}

/**
 * Machine-shaped seam entry (fn(m)): selector in the accumulator, chosen base left in the register
 * pair callers read. The selector is not overwritten and the zero-test flags survive both exits.
 */
export function selectPlayerIndicatorColumnBaseFromRegisters(m, a = m.regs.a) {
  const { regs } = m;
  regs.and(a); // zero test only: leaves the selector alone, sets zero from it, clears carry
  regs.hl = selectPlayerIndicatorColumnBase(a);
}
