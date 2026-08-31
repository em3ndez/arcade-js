// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { FORMATION_TABLE } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { loc_3cae } from "./loc_3cae.js";
/**
 * spawnFormationChildIntoFreeSlotOnTimer — object state-7 handler: tick animation, then periodically spawn a child.
 *
 * Advances the parent's animation and counts down its frame timer, returning until it elapses.
 * On elapse it walks the four formation records (stride 0x18), asking the spawn helper to seat a
 * child into the first free slot; the helper returns false once it launches one, aborting the
 * scan. If all four were occupied, the timer is reseeded. LIVE-OUT: none (a dispatched handler).
 */

const TIMER_FIELD = 0x11; // parent frame-timer field
const TIMER_RELOAD = 0x10; // timer value reseeded after a full, no-launch scan
const RECORD_STRIDE = 0x18; // formation-record stride
const RECORD_COUNT = 0x04; // formation records scanned

export function spawnFormationChildIntoFreeSlotOnTimer(m, parent = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, parent); // advance the parent's animation
  mem8[parent + TIMER_FIELD] = u8(mem8[parent + TIMER_FIELD] - 1);
  if (mem8[parent + TIMER_FIELD] !== 0) return; // timer not elapsed

  let record = FORMATION_TABLE;
  for (let n = RECORD_COUNT; n > 0; n--) {
    if (!loc_3cae(m, record, parent)) return; // launched -> abort the scan
    record = u16(record + RECORD_STRIDE);
  }
  mem8[parent + TIMER_FIELD] = TIMER_RELOAD; // no launch this frame -> reseed the timer
}
