// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerIndicatorColumnBase — pick one of two video-RAM column-base addresses from a
 * player selector.
 *
 * A tiny selector: given a player index (0 = player 1, anything else = player 2) it returns
 * the base address of that player's on-screen indicator column in the tilemap. Nothing else
 * varies — it is a two-way map from the selector byte to a fixed video-RAM address. The
 * caller stamps the indicator tiles through that base, stepping one tilemap row back per
 * cell, and in a two-player game calls again with the other player's index, so both arms are
 * live.
 *
 * A PURE LEAF: reads only its one input, writes no memory, calls nothing.
 *
 * LIVE-OUT: the returned column-base address, a video-RAM pointer. Writes no work RAM.
 */
export function selectPlayerIndicatorColumnBase(playerSelector) {
  // Zero selects the player-1 column base; any nonzero value selects the player-2 base.
  return playerSelector === 0 ? 0x7740 : 0x74e0;
}

/**
 * The machine-shaped entry point for the same selection. The swap seam dispatches a routine
 * as `fn(m)`, so the address needs an entry that takes the machine; the pure function above
 * keeps its own shape for direct callers.
 *
 * The selector arrives in the accumulator and the chosen column base is left in the register
 * pair callers read it from. The selector itself is NOT overwritten — the zero test only sets
 * the flags from it — and callers depend on that: they go on to use the selector they loaded
 * before the call, and clobbering it would corrupt the indicator tile they then store. The
 * flags of that zero test survive on both exits, and no memory is touched.
 *
 * Register-exact, flags included: the zero test is replayed as itself, so nothing about the
 * exit state is dropped.
 */
export function selectPlayerIndicatorColumnBaseFromRegisters(m) {
  const { regs } = m;
  regs.and(regs.a); // the zero test: leaves the selector alone, sets zero from it, clears carry
  regs.hl = selectPlayerIndicatorColumnBase(regs.a);
}
