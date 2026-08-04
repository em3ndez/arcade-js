// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2118 — one object record; a split on its vertical position choosing between two ways of
 * setting up the record's next ballistic arc.
 *
 * Below 224 this routine touches nothing at all and hands straight on to a continuation that
 * computes the setup there. At 224 or above it installs a FIXED setup itself and hands to a
 * different continuation. Both arms converge on the same tail, which clears the record's +20,
 * +4 and +6 — the field the ballistic integrator counts an arc's frames in, and the two
 * position fractions it carries the sub-pixel remainder in. That convergence, and those two
 * fields, are what "next arc" rests on; nothing here was read off a running game.
 *
 * NOT SETTLED: elsewhere that same +20 is read as a packed pair of nibbles rather than as a
 * counter, so the field has two readings in the code and this routine does not adjudicate
 * between them.
 *
 * Reads: OBJ_Y (+5) — the split — and OBJ_SPRITE_CODE (+7).
 * Writes, on the 224-and-above arm only and in this order: OBJ_SPRITE_CODE (+7) with its
 * low two bits forced to 01; +1 and +2 cleared; the horizontal velocity (+16 high, +17
 * low) set to -256; the launch vertical speed (+18 high, +19 low) set to 176; +14 set
 * to 1.
 *
 * THE TWO 16-BIT FIELDS ARE NAMED FROM THEIR CONSUMER, NOT FROM THIS BODY. The ballistic
 * integrator reads +16/+17 as the horizontal velocity and +18/+19 as the launch vertical
 * speed, each signed with the high byte first — and it runs on THIS record, which the sole
 * caller loads into the same index register a few instructions before reaching here. What +1,
 * +2 and +14 hold was NOT derived: +1 carries different roles on different record arrays, so
 * all three stay bare offsets.
 *
 * SIGNATURE — the record base stays in the index register rather than becoming a parameter,
 * because both continuations read that register themselves; a caller passing a different base
 * would be obeyed by the eight stores here and ignored one call later.
 *
 * LIVE-OUT: the tail's return value, propagated; and a zero accumulator into the
 * 224-and-above tail, which stores it into the record's +20, +4 and +6.
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

  // The tail stores the accumulator into three of the record's fields, so it is set here
  // for that reason alone.
  m.regs.a = 0;
  return m.call(0x2153);
}
