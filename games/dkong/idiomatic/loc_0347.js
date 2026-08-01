// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0347 — pick one of two video-RAM column-base addresses from a player selector.  ROM 0x0347.
 *
 * A tiny selector: given a player index (0 = player 1, anything else = player 2) it
 * returns the base address of that player's on-screen indicator column in the tilemap.
 * A zero selector yields the player-1 column base (0x7740); any nonzero selector yields
 * the player-2 column base (0x74e0). Nothing else varies — it is a two-way map from the
 * selector byte to a fixed video-RAM address.
 *
 * Grounding (its sole caller): the every-16th-frame indicator redraw at ROM 0x0315 reads
 * the current-player index and calls this to get the column base, then writes the
 * indicator tiles through it, stepping one tilemap row back per cell. That caller also
 * calls it a second time with the OTHER player's index (the current index's complement)
 * in the two-player case, so the selector genuinely ranges over both players.
 *
 * A PURE LEAF: reads only its one input, writes no memory, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0347.test.js.
 * GATE:     exhaustive — a total function of the one selector byte; returned address vs
 *           oracle over all 256 selector values, plus real captured 0x0347 attract
 *           dispatches (attract is player 1, so the zero arm) and a crafted player-2
 *           (nonzero) arm on a real state. The sweep also asserts the oracle writes no
 *           work RAM, so "memory-equivalent" holds trivially on the empty write set.
 * LIVE-OUT: memory-only — the returned column-base address (a video-RAM pointer the
 *           caller writes indicator tiles through). No live registers/flags; the
 *           oracle's residual accumulator/flags are dead ABI (the whole-machine gate
 *           backstops that).
 * NAMES:    none — a pure map of a register input to a fixed address; references no RAM
 *           cell. The two returned values are video-RAM column bases (0x74e0, 0x7740),
 *           not work RAM, so they have no ram.js name.
 */
export function loc_0347(playerSelector) {
  // Zero selects the player-1 column base; any nonzero value selects the player-2 base.
  return playerSelector === 0 ? 0x7740 : 0x74e0;
}
