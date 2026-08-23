// SPDX-License-Identifier: GPL-3.0-only
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";
import {
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD1_VRAM,
  SUBSTATE_FIELD2_VRAM,
  SUBSTATE_FIELD3_VRAM,
  SUBSTATE_FIELD3_HUNDREDS_VRAM,
} from "./names.js";
/**
 * loc_10c2 — adjust a counter and repaint a three-field BCD display. The counter is walked toward its
 * new value: up while the entry carry was set, down otherwise, one step at a time until the signed
 * adjustment reaches zero. The new counter is stored and drawn (doubled) as field 1. Field 2 draws a
 * second value directly when it is a single digit, otherwise re-encoded to packed BCD. Field 3, when
 * its source is nonzero, folds that source into the counter and draws it doubled, mirroring the
 * hundreds digit out when nonzero. Finally the main-loop sub-state is advanced and a sound cue queued.
 *
 * LIVE-OUT: HL — the sub-state selector address, left by the closing increment (the sound-cue append
 * preserves HL); and A — the ring cursor that append leaves, flowing out through the tail call. Both
 * are set through the return-assignment bridge so a register-dispatched caller reads them back.
 */
const SINGLE_DIGIT = 0x0a; // field-2 values below this are already a valid single BCD digit

export function loc_10c2(m, counter = m.regs.b, adjust = m.regs.a, dirUp = m.regs.fC) {
  const { mem8 } = m;

  // Walk the counter and the adjustment together until the adjustment reaches zero.
  if (dirUp) {
    do { counter = (counter + 1) & 0xff; adjust = (adjust + 1) & 0xff; } while (adjust !== 0);
  } else {
    do { counter = (counter - 1) & 0xff; adjust = (adjust - 1) & 0xff; } while (adjust !== 0);
  }

  // Field 1: store the new counter, draw double its value.
  mem8[SUBSTATE_FIELD1_COUNTER] = counter;
  drawStackedBcdDigits(m, SUBSTATE_FIELD1_VRAM, binToPackedBcd(m, (counter << 1) & 0xff).a);

  // Field 2: a single-digit value draws as-is; ten or more is re-encoded to packed BCD.
  const value2 = mem8[SUBSTATE_FIELD2_VALUE];
  const field2 = value2 < SINGLE_DIGIT ? value2 : binToPackedBcd(m, value2).a;
  drawStackedBcdDigits(m, SUBSTATE_FIELD2_VRAM, field2);

  // Field 3: present only when its source is nonzero.
  const value3 = mem8[SUBSTATE_FIELD3_VALUE];
  if (value3 !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = mem8[SUBSTATE_FIELD1_COUNTER] + value3; // fold into the counter
    const { a: field3, hundreds } = binToPackedBcd(m, (value3 << 1) & 0xff);
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM, field3);
  }

  mem8[MAINLOOP_SUBSTATE_SELECTOR] = mem8[MAINLOOP_SUBSTATE_SELECTOR] + 1; // advance the sub-state
  // HL live-out = the selector address; A live-out = the ring cursor the append leaves.
  return [(m.regs.hl = MAINLOOP_SUBSTATE_SELECTOR), queueSoundCommand13(m)];
}
