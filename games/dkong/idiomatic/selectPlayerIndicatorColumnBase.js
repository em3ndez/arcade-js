// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerIndicatorColumnBase — pick one of two video-RAM column-base addresses from a player
 * selector.  ROM 0x0347.
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
 * LIVE-OUT: memory-only for the pure function — the returned column-base address (a
 *           video-RAM pointer the caller writes indicator tiles through). The wired
 *           address lands it in HL; see the seam entry below.
 * NAMES:    none — a pure map of a register input to a fixed address; references no RAM
 *           cell. The two returned values are video-RAM column bases (0x74e0, 0x7740),
 *           not work RAM, so they have no names.js name.
 */
export function selectPlayerIndicatorColumnBase(playerSelector) {
  // Zero selects the player-1 column base; any nonzero value selects the player-2 base.
  return playerSelector === 0 ? 0x7740 : 0x74e0;
}

/**
 * The SEAM ENTRY for ROM 0x0347 — `ROUTINES[0x0347].entry`, the export the override
 * resolvers wire. The seam dispatches an override as `fn(m)`, so the address needs a
 * machine-shaped entry point; the pure function above keeps its own shape for the direct
 * idiomatic callers and for the exhaustive gate.
 *
 * ABI, read off the frozen oracle (translated/loc_0347.js, ROM 0x0347-0x034F):
 *
 *     0347  21 40 77   ld hl,0x7740
 *     034a  a7         and a          ; A UNCHANGED; Z from A, carry cleared
 *     034b  c8         ret z
 *     034c  21 e0 74   ld hl,0x74e0
 *     034f  c9         ret
 *
 *   IN:   A = the player selector.
 *   OUT:  HL = the column base. F = the flags of `and a`, on BOTH exits (the `ret z`
 *         path leaves them untouched after the test). A is NOT written — `and a` is the
 *         zero test, not an assignment — and the caller depends on that: ROM 0x0315
 *         reaches `inc a` at 0x033E with the selector it loaded BEFORE this call, from
 *         both of its two call sites (0x0320 and 0x033B). Clobbering A here would
 *         corrupt the indicator tile it then stores.
 *   MEM:  nothing. B/C/D/E/IX/IY untouched.
 *
 * This entry is register-exact, flags included: `and a` is one instruction and is
 * replayed as itself, so nothing about the oracle's exit state is dropped.
 */
export function selectPlayerIndicatorColumnBaseFromRegisters(m) {
  const { regs } = m;
  regs.and(regs.a); // 0x034A `and a` — leaves A alone, sets Z from it, clears carry
  regs.hl = selectPlayerIndicatorColumnBase(regs.a);
}
