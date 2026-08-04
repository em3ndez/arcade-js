// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f8d — step the object walk on to the next slot, and keep walking while slots remain.
 *
 * The walk this belongs to runs only while BOARD is 1 (25m): ten object records, one 32-byte
 * stride apart, each staging one 4-byte record into ACTOR_SPRITES. This routine is the step
 * the walk takes BETWEEN slots — finish the staging cursor's move onto the next
 * ACTOR_SPRITES record, move the object cursor on by one record, drop the remaining-slot
 * count, and go round again while any are left. The two cursors and the count are carried in
 * registers, so the loop-back re-enters the per-slot check rather than looping in JS.
 *
 * WHERE THE CURSORS ARE, checked rather than assumed. On entry the staging cursor sits on the
 * LAST byte of the record for the slot just handled, and this routine's step lands it on the
 * FIRST byte of the next one: ACTOR_SPRITES + 4*(10 − remaining) in, ACTOR_SPRITES +
 * 4*(11 − remaining) out. Across a whole walk the staging cursor therefore takes exactly ten
 * consecutive record positions as the count runs 10 down to 1, and the object cursor takes
 * exactly the ten record bases.
 *
 * TWO ENTRIES, which is why this is a routine of its own rather than the tail of the per-slot
 * check. The per-slot check arrives here having already moved the staging cursor three times
 * for a slot it SKIPPED; the shared sprite-record tail arrives here having moved it three
 * times between its four field writes. Either way this supplies the fourth and last move, so
 * the cursor lands on a record boundary from both directions.
 *
 * Only the staging cursor's LOW byte is stepped, so the move can never carry it out of the
 * page it sits in.
 *
 * WHAT THIS FILE DOES NOT CLAIM: the routine reads and writes no memory at all, so what the
 * object records HOLD and what the staged bytes MEAN are not derivable here, and nothing
 * above rests on a reading of them.
 *
 * LIVE-OUT: memory-only (it writes none), plus the propagated return value. No register and
 * no flag is live: every consumer of the two stepped cursors reloads and re-tests before it
 * branches, so the flags the two steps would leave behind are dropped rather than reproduced.
 */

export function loc_1f8d(m) {
  const { regs } = m;

  // The fourth and last move of the staging cursor for this slot, onto the first byte of the
  // next record. Only the cursor's low byte moves, so it can never leave the page it is in.
  regs.l = regs.l + 1;

  // On to the next object record, one stride along.
  regs.ix = regs.ix + regs.de;

  // One fewer slot to visit; go round again while any remain.
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(0x1f83);
}
