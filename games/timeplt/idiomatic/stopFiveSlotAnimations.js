import { CRAFT_RECORD_SLOT0 } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/** stopFiveSlotAnimations — while the byte a caller points at still reads zero, stop five consecutive records
 * at a fixed base: each is given the same shape byte and has its step timer cleared. A non-zero
 * byte means nothing at all is touched, so this is a guarded reset and not a step, and the guard
 * byte is the caller's while the five records are this routine's own. LIVE-OUT: the ten bytes, and the record cursor in IX. */

const RECORD_STRIDE = 16;
const RECORDS = 5;
const SHAPE_BYTE = 8;
const STEP_TIMER = 9;
const RESTING_SHAPE = 17;

export function stopFiveSlotAnimations(m) {
  const { mem8, regs } = m;
  if (mem8[regs.hl] !== 0) return;

  for (let i = 0; i < RECORDS; i++) {
    const record = CRAFT_RECORD_SLOT0 + i * RECORD_STRIDE;
    mem8[record + SHAPE_BYTE] = RESTING_SHAPE;
    mem8[record + STEP_TIMER] = 0;
  }
  regs.ix = CRAFT_RECORD_SLOT0 + RECORDS * RECORD_STRIDE;
}
