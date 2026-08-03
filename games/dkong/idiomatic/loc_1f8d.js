// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f8d — step the object walk on to the next slot, and keep walking while slots remain.
 * ROM 0x1F8D.
 *
 * The walk starts at ROM 0x1F72 and runs only while BOARD is 1 (25m): ten OBJ_ARRAY_67
 * records, stride 32, each staging one 4-byte record into ACTOR_SPRITES. This routine is the
 * step the walk takes BETWEEN slots — finish the staging cursor's move onto the next
 * ACTOR_SPRITES record, move the object cursor on by one record, drop the remaining-slot
 * count, and go round again while any are left. Everything else in that cluster is still the
 * frozen oracle, so both cursors and the count are still carried in registers and the
 * loop-back is a call into ROM 0x1F83 rather than a JS loop.
 *
 * WHERE THE CURSORS ARE, checked rather than assumed. On entry the staging cursor sits on the
 * last byte of the record for slot 10-remaining, and this routine's step lands it on the first
 * byte of the next one: ACTOR_SPRITES + 4*(10-remaining) in, ACTOR_SPRITES + 4*(11-remaining)
 * out. That is the same arithmetic ram.js records for RENDER_DST_PTR from the OTHER producer
 * of these records — a derivation that could have come out differently and did not — and the
 * gate measures it across every distinct entry shape those attract dispatches produce: the
 * staging cursor takes exactly the ten values 0x6983-0x69A7 against remaining 10 down to 1, and
 * the object cursor exactly the ten OBJ_ARRAY_67 record bases.
 *
 * TWO ENTRIES, which is why this is its own routine and not the tail of ROM 0x1F83. The
 * per-slot check at 0x1F83 falls in here having already moved the staging cursor three times
 * for a slot it skipped; the shared sprite-record tail at 0x21BA jumps in here having moved it
 * three times between its four field writes. Either way this supplies the fourth and last
 * move, so the cursor arrives on a record boundary from both directions.
 *
 * WHAT THIS FILE DOES NOT CLAIM: the routine reads and writes no memory at all, so what the
 * object records HOLD and what the staged bytes MEAN are not derivable here and nothing above
 * rests on a reading of them. The record layout belongs to the per-slot dispatch at ROM 0x1F93
 * and the field layout to the shared tail at ROM 0x21BA; neither was grounded for this file.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f8d.test.js.
 * GATE:     captured, ATTRACT ONLY — 0x1F8D needs no input and the gate MEASURES its reach:
 *           15320 real dispatches in 3000 attract frames. Cloning all of those is not
 *           affordable, so the run records a cheap entry shape for every dispatch and clones
 *           the FIRST at each distinct one — 95 clones, ALL of them replayed, so the sample
 *           covers every shape seen by construction rather than by a stride. Asserted
 *           coverage: all ten remaining-slot values, all ten record bases, both carry-in
 *           states, and the staging cursor exactly where the arithmetic above puts it. The
 *           rewrite is installed in the replaying machine's registry, so one replay drives the
 *           WHOLE remaining walk through it — 611 loop-backs and 117 staged records across the
 *           95 replays, reaching four of the five arms the active-slot dispatch can pick (ROM
 *           0x1FAC, 0x1FE5, 0x1FEF, 0x2053). The fifth (0x20EC) needs a record byte attract never produces here and
 *           rests on derivation alone. One crafted arm covers the other thing attract cannot
 *           produce: a staging cursor whose step wraps its page. Credited gameplay, boards 2-4
 *           and two-player are NOT covered. Teeth: dropped staging step, dropped object step,
 *           full-width staging step (escapes every natural capture and is caught by the
 *           crafted one — both halves asserted), inverted loop test, and a spurious return
 *           value that only the return half of the contract can catch.
 * LIVE-OUT: memory-only, plus the propagated return value — no register and no flag. Derived:
 *           `m.call(0x1f8d)` has exactly TWO call sites in translated/, ROM 0x1F83 and 0x21BA,
 *           and both are `return m.call(...)` tails that read nothing back; following the chain
 *           out (0x1F83 <- 0x1F72, also a tail) reaches the one real caller, the per-frame
 *           cascade at ROM 0x197A, whose next act is a call to ROM 0x2C8F — and that routine
 *           loads a constant before it tests anything. Inside the loop the same holds one level
 *           down: the per-slot check reloads and re-tests before each branch, and every arm the
 *           active-slot dispatch can pick overwrites the working value before reading it (ROM
 *           0x1FAC directly; 0x1FE5 and 0x1FEF through 0x1FF6; 0x2053 and 0x20EC through
 *           0x239C). Measured twice: the gate forces the flag the object step would have left,
 *           both ways, across every capture, and no RAM byte moves; and wired live for a
 *           1500-frame attract run against the all-oracle baseline — with the oracle's own
 *           instruction cost restored inside the override so the interrupt phase is unchanged —
 *           the per-frame trace is identical, on RAM minus STACK_SCRATCH and in fact on raw
 *           frame equality too. So the flag plumbing the oracle threads through both steps is
 *           dropped here rather than reproduced.
 * NAMES:    none imported — this routine touches no memory, so it names no ram.js cell in code
 *           (BOARD, OBJ_ARRAY_67, ACTOR_SPRITES and RENDER_DST_PTR are named above only to say
 *           where the walk runs). The one m.call is ROM 0x1F83, still frozen: it is in the same
 *           mutually-recursive cluster, being decompiled concurrently.
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
