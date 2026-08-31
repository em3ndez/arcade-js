// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { SOUND_ID_LATCH_8D1D, ARM_ANIM_TABLE } from "./names.js";
/**
 * descendObjectToLanding — per-object descent step for the record at IX.
 *
 * The animation stepper runs first, then the position (+3) advances by the signed step (+0x0a),
 * borrowing one from the sub-position (+4) when the position is below -(step). While the
 * sub-position is still >= 3 the object is mid-travel and returns. On landing it latches (+0x17)+1
 * as a sound id, resets the object (phase 2, 0x18 dwell), and tails (a word-table lookup by +0x17,
 * then setActorAnimation) into its landing animation.
 *
 * LIVE-OUT: none — a void object step; all effect lands in the record and the sound-id latch.
 */
export function descendObjectToLanding(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  const step = mem8[rec + 0x0a]; // signed descent step
  const pos = mem8[rec + 0x03];
  if (pos < u8(-step)) mem8[rec + 0x04] = u8(mem8[rec + 0x04] - 1); // borrow
  mem8[rec + 0x03] = u8(pos + step);

  if (mem8[rec + 0x04] >= 0x03) return; // still travelling

  const soundId = mem8[rec + 0x17];
  mem8[SOUND_ID_LATCH_8D1D] = u8(soundId + 1); // notify: landing sound id + 1
  mem8[rec + 0x02] = 0x02; // reset to phase 2
  mem8[rec + 0x11] = 0x18;
  const word = fetchWordFromTableIndex(m, soundId, ARM_ANIM_TABLE); // landing animation pointer
  return setActorAnimation(m, rec, word);
}
