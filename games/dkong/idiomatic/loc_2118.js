// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2118 — ROM 0x2118. One object record; a split on its vertical position choosing between
 * two ways of setting up the record's next ballistic arc.
 *
 * Below 224 this routine touches nothing at all and hands straight to the still-frozen routine
 * at ROM 0x2146, which computes the setup there. At 224 or above it installs a FIXED setup
 * itself and hands to the still-frozen routine at ROM 0x2153. Both arms converge on that same
 * tail, which clears the record's +20, +4 and +6 — the field stepBallisticMotion counts an
 * arc's frames in, and the two position fractions it carries the sub-pixel remainder in. That
 * convergence, and those two fields, are what "next arc" rests on; nothing here was read off
 * a running game.
 *
 * NOT SETTLED: ROM 0x2407 reads that same +20 as a packed pair of nibbles rather than as a
 * counter, so the field has two readings in the frozen tree and this routine does not
 * adjudicate between them.
 *
 * Reads: OBJ_Y (+5) — the split — and OBJ_SPRITE_CODE (+7).
 * Writes, on the 224-and-above arm only and in this order: OBJ_SPRITE_CODE (+7) with its
 * low two bits forced to 01; +1 and +2 cleared; the horizontal velocity (+16 high, +17
 * low) set to -256; the launch vertical speed (+18 high, +19 low) set to 176; +14 set
 * to 1.
 *
 * THE TWO 16-BIT FIELDS ARE NAMED FROM A GATED SIBLING, NOT FROM THIS BODY.
 * stepBallisticMotion (ROM 0x239C) reads +16/+17 as the horizontal velocity and +18/+19
 * as the launch vertical speed, each signed with the high byte first — and it runs on THIS
 * record: ROM 0x20EC, the only caller of ROM 0x2118 in the frozen tree, calls it with the
 * same index register a few instructions before reaching here. What +1, +2 and +14 hold was
 * NOT derived. names.js records that +1 carries different roles in different records and
 * names this routine's write to it as one of them, so those three stay bare offsets.
 *
 * SIGNATURE — the record base stays in the index register rather than becoming a parameter.
 * Both tails are still frozen and read that register themselves, so a caller passing a
 * different base would be obeyed by the eight stores here and ignored one call later. It
 * becomes an honest parameter once ROM 0x2146 and ROM 0x2153 are decompiled.
 *
 * THE TAIL DISPATCHES CARRY NO PUSH, which mirrors the oracle exactly: both are `jp` tails
 * there, emitted as a bare dispatch with no return address pushed, so the call-bracket seam
 * correctly sees no bracket of its own. Adding one would unbalance it. The gate compares the
 * FULL state dump including STACK_SCRATCH and the guest stack pointer at the hand-off, which
 * is what holds that claim down.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2118.test.js.
 * GATE:     strict, on real captured dispatches, with the two frozen tails stubbed so the
 *           comparison is of this routine's own head at the hand-off. Every one of the 39
 *           dispatches in a 12000-frame attract run is replayed inline (no sampling), across
 *           all 3 record bases and both arms (34 below / 5 at-or-above), and each is replayed
 *           again under 9 crafted variants built by poking one or two fields of that same real
 *           entry — the exact 223/224 split boundary, which no natural dispatch lands on, and
 *           five sprite-code patterns for the mask. Compared: the ordered write sequence, the
 *           full state dump INCLUDING STACK_SCRATCH, the hand-off registers, the guest stack
 *           pointer, and the return value. Attract only — no gameplay entry.
 *           WHICH CHECK CATCHES WHAT, from the eight twins the gate runs: the write sequence
 *           catches the unmasked sprite code, a dropped store, a re-ordered store and a spurious
 *           push (RAM alone cannot see the re-ordering); the hand-off registers catch the un-zeroed
 *           accumulator, which RAM and the return value both miss; the arm catches the split
 *           off-by-one; the return value catches a dropped tail result; and the stack pointer
 *           catches a stack shift that writes nothing.
 * LIVE-OUT: the tail's return value, propagated; and a zero accumulator into the 224-and-above
 *           tail, which stores it into the record's +20, +4 and +6. Everything else the oracle
 *           leaves is dead, MEASURED not assumed: poisoning the accumulator and the flags on
 *           entry to ROM 0x2146 (5 hits) and the flags on entry to ROM 0x2153 (6 hits) leaves a
 *           4000-frame attract trace byte-identical, while the control — poisoning the
 *           accumulator into ROM 0x2153, the one value claimed live — diverges at frame 622,
 *           the frame of the first dispatch. The gate re-runs the whole-attract check with this
 *           routine wired live and asserts its dispatch count against an independent count.
 * NAMES:    OBJ_Y (+5) and OBJ_SPRITE_CODE (+7) from names.js. The record base is OBJ_ARRAY_67
 *           in every dispatch attract produces (records 0, 1 and 3), but the base arrives in a
 *           register and this routine does not name it. The remaining offsets have no
 *           record-relative name in names.js and stay bare, as in stepBallisticMotion.
 */

import { OBJ_SPRITE_CODE, OBJ_Y } from "./names.js";

/** The vertical position that divides the two arms. */
const Y_SPLIT = 224;

export function loc_2118(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  // Below the split the record's own state drives what happens next, and none of it is
  // decided here.
  if (mem8[record + OBJ_Y] < Y_SPLIT) return m.call(0x2146);

  // At or past it, a fixed launch state goes into the record.
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255; // horizontal velocity = -256, high byte first
  mem8[record + 17] = 0;
  mem8[record + 18] = 0; // launch vertical speed = 176, high byte first
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;

  // The frozen tail stores the accumulator into three of the record's fields, so it is set
  // here for that reason alone; the line goes away when that tail is decompiled.
  m.regs.a = 0;
  return m.call(0x2153);
}
