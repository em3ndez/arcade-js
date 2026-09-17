// SPDX-License-Identifier: GPL-3.0-only
/** stopFiveSlotAnimations — while the byte a caller points at still reads zero, stop five consecutive records
 * at a fixed base: each is given the same shape byte and has its step timer cleared. A non-zero
 * byte means nothing at all is touched, so this is a guarded reset and not a step, and the guard
 * byte is the caller's while the five records are this routine's own. The guard byte is tested with
 * a logical AND against itself, which leaves it in the accumulator with the logical flags; the reset
 * loop counts a counter down to zero, walks a stride register, and steps the record cursor five
 * strides on. LIVE-OUT: the ten bytes; the record cursor; the guard byte and its test flags on the
 * skipped path, or the settled accumulator, counter, stride and flags on the reset path. */

import { CRAFT_RECORD_SLOT0 } from "./names.js";
import { F_S, F_Z, F_H, F_PV, F_F3, F_F5 } from "../../../core/cpu/z80.js";

const RECORD_STRIDE = 16;
const RECORDS = 5;
const SHAPE_BYTE = 8;
const STEP_TIMER = 9;
const RESTING_SHAPE = 17;

// AND-ing the guard byte with itself: sign, zero and the two high copies from the byte, its even
// parity, half-carry always raised, carry and subtract cleared.
function guardFlags(v) {
  let p = v ^ (v >> 4);
  p ^= p >> 2;
  p ^= p >> 1;
  return (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5)) | F_H | (p & 1 ? 0 : F_PV);
}

// When the five records settle: the zero guard's sign, zero and parity are carried through the loop
// untouched, and the half-carry, carry and high copies are those the final stride add leaves — the
// last cursor step carries out of neither nibble nor word, and the result's high byte sets both
// high copies while leaving sign clear.
const SETTLED_FLAGS = F_Z | F_PV | F_F3 | F_F5;

export function stopFiveSlotAnimations(m, guardAddr = m.regs.hl) {
  const { mem8, regs } = m;
  const guard = mem8[guardAddr];
  if (guard !== 0) return (regs.a = guard, regs.f = guardFlags(guard), undefined);

  for (let i = 0; i < RECORDS; i++) {
    const record = CRAFT_RECORD_SLOT0 + i * RECORD_STRIDE;
    mem8[record + SHAPE_BYTE] = RESTING_SHAPE;
    mem8[record + STEP_TIMER] = 0;
  }
  return (regs.a = 0, regs.f = SETTLED_FLAGS, regs.b = 0, regs.de = RECORD_STRIDE, regs.ix = CRAFT_RECORD_SLOT0 + RECORDS * RECORD_STRIDE, undefined);
}
